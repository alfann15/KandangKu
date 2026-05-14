'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { getRekapPeriode, type RekapData } from '@/lib/rekap-actions';
import {
  ArrowLeft,
  Calendar,
  LogOut,
  RotateCw,
  TrendingUp,
  Users,
  Package,
  ArrowUpDown,
  LineChart,
  Wallet,
  Receipt,
  Percent,
  Loader2,
  Inbox,
} from 'lucide-react';

// ============================================
// HELPERS — date string handling (local TZ)
// ============================================

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type Preset = {
  key: string;
  label: string;
  compute: () => { start: string; end: string };
};

const PRESETS: Preset[] = [
  {
    key: 'HARI_INI',
    label: 'Hari Ini',
    compute: () => {
      const t = toDateStr(new Date());
      return { start: t, end: t };
    },
  },
  {
    key: 'KEMARIN',
    label: 'Kemarin',
    compute: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const s = toDateStr(d);
      return { start: s, end: s };
    },
  },
  {
    key: '7_HARI',
    label: '7 Hari Terakhir',
    compute: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { start: toDateStr(start), end: toDateStr(end) };
    },
  },
  {
    key: '30_HARI',
    label: '30 Hari Terakhir',
    compute: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { start: toDateStr(start), end: toDateStr(end) };
    },
  },
  {
    key: 'BULAN_INI',
    label: 'Bulan Ini',
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toDateStr(start), end: toDateStr(now) };
    },
  },
  {
    key: 'BULAN_LALU',
    label: 'Bulan Lalu',
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toDateStr(start), end: toDateStr(end) };
    },
  },
];

type Tab = 'HARIAN' | 'KASIR' | 'KATEGORI' | 'MUTASI';

// ============================================
// COMPONENT
// ============================================

