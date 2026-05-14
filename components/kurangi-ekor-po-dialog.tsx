'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/lib/use-toast';
import { getPoAktifPerKategori, kurangiEkorPo } from '@/lib/actions';
import { Loader2, AlertTriangle } from 'lucide-react';

type Kategori = {
  id: number;
  nama_kategori: string;
  stok_booking: number;
};

type PoAktif = {
  id_transaksi: string;
  nama_pelanggan: string;
  jumlah_ekor: number;
  harga_satuan: number;
  sudah_dibayar: number;
  sisa_bayar: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategoriList: Kategori[];
  onSuccess: () => void;
};

export function KurangiEkorPoDialog({ open, onOpenChange, kategoriList, onSuccess }: Props) {
  const { toast } = useToast();
  const [selectedKategori, setSelectedKategori] = useState<number | null>(null);
  const [poList, setPoList] = useState<PoAktif[]>([]);
  const [loadingPo, setLoadingPo] = useState(false);
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [jumlahMati, setJumlahMati] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedKategori || !open) return;

    const loadPo = async () => {
      setLoadingPo(true);
      const result = await getPoAktifPerKategori(selectedKategori);
      setLoadingPo(false);
      if (result.success && result.data) {
        setPoList(result.data);
        setSelectedPo(null);
      } else {
        toast({ variant: 'destructive', title: 'Gagal', description: result.message });
      }
    };

    loadPo();
  }, [selectedKategori, open, toast]);

  const handleSubmit = async () => {
    if (!selectedPo || !jumlahMati) return;

    setIsSubmitting(true);
    const result = await kurangiEkorPo({
      id_transaksi: selectedPo,
      id_kategori: selectedKategori!,
      jumlah_ekor_mati: parseInt(jumlahMati),
      keterangan: keterangan || undefined,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      onOpenChange(false);
      setSelectedKategori(null);
      setSelectedPo(null);
      setJumlahMati('');
      setKeterangan('');
      onSuccess();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const poSelected = poList.find((p) => p.id_transaksi === selectedPo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> Kurangi Ekor dari PO
          </DialogTitle>
          <DialogDescription>
            Pilih PO spesifik yang ayamnya mati
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kategori</Label>
            <select
              value={selectedKategori || ''}
              onChange={(e) => setSelectedKategori(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded border border-border bg-background px-3 py-2"
            >
              <option value="">Pilih kategori...</option>
              {kategoriList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kategori} (Booking: {k.stok_booking} ekor)
                </option>
              ))}
            </select>
          </div>

          {selectedKategori && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pilih PO</Label>
              {loadingPo ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : poList.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  Tidak ada PO aktif untuk kategori ini
                </div>
              ) : (
                <select
                  value={selectedPo || ''}
                  onChange={(e) => setSelectedPo(e.target.value || null)}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                >
                  <option value="">Pilih PO...</option>
                  {poList.map((p) => (
                    <option key={p.id_transaksi} value={p.id_transaksi}>
                      {p.nama_pelanggan} - {p.jumlah_ekor} ekor
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {poSelected && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="text-amber-900">
                <span className="font-semibold">{poSelected.nama_pelanggan}</span>
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Total: {poSelected.jumlah_ekor} ekor × {poSelected.harga_satuan.toLocaleString('id-ID')} = {(poSelected.jumlah_ekor * poSelected.harga_satuan).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-amber-800">
                Sudah bayar: {poSelected.sudah_dibayar.toLocaleString('id-ID')} | Sisa: {poSelected.sisa_bayar.toLocaleString('id-ID')}
              </p>
            </div>
          )}

          {poSelected && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah Ekor Mati</Label>
              <Input
                type="number"
                min="1"
                max={poSelected.jumlah_ekor}
                placeholder={`Max: ${poSelected.jumlah_ekor} ekor`}
                value={jumlahMati}
                onChange={(e) => setJumlahMati(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Keterangan (Opsional)</Label>
            <Input
              placeholder="Contoh: Sakit, kecelakaan, dll"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedPo || !jumlahMati} variant="destructive">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Memproses...' : 'Kurangi Ekor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
