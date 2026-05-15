import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/lib/utils';
import {
  Bird,
  ArrowRight,
  CreditCard,
  Package,
  Users,
  ShieldCheck,
  Smartphone,
  LineChart,
  Tag,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';

// Selalu ambil data terbaru tiap kunjungan
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'KandangKu - POS & Manajemen Inventaris Ayam Hidup',
  description: 'Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup. Multi-kasir, stok real-time, pre-order, dan analytics lengkap.',
  openGraph: {
    title: 'KandangKu - POS & Manajemen Inventaris Ayam Hidup',
    description: 'Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup. Multi-kasir, stok real-time, pre-order, dan analytics lengkap.',
    url: 'https://kandangku.alfan-dev.online',
    type: 'website',
  },
};

type KategoriPublic = {
  id: number;
  nama_kategori: string;
  harga_hari_ini: number;
  stok_bebas: number;
  stok_booking: number;
};

async function fetchKategoriPublic(): Promise<KategoriPublic[]> {
  try {
    return await prisma.kategoriAyam.findMany({
      where: { aktif: true },
      orderBy: { harga_hari_ini: 'asc' },
      select: {
        id: true,
        nama_kategori: true,
        harga_hari_ini: true,
        stok_bebas: true,
        stok_booking: true,
      },
    });
  } catch {
    // Fallback graceful jika DB belum ter-seed atau koneksi gagal
    return [];
  }
}

export default async function Home() {
  // Jika sudah login, redirect ke halaman sesuai role
  const session = await auth();
  if (session?.user) {
    const role = (session.user as any).role;
    redirect(role === 'ADMIN' ? '/admin' : '/kasir');
  }

  const kategori = await fetchKategoriPublic();
  const totalStok = kategori.reduce((s, k) => s + k.stok_bebas, 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Subtle decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-grid-slate opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-primary/[0.04] to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 lg:py-14">
        {/* Brand bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bird className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">KandangKu</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                POS &amp; Inventory
              </p>
            </div>
          </div>
          <Link href="/auth/signin" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="gap-1.5">
              Masuk <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="mx-auto mt-16 w-full max-w-3xl text-center lg:mt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Stok &amp; harga update real-time
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Kelola penjualan ayam
            <br />
            <span className="text-muted-foreground">dengan presisi.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Point of Sale dan manajemen inventaris yang dirancang khusus untuk
            penjualan ayam hidup. Sederhana, andal, dan multi-pengguna.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/signin" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Masuk ke Aplikasi <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#stok" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Lihat Stok Hari Ini
              </Button>
            </Link>
          </div>
        </section>

        {/* === Stok Hari Ini === */}
        <section id="stok" className="mx-auto mt-20 w-full max-w-4xl lg:mt-28">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Live Inventory
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Stok ayam hari ini
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {kategori.length > 0
                  ? `Total ${totalStok} ekor siap jual di ${kategori.length} kategori`
                  : 'Data belum tersedia'}
              </p>
            </div>
            {totalStok > 0 && (
              <Badge variant="success" className="hidden sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Tersedia
              </Badge>
            )}
          </div>

          {kategori.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Belum ada data kategori</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Database belum di-seed atau koneksi belum tersedia
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kategori.map((k) => {
                const isHabis = k.stok_bebas === 0;
                const isMenipis = k.stok_bebas > 0 && k.stok_bebas <= 5;
                return (
                  <article
                    key={k.id}
                    className="group relative overflow-hidden transition-all hover:border-foreground/20 hover:shadow-md"
                  >
                    <Card className="h-full">
                      {/* Decorative icon background */}
                      <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/[0.03] transition-all group-hover:bg-primary/[0.06]" />
                      <CardContent className="relative p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <Bird className="h-5 w-5" strokeWidth={2.25} />
                          </div>
                          {isHabis ? (
                            <Badge variant="destructive">Habis</Badge>
                          ) : isMenipis ? (
                            <Badge variant="warning">
                              <TrendingDown className="h-3 w-3" /> Menipis
                            </Badge>
                          ) : (
                            <Badge variant="success">Tersedia</Badge>
                          )}
                        </div>

                        <p className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Ayam {k.nama_kategori}
                        </p>

                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-semibold tracking-tight tabular-nums">
                            {k.stok_bebas}
                          </span>
                          <span className="text-sm text-muted-foreground">ekor</span>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Tag className="h-3.5 w-3.5" />
                            Harga
                          </div>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatRupiah(k.harga_hari_ini)}
                          </span>
                        </div>

                        {k.stok_booking > 0 && (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            + {k.stok_booking} ekor sudah dipesan (booking)
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Feature grid */}
        <section
          id="fitur"
          className="mx-auto mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-28 lg:grid-cols-3"
        >
          <h2 className="sr-only">Fitur Utama KandangKu</h2>
          {[
            {
              icon: CreditCard,
              title: 'Penjualan Cepat',
              desc: 'Transaksi langsung & pre-order dengan validasi stok real-time.',
            },
            {
              icon: Package,
              title: 'Inventaris Akurat',
              desc: 'Stok per kategori terkunci atomic — anti overselling.',
            },
            {
              icon: Users,
              title: 'Multi Kasir',
              desc: 'Beberapa user bisa input bersamaan dengan aman.',
            },
            {
              icon: LineChart,
              title: 'Rekap & Analytics',
              desc: 'Analisa harian, mingguan, bulanan + margin, top kasir, top kategori.',
            },
            {
              icon: ShieldCheck,
              title: 'Audit Trail',
              desc: 'Setiap mutasi stok tercatat lengkap dengan id kasir.',
            },
            {
              icon: Smartphone,
              title: 'PWA & Offline',
              desc: 'Installable app, offline-capable, sync otomatis saat online.',
            },
          ].map((f) => (
            <article key={f.title}>
              <Card className="group transition-all hover:border-foreground/20 hover:shadow-md h-full">
                <CardContent className="pt-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold tracking-tight text-foreground">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </CardContent>
              </Card>
            </article>
          ))}
        </section>

        {/* Footer */}
        <footer className="mx-auto mt-auto w-full max-w-5xl pt-16 text-center">
          <p className="text-xs text-muted-foreground">
            KandangKu v1.2.0 · Built with Next.js, Prisma &amp; TypeScript
          </p>
        </footer>
      </div>
    </main>
  );
}
