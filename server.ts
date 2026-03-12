// Central data directory (for subscriptions, etc.)
const DATA_DIR = process.env.DATA_DIR || import.meta.dir + "/data";

// In non-production (local dev), load .env from project root
if (process.env.NODE_ENV !== "production") {
  try {
    const envPath = import.meta.dir + "/.env";
    const file = Bun.file(envPath);
    const exists = await file.exists();
    if (exists) {
      const text = await file.text();
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    }
  } catch {
    // Ignore local .env errors; rely on real env vars
  }
}

const BASE_URL = "https://redalert.orielhaim.com";

// Optional: Red Alert stats API now requires a key (see redalert.md). Get one via the dashboard.
const REDALERT_API_KEY = process.env.REDALERT_API_KEY || "";

function redAlertFetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (REDALERT_API_KEY) {
    headers["Authorization"] = `Bearer ${REDALERT_API_KEY}`;
  }
  return fetch(url, { headers });
}

// ---------------------------------------------------------------------------
// VAPID / Web Push helpers (no third-party libraries)
// ---------------------------------------------------------------------------

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:alert@suwayda.example.com";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("❌ Missing VAPID keys! Generate them and add to .env");
  console.error("   See README for instructions.");
  process.exit(1);
}

// --- base64url helpers ---
function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- VAPID JWT ---
async function createVapidJwt(audience: string, expSeconds: number = 12 * 3600): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + expSeconds,
    sub: VAPID_SUBJECT,
  };

  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import the private key
  const rawPrivate = base64urlDecode(VAPID_PRIVATE_KEY);
  const rawPublic = base64urlDecode(VAPID_PUBLIC_KEY);

  // Build JWK for P-256
  // private key is 32 bytes (d), public key is 65 bytes (04 + x + y)
  const x = base64urlEncode(rawPublic.slice(1, 33));
  const y = base64urlEncode(rawPublic.slice(33, 65));
  const d = base64urlEncode(rawPrivate);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsigned)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(sig);
  let rawSig: Uint8Array;

  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // WebCrypto on some platforms returns raw r||s, on others DER
    // Bun returns raw 64-byte, but handle DER just in case
    rawSig = sigBytes;
  }

  const sigB64 = base64urlEncode(rawSig);
  return `${unsigned}.${sigB64}`;
}

// --- Encrypt push payload (RFC 8291 — aes128gcm) ---
async function encryptPayload(
  subscription: PushSubscription,
  payload: Uint8Array
): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  const clientPublicKey = base64urlDecode(subscription.keys.p256dh);
  const authSecret = base64urlDecode(subscription.keys.auth);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export the local public key (raw, 65 bytes)
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeyPair.privateKey,
      256
    )
  );

  const enc = new TextEncoder();

  // HKDF-based key derivation (RFC 8291)
  async function hkdf(
    salt: Uint8Array,
    ikm: Uint8Array,
    info: Uint8Array,
    length: number
  ): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length ? salt : new Uint8Array(32)));
    // Expand
    const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

    // Actually: HKDF-Extract then HKDF-Expand
    // Re-do properly:
    // Extract
    const saltKey = await crypto.subtle.importKey(
      "raw",
      salt.length ? salt : new Uint8Array(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const prkProper = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

    // Expand
    const prkKey2 = await crypto.subtle.importKey(
      "raw",
      prkProper,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const infoWithCounter = new Uint8Array(info.length + 1);
    infoWithCounter.set(info);
    infoWithCounter[info.length] = 1;
    const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey2, infoWithCounter));
    return okm.slice(0, length);
  }

  // Build info strings per RFC 8291
  function createInfo(type: string, clientPub: Uint8Array, serverPub: Uint8Array): Uint8Array {
    const typeEnc = enc.encode(`Content-Encoding: ${type}\0`);
    const prefix = enc.encode("P-256\0");

    const info = new Uint8Array(
      typeEnc.length + prefix.length + 2 + clientPub.length + 2 + serverPub.length
    );
    let offset = 0;
    info.set(typeEnc, offset); offset += typeEnc.length;
    info.set(prefix, offset); offset += prefix.length;
    // Client public key length (2 bytes BE) + key
    info[offset++] = 0;
    info[offset++] = clientPub.length;
    info.set(clientPub, offset); offset += clientPub.length;
    // Server public key length (2 bytes BE) + key
    info[offset++] = 0;
    info[offset++] = serverPub.length;
    info.set(serverPub, offset);

    return info;
  }

  // IKM for the PRK
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const prk = await hkdf(authSecret, sharedSecret, authInfo, 32);

  // Derive content encryption key and nonce
  const contentInfo = createInfo("aesgcm", clientPublicKey, localPublicKeyRaw);
  const nonceInfo = createInfo("nonce", clientPublicKey, localPublicKeyRaw);

  const contentKey = await hkdf(prk, sharedSecret, contentInfo, 16);

  // Simpler approach: use aesgcm encoding (older but widely supported)
  // Actually, let's use aes128gcm (RFC 8291) which is what modern browsers expect

  // For aes128gcm, the info derivation is simpler:
  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const nonceInfoSimple = enc.encode("Content-Encoding: nonce\0");

  const ikm = await hkdf(authSecret, sharedSecret, enc.encode("WebPush: info\0" + String.fromCharCode(...clientPublicKey) + String.fromCharCode(...localPublicKeyRaw)), 32);

  // Actually, let me use a cleaner RFC 8291 implementation:
  // Step 1: IKM
  const ikmInfo = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...clientPublicKey,
    ...localPublicKeyRaw,
  ]);
  const ikm2 = await hkdf(authSecret, sharedSecret, ikmInfo, 32);

  // Step 2: salt (random 16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Step 3: CEK and nonce from ikm2 using salt
  const cek = await hkdf(salt, ikm2, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm2, enc.encode("Content-Encoding: nonce\0"), 12);

  // Step 4: Pad the plaintext (add a delimiter byte 0x02 and optional padding)
  const padded = new Uint8Array(payload.length + 1);
  padded.set(payload);
  padded[payload.length] = 2; // delimiter

  // Step 5: Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  // Step 6: Build the aes128gcm content body
  // Header: salt (16) + rs (4, big-endian uint32) + idlen (1) + keyid (65 = local public key)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0);
  // rs as big-endian uint32
  header[16] = (rs >> 24) & 0xff;
  header[17] = (rs >> 16) & 0xff;
  header[18] = (rs >> 8) & 0xff;
  header[19] = rs & 0xff;
  // idlen
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);

  return {
    body,
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    },
  };
}

