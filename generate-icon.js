const sharp = require('sharp');
const path = require('path');

async function generateIcon() {
  const size = 256;

  // Create SVG icon - screen scan / OCR theme
  const svg = `
  <svg width="${size}" height="${size}" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0a1628"/>
        <stop offset="100%" style="stop-color:#1a2a4e"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#00ccff"/>
        <stop offset="100%" style="stop-color:#0077ff"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#00aaff" flood-opacity="0.4"/>
      </filter>
      <filter id="innerGlow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <!-- Background rounded square -->
    <rect x="8" y="8" width="240" height="240" rx="48" ry="48" fill="url(#bg)"/>
    <rect x="8" y="8" width="240" height="240" rx="48" ry="48" fill="none" stroke="#1a3a6e" stroke-width="2"/>

    <!-- Scan corners - top left -->
    <path d="M56 72 L56 56 L72 56" fill="none" stroke="url(#glow)" stroke-width="5" stroke-linecap="round" filter="url(#shadow)"/>
    <!-- Scan corners - top right -->
    <path d="M184 56 L200 56 L200 72" fill="none" stroke="url(#glow)" stroke-width="5" stroke-linecap="round" filter="url(#shadow)"/>
    <!-- Scan corners - bottom left -->
    <path d="M56 184 L56 200 L72 200" fill="none" stroke="url(#glow)" stroke-width="5" stroke-linecap="round" filter="url(#shadow)"/>
    <!-- Scan corners - bottom right -->
    <path d="M184 200 L200 200 L200 184" fill="none" stroke="url(#glow)" stroke-width="5" stroke-linecap="round" filter="url(#shadow)"/>

    <!-- Scan line (horizontal sweep) -->
    <rect x="56" y="124" width="144" height="3" rx="1.5" fill="#00aaff" opacity="0.6"/>
    <rect x="56" y="124" width="144" height="2" rx="1" fill="#00ddff" opacity="0.9"/>

    <!-- Text lines representing OCR output -->
    <rect x="76" y="80" width="80" height="6" rx="3" fill="#e0e0e0" opacity="0.9"/>
    <rect x="76" y="96" width="104" height="6" rx="3" fill="#e0e0e0" opacity="0.6"/>
    <rect x="76" y="112" width="60" height="6" rx="3" fill="#e0e0e0" opacity="0.4"/>

    <!-- Text lines below scan -->
    <rect x="76" y="144" width="90" height="6" rx="3" fill="#00aaff" opacity="0.7"/>
    <rect x="76" y="160" width="104" height="6" rx="3" fill="#00aaff" opacity="0.5"/>
    <rect x="76" y="176" width="50" height="6" rx="3" fill="#00aaff" opacity="0.3"/>

    <!-- "T" letter icon on the left side -->
    <text x="46" y="155" font-family="Segoe UI, Arial" font-size="56" font-weight="bold" fill="url(#glow)" text-anchor="middle" filter="url(#shadow)" opacity="0.15">T</text>
  </svg>`;

  // Generate PNG at 256x256
  const png256 = await sharp(Buffer.from(svg)).png().toBuffer();
  await sharp(png256).toFile(path.join(__dirname, 'assets', 'icon-256.png'));

  // Generate 64x64 for tray
  await sharp(png256).resize(64, 64, { kernel: 'lanczos3' }).png().toFile(path.join(__dirname, 'assets', 'tray-icon.png'));

  // Generate 32x32 for small tray
  await sharp(png256).resize(32, 32, { kernel: 'lanczos3' }).png().toFile(path.join(__dirname, 'assets', 'tray-icon-32.png'));

  // Generate 16x16
  await sharp(png256).resize(16, 16, { kernel: 'lanczos3' }).png().toFile(path.join(__dirname, 'assets', 'tray-icon-16.png'));

  // Generate ICO (use 256 as base)
  console.log('Icons generated in assets/');
}

generateIcon().catch(console.error);
