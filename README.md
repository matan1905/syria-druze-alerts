# Suwayda Alert — Iran Missile Early Warning System

This is a real-time alert system designed to warn the Druze community in Suwayda, Syria about incoming Iranian missile attacks. It monitors alerts for the Golan Heights region and distinguishes between Lebanese-origin alerts (less relevant) and Iranian missile attacks (critical).

## How It Works

- **Server-side polling**: A Bun server (`server.ts`) polls the RedAlert API every 5 seconds for alerts in the רמת הגולן (Golan Heights) area.
- **newsFlash logic**: `newsFlash` alerts are treated as early warnings (national pre-alerts) and set the system to an **early** state.
- **missiles + newsFlash window**: If a `missiles` alert occurs within 20 minutes of a `newsFlash`, the system raises a **full** siren, modeling the Iranian attack pattern (Lebanon attacks do not have this early warning).
- **UI**: The web UI (in `public/index.html`) has loud audio sirens using Web Audio API, visual alerts in Arabic, Hebrew, and English, and uses the Wake Lock API plus a near-silent audio fallback to keep the screen awake on mobile.
- **Vibration**: Uses the Vibration API on supported devices to reinforce alerts.

## Project Structure

```text
suwayda-alert/
├── server.ts          # Bun server - serves the site + polls the API
├── public/
│   └── index.html     # The alert page with sounds and wake lock
├── package.json
└── README.md
```

## Prerequisites

- **Bun** installed (`bun` available in your `PATH`). See [`https://bun.sh`](https://bun.sh) for installation instructions.

## Install & Run

```bash
cd suwayda-alert

# (Optional) install dev types
bun install

# Red Alert stats API requires an API key (401 without it). See redalert.md.
# Get a key via https://redalert.orielhaim.com/docs then:
export REDALERT_API_KEY="your-key"

# Start the server
bun run server.ts
```

Then open `http://localhost:3000` in your browser.

## Testing

- **Early warning (newsFlash simulation)**  
  Open `http://localhost:3000/api/test?type=early`

- **Full siren (Iranian missile pattern)**  
  Open `http://localhost:3000/api/test?type=full`

On the UI:

- Click **"🔊 Enable Sound"** once to allow audio (required by browsers).
- Use the **test buttons** at the bottom to trigger early/full alerts from the page.

## Important Notes

- **Do NOT rely solely on this system.** Always use all official warning channels available to you.
- This project depends on the RedAlert API ([`https://redalert.orielhaim.com`](https://redalert.orielhaim.com)). The stats/history endpoint requires an API key; set `REDALERT_API_KEY` in the environment. See `redalert.md` for details.

