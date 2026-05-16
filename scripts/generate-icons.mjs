import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// Clean monochrome icon: dark slate bg + white chicken silhouette
// Chicken = simple geometric: circle head + teardrop body + comb + beak
function makeSvg(size, maskable = false) {
  const pad = maskable ? Math.round(size * 0.12) : 0;
  const d = size - pad * 2; // inner canvas
  const ox = pad, oy = pad;

  // unit = d/100
  const u = d / 100;
  const x = (v) => ox + v * u;
  const y = (v) => oy + v * u;

  const rx = maskable ? 0 : size * 0.2;

  // Body: ellipse centered ~55,62 rx=22 ry=17
  // Head: circle centered ~55,35 r=13
  // Comb: 3 small circles on top of head
  // Beak: small triangle right of head
  // Tail: bezier left of body
  // Legs: two lines

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#0f172a"/>
  <!-- tail -->
  <path d="M ${x(28)} ${y(58)} C ${x(14)} ${y(48)}, ${x(10)} ${y(38)}, ${x(20)} ${y(32)} C ${x(22)} ${y(50)}, ${x(28)} ${y(54)}, ${x(33)} ${y(58)} Z" fill="#f8fafc"/>
  <!-- body -->
  <ellipse cx="${x(55)}" cy="${y(63)}" rx="${u * 22}" ry="${u * 17}" fill="#f8fafc"/>
  <!-- head -->
  <circle cx="${x(62)}" cy="${y(36)}" r="${u * 13}" fill="#f8fafc"/>
  <!-- comb -->
  <circle cx="${x(56)}" cy="${y(22)}" r="${u * 4.5}" fill="#f8fafc"/>
  <circle cx="${x(62)}" cy="${y(19)}" r="${u * 5}" fill="#f8fafc"/>
  <circle cx="${x(68)}" cy="${y(22)}" r="${u * 4.5}" fill="#f8fafc"/>
  <!-- beak -->
  <polygon points="${x(75)},${y(37)} ${x(82)},${y(40)} ${x(75)},${y(43)}" fill="#0f172a"/>
  <!-- eye -->
  <circle cx="${x(67)}" cy="${y(33)}" r="${u * 2.5}" fill="#0f172a"/>
  <!-- wing hint -->
  <ellipse cx="${x(50)}" cy="${y(63)}" rx="${u * 12}" ry="${u * 8}" fill="#cbd5e1" opacity="0.35"/>
  <!-- legs -->
  <line x1="${x(50)}" y1="${y(79)}" x2="${x(46)}" y2="${y(92)}" stroke="#f8fafc" stroke-width="${u * 3}" stroke-linecap="round"/>
  <line x1="${x(60)}" y1="${y(79)}" x2="${x(64)}" y2="${y(92)}" stroke="#f8fafc" stroke-width="${u * 3}" stroke-linecap="round"/>
  <!-- feet -->
  <line x1="${x(46)}" y1="${y(92)}" x2="${x(40)}" y2="${y(92)}" stroke="#f8fafc" stroke-width="${u * 2}" stroke-linecap="round"/>
  <line x1="${x(64)}" y1="${y(92)}" x2="${x(70)}" y2="${y(92)}" stroke="#f8fafc" stroke-width="${u * 2}" stroke-linecap="round"/>
</svg>`;
}

async function makeIcon(svgStr, outPath, size) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(outPath);
  console.log('✓', outPath);
}

async function makeFavico(svgStr, outPath) {
  const png = await sharp(Buffer.from(svgStr)).resize(32, 32).png().toBuffer();
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); entry.writeUInt8(32, 1); entry.writeUInt8(0, 2); entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12);
  writeFileSync(outPath, Buffer.concat([header, entry, png]));
  console.log('✓', outPath);
}

await Promise.all([
  makeFavico(makeSvg(32),        join(PUBLIC, 'favicon.ico')),
  makeIcon(makeSvg(180),         join(PUBLIC, 'apple-touch-icon.png'), 180),
  makeIcon(makeSvg(192),         join(PUBLIC, 'icon-192.png'), 192),
  makeIcon(makeSvg(512),         join(PUBLIC, 'icon-512.png'), 512),
  makeIcon(makeSvg(192, true),   join(PUBLIC, 'icon-maskable-192.png'), 192),
  makeIcon(makeSvg(512, true),   join(PUBLIC, 'icon-maskable-512.png'), 512),
]);

console.log('\nDone.');
