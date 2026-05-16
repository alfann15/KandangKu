import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// OG Image 1200x630 — dark slate, logo kiri, teks kanan
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- Background -->
  <rect width="1200" height="630" fill="#0f172a"/>
  <!-- Subtle grid lines -->
  <line x1="0" y1="315" x2="1200" y2="315" stroke="#1e293b" stroke-width="1"/>
  <line x1="600" y1="0" x2="600" y2="630" stroke="#1e293b" stroke-width="1"/>
  <!-- Glow circle -->
  <radialGradient id="glow" cx="30%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#334155" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
  </radialGradient>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Icon box -->
  <rect x="80" y="215" width="120" height="120" rx="24" fill="#1e293b"/>
  <!-- Chicken silhouette (scaled from icon design, centered in box) -->
  <!-- tail -->
  <path d="M 113 278 C 103 270 100 262 107 257 C 108 268 113 273 117 278 Z" fill="#f8fafc"/>
  <!-- body -->
  <ellipse cx="148" cy="285" rx="30" ry="23" fill="#f8fafc"/>
  <!-- head -->
  <circle cx="163" cy="258" r="17" fill="#f8fafc"/>
  <!-- comb -->
  <circle cx="156" cy="238" r="6" fill="#f8fafc"/>
  <circle cx="163" cy="235" r="7" fill="#f8fafc"/>
  <circle cx="170" cy="238" r="6" fill="#f8fafc"/>
  <!-- beak -->
  <polygon points="180,259 189,262 180,265" fill="#0f172a"/>
  <!-- eye -->
  <circle cx="169" cy="255" r="3.5" fill="#0f172a"/>
  <!-- legs -->
  <line x1="143" y1="307" x2="140" y2="322" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>
  <line x1="155" y1="307" x2="158" y2="322" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>
  <line x1="140" y1="322" x2="133" y2="322" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
  <line x1="158" y1="322" x2="165" y2="322" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>

  <!-- App name -->
  <text x="228" y="282" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#f8fafc" letter-spacing="-2">KandangKu</text>
  <!-- Tagline -->
  <text x="230" y="330" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#94a3b8" letter-spacing="0">POS &amp; Manajemen Inventaris Ayam Hidup</text>

  <!-- Divider -->
  <line x1="80" y1="390" x2="1120" y2="390" stroke="#1e293b" stroke-width="1.5"/>

  <!-- Feature pills -->
  <rect x="80" y="415" width="180" height="40" rx="20" fill="#1e293b"/>
  <text x="170" y="441" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">Multi Kasir</text>

  <rect x="278" y="415" width="200" height="40" rx="20" fill="#1e293b"/>
  <text x="378" y="441" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">Stok Real-time</text>

  <rect x="496" y="415" width="160" height="40" rx="20" fill="#1e293b"/>
  <text x="576" y="441" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">Pre-Order</text>

  <rect x="674" y="415" width="180" height="40" rx="20" fill="#1e293b"/>
  <text x="764" y="441" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">Analytics</text>

  <rect x="872" y="415" width="248" height="40" rx="20" fill="#1e293b"/>
  <text x="996" y="441" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">Manajemen Piutang</text>

  <!-- URL -->
  <text x="1120" y="590" font-family="system-ui, sans-serif" font-size="20" fill="#475569" text-anchor="end">kandangku.alfan-dev.online</text>
</svg>`;

// Logo 512x512 — same as icon-512 but exported as logo.png
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="102" fill="#0f172a"/>
  <!-- tail -->
  <path d="M 143 296 C 72 245 51 194 102 164 C 112 256 143 277 169 296 Z" fill="#f8fafc"/>
  <!-- body -->
  <ellipse cx="281" cy="322" rx="113" ry="87" fill="#f8fafc"/>
  <!-- head -->
  <circle cx="317" cy="184" r="67" fill="#f8fafc"/>
  <!-- comb -->
  <circle cx="285" cy="113" r="23" fill="#f8fafc"/>
  <circle cx="317" cy="97" r="26" fill="#f8fafc"/>
  <circle cx="348" cy="113" r="23" fill="#f8fafc"/>
  <!-- beak -->
  <polygon points="384,190 420,205 384,220" fill="#0f172a"/>
  <!-- eye -->
  <circle cx="343" cy="169" r="13" fill="#0f172a"/>
  <!-- wing -->
  <ellipse cx="256" cy="322" rx="61" ry="41" fill="#cbd5e1" opacity="0.35"/>
  <!-- legs -->
  <line x1="256" y1="404" x2="236" y2="471" stroke="#f8fafc" stroke-width="15" stroke-linecap="round"/>
  <line x1="307" y1="404" x2="327" y2="471" stroke="#f8fafc" stroke-width="15" stroke-linecap="round"/>
  <line x1="236" y1="471" x2="205" y2="471" stroke="#f8fafc" stroke-width="10" stroke-linecap="round"/>
  <line x1="327" y1="471" x2="358" y2="471" stroke="#f8fafc" stroke-width="10" stroke-linecap="round"/>
</svg>`;

await Promise.all([
  sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(join(PUBLIC, 'og-image.png')),
  sharp(Buffer.from(logoSvg)).resize(512, 512).png().toFile(join(PUBLIC, 'logo.png')),
]);

console.log('✓ og-image.png (1200x630)');
console.log('✓ logo.png (512x512)');
