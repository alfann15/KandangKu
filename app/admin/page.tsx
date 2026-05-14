'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/use-toast';
import { formatRupiah } from '@/lib/utils';
import { getKategoriForAdmin, updateHargaKategori, updateStokKategori, getMutasiStokHistory, createKategori, getKategoriPengeluaranForAdmin, createKategoriPengeluaran, toggleKategoriPengeluaran, toggleKategoriAyam, deleteKategoriAyam, deleteKategoriPengeluaran, getAllUsers, createUser, deleteUser, changeUserRole, resetUserPassword } from '@/lib/admin-actions';
import {
  LogOut, Pencil, ShieldCheck, Tag, Boxes, History,
  LayoutDashboard, Bird, BarChart3, Loader2, Inbox,
  RotateCw, Pause, Play, Plus, Eye, EyeOff, Trash2, Users,
} from 'lucide-react';

type Kategori = { id: number; nama_kategori: string; harga_hari_ini: number; stok_bebas: number; stok_booking: number; aktif: boolean };
type MutasiHistory = { id: number; kategori_nama: string; jumlah_ekor: number; tipe_mutasi: string; kasir_nama: string; waktu_mutasi: string };
type KategoriPengeluaran = { id: number; nama: string; aktif: boolean };
type User = { id: number; nama: string; username: string; role: string };

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [kategori_list, setKategoriList] = useState<Kategori[]>([]);
  const [mutasi_history, setMutasiHistory] = useState<MutasiHistory[]>([]);
  const [kategori_pengeluaran, setKategoriPengeluaran] = useState<KategoriPengeluaran[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auto_refresh, setAutoRefresh] = useState(true);
  const [openEditHarga, setOpenEditHarga] = useState(false);
  const [openEditStok, setOpenEditStok] = useState(false);
  const [openCreateKategori, setOpenCreateKategori] = useState(false);
  const [openCreateKategoriPengeluaran, setOpenCreateKategoriPengeluaran] = useState(false);
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [openResetPassword, setOpenResetPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedKategori, setSelectedKategori] = useState<Kategori | null>(null);
  const [edit_harga, setEditHarga] = useState('');
  const [edit_stok_bebas, setEditStokBebas] = useState('');
  const [edit_stok_booking, setEditStokBooking] = useState('');
  const [create_nama, setCreateNama] = useState('');
  const [create_harga, setCreateHarga] = useState('');
  const [create_nama_pengeluaran, setCreateNamaPengeluaran] = useState('');
  const [create_user_nama, setCreateUserNama] = useState('');
  const [create_user_username, setCreateUserUsername] = useState('');
  const [create_user_password, setCreateUserPassword] = useState('');
  const [create_user_role, setCreateUserRole] = useState<'ADMIN' | 'KASIR'>('KASIR');
  const [reset_password, setResetPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [kategoriRes, mutasiRes, pengeluaranRes, usersRes] = await Promise.all([getKategoriForAdmin(), getMutasiStokHistory(30), getKategoriPengeluaranForAdmin(), getAllUsers()]);
      if (kategoriRes.error === 'FORBIDDEN') { router.push('/kasir'); return; }
      if (kategoriRes.success && kategoriRes.data) setKategoriList(kategoriRes.data);
      if (mutasiRes.success && mutasiRes.data) setMutasiHistory(mutasiRes.data);
      if (pengeluaranRes.success && pengeluaranRes.data) setKategoriPengeluaran(pengeluaranRes.data);
      if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/signin'); return; }
    if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') { router.push('/kasir'); return; }
    if (status !== 'authenticated') return;
    loadData();
    const interval = auto_refresh ? setInterval(() => loadData(true), 10000) : null;
    return () => { if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, auto_refresh]);

  const handleSaveHarga = async () => {
    if (!selectedKategori || !edit_harga) return;
    setIsSubmitting(true);
    const result = await updateHargaKategori({ id_kategori: selectedKategori.id, harga_baru: parseInt(edit_harga) });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setOpenEditHarga(false); await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleSaveStok = async () => {
    if (!selectedKategori) return;
    setIsSubmitting(true);
    const result = await updateStokKategori({ id_kategori: selectedKategori.id, stok_bebas: parseInt(edit_stok_bebas) || 0, stok_booking: parseInt(edit_stok_booking) || 0 });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setOpenEditStok(false); await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleCreateKategori = async () => {
    if (!create_nama || !create_harga) return;
    setIsSubmitting(true);
    const result = await createKategori({ nama_kategori: create_nama, harga_hari_ini: parseInt(create_harga) });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setOpenCreateKategori(false);
      setCreateNama('');
      setCreateHarga('');
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleCreateKategoriPengeluaran = async () => {
    if (!create_nama_pengeluaran) return;
    setIsSubmitting(true);
    const result = await createKategoriPengeluaran({ nama: create_nama_pengeluaran });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setOpenCreateKategoriPengeluaran(false);
      setCreateNamaPengeluaran('');
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleToggleKategoriPengeluaran = async (id: number, aktif: boolean) => {
    const result = await toggleKategoriPengeluaran({ id, aktif: !aktif });
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleToggleKategoriAyam = async (id: number, aktif: boolean) => {
    const result = await toggleKategoriAyam({ id, aktif: !aktif });
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleDeleteKategoriAyam = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    const result = await deleteKategoriAyam({ id });
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleDeleteKategoriPengeluaran = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    const result = await deleteKategoriPengeluaran({ id });
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleCreateUser = async () => {
    if (!create_user_nama || !create_user_username || !create_user_password) return;
    setIsSubmitting(true);
    const result = await createUser({ nama: create_user_nama, username: create_user_username, password: create_user_password, role: create_user_role });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setOpenCreateUser(false);
      setCreateUserNama('');
      setCreateUserUsername('');
      setCreateUserPassword('');
      setCreateUserRole('KASIR');
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Yakin ingin menghapus user ini?')) return;
    const result = await deleteUser({ id });
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleChangeUserRole = async (id: number, newRole: 'ADMIN' | 'KASIR') => {
    const result = await changeUserRole({ id, role: newRole });
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      await loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: result.message });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !reset_password) return;
    setIsSubmitting(true);
    const result = await resetUserPassword({ id: selectedUser.id, password_baru: reset_password });
    setIsSubmitting(false);
    if (result.success) {
      toast({ variant: 'success', title: 'Berhasil', description: result.message });
      setOpenResetPassword(false);
      setResetPassword('');
      setSelectedUser(null);
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Kelola harga &amp; stok</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/kasir" className="hidden sm:block">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Bird className="h-4 w-4" /> Kasir
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-1.5 hidden sm:inline-flex">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <Link href="/rekap">
              <Button variant="outline" size="sm" className="gap-1.5 hidden md:inline-flex">
                <BarChart3 className="h-4 w-4" /> Rekap
              </Button>
            </Link>
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
        {/* Kategori Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Manajemen Kategori Ayam</CardTitle>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setOpenCreateKategori(true)}>
                <Plus className="h-4 w-4" /> Tambah Kategori
              </Button>
            </div>
            <CardDescription>Update harga jual dan stok harian</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {kategori_list.map((k) => (
                <div key={k.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold tracking-tight">{k.nama_kategori}</p>
                      {!k.aktif && <Badge variant="secondary">Nonaktif</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="muted" className="tabular-nums">
                        <Tag className="h-3 w-3" /> {formatRupiah(k.harga_hari_ini)}
                      </Badge>
                      <Badge variant="info" className="tabular-nums">
                        Siap: {k.stok_bebas}
                      </Badge>
                      <Badge variant="warning" className="tabular-nums">
                        Booking: {k.stok_booking}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { setSelectedKategori(k); setEditHarga(String(k.harga_hari_ini)); setOpenEditHarga(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Harga
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { setSelectedKategori(k); setEditStokBebas(String(k.stok_bebas)); setEditStokBooking(String(k.stok_booking)); setOpenEditStok(true); }}
                    >
                      <Boxes className="h-3.5 w-3.5" /> Stok
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleToggleKategoriAyam(k.id, k.aktif)}
                    >
                      {k.aktif ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {k.aktif ? 'Nonaktif' : 'Aktif'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => handleDeleteKategoriAyam(k.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Kategori Pengeluaran Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Kategori Pengeluaran</CardTitle>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setOpenCreateKategoriPengeluaran(true)}>
                <Plus className="h-4 w-4" /> Tambah Kategori
              </Button>
            </div>
            <CardDescription>Kelola kategori pengeluaran kas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {kategori_pengeluaran.map((k) => (
                <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${k.aktif ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                    <span className="font-medium">{k.nama}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleToggleKategoriPengeluaran(k.id, k.aktif)}
                    >
                      {k.aktif ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteKategoriPengeluaran(k.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Manajemen User</CardTitle>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setOpenCreateUser(true)}>
                <Plus className="h-4 w-4" /> Tambah User
              </Button>
            </div>
            <CardDescription>Kelola user dan role</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <Inbox className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">Belum ada user</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nama}</TableCell>
                    <TableCell className="text-muted-foreground">{u.username}</TableCell>
                    <TableCell>
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeUserRole(u.id, e.target.value as 'ADMIN' | 'KASIR')}
                        className="rounded border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option value="KASIR">KASIR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => { setSelectedUser(u); setResetPassword(''); setOpenResetPassword(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Reset Pass
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Mutasi History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle>History Mutasi Stok</CardTitle>
            </div>
            <CardDescription>30 perubahan stok terakhir · auto-refresh tiap 10 detik</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Kasir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mutasi_history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <Inbox className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">Belum ada mutasi stok</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : mutasi_history.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{m.waktu_mutasi}</TableCell>
                    <TableCell className="font-medium">{m.kategori_nama}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipe_mutasi === 'TAMBAH_STOK' ? 'success' : 'destructive'}>
                        {m.tipe_mutasi === 'TAMBAH_STOK' ? '+' : '−'} {m.tipe_mutasi.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">{m.jumlah_ekor} ekor</TableCell>
                    <TableCell className="text-muted-foreground">{m.kasir_nama}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Edit Harga Dialog */}
      <Dialog open={openEditHarga} onOpenChange={setOpenEditHarga}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" /> Edit Harga
            </DialogTitle>
            <DialogDescription>
              {selectedKategori?.nama_kategori} · Harga lama: {formatRupiah(selectedKategori?.harga_hari_ini || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Harga Baru (Rp)</Label>
            <Input className="tabular-nums" type="number" min="1" value={edit_harga} onChange={(e) => setEditHarga(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditHarga(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleSaveHarga} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stok Dialog */}
      <Dialog open={openEditStok} onOpenChange={setOpenEditStok}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-muted-foreground" /> Edit Stok
            </DialogTitle>
            <DialogDescription>{selectedKategori?.nama_kategori}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stok Siap Jual</Label>
              <Input className="tabular-nums" type="number" min="0" value={edit_stok_bebas} onChange={(e) => setEditStokBebas(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stok Booking</Label>
              <Input className="tabular-nums" type="number" min="0" value={edit_stok_booking} onChange={(e) => setEditStokBooking(e.target.value)} />
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
              <span className="text-muted-foreground">Total stok: </span>
              <span className="font-semibold tabular-nums">{(parseInt(edit_stok_bebas) || 0) + (parseInt(edit_stok_booking) || 0)} ekor</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditStok(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleSaveStok} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Kategori Dialog */}
      <Dialog open={openCreateKategori} onOpenChange={setOpenCreateKategori}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-muted-foreground" /> Tambah Kategori Ayam
            </DialogTitle>
            <DialogDescription>Buat kategori ayam baru dengan harga awal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Kategori</Label>
              <Input placeholder="Contoh: Ayam Jumbo" value={create_nama} onChange={(e) => setCreateNama(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Harga Awal (Rp)</Label>
              <Input className="tabular-nums" type="number" min="1" placeholder="0" value={create_harga} onChange={(e) => setCreateHarga(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateKategori(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleCreateKategori} disabled={isSubmitting || !create_nama || !create_harga}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Membuat...' : 'Buat Kategori'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Kategori Pengeluaran Dialog */}
      <Dialog open={openCreateKategoriPengeluaran} onOpenChange={setOpenCreateKategoriPengeluaran}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-muted-foreground" /> Tambah Kategori Pengeluaran
            </DialogTitle>
            <DialogDescription>Buat kategori pengeluaran kas baru</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Kategori</Label>
              <Input placeholder="Contoh: Pakan, Sopir, Listrik" value={create_nama_pengeluaran} onChange={(e) => setCreateNamaPengeluaran(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateKategoriPengeluaran(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleCreateKategoriPengeluaran} disabled={isSubmitting || !create_nama_pengeluaran}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Membuat...' : 'Buat Kategori'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={openCreateUser} onOpenChange={setOpenCreateUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-muted-foreground" /> Tambah User
            </DialogTitle>
            <DialogDescription>Buat user baru dengan role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nama</Label>
              <Input placeholder="Nama lengkap" value={create_user_nama} onChange={(e) => setCreateUserNama(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Username</Label>
              <Input placeholder="Username untuk login" value={create_user_username} onChange={(e) => setCreateUserUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input type="password" placeholder="Password minimal 6 karakter" value={create_user_password} onChange={(e) => setCreateUserPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
              <select
                value={create_user_role}
                onChange={(e) => setCreateUserRole(e.target.value as 'ADMIN' | 'KASIR')}
                className="w-full rounded border border-border bg-background px-3 py-2"
              >
                <option value="KASIR">KASIR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateUser(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting || !create_user_nama || !create_user_username || !create_user_password}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Membuat...' : 'Buat User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={openResetPassword} onOpenChange={setOpenResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-muted-foreground" /> Reset Password
            </DialogTitle>
            <DialogDescription>{selectedUser?.nama}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password Baru</Label>
              <Input type="password" placeholder="Password minimal 6 karakter" value={reset_password} onChange={(e) => setResetPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenResetPassword(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleResetPassword} disabled={isSubmitting || !reset_password}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Mereset...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
