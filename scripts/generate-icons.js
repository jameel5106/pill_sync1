import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG icon with PillSync blue-to-green gradient & pill glyph
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="pillsync-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E88E5" />
      <stop offset="100%" stop-color="#2E9E6B" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#pillsync-grad)" />
  <g transform="translate(136, 136) scale(10)" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </g>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');

// Also create a maskable SVG with padding
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="pillsync-grad-m" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E88E5" />
      <stop offset="100%" stop-color="#2E9E6B" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#pillsync-grad-m)" />
  <g transform="translate(156, 156) scale(8.3)" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </g>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), maskableSvg, 'utf8');

console.log('Icons generated successfully');
