'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { getDashboardSummaryHariIni, getTransaksiHariIni, getStokRealtime, getOmzet7Hari } from '@/lib/dashboard-actions';
import {
  LogOut, RotateCw, Pause, Play, BarChart3, Bird,
  LayoutDashboard, Users, Package, TrendingUp, Wallet,
  Receipt, ShieldCheck, Loader2, Inbox, AlertCircle,
  PiggyBank, WalletCards,
} from 'lucide-react';

type KasirBreakdown = { kasir_id: number; kasir_nama: string; jumlah_transaksi: number; total_kas: number };
type Transaksi = {
  id: string; nama_pelanggan: string; kasir_nama: string;
  tipe_transaksi: string; status_bayar: string;
  total_bayar: number; total_efektif: number; diskon: number; waktu: string;
  dibatalkan: boolean;
};
type StokItem = { id: number; nama_kategori: string; harga_hari_ini: number; stok_bebas: number; stok_booking: number; total_stok: number };
type OmzetHarian = { tanggal: string; label: string; omzet: number; jumlah_transaksi: number; is_today: boolean };

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const role = (session?.user as any)?.role as string | undefined;

  const [tanggal, setTanggal] = useState('');
  const [total_transaksi, setTotalTransaksi] = useState(0);
  const [total_penjualan, setTotalPenjualan] = useState(0);
  const [total_kas_masuk, setTotalKasMasuk] = useState(0);
  const [total_pengeluaran, setTotalPengeluaran] = useState(0);
  const [kas_bersih, setKasBersih] = useState(0);
  const [total_piutang, setTotalPiutang] = useState(0);
  const [kasir_breakdown, setKasirBreakdown] = useState<KasirBreakdown[]>([]);
  const [transaksi_list, setTransaksiList] = useState<Transaksi[]>([]);
  const [stok_list, setStokList] = useState<StokItem[]>([]);
  const [omzet_7_hari, setOmzet7Hari] = useState<OmzetHarian[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auto_refresh, setAutoRefresh] = useState(true);
  const [openMobileMenu, setOpenMobileMenu] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [summaryRes, transaksiRes, stokRes, omzetRes] = await Promise.all([
        getDashboardSummaryHariIni(),
        getTransaksiHariIni(20),
        getStokRealtime(),
        getOmzet7Hari(),
      ]);
      if (summaryRes.success && summaryRes.data) {
        setTanggal(summaryRes.data.tanggal);
        setTotalTransaksi(summaryRes.data.total_transaksi);
        setTotalPenjualan(summaryRes.data.total_penjualan);
        setTotalKasMasuk(summaryRes.data.total_kas_masuk);
        setTotalPengeluaran(summaryRes.data.total_pengeluaran);
        setKasBersih(summaryRes.data.kas_bersih);
        setTotalPiutang(summaryRes.data.total_piutang);
        setKasirBreakdown(summaryRes.data.kasir_breakdown);
      }
      if (transaksiRes.success && transaksiRes.data) setTransaksiList(transaksiRes.data);
      if (stokRes.success && stokRes.data) setStokList(stokRes.data);
      if (omzetRes.success && omzetRes.data) setOmzet7Hari(omzetRes.data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/signin'); return; }
    loadData();
    const interval = auto_refresh ? setInterval(() => loadData(true), 10000) : null;
    return () => { if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, auto_refresh]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: 'Omzet Hari Ini', value: formatRupiah(total_penjualan), icon: TrendingUp, accent: 'text-foreground', hint: 'Nilai semua barang yang keluar' },
    { label: 'Kas Masuk', value: formatRupiah(total_kas_masuk), icon: WalletCards, accent: 'text-emerald-600', hint: 'Uang dari penjualan' },
    { label: 'Pengeluaran', value: formatRupiah(total_pengeluaran), icon: Wallet, accent: total_pengeluaran > 0 ? 'text-amber-600' : 'text-foreground', hint: 'Kas yang dikeluarkan hari ini' },
    { label: 'Kas Bersih', value: formatRupiah(kas_bersih), icon: PiggyBank, accent: kas_bersih < 0 ? 'text-rose-600' : 'text-emerald-600', hint: 'Kas Masuk − Pengeluaran' },
    { label: 'Total Piutang', value: formatRupiah(total_piutang), icon: AlertCircle, accent: total_piutang > 0 ? 'text-rose-600' : 'text-foreground', hint: 'Tagihan terbuka (lintas hari)' },
    { label: 'Transaksi', value: String(total_transaksi), icon: Receipt, accent: 'text-foreground', hint: 'Jumlah transaksi hari ini' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="leading-tight min-w-0">
              <h1 className="text-sm font-semibold tracking-tight">Dashboard</h1>
              <p className="text-xs text-muted-foreground truncate">{tanggal}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Desktop buttons */}
            <Link href="/kasir" className="hidden sm:block">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Bird className="h-4 w-4" /> Kasir
              </Button>
            </Link>
            <Link href="/rekap">
              <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex">
                <BarChart3 className="h-4 w-4" /> Rekap
              </Button>
            </Link>
            <Link href="/dashboard/analytics" className="hidden md:block">
              <Button variant="outline" size="sm" className="gap-1.5">
                <TrendingUp className="h-4 w-4" /> Analytics
              </Button>
            </Link>
            {role === 'ADMIN' && (
              <Link href="/admin" className="hidden md:block">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Admin
                </Button>
              </Link>
            )}

            {/* Mobile menu */}
            <div className="relative sm:hidden">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-9 p-0"
                onClick={() => setOpenMobileMenu(!openMobileMenu)}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              {openMobileMenu && (
                <div className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-background shadow-lg z-50">
                  <Link href="/kasir" className="block">
                    <button 
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-b border-border"
                      onClick={() => setOpenMobileMenu(false)}
                    >
                      <Bird className="h-4 w-4" /> Kasir
                    </button>
                  </Link>
                  <Link href="/rekap" className="block">
                    <button 
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-b border-border"
                      onClick={() => setOpenMobileMenu(false)}
                    >
                      <BarChart3 className="h-4 w-4" /> Rekap
                    </button>
                  </Link>
                  <Link href="/dashboard/analytics" className="block">
                    <button 
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-b border-border"
                      onClick={() => setOpenMobileMenu(false)}
                    >
                      <TrendingUp className="h-4 w-4" /> Analytics
                    </button>
                  </Link>
                  {role === 'ADMIN' && (
                    <Link href="/admin" className="block">
                      <button 
                        className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                        onClick={() => setOpenMobileMenu(false)}
                      >
                        <ShieldCheck className="h-4 w-4" /> Admin
                      </button>
                    </Link>
                  )}
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => loadData()} disabled={refreshing} aria-label="Refresh">
              <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5" onClick={() => setAutoRefresh(!auto_refresh)} aria-label={auto_refresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}>
              {auto_refresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="hidden sm:inline">{auto_refresh ? 'Pause' : 'Auto'}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => signOut({ callbackUrl: '/auth/signin' })} aria-label="Keluar">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <p className={`mt-2 text-lg font-semibold tracking-tight tabular-nums lg:text-xl ${s.accent}`}>{s.value}</p>
                <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{s.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart 7 hari */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Tren Omzet 7 Hari Terakhir</CardTitle>
            </div>
            <CardDescription>
              Termasuk hari ini · transaksi yang dibatalkan tidak dihitung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Omzet7HariChart data={omzet_7_hari} />
          </CardContent>
        </Card>

        {/* Two-column section: Kas per Kasir + Stok */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Kas per Kasir</CardTitle>
              </div>
              <CardDescription>Uang yang dipegang masing-masing anggota hari ini</CardDescription>
            </CardHeader>
            <CardContent>
              {kasir_breakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <Inbox className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kasir_breakdown.map((k) => (
                    <div key={k.kasir_id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground shrink-0">
                          <span className="text-xs font-semibold uppercase">{k.kasir_nama.slice(0, 2)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{k.kasir_nama}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{k.jumlah_transaksi} transaksi</p>
                        </div>
                      </div>
                      <p className="font-semibold tabular-nums">{formatRupiah(k.total_kas)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Status Stok</CardTitle>
              </div>
              <CardDescription>Stok per kategori real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stok_list.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{s.nama_kategori}</p>
                      <p className="text-sm font-semibold tabular-nums">Total: {s.total_stok}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="info">Siap: {s.stok_bebas}</Badge>
                      <Badge variant="warning">Booking: {s.stok_booking}</Badge>
                      <Badge variant="muted" className="tabular-nums">{formatRupiah(s.harga_hari_ini)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaksi Terbaru */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Transaksi Terbaru</CardTitle>
            </div>
            <CardDescription>20 transaksi terakhir hari ini · "Nilai" = total barang, "Bayar" = uang yang sudah masuk</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                    <TableHead className="text-right">Bayar</TableHead>
                    {role === 'ADMIN' && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaksi_list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                            <Inbox className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : transaksi_list.map((t) => (
                    <TableRow key={t.id} className={t.dibatalkan ? 'opacity-60' : ''}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{t.waktu}</TableCell>
                      <TableCell className={`font-medium ${t.dibatalkan ? 'line-through' : ''}`}>{t.nama_pelanggan}</TableCell>
                      <TableCell className="text-muted-foreground">{t.kasir_nama}</TableCell>
                      <TableCell>
                        <Badge variant={t.tipe_transaksi === 'LANGSUNG' ? 'success' : 'info'}>
                          {t.tipe_transaksi}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.dibatalkan ? (
                          <Badge variant="muted">DIBATALKAN</Badge>
                        ) : (
                          <Badge variant={t.status_bayar === 'LUNAS' ? 'success' : t.status_bayar === 'DP' ? 'warning' : 'destructive'}>
                            {t.status_bayar}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${t.dibatalkan ? 'line-through text-muted-foreground' : ''}`}>{formatRupiah(t.total_efektif)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatRupiah(t.total_bayar)}</TableCell>
                      {role === 'ADMIN' && (
                        <TableCell className="text-right">
                          {!t.dibatalkan && (
                            <Link href={`/admin/edit-transaksi?id=${t.id}`}>
                              <Button size="sm" variant="outline" className="gap-1.5">
                                Edit
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}



function formatRupiahShort(value: number): string {
  if (value === 0) return '–';
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `${v.toFixed(v >= 10 ? 0 : 1).replace(/\.0$/, '')}jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
}

const Omzet7HariChart = React.memo(function Omzet7HariChart({ data }: { data: Array<{ tanggal: string; label: string; omzet: number; jumlah_transaksi: number; is_today: boolean }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Belum ada data omzet</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.omzet), 1);
  const total7Hari = data.reduce((s, d) => s + d.omzet, 0);
  const rataRata = Math.round(total7Hari / data.length);
  const CHART_HEIGHT = 160;

  return (
    <div className="space-y-4">
      {/* Summary atas */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total 7 hari</p>
          <p className="text-lg font-semibold tabular-nums">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total7Hari)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rata-rata / hari</p>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(rataRata)}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {data.map((d) => {
          const barHeight = (d.omzet / max) * CHART_HEIGHT;
          return (
            <div
              key={d.tanggal}
              className="flex flex-col items-center justify-end gap-1.5"
              style={{ minHeight: `${CHART_HEIGHT + 30}px` }}
              title={`${d.label}: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(d.omzet)} (${d.jumlah_transaksi} trx)`}
            >
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {formatRupiahShort(d.omzet)}
              </span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  d.is_today
                    ? 'bg-primary'
                    : d.omzet > 0
                    ? 'bg-primary/40'
                    : 'bg-muted'
                }`}
                style={{ height: `${barHeight}px`, minHeight: d.omzet > 0 ? '4px' : '2px' }}
              />
              <span className={`text-[11px] tabular-nums ${d.is_today ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});



