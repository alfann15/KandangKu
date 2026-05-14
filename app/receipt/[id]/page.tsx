'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/utils';
import { getDetailTransaksi } from '@/lib/actions';
import { Printer, ArrowLeft, Loader2, Bird } from 'lucide-react';

type DetailTransaksi = {
  id: string;
  nama_pelanggan: string;
  nomor_wa: string | null;
  tipe_transaksi: string;
  status_bayar: string;
  total_bayar: number;
  diskon: number;
  waktu_transaksi: string | Date;
  tanggal_jatuh_tempo: string | Date | null;
  dibatalkan_pada: string | Date | null;
  alasan_batal: string | null;
  detail_pesanan: Array<{
    id: number;
    jumlah_ekor: number;
    harga_satuan: number;
    kategori: { nama_kategori: string };
  }>;
  kasir: { nama: string };
};

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DetailTransaksi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDetailTransaksi(params.id).then((r) => {
      if (r.success && r.data) {
        setData(r.data as any);
      } else {
        setError(r.message);
      }
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4">
        <p className="text-sm text-muted-foreground">{error || 'Transaksi tidak ditemukan'}</p>
        <Link href="/kasir">
          <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Kembali</Button>
        </Link>
      </div>
    );
  }

  const subtotal = data.detail_pesanan.reduce((s, d) => s + d.jumlah_ekor * d.harga_satuan, 0);
  const total = subtotal - data.diskon;
  const sisa = Math.max(0, total - data.total_bayar);
  const tanggal = new Date(data.waktu_transaksi).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const jatuh_tempo = data.tanggal_jatuh_tempo
    ? new Date(data.tanggal_jatuh_tempo).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <main className="min-h-screen bg-muted/30 print:bg-white">
      {/* Toolbar — disembunyikan saat print */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/kasir">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak Struk
          </Button>
        </div>
      </div>

      {/* Struk */}
      <div className="mx-auto my-6 max-w-md bg-white p-6 shadow-sm border border-border print:my-0 print:max-w-none print:border-0 print:shadow-none print:p-3">
        <div className="receipt text-foreground">
          {/* Header */}
          <div className="text-center border-b border-dashed border-foreground/30 pb-3 mb-3">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground print:bg-foreground print:text-background">
              <Bird className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <h1 className="text-base font-bold tracking-tight">KandangKu</h1>
            <p className="text-[11px] text-muted-foreground">Penjualan Ayam Hidup</p>
          </div>

          {/* Meta */}
          <div className="space-y-0.5 text-[11px] mb-3 font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">No.</span><span>{data.id.slice(-10).toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tanggal</span><span>{tanggal}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tipe</span><span>{data.tipe_transaksi === 'PRE_ORDER' ? 'Pre-Order' : 'Penjualan'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Kasir</span><span>{data.kasir.nama}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pelanggan</span><span className="font-semibold">{data.nama_pelanggan}</span></div>
            {data.nomor_wa && (
              <div className="flex justify-between"><span className="text-muted-foreground">No. WA</span><span>{data.nomor_wa}</span></div>
            )}
          </div>

          {/* Cancelled banner */}
          {data.dibatalkan_pada && (
            <div className="mb-3 border border-rose-300 bg-rose-50 p-2 text-center text-[11px] font-bold text-rose-700 print:border-foreground print:bg-transparent print:text-foreground">
              ⚠ TRANSAKSI DIBATALKAN
              {data.alasan_batal && (
                <p className="mt-0.5 font-normal italic">"{data.alasan_batal}"</p>
              )}
            </div>
          )}

          {/* Items */}
          <div className="border-t border-dashed border-foreground/30 pt-2 space-y-1.5">
            {data.detail_pesanan.map((d) => (
              <div key={d.id} className="text-[12px]">
                <div className="flex justify-between">
                  <span className="font-medium">{d.kategori.nama_kategori}</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(d.jumlah_ekor * d.harga_satuan)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {d.jumlah_ekor} ekor × {formatRupiah(d.harga_satuan)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-3 space-y-1 border-t border-dashed border-foreground/30 pt-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatRupiah(subtotal)}</span>
            </div>
            {data.diskon > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Diskon</span>
                <span className="tabular-nums">− {formatRupiah(data.diskon)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-foreground/20 pt-1 font-bold text-sm">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="mt-3 border-t border-dashed border-foreground/30 pt-2 text-[12px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sudah Bayar</span>
              <span className="tabular-nums">{formatRupiah(data.total_bayar)}</span>
            </div>
            {!data.dibatalkan_pada && (
              <div className="flex justify-between font-semibold">
                <span>{sisa > 0 ? 'Sisa Tagihan' : 'Status'}</span>
                <span className="tabular-nums">
                  {sisa > 0 ? formatRupiah(sisa) : data.status_bayar}
                </span>
              </div>
            )}
            {jatuh_tempo && sisa > 0 && (
              <div className="flex justify-between text-[11px] text-rose-600 print:text-foreground">
                <span>Jatuh Tempo</span>
                <span>{jatuh_tempo}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 border-t border-dashed border-foreground/30 pt-3 text-center text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Terima kasih</p>
            <p className="mt-0.5">Simpan struk ini sebagai bukti</p>
          </div>
        </div>
      </div>

      {/* Print-specific CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </main>
  );
}
