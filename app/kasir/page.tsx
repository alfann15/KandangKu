'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { formatRupiah, buildWaUrl } from '@/lib/utils';
import {
  createTransaksiLangsung, getKategoriAyamDenganStok,
  catatAyamMati, tambahStok,
  createPreOrder, lunasiTransaksi, getTransaksiBelumLunas,
  getAllPelanggan, getRiwayatPembayaran, batalkanTransaksi,
} from '@/lib/actions';
import {
  createPengeluaran, getKategoriPengeluaran,
} from '@/lib/pengeluaran-actions';
import { CatatAyamMatiPODialog } from '@/components/catat-ayam-mati-po-dialog';
import { KurangiEkorPoDialog } from '@/components/kurangi-ekor-po-dialog';
import {
  LogOut, Plus, Trash2, AlertTriangle, Package,
  Bird, ShoppingCart, Clock, Receipt, Loader2,
  LayoutDashboard, ShieldCheck, MessageCircle, Phone,
  Wallet, Ban, Check, Search, X, Printer, Menu,
} from 'lucide-react';

type Kategori = { id: number; nama_kategori: string; harga_hari_ini: number; stok_bebas: number; stok_booking: number };
type CartItem = { kategori_id: number; kategori_nama: string; harga: number; jumlah_ekor: number };
type Piutang = {
  id: string;
  tipe_transaksi: 'LANGSUNG' | 'PRE_ORDER';
  nama_pelanggan: string;
  nomor_wa: string | null;
  kasir_nama: string;
  status_bayar: string;
  sudah_dibayar: number;
  diskon: number;
  total_harga_efektif: number;
  sisa_bayar: number;
  waktu: string;
  waktu_iso: string;
  tanggal_jatuh_tempo: string | null;
  lewat_tempo: boolean;
  items: { nama_kategori: string; jumlah_ekor: number; harga_efektif: number }[];
};
type Tab = 'LANGSUNG' | 'PRE_ORDER' | 'PIUTANG';

