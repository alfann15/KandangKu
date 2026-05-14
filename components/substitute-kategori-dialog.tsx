'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { substituteKategoriPO } from '@/lib/actions';
import { Loader2, ArrowRightLeft } from 'lucide-react';

type DetailPesanan = {
  id: number;
  id_kategori: number;
  nama_kategori: string;
  jumlah_ekor: number;
  harga_satuan: number;
};

type Kategori = {
  id: number;
  nama_kategori: string;
  stok_booking: number;
  harga_hari_ini: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: DetailPesanan | null;
  kategoriList: Kategori[];
  onSuccess: () => void;
};

export function SubstituteKategoriDialog({ open, onOpenChange, detail, kategoriList, onSuccess }: Props) {
  const { toast } = useToast();
  const [selectedKategori, setSelectedKategori] = useState<number | null>(null);
  const [alasan, setAlasan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!detail || !selectedKategori || !alasan) return;

    setIsSubmitting(true);
    const result = await substituteKategoriPO({
      id_detail: detail.id,
      id_kategori_baru: selectedKategori,
      alasan,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      onOpenChange(false);
      setSelectedKategori(null);
      setAlasan('');
      onSuccess();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const kategoriSelected = kategoriList.find((k) => k.id === selectedKategori);
  const hargaLama = detail?.harga_satuan || 0;
  const hargaBaru = kategoriSelected?.harga_hari_ini || 0;
  const selisihHarga = (hargaBaru - hargaLama) * (detail?.jumlah_ekor || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" /> Substitusi Kategori
          </DialogTitle>
          <DialogDescription>
            Ganti kategori untuk PO yang ayamnya mati
          </DialogDescription>
        </DialogHeader>

        {detail && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">Kategori Lama</p>
              <p className="font-semibold">{detail.nama_kategori}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {detail.jumlah_ekor} ekor × {formatRupiah(detail.harga_satuan)} = {formatRupiah(detail.jumlah_ekor * detail.harga_satuan)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kategori Baru</Label>
              <select
                value={selectedKategori || ''}
                onChange={(e) => setSelectedKategori(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded border border-border bg-background px-3 py-2"
              >
                <option value="">Pilih kategori...</option>
                {kategoriList
                  .filter((k) => k.id !== detail.id_kategori)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kategori} (Stok: {k.stok_booking}, Harga: {formatRupiah(k.harga_hari_ini)})
                    </option>
                  ))}
              </select>
            </div>

            {kategoriSelected && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">Kategori Baru</p>
                <p className="font-semibold">{kategoriSelected.nama_kategori}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {detail.jumlah_ekor} ekor × {formatRupiah(kategoriSelected.harga_hari_ini)} = {formatRupiah(detail.jumlah_ekor * kategoriSelected.harga_hari_ini)}
                </p>
                {selisihHarga !== 0 && (
                  <p className={`text-xs font-semibold mt-2 ${selisihHarga > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Selisih: {selisihHarga > 0 ? '+' : ''}{formatRupiah(selisihHarga)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Alasan Substitusi</Label>
              <Input
                placeholder="Contoh: Ayam mati, ganti dengan kategori lain"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedKategori || !alasan}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Memproses...' : 'Substitusi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