// --- Send push notification ---
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

async function sendPush(subscription: PushSubscription, payload: object): Promise<boolean> {
  try {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await encryptPayload(subscription, payloadBytes);

    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    const jwt = await createVapidJwt(audience);
    const vapidPublicKeyUrlSafe = VAPID_PUBLIC_KEY;

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        ...encrypted.headers,
        Authorization: `vapid t=${jwt}, k=${vapidPublicKeyUrlSafe}`,
        TTL: "86400",
        Urgency: "very-low",
        Topic: "suwayda-alert",
        "Content-Length": String(encrypted.body.length),
      },
      body: encrypted.body,
    });

    if (res.status === 201 || res.status === 200) {
      return true;
    }

    if (res.status === 410 || res.status === 404) {
      // Subscription expired — remove it
      console.log(`[Push] Subscription gone (${res.status}), removing: ${subscription.endpoint.slice(0, 60)}...`);
      removeSubscription(subscription.endpoint);
      return false;
    }

    console.error(`[Push] Unexpected status ${res.status}: ${await res.text()}`);
    return false;
  } catch (err: any) {
    console.error(`[Push] Send error:`, err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Subscription storage (in-memory + file persistence)
// ---------------------------------------------------------------------------
const SUBS_FILE = DATA_DIR + "/subscriptions.json";
let subscriptions: PushSubscription[] = [];

function loadSubscriptions() {
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.dirname(SUBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(SUBS_FILE) && fs.statSync(SUBS_FILE).size > 0) {
      const data = JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
      subscriptions = Array.isArray(data) ? data : [];
      console.log(`[Push] Loaded ${subscriptions.length} subscriptions from disk`);
    }
  } catch {
    subscriptions = [];
  }
}

function saveSubscriptions() {
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.dirname(SUBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (err: any) {
    console.error("[Push] Failed to save subscriptions:", err.message);
  }
}

function addSubscription(sub: PushSubscription) {
  const exists = subscriptions.some((s) => s.endpoint === sub.endpoint);
  if (!exists) {
    subscriptions.push(sub);
    saveSubscriptions();
    console.log(`[Push] New subscription (total: ${subscriptions.length})`);
  } else {
    // Update keys if changed
    const idx = subscriptions.findIndex((s) => s.endpoint === sub.endpoint);
    subscriptions[idx] = sub;
    saveSubscriptions();
  }
}

function removeSubscription(endpoint: string) {
  subscriptions = subscriptions.filter((s) => s.endpoint !== endpoint);
  saveSubscriptions();
}

loadSubscriptions();

// Broadcast push to all subscribers
async function broadcastPush(payload: object) {
  console.log(`[Push] Broadcasting to ${subscriptions.length} subscribers...`);
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPush(sub, payload))
  );
  const success = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failed = results.length - success;
  console.log(`[Push] Sent: ${success} ok, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AlertCity {
  id: number;
  name: string;
}

interface AlertRecord {
  id: number;
  timestamp: string;
  type: string;
  origin: string | null;
  cities: AlertCity[];
}

interface HistoryResponse {
  data: AlertRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface AlertState {
  lastNewsFlashTime: number | null;
  activeAlert: "none" | "early" | "full";
  activeAlertTime: number | null;
  lastSeenAlertId: number | null;
  recentAlerts: AlertRecord[];
  lastPollTime: number | null;
  error: string | null;
}

const state: AlertState = {
  lastNewsFlashTime: null,
  activeAlert: "none",
  activeAlertTime: null,
  lastSeenAlertId: null,
  recentAlerts: [],
  lastPollTime: null,
  error: null,
};

const NEWS_FLASH_WINDOW_MS = 20 * 60 * 1000;
const ALERT_AUTO_CLEAR_MS = 5 * 60 * 1000; // return to normal after 5 min in alert
const GOLAN_ZONES = ["רמת הגולן"];

// Track what we last pushed so we don't spam
let lastPushedLevel: string = "none";
let lastPushedTime: number = 0;
const PUSH_COOLDOWN_MS = 60 * 1000; // don't re-push same level within 60s

// ---------------------------------------------------------------------------
// Polling logic
// ---------------------------------------------------------------------------
function runAutoClear() {
  if (
    state.activeAlert !== "none" &&
    state.activeAlertTime &&
    Date.now() - state.activeAlertTime > ALERT_AUTO_CLEAR_MS
  ) {
    console.log(`[${new Date().toISOString()}] ✅ Alert auto-cleared`);
    state.activeAlert = "none";
    state.activeAlertTime = null;
    lastPushedLevel = "none";
  }
  if (
    state.lastNewsFlashTime !== null &&
    Date.now() - state.lastNewsFlashTime > NEWS_FLASH_WINDOW_MS
  ) {
    state.lastNewsFlashTime = null;
  }
}

async function pollAlerts() {
  try {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const allUrl = `${BASE_URL}/api/stats/history?startDate=${encodeURIComponent(twoMinAgo)}&endDate=${encodeURIComponent(now)}&limit=100&order=desc&sort=timestamp`;
    const allRes = await redAlertFetch(allUrl);
    if (!allRes.ok) {
      state.error = `API error: ${allRes.status}`;
      state.lastPollTime = Date.now();
      runAutoClear();
      return;
    }
    const allData: HistoryResponse = await allRes.json();

    state.lastPollTime = Date.now();
    state.error = null;

    const sorted = [...allData.data].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const previousLevel = state.activeAlert;

    for (const alert of sorted) {
      if (state.lastSeenAlertId !== null && alert.id <= state.lastSeenAlertId) {
        continue;
      }

      const alertTime = new Date(alert.timestamp).getTime();

      const isGolanRelevant = alert.cities.some((c) => {
        const name = c.name || "";
        return GOLAN_ZONES.some((z) => name.includes(z));
      });

      if (alert.type === "newsFlash") {
        console.log(`[${new Date().toISOString()}] 📰 newsFlash detected: ${alert.id}`);
          console.log(alert)
        state.lastNewsFlashTime = alertTime;
        state.activeAlert = "early";
        state.activeAlertTime = alertTime;
      }

      if (alert.type === "missiles") {
        const newsFlashRecent =
          state.lastNewsFlashTime !== null &&
          alertTime - state.lastNewsFlashTime < NEWS_FLASH_WINDOW_MS;

        if (newsFlashRecent || isGolanRelevant) {
          console.log(
            `[${new Date().toISOString()}] 🚀 MISSILE ALERT! id=${alert.id} origin=${alert.origin} golanRelevant=${isGolanRelevant} newsFlashRecent=${newsFlashRecent}`
          );

          if (newsFlashRecent) {
            state.activeAlert = "full";
            state.activeAlertTime = alertTime;
          } else if (isGolanRelevant && state.activeAlert !== "full") {
            state.activeAlert = "early";
            state.activeAlertTime = alertTime;
          }
        }
      }
    }

    if (sorted.length > 0) {
      const maxId = Math.max(...sorted.map((a) => a.id));
      if (state.lastSeenAlertId === null || maxId > state.lastSeenAlertId) {
        state.lastSeenAlertId = maxId;
      }
    }

    state.recentAlerts = sorted.slice(0, 20);

    // --- SEND PUSH NOTIFICATIONS on state change ---
    if (state.activeAlert !== "none" && state.activeAlert !== previousLevel) {
      const shouldPush =
        state.activeAlert !== lastPushedLevel ||
        Date.now() - lastPushedTime > PUSH_COOLDOWN_MS;

      if (shouldPush && subscriptions.length > 0) {
        const payload =
          state.activeAlert === "full"
            ? {
                title: "🚨 صواريخ! ادخل للملجأ فوراً",
                body: "تم الكشف عن هجوم صاروخي إيراني محتمل — ادخل فوراً لمكان محمي",
                bodyHe: "טילים! היכנסו למרחב מוגן עכשיו!",
                level: "full",
              }
            : {
                title: "⚠️ إنذار مبكر — كن مستعداً",
                body: "تم الكشف عن إنذار مبكر — جهّز نفسك بالقرب من مكان محمي",
                bodyHe: "התראה מוקדמת — היו מוכנים",
                level: "early",
              };

        broadcastPush(payload);
        lastPushedLevel = state.activeAlert;
        lastPushedTime = Date.now();
      }
    }

    runAutoClear();
  } catch (err: any) {
    state.error = `Poll error: ${err.message}`;
    state.lastPollTime = Date.now();
    runAutoClear();
    console.error(`[${new Date().toISOString()}] ❌ Poll error:`, err);
  }
}

setInterval(pollAlerts, 5000);
pollAlerts();

// Run auto-clear on a fixed interval so we return to normal even if API polling hangs
setInterval(runAutoClear, 60 * 1000);

// ---------------------------------------------------------------------------
// Bun HTTP Server
// ---------------------------------------------------------------------------
const PUBLIC_DIR = import.meta.dir + "/public";

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // --- API: current state ---
    if (url.pathname === "/api/state") {
      return new Response(JSON.stringify(state), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    // --- API: VAPID public key ---
    if (url.pathname === "/api/vapid-public-key") {
      return new Response(JSON.stringify({ key: VAPID_PUBLIC_KEY }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- API: subscribe to push ---
    if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
      try {
        const body = await req.json();
        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
          return new Response(JSON.stringify({ error: "Invalid subscription" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        addSubscription({
          endpoint: body.endpoint,
          keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
        });
        return new Response(JSON.stringify({ ok: true, total: subscriptions.length }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // --- API: unsubscribe ---
    if (url.pathname === "/api/push/unsubscribe" && req.method === "POST") {
      try {
        const body = await req.json();
        if (body.endpoint) {
          removeSubscription(body.endpoint);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // --- API: dismiss ---
    if (url.pathname === "/api/dismiss" && req.method === "POST") {
      state.activeAlert = "none";
      state.activeAlertTime = null;
      lastPushedLevel = "none";
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    // /api/test endpoint removed for production

    // --- Dynamic PNG icon generation (from SVG) ---
    if (url.pathname === "/icon-192.png" || url.pathname === "/icon-512.png") {
      const size = url.pathname.includes("192") ? 192 : 512;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
        <rect width="512" height="512" rx="80" fill="#0a1628"/>
        <circle cx="256" cy="240" r="140" fill="none" stroke="#e74c3c" stroke-width="24"/>
        <circle cx="256" cy="240" r="50" fill="#e74c3c"/>
        <rect x="240" y="380" width="32" height="60" rx="8" fill="#e74c3c"/>
        <rect x="240" y="450" width="32" height="32" rx="8" fill="#e74c3c"/>
      </svg>`;
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml" },
      });
    }

    // --- Serve static files ---
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(PUBLIC_DIR + filePath);
    if (await file.exists()) {
      // Service worker must be served with proper scope
      const headers: Record<string, string> = {};
      if (filePath === "/sw.js") {
        headers["Service-Worker-Allowed"] = "/";
        headers["Content-Type"] = "application/javascript";
      }
      return new Response(file, { headers });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🛡️  Suwayda Alert System — Running                          ║
║  🌐  http://localhost:${Number(process.env.PORT) || 3000}    ║
║  📡  Polling RedAlert API every 5 seconds                    ║
║  🔔  Push notifications: ${subscriptions.length} subscribers ║
║  🎯  Monitoring: רמת הגולן (Golan Heights)                   ║
╚══════════════════════════════════════════════════════════════╝
`);