export default function RekapPage() {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();

  const initial = PRESETS[2].compute(); // 7 Hari Terakhir
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [activePreset, setActivePreset] = useState<string>('7_HARI');
  const [data, setData] = useState<RekapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('HARIAN');

  const loadRekap = useCallback(
    async (s: string, e: string) => {
      setLoading(true);
      const result = await getRekapPeriode({ start_date: s, end_date: e });
      setLoading(false);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal memuat rekap',
          description: result.message,
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      loadRekap(startDate, endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const applyPreset = (p: Preset) => {
    const range = p.compute();
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset(p.key);
    loadRekap(range.start, range.end);
  };

  const applyCustom = () => {
    if (!startDate || !endDate) {
      toast({
        variant: 'destructive',
        title: 'Tanggal belum lengkap',
        description: 'Isi tanggal mulai dan tanggal akhir',
      });
      return;
    }
    if (startDate > endDate) {
      toast({
        variant: 'destructive',
        title: 'Tanggal tidak valid',
        description: 'Tanggal mulai harus sebelum tanggal akhir',
      });
      return;
    }
    setActivePreset('CUSTOM');
    loadRekap(startDate, endDate);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Persentase max untuk bar chart harian (skala relatif)
  const maxKasHarian = data
    ? Math.max(1, ...data.daily_breakdown.map((d) => d.total_kas))
    : 1;

  const TABS: { k: Tab; l: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { k: 'HARIAN', l: 'Per Hari', icon: TrendingUp },
    { k: 'KASIR', l: 'Per Kasir', icon: Users },
    { k: 'KATEGORI', l: 'Per Kategori', icon: Package },
    { k: 'MUTASI', l: 'Mutasi Stok', icon: ArrowUpDown },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Kembali">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <LineChart className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Rekap Periode</h1>
              <p className="truncate text-xs text-muted-foreground">
                {data?.periode_label || 'Memuat...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRekap(startDate, endDate)}
              disabled={loading}
              className="h-9 w-9 p-0"
              aria-label="Refresh"
            >
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {/* Filter Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Filter Periode</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preset buttons */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p)}
                  className={`shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                    activePreset === p.key
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-foreground hover:border-foreground/20 hover:bg-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Custom range */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={toDateStr(new Date())}
                />
              </div>
              <Button onClick={applyCustom} disabled={loading} className="h-11">
                Terapkan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading state */}
        {loading && !data && (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Memuat rekap...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Kas Masuk</p>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-emerald-600 lg:text-2xl">
                    {formatRupiah(data.summary.total_kas_masuk)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    rata-rata {formatRupiah(data.summary.rata_rata_kas_per_hari)}/hari
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Penjualan Kotor</p>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">
                    {formatRupiah(data.summary.total_penjualan)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">sebelum diskon</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Diskon</p>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-amber-600 lg:text-2xl">
                    {formatRupiah(data.summary.total_diskon)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Transaksi</p>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">
                    {data.summary.jumlah_transaksi}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    dalam {data.jumlah_hari} hari
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
              {TABS.map(({ k, l, icon: Icon }) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                    tab === k
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {l}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'HARIAN' && (
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown Harian</CardTitle>
                  <CardDescription>
                    Total kas masuk per hari dalam periode
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.daily_breakdown.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Tidak ada data</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.daily_breakdown.map((d) => {
                        const widthPct =
                          maxKasHarian > 0
                            ? (d.total_kas / maxKasHarian) * 100
                            : 0;
                        return (
                          <div key={d.tanggal} className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="font-medium">{d.label}</span>
                              <div className="flex items-baseline gap-3 text-xs text-muted-foreground tabular-nums">
                                <span>{d.jumlah_transaksi} trx</span>
                                <span className="text-sm font-semibold text-foreground">
                                  {formatRupiah(d.total_kas)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {tab === 'KASIR' && (
              <Card>
                <CardHeader>
                  <CardTitle>Kontribusi per Kasir</CardTitle>
                  <CardDescription>
                    Total kas yang ditangani masing-masing kasir
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.kasir_breakdown.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Tidak ada transaksi pada periode ini</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {data.kasir_breakdown.map((k) => (
                        <div
                          key={k.kasir_id}
                          className="space-y-2 rounded-xl border border-border bg-card p-4"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                                <span className="text-xs font-semibold uppercase">
                                  {k.kasir_nama.slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-semibold tracking-tight">{k.kasir_nama}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {k.jumlah_transaksi} transaksi
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold tabular-nums">
                                {formatRupiah(k.total_kas)}
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {k.persentase}% dari total
                              </p>
                            </div>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${k.persentase}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {tab === 'KATEGORI' && (
              <Card>
                <CardHeader>
                  <CardTitle>Penjualan per Kategori</CardTitle>
                  <CardDescription>
                    Total ekor terjual &amp; estimasi pendapatan (pakai harga saat ini)
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  {data.kategori_breakdown.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Tidak ada penjualan</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kategori</TableHead>
                          <TableHead className="text-right">Ekor Terjual</TableHead>
                          <TableHead className="text-right">Estimasi Pendapatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.kategori_breakdown.map((k) => (
                          <TableRow key={k.kategori_id}>
                            <TableCell className="font-medium">{k.nama_kategori}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {k.total_ekor} ekor
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRupiah(k.estimasi_pendapatan)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <p className="mt-4 px-4 text-xs italic text-muted-foreground sm:px-0">
                    * Pendapatan adalah estimasi karena harga per kategori tidak disimpan di tiap transaksi (pakai harga_hari_ini saat ini). Kas masuk aktual lihat tab "Per Hari" / "Per Kasir".
                  </p>
                </CardContent>
              </Card>
            )}

            {tab === 'MUTASI' && (
              <Card>
                <CardHeader>
                  <CardTitle>Mutasi Stok</CardTitle>
                  <CardDescription>
                    Tambah stok &amp; ayam mati selama periode
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Total Tambah Stok</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                        +{data.mutasi_summary.total_tambah_stok}
                        <span className="ml-1 text-sm font-medium">ekor</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-rose-700">Total Ayam Mati</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-rose-700">
                        −{data.mutasi_summary.total_ayam_mati}
                        <span className="ml-1 text-sm font-medium">ekor</span>
                      </p>
                    </div>
                  </div>

                  {data.mutasi_summary.detail_per_kategori.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Tidak ada mutasi stok pada periode ini</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kategori</TableHead>
                          <TableHead className="text-right">Tambah</TableHead>
                          <TableHead className="text-right">Mati</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.mutasi_summary.detail_per_kategori.map((m) => {
                          const net = m.tambah - m.mati;
                          return (
                            <TableRow key={m.kategori_id}>
                              <TableCell className="font-medium">{m.nama_kategori}</TableCell>
                              <TableCell className="text-right tabular-nums text-emerald-700">
                                {m.tambah > 0 ? `+${m.tambah}` : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-rose-700">
                                {m.mati > 0 ? `−${m.mati}` : '—'}
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold tabular-nums ${
                                  net > 0 ? 'text-emerald-700' : net < 0 ? 'text-rose-700' : 'text-muted-foreground'
                                }`}
                              >
                                {net > 0 ? '+' : ''}{net}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
