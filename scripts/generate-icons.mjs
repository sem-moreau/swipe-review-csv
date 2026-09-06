import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// Icon: rounded square, dark gradient background, two swipe-arrow chevrons
// (left = reject, right = approve) framing a stacked-card glyph.
function svgIcon({ size, maskable = false }) {
  const s = size;
  const r = maskable ? 0 : s * 0.22;
  const cx = s / 2;
  const cy = s / 2;
  const cardW = s * 0.34;
  const cardH = s * 0.46;

  return `
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1f2b"/>
      <stop offset="100%" stop-color="#0b0c10"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>
  <g opacity="0.35">
    <rect x="${cx - cardW / 2 + s * 0.06}" y="${cy - cardH / 2 + s * 0.05}" width="${cardW}" height="${cardH}" rx="${s * 0.045}" fill="#ffffff" transform="rotate(8 ${cx} ${cy})"/>
  </g>
  <rect x="${cx - cardW / 2}" y="${cy - cardH / 2}" width="${cardW}" height="${cardH}" rx="${s * 0.05}" fill="url(#cardGrad)"/>
  <path d="M ${cx - cardW * 0.18} ${cy} l ${cardW * 0.14} ${cardW * 0.16} l ${cardW * 0.24} -${cardW * 0.3}" stroke="#ffffff" stroke-width="${s * 0.028}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${s * 0.14} ${cy} l ${s * 0.09} -${s * 0.055} v ${s * 0.11} z" fill="#f87171" opacity="0.9"/>
  <path d="M ${s * 0.86} ${cy} l -${s * 0.09} -${s * 0.055} v ${s * 0.11} z" fill="#34d399" opacity="0.9"/>
</svg>`;
}

const targets = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-16x16.png', size: 16 },
];

for (const t of targets) {
  const svg = svgIcon({ size: t.size, maskable: t.maskable });
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(publicDir, t.file));
  console.log('wrote', t.file);
}

// favicon.svg for modern browsers
const fs = await import('node:fs/promises');
await fs.writeFile(path.join(publicDir, 'favicon.svg'), svgIcon({ size: 64 }));
console.log('wrote favicon.svg');
