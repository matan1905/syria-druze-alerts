// Run: bun run generate-icons.ts
// Creates SVG icons for the PWA manifest

const sizes = [192, 512];

for (const size of sizes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" rx="80" fill="#0a1628"/>
    <circle cx="256" cy="240" r="140" fill="none" stroke="#e74c3c" stroke-width="24"/>
    <circle cx="256" cy="240" r="50" fill="#e74c3c"/>
    <rect x="240" y="380" width="32" height="60" rx="8" fill="#e74c3c"/>
    <rect x="240" y="450" width="32" height="32" rx="8" fill="#e74c3c"/>
  </svg>`;

  await Bun.write(`public/icon-${size}.svg`, svg);
}

console.log("SVG icons written to public/icon-192.svg and public/icon-512.svg");
