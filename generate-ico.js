const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Simple ICO file generator from PNG buffers
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + count * entrySize;

  let offset = dataOffset;
  const entries = [];
  for (const buf of pngBuffers) {
    entries.push({ size: buf.length, offset });
    offset += buf.length;
  }

  const totalSize = offset;
  const ico = Buffer.alloc(totalSize);

  // ICO header
  ico.writeUInt16LE(0, 0);      // reserved
  ico.writeUInt16LE(1, 2);      // type: ICO
  ico.writeUInt16LE(count, 4);  // count

  const sizes = [256, 64, 32, 16];
  for (let i = 0; i < count; i++) {
    const pos = headerSize + i * entrySize;
    const s = sizes[i] || 0;
    ico.writeUInt8(s === 256 ? 0 : s, pos);       // width (0 = 256)
    ico.writeUInt8(s === 256 ? 0 : s, pos + 1);   // height
    ico.writeUInt8(0, pos + 2);                     // palette
    ico.writeUInt8(0, pos + 3);                     // reserved
    ico.writeUInt16LE(1, pos + 4);                  // color planes
    ico.writeUInt16LE(32, pos + 6);                 // bits per pixel
    ico.writeUInt32LE(entries[i].size, pos + 8);    // size
    ico.writeUInt32LE(entries[i].offset, pos + 12); // offset
  }

  for (let i = 0; i < count; i++) {
    pngBuffers[i].copy(ico, entries[i].offset);
  }

  return ico;
}

async function main() {
  const srcPath = path.join(__dirname, 'assets', 'icon-256.png');
  const src = sharp(srcPath);

  const png256 = await src.clone().resize(256, 256).png().toBuffer();
  const png64 = await src.clone().resize(64, 64).png().toBuffer();
  const png32 = await src.clone().resize(32, 32).png().toBuffer();
  const png16 = await src.clone().resize(16, 16).png().toBuffer();

  const ico = createIco([png256, png64, png32, png16]);
  fs.writeFileSync(path.join(__dirname, 'assets', 'icon.ico'), ico);
  console.log('icon.ico generated');
}

main().catch(console.error);
