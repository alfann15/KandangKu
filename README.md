<div align="center">

# KandangKu

**Sistem Point of Sale &amp; Manajemen Inventaris untuk Penjualan Ayam Hidup**

Aplikasi web modern yang dirancang khusus untuk usaha penjualan ayam skala micro — sederhana, andal, dan aman digunakan oleh banyak kasir secara bersamaan.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-ISC-green.svg)](LICENSE)

</div>

---

## Daftar Isi

- [Tentang](#tentang)
- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Arsitektur](#arsitektur)
- [Persyaratan](#persyaratan)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Database Setup](#database-setup)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Akun Demo](#akun-demo)
- [Struktur Proyek](#struktur-proyek)
- [Data Model](#data-model)
- [Alur Bisnis](#alur-bisnis)
- [Keamanan &amp; Konkurensi](#keamanan--konkurensi)
- [Skrip NPM](#skrip-npm)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Lisensi](#lisensi)

---

## Tentang

**KandangKu** adalah aplikasi POS (Point of Sale) dan manajemen inventaris yang dibuat khusus untuk penjualan ayam hidup per kategori berat. Aplikasi ini menyelesaikan masalah-masalah umum yang dihadapi penjual ayam skala micro:

- **Banyak orang input transaksi bersamaan** — beberapa user bisa jadi kasir tanpa bentrok stok.
- **Stok sering double-sold** — sistem mengunci stok di level database (atomic transaction) agar tidak pernah terjual lebih dari yang ada.
- **Harga harian berubah-ubah** — admin bisa update harga setiap pagi, transaksi langsung pakai harga saat ini, dan harga di-snapshot agar omzet tetap akurat.
- **Pre-Order &amp; DP rumit dihitung manual** — sistem otomatis menghitung sisa bayar berdasarkan harga terkini saat pelunasan.
- **Pelanggan ngutang / "ambil dulu, bayar belakangan"** — semua tagihan terbuka tercatat di satu tempat, lengkap dengan tombol WhatsApp untuk follow-up.
- **Pelanggan batalkan pesanan** — pembatalan menjaga audit trail, kembalikan stok otomatis, dan punya opsi refund / tanpa refund.
- **Tidak tahu uang siapa pegang berapa** — dashboard real-time menampilkan kas per kasir, total pengeluaran, dan kas bersih hari ini.

---

## Fitur Utama

### Penjualan
- **Transaksi langsung** dengan multi-item dan diskon fleksibel
- Tiga opsi pembayaran: **Lunas**, **DP** (sebagian), atau **Belum Bayar** (hutang)
- **Pre-Order** dengan booking stok dan harga dikunci saat pelunasan
- Snapshot harga per item di setiap transaksi sehingga omzet tetap akurat meskipun harga harian berubah
- **Cetak struk** otomatis (thermal-friendly 80mm) — opsional, muncul sebagai tombol di toast setelah submit

### Manajemen Pelanggan
- **Pelanggan registry otomatis** — tidak perlu mendaftarkan pelanggan, sistem auto-derive saat transaksi pertama
- **Autocomplete nama** dengan datalist HTML5 — kasir mulai mengetik, sistem menyarankan dari pelanggan lama
- **Auto-fill nomor WA** — kalau nama yang dipilih cocok pelanggan lama, nomor WA otomatis terisi
- Case-insensitive matching ("Andi", "ANDI", "andi" dianggap sama)

### Manajemen Piutang
- **Tab Piutang gabungan** — semua tagihan terbuka (hutang LANGSUNG + PO aktif) dalam satu daftar
- **Pelunasan generik** — bisa bayar penuh atau parsial; sistem otomatis pilih status LUNAS / DP / BELUM_BAYAR
- **Riwayat pembayaran cicilan** — setiap kali kasir mencatat pembayaran tersimpan di log dengan kasir + waktu, ditampilkan di dialog Bayar/Lunasi
- **Total piutang real-time** di dashboard (lintas hari, bukan hanya hari ini)
- **Tanggal jatuh tempo** — kasir bisa set deadline; piutang yang lewat tempo ditandai dengan badge merah dan background merah halus
- **Search & filter** — cari nama/nomor WA, filter tipe (Hutang / PO / Semua), toggle "Hanya Lewat Tempo"
- **Integrasi WhatsApp** — tombol "WA" satu klik membuka WhatsApp dengan pesan otomatis berisi rincian tagihan

### Pembatalan Transaksi
- Tombol Batal di tab Piutang — atomic kembalikan stok (LANGSUNG ke `stok_bebas`, PO `booking → bebas`)
- **Pilihan refund / tanpa refund** untuk DP yang sudah dibayar
- **Time window untuk kasir**: hanya bisa batalkan dalam 1 jam setelah transaksi (mencegah penyalahgunaan)
- **Admin bebas** membatalkan kapan saja
- Audit trail lengkap: `dibatalkan_pada`, `alasan_batal`, log `MutasiStok PEMBATALAN_*`, refund tercatat di `PembayaranLog` dengan jumlah negatif
- Transaksi tidak dihapus, hanya ditandai — tetap muncul di dashboard sebagai "DIBATALKAN" dengan strikethrough

### Pengeluaran Kas
- Catat kas keluar (pakan, sopir, listrik, dll) lewat dialog cepat di header kasir
- **Kategori extensible** — admin bisa menambah/menonaktifkan kategori (5 default ter-seed: Pakan, Operasional, Sopir, Listrik, Lain-lain)
- **Kas Bersih** = Kas Masuk − Pengeluaran, otomatis terhitung di dashboard

### Inventaris
- Stok per kategori ayam (kecil, sedang, besar) dengan pemisahan **stok bebas** dan **stok booking**
- **Catat ayam mati** dengan log mutasi
- **Tambah stok** dari kandang ke siap-jual
- **Audit trail** lengkap setiap perubahan stok (TAMBAH_STOK, AYAM_MATI, PEMBATALAN_LANGSUNG, PEMBATALAN_PO)

### Dashboard &amp; Rekap
- Dashboard real-time hari ini (auto-refresh tiap 10 detik)
- Enam kartu KPI: **Omzet**, **Kas Masuk**, **Pengeluaran**, **Kas Bersih**, **Total Piutang**, **Transaksi**
- **Chart bar tren omzet 7 hari terakhir** — pure CSS, hari ini di-highlight, format Rupiah pendek (rb / jt)
- Kas masuk per kasir
- Status stok real-time
- Tabel transaksi terbaru dengan kolom **Nilai** (barang keluar) dan **Bayar** (uang masuk) terpisah, badge DIBATALKAN untuk transaksi yang dibatalkan
- **Rekap periode** dengan preset: Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulan Ini, Bulan Lalu, atau range custom
- Breakdown harian, per kasir, per kategori, per pengeluaran, dan mutasi stok

### Admin Panel
- **Manajemen Kategori Ayam**: Buat, update harga, override stok, disable/enable, hapus kategori
- **Manajemen Kategori Pengeluaran**: Buat, disable/enable, hapus kategori
- **Manajemen User**: Buat user baru, ubah role (ADMIN/KASIR), hapus user
- History mutasi stok 30 transaksi terakhir
- Role-based access control (`ADMIN` vs `KASIR`)

### UI &amp; UX
- Login dengan **username** (bukan email), karena tidak ada flow lupa password
- Desain modern, mobile-first, dengan touch-friendly controls (h-12 inputs, h-12 buttons)
- Tema elegant monochrome (slate-based) dengan accent halus
- Header glass-morphism dengan backdrop blur
- Iconography konsisten dengan [lucide-react](https://lucide.dev) — tanpa emoji
- Tabular numerals untuk angka uang yang rapi
- Toast aksi: setelah submit transaksi, toast hijau muncul dengan tombol "Cetak Struk" (klik kalau perlu)

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router) + [React 18](https://react.dev/) |
| **Bahasa** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) (Neon, Supabase, atau lokal) |
| **ORM** | [Prisma 5](https://www.prisma.io/) |
| **Autentikasi** | [NextAuth.js v5](https://authjs.dev/) (Credentials + JWT, login by username) |
| **Password Hashing** | [bcryptjs](https://www.npmjs.com/package/bcryptjs) |
| **UI Components** | [Radix UI](https://www.radix-ui.com/) primitives |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) + [class-variance-authority](https://cva.style/) |
| **Validation** | [Zod](https://zod.dev/) |
| **Form** | [React Hook Form](https://react-hook-form.com/) |
| **Icons** | [lucide-react](https://lucide.dev/) |
| **Linting** | ESLint + `eslint-config-next` |

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                     │
│  Next.js Pages: /, /auth/signin, /kasir, /dashboard,    │
│  /admin, /rekap, /receipt/[id]                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                Next.js Server (App Router)              │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Middleware (auth guard)                         │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Server Actions ('use server')                   │    │
│  │  • lib/actions.ts          (kasir + piutang +   │    │
│  │                             pembatalan + WA)    │    │
│  │  • lib/admin-actions.ts    (admin flows)        │    │
│  │  • lib/pengeluaran-actions (kas keluar)         │    │
│  │  • lib/dashboard-actions.ts                     │    │
│  │  • lib/rekap-actions.ts                         │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ NextAuth Route Handler  (/api/auth/[...nextauth])│   │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │ Prisma Client (atomic $transaction)
┌──────────────────────▼──────────────────────────────────┐
│                PostgreSQL Database                      │
│   User · KategoriAyam · Transaksi · DetailTransaksi ·   │
│   MutasiStok · Pelanggan · Pengeluaran ·                │
│   KategoriPengeluaran · PembayaranLog                   │
└─────────────────────────────────────────────────────────┘
```

**Karakteristik kunci:**
- Semua mutasi stok dijalankan dalam `prisma.$transaction()` dengan isolation level `Serializable` untuk mencegah race condition.
- Validasi input ganda: **Zod schema** di server, **HTML constraints** di client.
- Autentikasi pakai JWT (stateless), middleware menjaga route `/kasir`, `/dashboard`, `/admin`, `/rekap`, `/receipt`.
- Harga di-snapshot per `DetailTransaksi` saat transaksi dibuat (`harga_satuan`) sehingga laporan keuangan tetap konsisten meskipun harga harian dirubah.
- Pelanggan registry auto-derived saat transaksi (case-insensitive lookup); FK opsional `id_pelanggan` di Transaksi.
- Setiap pembayaran cicilan tercatat di `PembayaranLog` (jumlah negatif untuk refund).
- Pembatalan tidak menghapus data — hanya set `dibatalkan_pada`, untuk audit trail.

---

## Persyaratan

- **Node.js** 18.17+ atau 20+
- **npm** 9+ (atau pnpm/yarn — sesuaikan perintah)
- **PostgreSQL** 13+ (lokal atau cloud: [Neon](https://neon.tech/), [Supabase](https://supabase.com/), [Prisma Postgres](https://www.prisma.io/postgres))

---

## Instalasi

```bash
# 1. Clone repository
git clone <repository-url>
cd kandangku

# 2. Install dependencies
npm install
```

---

## Konfigurasi Environment

Salin `.env.example` menjadi `.env`, lalu isi nilai-nilainya:

```bash
cp .env.example .env
```

**Isi `.env`:**

```env
# Database PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:5432/database_name"

# Generate dengan: openssl rand -base64 32
NEXTAUTH_SECRET="your-random-32-byte-secret"

# URL aplikasi (development)
NEXTAUTH_URL="http://localhost:3000"
```

> **Tip:** Untuk men-generate `NEXTAUTH_SECRET` di Windows PowerShell:
> ```powershell
> [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
> ```

---

## Database Setup

```bash
# 1. Generate Prisma Client
npm run db:generate

# 2. Push schema ke database (tanpa migration file)
npm run db:push

# 3. (Opsional) Seed data awal — 2 user + 3 kategori ayam + 5 kategori pengeluaran
npm run db:seed
```

**`db:seed` akan membuat:**
- 2 user: `testadmin` (ADMIN) & `testkasir` (KASIR), password sama dengan username
- 3 kategori ayam: Kecil (Rp 50.000), Sedang (Rp 75.000), Besar (Rp 100.000)
- 5 kategori pengeluaran default: Pakan, Operasional, Sopir, Listrik, Lain-lain

> **Migrasi schema:** kalau Anda mengubah `schema.prisma` setelah ada data, gunakan `npm run db:push -- --force-reset` (akan menghapus seluruh data dan re-create tabel) atau pakai `prisma migrate` untuk migrasi yang preserve data.

---

## Menjalankan Aplikasi

### Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm run start
```

### Prisma Studio (database GUI)

```bash
npm run prisma:studio
```

---

## Akun Demo

Setelah `npm run db:seed`:

| Username | Password | Role |
|----------|-----------|------|
| `testadmin` | `testadmin` | ADMIN |
| `testkasir` | `testkasir` | KASIR |

> **Penting:** Ganti password default sebelum deploy ke production. Untuk usaha micro dengan banyak kasir, edit `prisma/seed.ts` untuk menambahkan user lain (mis. `ayah`, `ibu`, `kakak`, `adik`) sebelum seed.

---

## Struktur Proyek

```
kandangku/
├── app/                          # Next.js App Router
│   ├── api/auth/[...nextauth]/   # NextAuth route handler
│   ├── auth/signin/              # Halaman login (username + password)
│   ├── kasir/                    # Halaman kasir (Penjualan, Pre-Order, Piutang)
│   ├── dashboard/                # Dashboard real-time + chart 7 hari
│   ├── admin/                    # Admin panel (kelola harga & stok)
│   ├── rekap/                    # Rekap periode (filter tanggal)
│   ├── receipt/[id]/             # Halaman struk cetak (thermal 80mm)
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Design tokens & global styles
├── components/
│   ├── ui/                       # Komponen UI primitif (shadcn-style)
│   ├── providers.tsx             # SessionProvider wrapper
│   └── toaster.tsx               # Toast container
├── lib/
│   ├── actions.ts                # Kasir + piutang + pembatalan + pelanggan
│   ├── admin-actions.ts          # Admin flows
│   ├── pengeluaran-actions.ts    # Kas keluar + kategori pengeluaran
│   ├── dashboard-actions.ts      # Query dashboard + chart 7 hari
│   ├── rekap-actions.ts          # Query rekap periode
│   ├── auth.ts                   # NextAuth config (Credentials by username)
│   ├── prisma.ts                 # Prisma client singleton
│   ├── use-toast.ts              # Toast hook
│   └── utils.ts                  # cn(), formatRupiah(), normalizeWaNumber(), buildWaUrl()
├── prisma/
│   ├── schema.prisma             # Skema database
│   └── seed.ts                   # Seed script
├── middleware.ts                 # Auth middleware
├── globals.d.ts                  # Ambient type declarations (CSS imports)
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
├── package.json
└── .env.example
```

---

## Data Model

```prisma
User
├── id, nama, role
├── username (unique)        — login pakai username, bukan email
├── password (hashed)
└── relations: transaksi[], mutasi_stok[], pengeluaran[], pembayaran_log[]

Pelanggan
├── id, nama
├── nama_normalized (unique) — lowercase + trim untuk dedup case-insensitive
├── nomor_wa
└── transaksi[]              — auto-derived saat transaksi pertama

KategoriAyam
├── id, nama_kategori, harga_hari_ini
├── stok_bebas               — stok yang siap dijual
├── stok_booking             — stok yang sudah di-PO tapi belum dilunasi
└── relations: detail_pesanan[], mutasi_stok[]

Transaksi
├── id (cuid), nama_pelanggan
├── nomor_wa                 — opsional, untuk follow-up via WhatsApp
├── id_pelanggan → Pelanggan?
├── tipe_transaksi           — 'LANGSUNG' | 'PRE_ORDER'
├── status_bayar             — 'LUNAS' | 'DP' | 'BELUM_BAYAR'
├── total_bayar, diskon
├── tanggal_jatuh_tempo      — opsional, untuk highlight piutang lewat tempo
├── dibatalkan_pada          — null kalau aktif, isi kalau sudah dibatalkan
├── alasan_batal
├── id_kasir → User
└── detail_pesanan[], pembayaran_log[]

DetailTransaksi
├── id_transaksi, id_kategori, jumlah_ekor
└── harga_satuan             — snapshot harga saat transaksi dibuat
                              (untuk PO: di-update ke harga_hari_ini saat pelunasan)

PembayaranLog
├── id_transaksi → Transaksi
├── jumlah                   — bisa negatif untuk refund
├── diskon_tambahan
├── status_sebelum, status_sesudah
├── id_kasir → User
├── keterangan
└── waktu                    — audit trail per cicilan/refund

MutasiStok
├── id_kategori, jumlah_ekor
├── tipe_mutasi              — 'TAMBAH_STOK' | 'AYAM_MATI' |
│                              'PEMBATALAN_LANGSUNG' | 'PEMBATALAN_PO'
└── id_kasir → User

KategoriPengeluaran
├── id, nama (unique)
├── aktif                    — admin bisa nonaktifkan tanpa menghapus
└── pengeluaran[]

Pengeluaran
├── id, jumlah, keterangan
├── id_kategori → KategoriPengeluaran?
├── id_kasir → User
└── waktu
```

---

## Alur Bisnis

### Penjualan Langsung (Lunas)
1. Kasir pilih kategori &amp; jumlah → masuk keranjang.
2. Sistem validasi stok bebas mencukupi.
3. Pilih status **Lunas**, masukkan nomor WA pelanggan (opsional).
4. Submit → atomic transaction: upsert Pelanggan + buat `Transaksi` + `DetailTransaksi` (dengan `harga_satuan` snapshot) + `stok_bebas--`.
5. Toast hijau muncul dengan tombol "Cetak Struk" — klik untuk buka struk di tab baru.

### Penjualan Langsung (DP / Hutang)
1. Sama seperti di atas, tapi pilih status **DP** atau **Belum Bayar**.
2. Boleh isi tanggal jatuh tempo (opsional).
3. Stok tetap berkurang dari `stok_bebas` (ayam memang keluar).
4. Transaksi muncul di tab **Piutang** untuk follow-up.
5. Saat pelanggan datang/transfer membayar, kasir buka piutang → input "Bayar Sekarang" → submit. Status auto-update ke DP atau LUNAS, tercatat di `PembayaranLog`.

### Pre-Order
1. Buat PO dengan DP opsional, nomor WA, dan tanggal jatuh tempo.
2. Stok dipindahkan: `stok_bebas--`, `stok_booking++`.
3. Harga **belum dikunci** — total dihitung saat pelunasan pakai `harga_hari_ini` terkini.

### Pelunasan / Cicilan
1. Buka tab **Piutang**, klik "Bayar" pada transaksi terkait.
2. Dialog menampilkan **Riwayat Pembayaran** (kalau sudah pernah bayar sebelumnya), total, sisa.
3. Isi "Bayar Sekarang" (default = sisa) dan diskon tambahan (opsional).
4. Submit → atomic update + insert `PembayaranLog`. Untuk PO yang jadi LUNAS: `harga_satuan` di-lock, `stok_booking--`.

### Pembatalan Transaksi
1. Buka tab **Piutang**, klik tombol Ban (merah) pada transaksi.
2. Isi alasan, pilih opsi **Refund** atau **Tanpa Refund** (kalau sudah ada DP).
3. Submit → atomic: tandai `dibatalkan_pada`, kembalikan stok (LANGSUNG → `stok_bebas`, PO → `booking → bebas`), log `MutasiStok PEMBATALAN_*`, `PembayaranLog` negatif untuk refund.
4. KASIR hanya bisa membatalkan dalam 1 jam setelah transaksi (admin bebas).

### Follow-up via WhatsApp
1. Buka tab **Piutang**.
2. Klik tombol **WA** di baris pelanggan target.
3. Browser membuka `wa.me/<nomor>` dengan pesan otomatis berisi nama, item, total, sudah bayar, dan sisa.
4. Kasir tinggal kirim — tidak perlu mengetik manual.

### Pengeluaran Kas
1. Klik tombol **Pengeluaran** di header kasir.
2. Isi jumlah, kategori (opsional), keterangan (opsional).
3. Submit → tercatat. Dashboard otomatis update kartu Pengeluaran &amp; Kas Bersih.

### Catat Ayam Mati / Tambah Stok
- Atomic update `KategoriAyam.stok_bebas` + insert `MutasiStok` log.

---

## Keamanan &amp; Konkurensi

- **Atomic Transactions** — semua operasi multi-step dijalankan dalam `prisma.$transaction()` dengan `isolationLevel: 'Serializable'`.
- **Race Condition Guard** — setelah update, sistem cek `if (stok &lt; 0) throw` untuk rollback otomatis.
- **Server-side validation** — Zod schema validasi semua input sebelum query ke database.
- **Role-based access** — middleware + cek `session.user.role === 'ADMIN'` di setiap admin action.
- **Time window untuk pembatalan kasir** — dibatasi 1 jam, dicek di server untuk mencegah bypass dari client.
- **Password hashing** — bcrypt dengan cost factor 10.
- **JWT session** — stateless, secret diambil dari `NEXTAUTH_SECRET`.
- **CSRF protection** — built-in dari NextAuth.
- **Snapshot harga** — `harga_satuan` di `DetailTransaksi` mencegah laporan keuangan jadi rusak ketika harga harian diubah setelah transaksi.
- **Audit trail** — `MutasiStok`, `PembayaranLog`, `dibatalkan_pada` + `alasan_batal` menyimpan jejak lengkap setiap event penting.
- **WhatsApp link** — pakai protokol `wa.me` resmi (tidak butuh API/token); nomor di-normalize ke format internasional Indonesia (62...) dan tombol auto-disabled kalau format invalid.

---

## Skrip NPM

| Script | Deskripsi |
|--------|-----------|
| `npm run dev` | Jalankan dev server di `localhost:3000` |
| `npm run build` | Build production |
| `npm run start` | Jalankan production server |
| `npm run lint` | Cek linting dengan ESLint |
| `npm run db:push` | Push schema Prisma ke database |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:seed` | Seed data awal (user + kategori ayam + kategori pengeluaran) |
| `npm run prisma:studio` | Buka Prisma Studio (DB GUI) |

---

## Deployment

### Vercel (Recommended)

1. Push repo ke GitHub.
2. Import project di [vercel.com](https://vercel.com/).
3. Tambahkan environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (= URL Vercel domain).
4. Tambahkan build command: `prisma generate && next build` (atau pakai `postinstall` hook di `package.json`).
5. Deploy.

### Database Cloud Provider

- **[Neon](https://neon.tech/)** — Serverless PostgreSQL, free tier mencukupi
- **[Supabase](https://supabase.com/)** — Free tier dengan 500MB
- **[Prisma Postgres](https://www.prisma.io/postgres)** — Terintegrasi dengan Prisma

### Self-Hosted

- VPS dengan Docker + PostgreSQL container, atau
- VPS langsung jalankan `npm run start` di belakang reverse proxy (Nginx/Caddy)

---

## Roadmap

**v1.2.0 - Production Release (Selesai):**
- [x] Edit transaksi (admin only)
- [x] Substitusi kategori untuk PO yang ayamnya mati
- [x] Kurangi ayam dari PO spesifik
- [x] Dashboard analytics (margin, top kasir, top kategori)
- [x] Mobile navbar optimization
- [x] Code optimization (remove unused imports, React.memo, extract types)
- [x] Production deployment ke Vercel

**Fitur Selesai (v1.0 - v1.2):**
- [x] Pencatatan pengeluaran kas
- [x] Customer registry + autocomplete
- [x] Riwayat pembayaran cicilan
- [x] Cetak struk thermal-friendly
- [x] Tanggal jatuh tempo + highlight piutang lewat tempo
- [x] Search/filter di tab Piutang
- [x] Pembatalan transaksi (refund / tanpa refund)
- [x] Dashboard chart tren omzet 7 hari
- [x] Breakdown pengeluaran di rekap
- [x] Manajemen kategori ayam
- [x] Manajemen kategori pengeluaran
- [x] Manajemen user
- [x] Export rekap ke Excel

**Masih dalam Pertimbangan (Future):**
- [ ] Auto-reminder piutang via WhatsApp Business API
- [ ] Multi-cabang (per outlet)
- [ ] Reset password by email
- [ ] Thermal printer Bluetooth integration
- [ ] Mobile app native (React Native)

---

## Lisensi

ISC © KandangKu

---

<div align="center">

**Dibangun dengan Next.js, Prisma &amp; TypeScript**

Solusi POS terpercaya untuk usaha ayam skala kecil dan menengah.

</div>
