'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { getTransaksiList } from '@/lib/admin-actions';
import { ArrowLeft, LogOut, Loader2, Search, Inbox } from 'lucide-react';

type Transaksi = {
  id: string;
  nama_pelanggan: string;
  tipe_transaksi: string;
  status_bayar: string;
  total_bayar: number;
  waktu_transaksi: string;
};

export default function EditTransaksiListPage() {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();

  const [transaksiList, setTransaksiList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status !== 'authenticated') return;

    loadTransaksi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadTransaksi = async () => {
    setLoading(true);
    const result = await getTransaksiList();
    setLoading(false);
    if (result.success && result.data) {
      setTransaksiList(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Gagal memuat transaksi',
        description: result.message,
      });
    }
  };

  const filtered = transaksiList.filter((t) => {
    const q = search.toLowerCase();
    return t.nama_pelanggan.toLowerCase().includes(q) || t.id.includes(q);
  });

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Kembali">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0 leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Edit Transaksi</h1>
              <p className="text-xs text-muted-foreground">Pilih transaksi untuk diedit</p>
            </div>
          </div>
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
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama pelanggan atau ID transaksi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Transaksi List */}
        <Card>
          <CardHeader>
            <CardTitle>Daftar Transaksi</CardTitle>
            <CardDescription>Total: {filtered.length} transaksi</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Tidak ada transaksi</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Pelanggan</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nama_pelanggan}</TableCell>
                      <TableCell>
                        <Badge variant={t.tipe_transaksi === 'LANGSUNG' ? 'default' : 'secondary'}>
                          {t.tipe_transaksi}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status_bayar === 'LUNAS' ? 'success' : 'warning'}>
                          {t.status_bayar}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(t.total_bayar)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/edit-transaksi?id=${t.id}`}>
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                        </Link>
                      </TableCell>
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
