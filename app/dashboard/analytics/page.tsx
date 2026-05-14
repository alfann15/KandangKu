'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { getDashboardAnalytics } from '@/lib/dashboard-actions';
import { ArrowLeft, LogOut, RotateCw, Loader2, Inbox, TrendingUp, Users, Package, Percent } from 'lucide-react';

type AnalyticsData = {
  margin_analysis: {
    total_omzet: number;
    total_kas_masuk: number;
    total_diskon: number;
    margin_persen: number;
  };
  top_kasir: Array<{
    kasir_id: number;
    kasir_nama: string;
    jumlah_transaksi: number;
    total_omzet: number;
    total_kas: number;
    margin_persen: number;
  }>;
  top_kategori: Array<{
    kategori_id: number;
    nama_kategori: string;
    total_ekor: number;
    total_omzet: number;
    harga_rata_rata: number;
  }>;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadAnalytics = async () => {
    setRefreshing(true);
    const result = await getDashboardAnalytics();
    setRefreshing(false);
    if (result.success && result.data) {
      setData(result.data);
      setLoading(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Gagal memuat analytics',
        description: result.message,
      });
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Gagal memuat data</p>
      </div>
    );
  }

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
            <div className="min-w-0 leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Analytics Hari Ini</h1>
              <p className="truncate text-xs text-muted-foreground">Margin, Top Kasir, Top Kategori</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAnalytics}
              disabled={refreshing}
              className="h-9 w-9 p-0"
              aria-label="Refresh"
            >
              <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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
        {/* Margin Analysis */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Analisis Margin</CardTitle>
            </div>
            <CardDescription>Perbandingan omzet vs kas masuk</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Omzet</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {formatRupiah(data.margin_analysis.total_omzet)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kas Masuk</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-emerald-600">
                  {formatRupiah(data.margin_analysis.total_kas_masuk)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Diskon</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-amber-600">
                  {formatRupiah(data.margin_analysis.total_diskon)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margin</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {data.margin_analysis.margin_persen}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Kasir */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Top Kasir</CardTitle>
            </div>
            <CardDescription>Kasir dengan kas masuk terbanyak</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {data.top_kasir.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada data</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kasir</TableHead>
                    <TableHead className="text-right">Transaksi</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                    <TableHead className="text-right">Kas Masuk</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_kasir.map((k) => (
                    <TableRow key={k.kasir_id}>
                      <TableCell className="font-medium">{k.kasir_nama}</TableCell>
                      <TableCell className="text-right tabular-nums">{k.jumlah_transaksi}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah(k.total_omzet)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                        {formatRupiah(k.total_kas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{k.margin_persen}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Kategori */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Top Kategori</CardTitle>
            </div>
            <CardDescription>Kategori dengan penjualan terbanyak</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {data.top_kategori.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada data</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Total Ekor</TableHead>
                    <TableHead className="text-right">Total Omzet</TableHead>
                    <TableHead className="text-right">Harga Rata-rata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_kategori.map((k) => (
                    <TableRow key={k.kategori_id}>
                      <TableCell className="font-medium">{k.nama_kategori}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{k.total_ekor} ekor</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah(k.total_omzet)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah(k.harga_rata_rata)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