export default function KasirPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const role = (session?.user as any)?.role as string | undefined;

  const [tab, setTab] = useState<Tab>('LANGSUNG');
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [loadingKategori, setLoadingKategori] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form transaksi (LANGSUNG & PRE_ORDER)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [nama_pelanggan, setNamaPelanggan] = useState('');
  const [nomor_wa, setNomorWa] = useState('');
  const [selected_kategori_id, setSelectedKategoriId] = useState('');
  const [jumlah_ekor, setJumlahEkor] = useState('');
  const [diskon, setDiskon] = useState('0');
  const [status_bayar, setStatusBayar] = useState<'LUNAS' | 'DP' | 'BELUM_BAYAR'>('LUNAS');
  const [dp_langsung, setDpLangsung] = useState('0');
  const [dp_po, setDpPo] = useState('0');
  const [tanggal_jatuh_tempo, setTanggalJatuhTempo] = useState('');

  // Pelanggan registry untuk autocomplete
  const [pelangganList, setPelangganList] = useState<Array<{ id: number; nama: string; nomor_wa: string | null }>>([]);

  // Piutang
  const [piutangList, setPiutangList] = useState<Piutang[]>([]);
  const [loadingPiutang, setLoadingPiutang] = useState(false);
  const [selectedPiutang, setSelectedPiutang] = useState<Piutang | null>(null);
  const [openLunas, setOpenLunas] = useState(false);
  const [tambahan_bayar, setTambahanBayar] = useState('0');
  const [diskon_tambahan, setDiskonTambahan] = useState('0');

  // Filter Piutang (client-side)
  const [filter_search, setFilterSearch] = useState('');
  const [filter_tipe, setFilterTipe] = useState<'ALL' | 'LANGSUNG' | 'PRE_ORDER'>('ALL');
  const [filter_lewat_tempo, setFilterLewatTempo] = useState(false);

  // Pembatalan transaksi
  const [openMobileMenu, setOpenMobileMenu] = useState(false);
  const [openBatal, setOpenBatal] = useState(false);
  const [selectedForBatal, setSelectedForBatal] = useState<Piutang | null>(null);
  const [alasan_batal, setAlasanBatal] = useState('');
  const [refund_choice, setRefundChoice] = useState<'REFUND' | 'NO_REFUND'>('REFUND');
  const [isSubmittingBatal, setIsSubmittingBatal] = useState(false);

  // Riwayat pembayaran (untuk dialog Bayar/Lunasi)
  type RiwayatItem = {
    id: string;
    jumlah: number;
    diskon_tambahan: number;
    status_sebelum: string | null;
    status_sesudah: string;
    kasir_nama: string;
    waktu: string;
    keterangan: string | null;
    is_awal: boolean;
  };
  const [riwayatPembayaran, setRiwayatPembayaran] = useState<RiwayatItem[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  // Mutasi stok dialogs
  const [openCatatMati, setOpenCatatMati] = useState(false);
  const [mati_kategori_id, setMatiKategoriId] = useState('');
  const [mati_jumlah, setMatiJumlah] = useState('');
  const [isSubmittingMati, setIsSubmittingMati] = useState(false);

  const [openTambahStok, setOpenTambahStok] = useState(false);
  const [tambah_kategori_id, setTambahKategoriId] = useState('');
  const [tambah_jumlah, setTambahJumlah] = useState('');
  const [isSubmittingTambah, setIsSubmittingTambah] = useState(false);

  // Pengeluaran kas
  const [openPengeluaran, setOpenPengeluaran] = useState(false);
  const [openCatatAyamMatiPO, setOpenCatatAyamMatiPO] = useState(false);
  const [openKurangiEkorPo, setOpenKurangiEkorPo] = useState(false);
  const [kategoriPengeluaran, setKategoriPengeluaran] = useState<Array<{ id: number; nama: string }>>([]);
  const [pengeluaran_jumlah, setPengeluaranJumlah] = useState('');
  const [pengeluaran_kategori_id, setPengeluaranKategoriId] = useState('');
  const [pengeluaran_keterangan, setPengeluaranKeterangan] = useState('');
  const [isSubmittingPengeluaran, setIsSubmittingPengeluaran] = useState(false);

  const refreshKategori = async () => {
    const r = await getKategoriAyamDenganStok();
    if (r.success && r.data) setKategori(r.data);
  };

  const refreshPelanggan = async () => {
    const r = await getAllPelanggan();
    if (r.success && r.data) setPelangganList(r.data);
  };

  const refreshPiutang = async () => {
    setLoadingPiutang(true);
    const r = await getTransaksiBelumLunas();
    if (r.success && r.data) setPiutangList(r.data as Piutang[]);
    setLoadingPiutang(false);
  };

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/signin'); return; }
    refreshKategori().then(() => setLoadingKategori(false));
    refreshPelanggan();
  }, [status]);

  useEffect(() => {
    if (tab === 'PIUTANG') refreshPiutang();
  }, [tab]);

  // Auto-isi tambahan_bayar dengan sisa saat dialog dibuka
  useEffect(() => {
    if (openLunas && selectedPiutang) {
      setTambahanBayar(String(selectedPiutang.sisa_bayar));
      setDiskonTambahan('0');

      // Load riwayat pembayaran transaksi ini
      setLoadingRiwayat(true);
      getRiwayatPembayaran(selectedPiutang.id).then((r) => {
        if (r.success && r.data) setRiwayatPembayaran(r.data);
        else setRiwayatPembayaran([]);
        setLoadingRiwayat(false);
      });
    } else if (!openLunas) {
      setRiwayatPembayaran([]);
    }
  }, [openLunas, selectedPiutang]);

  const total_harga_asli = cart.reduce((s, i) => s + i.harga * i.jumlah_ekor, 0);
  const diskon_nilai = parseInt(diskon) || 0;
  const total_setelah_diskon = Math.max(0, total_harga_asli - diskon_nilai);

  const resetForm = () => {
    setCart([]); setNamaPelanggan(''); setNomorWa('');
    setDiskon('0'); setDpLangsung('0'); setDpPo('0'); setStatusBayar('LUNAS');
    setTanggalJatuhTempo('');
  };

  const handleAddToCart = () => {
    if (!selected_kategori_id || !jumlah_ekor) return;
    const kid = parseInt(selected_kategori_id);
    const jumlah = parseInt(jumlah_ekor);
    const k = kategori.find((x) => x.id === kid);
    if (!k) return;
    if (jumlah > k.stok_bebas) {
      toast({ variant: 'destructive', title: 'Stok tidak cukup', description: `Tersedia: ${k.stok_bebas} ekor` });
      return;
    }
    const existing = cart.find((i) => i.kategori_id === kid);
    if (existing) {
      const total = existing.jumlah_ekor + jumlah;
      if (total > k.stok_bebas) { toast({ variant: 'destructive', title: 'Stok tidak cukup', description: `Tersedia: ${k.stok_bebas} ekor` }); return; }
      setCart(cart.map((i) => i.kategori_id === kid ? { ...i, jumlah_ekor: total } : i));
    } else {
      setCart([...cart, { kategori_id: kid, kategori_nama: k.nama_kategori, harga: k.harga_hari_ini, jumlah_ekor: jumlah }]);
    }
    setSelectedKategoriId(''); setJumlahEkor('');
  };

  const handleSubmitLangsung = async () => {
    if (!nama_pelanggan.trim() || cart.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Nama pelanggan & keranjang wajib diisi' }); return;
    }
    setIsSubmitting(true);
    const dpVal = parseInt(dp_langsung) || 0;
    const total_bayar =
      status_bayar === 'BELUM_BAYAR' ? 0
      : status_bayar === 'LUNAS' ? total_setelah_diskon
      : dpVal;
    
    // Check if online
    if (!navigator.onLine) {
      try {
        const { savePendingTransaksi } = await import('@/lib/offline-sync');
        await savePendingTransaksi({
          nama_pelanggan,
          nomor_wa: nomor_wa.trim() || undefined,
          items: cart.map((i) => ({ id_kategori: i.kategori_id, jumlah_ekor: i.jumlah_ekor, harga_satuan: i.harga })),
          diskon: diskon_nilai,
          status_bayar,
          total_bayar,
          tanggal_jatuh_tempo: status_bayar !== 'LUNAS' ? (tanggal_jatuh_tempo || undefined) : undefined,
          tipe: 'LANGSUNG',
        });
        setIsSubmitting(false);
        toast({
          variant: 'success',
          title: 'Transaksi disimpan offline',
          description: 'Data akan disinkronkan saat online',
        });
        resetForm();
        return;
      } catch (error) {
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan offline' });
        return;
      }
    }
    
    const result = await createTransaksiLangsung({
      nama_pelanggan,
      nomor_wa: nomor_wa.trim() || undefined,
      items: cart.map((i) => ({ id_kategori: i.kategori_id, jumlah_ekor: i.jumlah_ekor })),
      diskon: diskon_nilai,
      status_bayar,
      total_bayar,
      tanggal_jatuh_tempo: status_bayar !== 'LUNAS' ? (tanggal_jatuh_tempo || undefined) : undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      const txId = (result.data as any)?.transaksi_id;
      toast({
        variant: 'success',
        title: 'Transaksi berhasil',
        description: `Untuk ${nama_pelanggan}`,
        action: txId ? (
          <ToastAction altText="Cetak Struk" onClick={() => window.open(`/receipt/${txId}`, '_blank', 'noopener,noreferrer')}>
            Cetak Struk
          </ToastAction>
        ) : undefined,
      });
      resetForm(); await refreshKategori(); await refreshPelanggan();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleSubmitPreOrder = async () => {
    if (!nama_pelanggan.trim() || cart.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Nama pelanggan & keranjang wajib diisi' }); return;
    }
    setIsSubmitting(true);
    
    // Check if online
    if (!navigator.onLine) {
      try {
        const { savePendingTransaksi } = await import('@/lib/offline-sync');
        await savePendingTransaksi({
          nama_pelanggan,
          nomor_wa: nomor_wa.trim() || undefined,
          items: cart.map((i) => ({ id_kategori: i.kategori_id, jumlah_ekor: i.jumlah_ekor, harga_satuan: i.harga })),
          dp: parseInt(dp_po) || 0,
          diskon: diskon_nilai,
          tanggal_jatuh_tempo: tanggal_jatuh_tempo || undefined,
          tipe: 'PRE_ORDER',
        });
        setIsSubmitting(false);
        toast({
          variant: 'success',
          title: 'Pre-Order disimpan offline',
          description: 'Data akan disinkronkan saat online',
        });
        resetForm();
        return;
      } catch (error) {
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan offline' });
        return;
      }
    }
    
    const result = await createPreOrder({
      nama_pelanggan,
      nomor_wa: nomor_wa.trim() || undefined,
      items: cart.map((i) => ({ id_kategori: i.kategori_id, jumlah_ekor: i.jumlah_ekor })),
      dp: parseInt(dp_po) || 0,
      diskon: diskon_nilai,
      tanggal_jatuh_tempo: tanggal_jatuh_tempo || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      const txId = (result.data as any)?.transaksi_id;
      toast({
        variant: 'success',
        title: 'Pre-Order berhasil',
        description: `Untuk ${nama_pelanggan}`,
        action: txId ? (
          <ToastAction altText="Cetak Struk" onClick={() => window.open(`/receipt/${txId}`, '_blank', 'noopener,noreferrer')}>
            Cetak Struk
          </ToastAction>
        ) : undefined,
      });
      resetForm(); await refreshKategori(); await refreshPelanggan();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleBatal = async () => {
    if (!selectedForBatal || !alasan_batal.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Alasan pembatalan wajib diisi' });
      return;
    }
    setIsSubmittingBatal(true);
    const result = await batalkanTransaksi({
      transaksi_id: selectedForBatal.id,
      alasan: alasan_batal.trim(),
      refund: refund_choice === 'REFUND',
    });
    setIsSubmittingBatal(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Transaksi dibatalkan', description: refund_choice === 'REFUND' ? 'Refund tercatat di riwayat' : 'Tanpa refund' });
      setOpenBatal(false); setSelectedForBatal(null); setAlasanBatal(''); setRefundChoice('REFUND');
      await Promise.all([refreshPiutang(), refreshKategori()]);
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleLunas = async () => {
    if (!selectedPiutang) return;
    setIsSubmitting(true);
    const result = await lunasiTransaksi({
      transaksi_id: selectedPiutang.id,
      tambahan_bayar: parseInt(tambahan_bayar) || 0,
      diskon_tambahan: parseInt(diskon_tambahan) || 0,
    });
    setIsSubmitting(false);
    if (result.success && result.data) {
      const lunas = result.data.status_baru === 'LUNAS';
      toast({
        variant: 'success',
        title: lunas ? 'Pelunasan berhasil' : 'Pembayaran tercatat',
        description: lunas
          ? 'Status berubah jadi LUNAS'
          : `Sisa tagihan: ${formatRupiah(result.data.sisa_setelah)}`,
      });
      setOpenLunas(false); setSelectedPiutang(null);
      setTambahanBayar('0'); setDiskonTambahan('0');
      await Promise.all([refreshPiutang(), refreshKategori()]);
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleCatatMati = async () => {
    if (!mati_kategori_id || !mati_jumlah) return;
    setIsSubmittingMati(true);
    const result = await catatAyamMati({ id_kategori: parseInt(mati_kategori_id), jumlah_ekor: parseInt(mati_jumlah) });
    setIsSubmittingMati(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: 'Ayam mati dicatat' });
      setMatiKategoriId(''); setMatiJumlah(''); setOpenCatatMati(false); await refreshKategori();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleTambahStok = async () => {
    if (!tambah_kategori_id || !tambah_jumlah) return;
    setIsSubmittingTambah(true);
    const result = await tambahStok({ id_kategori: parseInt(tambah_kategori_id), jumlah_ekor: parseInt(tambah_jumlah) });
    setIsSubmittingTambah(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: 'Stok ditambahkan' });
      setTambahKategoriId(''); setTambahJumlah(''); setOpenTambahStok(false); await refreshKategori();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  // Load kategori pengeluaran saat dialog dibuka pertama kali
  useEffect(() => {
    if (openPengeluaran && kategoriPengeluaran.length === 0) {
      getKategoriPengeluaran().then((r) => {
        if (r.success && r.data) setKategoriPengeluaran(r.data);
      });
    }
  }, [openPengeluaran, kategoriPengeluaran.length]);

  const handlePengeluaran = async () => {
    const jumlah = parseInt(pengeluaran_jumlah);
    if (!jumlah || jumlah <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Jumlah harus lebih dari 0' });
      return;
    }
    setIsSubmittingPengeluaran(true);
    const result = await createPengeluaran({
      jumlah,
      id_kategori: pengeluaran_kategori_id ? parseInt(pengeluaran_kategori_id) : undefined,
      keterangan: pengeluaran_keterangan.trim() || undefined,
    });
    setIsSubmittingPengeluaran(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: 'Pengeluaran dicatat' });
      setPengeluaranJumlah(''); setPengeluaranKategoriId(''); setPengeluaranKeterangan('');
      setOpenPengeluaran(false);
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  // Helper: bangun pesan WA otomatis untuk follow-up piutang
  const buildWaMessage = (p: Piutang) => {
    const itemsText = p.items
      .map((i) => `- ${i.nama_kategori}: ${i.jumlah_ekor} ekor × ${formatRupiah(i.harga_efektif)}`)
      .join('\n');
    const intro = p.tipe_transaksi === 'PRE_ORDER'
      ? `Halo ${p.nama_pelanggan}, kami dari KandangKu. Pre-Order Anda atas:`
      : `Halo ${p.nama_pelanggan}, kami dari KandangKu. Tagihan Anda atas:`;
    return `${intro}\n${itemsText}\n\nTotal: ${formatRupiah(p.total_harga_efektif)}\nSudah dibayar: ${formatRupiah(p.sudah_dibayar)}\nSisa: ${formatRupiah(p.sisa_bayar)}\n\nMohon konfirmasi kapan akan dilunasi/diambil. Terima kasih.`;
  };

  if (status === 'loading' || loadingKategori) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'LANGSUNG', label: 'Penjualan', icon: ShoppingCart },
    { key: 'PRE_ORDER', label: 'Pre-Order', icon: Clock },
    { key: 'PIUTANG', label: 'Piutang', icon: Receipt },
  ];

  // Apply filter ke piutang list
  const piutangFiltered = piutangList.filter((p) => {
    if (filter_tipe !== 'ALL' && p.tipe_transaksi !== filter_tipe) return false;
    if (filter_lewat_tempo && !p.lewat_tempo) return false;
    if (filter_search.trim()) {
      const q = filter_search.toLowerCase();
      const haystack = `${p.nama_pelanggan} ${p.nomor_wa ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const CartForm = (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm">Nama Pelanggan</Label>
          <Input
            className="h-12 text-base"
            placeholder="Ketik nama (auto-suggest pelanggan lama)"
            list="pelanggan-list"
            value={nama_pelanggan}
            onChange={(e) => {
              const val = e.target.value;
              setNamaPelanggan(val);
              // Auto-fill nomor WA kalau nama yang diketik cocok pelanggan
              const found = pelangganList.find(
                (p) => p.nama.toLowerCase().trim() === val.toLowerCase().trim()
              );
              if (found && found.nomor_wa && !nomor_wa) {
                setNomorWa(found.nomor_wa);
              }
            }}
          />
          <datalist id="pelanggan-list">
            {pelangganList.map((p) => (
              <option key={p.id} value={p.nama}>
                {p.nomor_wa ? p.nomor_wa : 'Tanpa nomor WA'}
              </option>
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Nomor WA <span className="text-xs text-muted-foreground">(opsional)</span>
          </Label>
          <Input className="h-12 text-base tabular-nums" inputMode="tel" placeholder="08xx atau 62xx" value={nomor_wa} onChange={(e) => setNomorWa(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-sm">Kategori Ayam</Label>
          <Select value={selected_kategori_id} onValueChange={setSelectedKategoriId}>
            <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
            <SelectContent>
              {kategori.map((k) => (
                <SelectItem key={k.id} value={String(k.id)} disabled={k.stok_bebas === 0}>
                  {k.nama_kategori} — {formatRupiah(k.harga_hari_ini)} (Stok: {k.stok_bebas})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Jumlah</Label>
          <Input className="h-12 text-base tabular-nums" type="number" min="1" placeholder="0" value={jumlah_ekor} onChange={(e) => setJumlahEkor(e.target.value)} />
        </div>
      </div>
      <Button className="w-full h-12 gap-2" onClick={handleAddToCart}>
        <Plus className="h-5 w-5" /> Tambah ke Keranjang
      </Button>
      {cart.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Keranjang</p>
          {cart.map((item) => (
            <div key={item.kategori_id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.kategori_nama}</p>
                <p className="text-sm text-muted-foreground tabular-nums">{formatRupiah(item.harga)} × {item.jumlah_ekor}</p>
              </div>
              <p className="font-semibold tabular-nums">{formatRupiah(item.harga * item.jumlah_ekor)}</p>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" onClick={() => setCart(cart.filter((i) => i.kategori_id !== item.kategori_id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const SummaryCard = (isPreOrder: boolean) => (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Ringkasan {isPreOrder ? 'Pre-Order' : 'Transaksi'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatRupiah(total_harga_asli)}</span>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Diskon (Rp)</Label>
          <Input className="tabular-nums" type="number" min="0" value={diskon} onChange={(e) => setDiskon(e.target.value)} />
        </div>
        <div className="flex justify-between border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatRupiah(total_setelah_diskon)}</span>
        </div>
        {isPreOrder ? (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">DP (Rp)</Label>
            <Input className="tabular-nums" type="number" min="0" value={dp_po} onChange={(e) => setDpPo(e.target.value)} />
            <p className="text-xs text-muted-foreground">Sisa dilunasi saat ambil. Harga di-lock saat lunas.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status Bayar</Label>
              <Select value={status_bayar} onValueChange={(v: any) => setStatusBayar(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LUNAS">Lunas</SelectItem>
                  <SelectItem value="DP">Sebagian (DP)</SelectItem>
                  <SelectItem value="BELUM_BAYAR">Belum Bayar (Hutang)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status_bayar === 'DP' && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bayar Sekarang (DP)</Label>
                <Input className="tabular-nums" type="number" min="0" value={dp_langsung} onChange={(e) => setDpLangsung(e.target.value)} />
              </div>
            )}
            {status_bayar === 'BELUM_BAYAR' && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                Ayam diambil sekarang, ditagih nanti. Tercatat di tab Piutang.
              </p>
            )}
          </>
        )}
        {/* Jatuh tempo: tampil utk PO atau LANGSUNG dgn DP/BELUM_BAYAR */}
        {(isPreOrder || status_bayar !== 'LUNAS') && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tanggal Jatuh Tempo <span className="text-muted-foreground/70">(opsional)</span>
            </Label>
            <Input
              type="date"
              className="tabular-nums"
              value={tanggal_jatuh_tempo}
              onChange={(e) => setTanggalJatuhTempo(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
            <p className="text-[11px] text-muted-foreground">Akan ditandai "LEWAT TEMPO" di tab Piutang setelah lewat tanggal ini.</p>
          </div>
        )}
        <Button
          className="w-full h-12 font-semibold"
          disabled={isSubmitting || cart.length === 0 || !nama_pelanggan.trim()}
          onClick={isPreOrder ? handleSubmitPreOrder : handleSubmitLangsung}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Memproses...' : isPreOrder ? 'Buat Pre-Order' : 'Simpan Transaksi'}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bird className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">KandangKu Kasir</h1>
              <p className="text-xs text-muted-foreground">
                {session?.user?.nama} · <span className="uppercase tracking-wide">{role}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Desktop buttons */}
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex" onClick={() => setOpenCatatMati(true)}>
              <AlertTriangle className="h-4 w-4" /> Mati
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex" onClick={() => setOpenTambahStok(true)}>
              <Package className="h-4 w-4" /> Stok
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex" onClick={() => setOpenPengeluaran(true)}>
              <Wallet className="h-4 w-4" /> Pengeluaran
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex" onClick={() => setOpenKurangiEkorPo(true)}>
              <AlertTriangle className="h-4 w-4" /> Mati PO
            </Button>
            
            {/* Mobile menu dropdown */}
            <div className="relative sm:hidden">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-9 p-0"
                onClick={() => setOpenMobileMenu(!openMobileMenu)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              {openMobileMenu && (
                <div className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-background shadow-lg z-50">
                  <button 
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-b border-border"
                    onClick={() => { setOpenCatatMati(true); setOpenMobileMenu(false); }}
                  >
                    <AlertTriangle className="h-4 w-4" /> Catat Mati
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-b border-border"
                    onClick={() => { setOpenTambahStok(true); setOpenMobileMenu(false); }}
                  >
                    <Package className="h-4 w-4" /> Tambah Stok
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-b border-border"
                    onClick={() => { setOpenPengeluaran(true); setOpenMobileMenu(false); }}
                  >
                    <Wallet className="h-4 w-4" /> Pengeluaran
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                    onClick={() => { setOpenKurangiEkorPo(true); setOpenMobileMenu(false); }}
                  >
                    <AlertTriangle className="h-4 w-4" /> Mati PO
                  </button>
                  {role === 'ADMIN' && (
                    <>
                      <Link href="/dashboard" className="block">
                        <button 
                          className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 border-t border-border"
                          onClick={() => setOpenMobileMenu(false)}
                        >
                          <LayoutDashboard className="h-4 w-4" /> Dashboard
                        </button>
                      </Link>
                      <Link href="/admin" className="block">
                        <button 
                          className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                          onClick={() => setOpenMobileMenu(false)}
                        >
                          <ShieldCheck className="h-4 w-4" /> Admin
                        </button>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {role === 'ADMIN' && (
              <>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="gap-1.5 hidden md:inline-flex">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Button>
                </Link>
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-1.5 hidden md:inline-flex">
                    <ShieldCheck className="h-4 w-4" /> Admin
                  </Button>
                </Link>
              </>
            )}
            <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => signOut({ callbackUrl: '/auth/signin' })} aria-label="Keluar">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === 'LANGSUNG' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Penjualan Langsung</CardTitle>
                  <CardDescription>Stok berkurang segera. Bisa Lunas, DP, atau Hutang.</CardDescription>
                </CardHeader>
                <CardContent>{CartForm}</CardContent>
              </Card>
            </div>
            <div>{SummaryCard(false)}</div>
          </div>
        )}

        {tab === 'PRE_ORDER' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Buat Pre-Order</CardTitle>
                  <CardDescription>Stok dipindahkan ke booking. Harga dikunci saat pelunasan.</CardDescription>
                </CardHeader>
                <CardContent>{CartForm}</CardContent>
              </Card>
            </div>
            <div>{SummaryCard(true)}</div>
          </div>
        )}

        {tab === 'PIUTANG' && (
          <Card>
            <CardHeader>
              <CardTitle>Daftar Piutang & Pre-Order Aktif</CardTitle>
              <CardDescription>
                Hutang transaksi langsung & PO yang belum lunas. Klik tombol WhatsApp untuk follow-up langsung.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              {/* Filter bar */}
              <div className="px-4 sm:px-0 mb-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Cari nama pelanggan atau nomor WA..."
                    value={filter_search}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                  {filter_search && (
                    <button
                      type="button"
                      onClick={() => setFilterSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Hapus pencarian"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
                    {([
                      { v: 'ALL', l: 'Semua' },
                      { v: 'LANGSUNG', l: 'Hutang' },
                      { v: 'PRE_ORDER', l: 'PO' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        onClick={() => setFilterTipe(opt.v)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          filter_tipe === opt.v
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setFilterLewatTempo(!filter_lewat_tempo)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter_lewat_tempo
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {filter_lewat_tempo && <Check className="h-3 w-3" />} Hanya Lewat Tempo
                  </button>
                  <p className="ml-auto text-xs text-muted-foreground">
                    {piutangFiltered.length === piutangList.length
                      ? `${piutangList.length} item`
                      : `${piutangFiltered.length} dari ${piutangList.length} item`}
                  </p>
                </div>
              </div>

              {loadingPiutang ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : piutangList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Tidak ada piutang aktif</p>
                </div>
              ) : piutangFiltered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Tidak ada piutang yang cocok dengan filter</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Sudah Bayar</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Sisa</TableHead>
                        <TableHead>Waktu</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {piutangFiltered.map((p) => {
                        const waUrl = buildWaUrl(p.nomor_wa, buildWaMessage(p));
                        // Apakah user bisa membatalkan?
                        // ADMIN: selalu, KASIR: hanya kalau waktu transaksi < 1 jam
                        const waktuMillis = new Date(p.waktu_iso).getTime();
                        const dalamWindow = role === 'ADMIN' || (Date.now() - waktuMillis < 60 * 60 * 1000);
                        return (
                          <TableRow key={p.id} className={p.lewat_tempo ? 'bg-rose-50/30' : ''}>
                            <TableCell>
                              <p className="font-medium">{p.nama_pelanggan}</p>
                              <p className="text-xs text-muted-foreground">{p.nomor_wa || '— tanpa nomor WA'}</p>
                              {p.tanggal_jatuh_tempo && (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="text-[11px] text-muted-foreground">Tempo: {p.tanggal_jatuh_tempo}</span>
                                  {p.lewat_tempo && (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0">LEWAT TEMPO</Badge>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={p.tipe_transaksi === 'LANGSUNG' ? 'destructive' : 'info'}>
                                {p.tipe_transaksi === 'LANGSUNG' ? 'HUTANG' : 'PRE-ORDER'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={p.status_bayar === 'DP' ? 'warning' : 'destructive'}>
                                {p.status_bayar}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatRupiah(p.sudah_dibayar)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatRupiah(p.total_harga_efektif)}</TableCell>
                            <TableCell className="text-right font-semibold text-rose-600 tabular-nums">{formatRupiah(p.sisa_bayar)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{p.waktu}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {waUrl ? (
                                  <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label={`Hubungi ${p.nama_pelanggan} via WhatsApp`}>
                                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                                      <MessageCircle className="h-4 w-4" /> WA
                                    </Button>
                                  </a>
                                ) : (
                                  <Button size="sm" variant="outline" disabled className="gap-1.5" title="Nomor WA tidak tersedia">
                                    <MessageCircle className="h-4 w-4" /> WA
                                  </Button>
                                )}
                                <Button size="sm" onClick={() => { setSelectedPiutang(p); setOpenLunas(true); }}>
                                  Bayar
                                </Button>
                                <Link href={`/receipt/${p.id}`} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="gap-1.5" title="Cetak struk">
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                                  disabled={!dalamWindow}
                                  title={dalamWindow ? 'Batalkan transaksi' : 'Kasir hanya bisa batalkan dalam 1 jam'}
                                  onClick={() => { setSelectedForBatal(p); setOpenBatal(true); }}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialog Bayar / Lunasi */}
      <Dialog open={openLunas} onOpenChange={setOpenLunas}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" /> Bayar / Lunasi
            </DialogTitle>
            <DialogDescription>
              {selectedPiutang?.nama_pelanggan} —{' '}
              {selectedPiutang?.tipe_transaksi === 'LANGSUNG' ? 'Hutang penjualan langsung' : 'Pre-Order'}
            </DialogDescription>
          </DialogHeader>
          {selectedPiutang && (
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3.5">
                {selectedPiutang.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.nama_kategori} × {item.jumlah_ekor} ekor</span>
                    <span className="tabular-nums">{formatRupiah(item.harga_efektif * item.jumlah_ekor)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total {selectedPiutang.tipe_transaksi === 'PRE_ORDER' ? '(harga sekarang)' : ''}
                  </span>
                  <span className="font-medium tabular-nums">{formatRupiah(selectedPiutang.total_harga_efektif)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Diskon sebelumnya</span>
                  <span className="tabular-nums">− {formatRupiah(selectedPiutang.diskon)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Sudah dibayar</span>
                  <span className="tabular-nums">− {formatRupiah(selectedPiutang.sudah_dibayar)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Sisa tagihan</span>
                  <span className="tabular-nums text-rose-600">{formatRupiah(selectedPiutang.sisa_bayar)}</span>
                </div>
              </div>

              {/* Riwayat Pembayaran */}
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Riwayat Pembayaran</p>
                {loadingRiwayat ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : riwayatPembayaran.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada pembayaran tercatat</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {riwayatPembayaran.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {r.is_awal ? 'Pembayaran awal' : `Cicilan → ${r.status_sesudah}`}
                          </p>
                          <p className="text-muted-foreground">
                            {r.waktu} · {r.kasir_nama}
                            {r.diskon_tambahan > 0 && (
                              <span className="text-amber-600"> · diskon {formatRupiah(r.diskon_tambahan)}</span>
                            )}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-emerald-700 shrink-0">
                          {formatRupiah(r.jumlah)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bayar Sekarang</Label>
                  <Input className="tabular-nums" type="number" min="0" value={tambahan_bayar} onChange={(e) => setTambahanBayar(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Diskon Tambahan</Label>
                  <Input className="tabular-nums" type="number" min="0" value={diskon_tambahan} onChange={(e) => setDiskonTambahan(e.target.value)} />
                </div>
              </div>
              {(() => {
                const bayar = parseInt(tambahan_bayar) || 0;
                const dt = parseInt(diskon_tambahan) || 0;
                const sisa_baru = Math.max(0, selectedPiutang.sisa_bayar - bayar - dt);
                const akan_lunas = sisa_baru === 0;
                return (
                  <div className={`flex justify-between rounded-lg border p-2.5 text-sm font-semibold ${akan_lunas ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    <span>{akan_lunas ? 'Akan jadi LUNAS ✓' : 'Sisa setelah pembayaran ini'}</span>
                    <span className="tabular-nums">{formatRupiah(sisa_baru)}</span>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenLunas(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleLunas} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pembatalan Transaksi */}
      <Dialog open={openBatal} onOpenChange={setOpenBatal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-rose-600" /> Batalkan Transaksi
            </DialogTitle>
            <DialogDescription>
              {selectedForBatal?.nama_pelanggan} —{' '}
              {selectedForBatal?.tipe_transaksi === 'PRE_ORDER' ? 'Pre-Order' : 'Penjualan langsung'}
            </DialogDescription>
          </DialogHeader>
          {selectedForBatal && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <p className="font-semibold mb-1">Konsekuensi pembatalan:</p>
                <ul className="space-y-0.5 list-disc pl-4">
                  <li>
                    Stok ayam akan dikembalikan{' '}
                    {selectedForBatal.tipe_transaksi === 'PRE_ORDER'
                      ? 'dari booking ke siap-jual'
                      : 'ke siap-jual (asumsi ayam masih utuh)'}
                  </li>
                  <li>Transaksi ditandai dibatalkan, tidak dihapus (untuk audit)</li>
                  {selectedForBatal.sudah_dibayar > 0 && (
                    <li>Pelanggan sudah membayar {formatRupiah(selectedForBatal.sudah_dibayar)} — pilih opsi refund di bawah</li>
                  )}
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Alasan Pembatalan</Label>
                <Input
                  maxLength={500}
                  placeholder="Contoh: pelanggan tidak jadi ambil, ayam mati"
                  value={alasan_batal}
                  onChange={(e) => setAlasanBatal(e.target.value)}
                />
              </div>

              {selectedForBatal.sudah_dibayar > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Refund Uang Pelanggan?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundChoice('REFUND')}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                        refund_choice === 'REFUND'
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {refund_choice === 'REFUND' && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                        <span className="text-sm font-semibold">Refund</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Kembalikan {formatRupiah(selectedForBatal.sudah_dibayar)} ke pelanggan. Tercatat di riwayat.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundChoice('NO_REFUND')}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                        refund_choice === 'NO_REFUND'
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {refund_choice === 'NO_REFUND' && <Check className="h-3.5 w-3.5 text-amber-700" />}
                        <span className="text-sm font-semibold">Tanpa Refund</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Uang DP {formatRupiah(selectedForBatal.sudah_dibayar)} hangus / dianggap kompensasi.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {role === 'KASIR' && (
                <p className="text-[11px] text-muted-foreground italic">
                  Kasir hanya bisa membatalkan dalam 1 jam. Untuk pembatalan transaksi lama, hubungi admin.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBatal(false)} disabled={isSubmittingBatal}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleBatal}
              disabled={isSubmittingBatal || !alasan_batal.trim()}
            >
              {isSubmittingBatal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmittingBatal ? 'Memproses...' : 'Konfirmasi Pembatalan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Catat Mati */}
      <Dialog open={openCatatMati} onOpenChange={setOpenCatatMati}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" /> Catat Ayam Mati
            </DialogTitle>
            <DialogDescription>Stok bebas akan berkurang dan tercatat di history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kategori</Label>
              <Select value={mati_kategori_id} onValueChange={setMatiKategoriId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                <SelectContent>{kategori.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kategori} (Stok: {k.stok_bebas})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah Ekor</Label>
              <Input className="tabular-nums" type="number" min="1" value={mati_jumlah} onChange={(e) => setMatiJumlah(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCatatMati(false)} disabled={isSubmittingMati}>Batal</Button>
            <Button variant="destructive" onClick={handleCatatMati} disabled={isSubmittingMati}>
              {isSubmittingMati && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmittingMati ? 'Memproses...' : 'Catat Mati'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Stok */}
      <Dialog open={openTambahStok} onOpenChange={setOpenTambahStok}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" /> Tambah Stok
            </DialogTitle>
            <DialogDescription>Pindahkan ayam dari kandang ke stok siap jual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kategori</Label>
              <Select value={tambah_kategori_id} onValueChange={setTambahKategoriId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                <SelectContent>{kategori.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kategori} (Stok: {k.stok_bebas})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah Ekor</Label>
              <Input className="tabular-nums" type="number" min="1" value={tambah_jumlah} onChange={(e) => setTambahJumlah(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTambahStok(false)} disabled={isSubmittingTambah}>Batal</Button>
            <Button onClick={handleTambahStok} disabled={isSubmittingTambah}>
              {isSubmittingTambah && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmittingTambah ? 'Memproses...' : 'Tambah Stok'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pengeluaran Kas */}
      <Dialog open={openPengeluaran} onOpenChange={setOpenPengeluaran}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-600" /> Catat Pengeluaran Kas
            </DialogTitle>
            <DialogDescription>Uang kas yang dikeluarkan untuk operasional (pakan, sopir, dll).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah (Rp)</Label>
              <Input className="tabular-nums" type="number" min="1" placeholder="0" value={pengeluaran_jumlah} onChange={(e) => setPengeluaranJumlah(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kategori (opsional)</Label>
              <Select value={pengeluaran_kategori_id} onValueChange={setPengeluaranKategoriId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                <SelectContent>
                  {kategoriPengeluaran.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Belum ada kategori aktif</div>
                  ) : (
                    kategoriPengeluaran.map((k) => (
                      <SelectItem key={k.id} value={String(k.id)}>{k.nama}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Bisa dikosongkan kalau belum ada kategori cocok. Admin bisa tambah kategori di panel admin.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Keterangan (opsional)</Label>
              <Input maxLength={200} placeholder="Contoh: beli pakan untuk minggu depan" value={pengeluaran_keterangan} onChange={(e) => setPengeluaranKeterangan(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPengeluaran(false)} disabled={isSubmittingPengeluaran}>Batal</Button>
            <Button onClick={handlePengeluaran} disabled={isSubmittingPengeluaran}>
              {isSubmittingPengeluaran && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmittingPengeluaran ? 'Memproses...' : 'Catat Pengeluaran'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catat Ayam Mati PO Dialog */}
      <KurangiEkorPoDialog
        open={openKurangiEkorPo}
        onOpenChange={setOpenKurangiEkorPo}
        kategoriList={kategori}
        onSuccess={() => {
          refreshKategori();
          toast({ variant: 'success', title: 'Berhasil', description: 'Ekor PO berhasil dikurangi' });
        }}
      />
    </div>
  );
}
