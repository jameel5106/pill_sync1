import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.join(__dirname, '../public/icons');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function generatePillSyncPng(size, isMaskable = false) {
  const width = size;
  const height = size;

  // Raw image data: filter byte (0) + width * 4 bytes per row
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: none
    const t = y / height;
    // Gradient: #1E88E5 (30, 136, 229) to #2E9E6B (46, 158, 107)
    const r = Math.round(30 + t * (46 - 30));
    const g = Math.round(136 + t * (158 - 136));
    const b = Math.round(229 + t * (107 - 229));

    for (let x = 0; x < width; x++) {
      // Pill icon coordinate calculation
      const cx = width / 2;
      const cy = height / 2;
      const dx = (x - cx) / (width * 0.35);
      const dy = (y - cy) / (height * 0.35);
      // Angled pill shape: rotate 45 deg
      const rotX = (dx + dy) * 0.7071;
      const rotY = (-dx + dy) * 0.7071;

      const inPill = (Math.abs(rotX) < 0.65 && Math.abs(rotY) < 0.28) ||
        (Math.hypot(rotX - 0.37, rotY) < 0.28) ||
        (Math.hypot(rotX + 0.37, rotY) < 0.28);

      const inDivider = inPill && Math.abs(rotX) < 0.04;

      if (inPill && !inDivider) {
        // White pill symbol
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 255;
      } else {
        // Gradient background
        rawData[offset++] = r;
        rawData[offset++] = g;
        rawData[offset++] = b;
        rawData[offset++] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePillSyncPng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePillSyncPng(512));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable.png'), generatePillSyncPng(512, true));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), generatePillSyncPng(180));

console.log('PNG Icons 192, 512, maskable, apple-touch-icon created successfully');
