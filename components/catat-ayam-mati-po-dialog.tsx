'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/lib/use-toast';
import { catatAyamMatiPO } from '@/lib/actions';
import { Loader2, AlertTriangle } from 'lucide-react';

type Kategori = {
  id: number;
  nama_kategori: string;
  stok_booking: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kategoriList: Kategori[];
  onSuccess: () => void;
};

export function CatatAyamMatiPODialog({ open, onOpenChange, kategoriList, onSuccess }: Props) {
  const { toast } = useToast();
  const [selectedKategori, setSelectedKategori] = useState<number | null>(null);
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedKategori || !jumlah) return;

    setIsSubmitting(true);
    const result = await catatAyamMatiPO({
      id_kategori: selectedKategori,
      jumlah_ekor: parseInt(jumlah),
      keterangan: keterangan || undefined,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      onOpenChange(false);
      setSelectedKategori(null);
      setJumlah('');
      setKeterangan('');
      onSuccess();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const kategoriSelected = kategoriList.find((k) => k.id === selectedKategori);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> Catat Ayam Mati (PO)
          </DialogTitle>
          <DialogDescription>
            Kurangi stok booking saat ada ayam PO yang mati
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
              {kategoriList
                .filter((k) => k.stok_booking > 0)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kategori} (Booking: {k.stok_booking} ekor)
                  </option>
                ))}
            </select>
          </div>

          {kategoriSelected && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Stok booking saat ini: <span className="font-semibold">{kategoriSelected.stok_booking} ekor</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah Ekor Mati</Label>
            <Input
              type="number"
              min="1"
              placeholder="Berapa ekor?"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
            />
          </div>

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
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedKategori || !jumlah} variant="destructive">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Mencatat...' : 'Catat Mati'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
