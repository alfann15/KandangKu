'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { getTransaksiForEdit, editDetailTransaksi } from '@/lib/admin-actions';
import { ArrowLeft, LogOut, Loader2, Pencil } from 'lucide-react';

type DetailPesanan = {
  id: number;
  id_kategori: number;
  nama_kategori: string;
  jumlah_ekor: number;
  harga_satuan: number;
};

type TransaksiData = {
  id: string;
  nama_pelanggan: string;
  tipe_transaksi: string;
  status_bayar: string;
  total_bayar: number;
  diskon: number;
  detail_pesanan: DetailPesanan[];
};

export default function EditTransaksiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { toast } = useToast();

  const transaksi_id = searchParams.get('id');
  const [data, setData] = useState<TransaksiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status !== 'authenticated') return;

    if (!transaksi_id) {
      router.push('/admin');
      return;
    }

    loadTransaksi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, transaksi_id]);

  const loadTransaksi = async () => {
    if (!transaksi_id) return;
    setLoading(true);
    const result = await getTransaksiForEdit(transaksi_id);
    setLoading(false);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Gagal memuat transaksi',
        description: result.message,
      });
      router.push('/admin');
    }
  };

  const handleEditDetail = async (detailId: number) => {
    if (!editValue) return;
    setIsSubmitting(true);
    const result = await editDetailTransaksi({
      id_detail: detailId,
      jumlah_ekor_baru: parseInt(editValue),
    });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setEditingId(null);
      setEditValue('');
      await loadTransaksi();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
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
        <p className="text-muted-foreground">Transaksi tidak ditemukan</p>
      </div>
    );
  }

  const totalOmzet = data.detail_pesanan.reduce((s, d) => s + d.jumlah_ekor * d.harga_satuan, 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Kembali">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0 leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Edit Transaksi</h1>
              <p className="truncate text-xs text-muted-foreground">{data.nama_pelanggan}</p>
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

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Tipe</p>
                <p className="font-semibold">{data.tipe_transaksi}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className="mt-1">{data.status_bayar}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Omzet</p>
                <p className="font-semibold tabular-nums">{formatRupiah(totalOmzet)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bayar</p>
                <p className="font-semibold tabular-nums">{formatRupiah(data.total_bayar)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail Items */}
        <Card>
          <CardHeader>
            <CardTitle>Detail Item</CardTitle>
            <CardDescription>Edit jumlah ekor per kategori</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.detail_pesanan.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-medium">{d.nama_kategori}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatRupiah(d.harga_satuan)} × {d.jumlah_ekor} ekor = {formatRupiah(d.jumlah_ekor * d.harga_satuan)}
                  </p>
                </div>
                {editingId === d.id ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 tabular-nums"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => handleEditDetail(d.id)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      disabled={isSubmitting}
                    >
                      Batal
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingId(d.id);
                      setEditValue(String(d.jumlah_ekor));
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
