'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { ActionResponse } from '@/lib/types';

// ============================================
// CREATE PENGELUARAN
// ============================================

const CreatePengeluaranSchema = z.object({
  jumlah: z.number().int().positive('Jumlah harus lebih dari 0'),
  id_kategori: z.number().int().positive().optional(),
  keterangan: z.string().max(200, 'Keterangan terlalu panjang').optional(),
});

type CreatePengeluaranInput = z.infer<typeof CreatePengeluaranSchema>;

/**
 * Catat pengeluaran kas (mis. beli pakan, bayar sopir).
 * Mengurangi "kas net" tetapi tidak menyentuh stok ayam.
 * Kategori opsional — kasir bisa tidak isi kalau belum kebagian kategori.
 */
export async function createPengeluaran(
  input: CreatePengeluaranInput
): Promise<ActionResponse<{ pengeluaran_id: number }>> {
  try {
    const validated = CreatePengeluaranSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Anda harus login terlebih dahulu', error: 'UNAUTHORIZED' };
    }
    const id_kasir = parseInt(session.user.id as string, 10);

    // Validasi kategori (kalau diisi)
    if (validated.id_kategori) {
      const kategori = await prisma.kategoriPengeluaran.findUnique({
        where: { id: validated.id_kategori },
      });
      if (!kategori || !kategori.aktif) {
        return {
          success: false,
          message: 'Kategori pengeluaran tidak ditemukan atau sudah dinonaktifkan',
          error: 'INVALID_KATEGORI',
        };
      }
    }

    const pengeluaran = await prisma.pengeluaran.create({
      data: {
        jumlah: validated.jumlah,
        id_kategori: validated.id_kategori ?? null,
        keterangan: validated.keterangan?.trim() || null,
        id_kasir,
      },
    });

    return {
      success: true,
      message: 'Pengeluaran berhasil dicatat',
      data: { pengeluaran_id: pengeluaran.id },
    };
  } catch (error) {
    console.error('Error createPengeluaran:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Gagal mencatat pengeluaran', error: error instanceof Error ? error.message : 'UNKNOWN' };
  }
}

// ============================================
// LIST PENGELUARAN HARI INI
// ============================================

/**
 * Daftar pengeluaran hari ini, untuk ditampilkan di kasir page / dashboard.
 */
export async function getPengeluaranHariIni(): Promise<
  ActionResponse<
    Array<{
      id: number;
      jumlah: number;
      keterangan: string | null;
      kategori_nama: string | null;
      kasir_nama: string;
      waktu: string;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const list = await prisma.pengeluaran.findMany({
      where: { waktu: { gte: start, lt: end } },
      include: {
        kategori: { select: { nama: true } },
        kasir: { select: { nama: true } },
      },
      orderBy: { waktu: 'desc' },
    });

    const data = list.map((p) => ({
      id: p.id,
      jumlah: p.jumlah,
      keterangan: p.keterangan,
      kategori_nama: p.kategori?.nama ?? null,
      kasir_nama: p.kasir.nama,
      waktu: p.waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    }));

    return { success: true, message: 'OK', data };
  } catch (error) {
    console.error('Error getPengeluaranHariIni:', error);
    return { success: false, message: 'Gagal mengambil daftar pengeluaran', error: 'FETCH_ERROR' };
  }
}

// ============================================
// LIST KATEGORI PENGELUARAN AKTIF
// ============================================

/**
 * Daftar kategori pengeluaran yang aktif (untuk dropdown di form).
 */
export async function getKategoriPengeluaran(): Promise<
  ActionResponse<Array<{ id: number; nama: string }>>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const list = await prisma.kategoriPengeluaran.findMany({
      where: { aktif: true },
      select: { id: true, nama: true },
      orderBy: { nama: 'asc' },
    });

    return { success: true, message: 'OK', data: list };
  } catch (error) {
    console.error('Error getKategoriPengeluaran:', error);
    return { success: false, message: 'Gagal mengambil kategori', error: 'FETCH_ERROR' };
  }
}

// ============================================
// ADMIN: TAMBAH KATEGORI PENGELUARAN
// ============================================

const CreateKategoriPengeluaranSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi').max(50, 'Nama terlalu panjang'),
});

export async function createKategoriPengeluaran(
  input: { nama: string }
): Promise<ActionResponse<{ id: number; nama: string }>> {
  try {
    const validated = CreateKategoriPengeluaranSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }
    if ((session.user as any).role !== 'ADMIN') {
      return { success: false, message: 'Hanya admin yang bisa mengelola kategori', error: 'FORBIDDEN' };
    }

    const nama = validated.nama.trim();

    // Cek duplikat (case-insensitive)
    const existing = await prisma.kategoriPengeluaran.findFirst({
      where: { nama: { equals: nama, mode: 'insensitive' } },
    });
    if (existing) {
      // Kalau ada tapi nonaktif, aktifkan saja
      if (!existing.aktif) {
        const reactivated = await prisma.kategoriPengeluaran.update({
          where: { id: existing.id },
          data: { aktif: true },
        });
        return {
          success: true,
          message: `Kategori "${nama}" diaktifkan kembali`,
          data: { id: reactivated.id, nama: reactivated.nama },
        };
      }
      return { success: false, message: `Kategori "${nama}" sudah ada`, error: 'DUPLICATE' };
    }

    const kategori = await prisma.kategoriPengeluaran.create({ data: { nama } });
    return {
      success: true,
      message: 'Kategori berhasil ditambahkan',
      data: { id: kategori.id, nama: kategori.nama },
    };
  } catch (error) {
    console.error('Error createKategoriPengeluaran:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Gagal menambah kategori', error: error instanceof Error ? error.message : 'UNKNOWN' };
  }
}

// ============================================
// ADMIN: TOGGLE KATEGORI PENGELUARAN AKTIF/NONAKTIF
// ============================================

export async function toggleKategoriPengeluaran(
  input: { id: number; aktif: boolean }
): Promise<ActionResponse<{ id: number; aktif: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }
    if ((session.user as any).role !== 'ADMIN') {
      return { success: false, message: 'Hanya admin yang bisa mengelola kategori', error: 'FORBIDDEN' };
    }

    if (!Number.isInteger(input.id) || input.id <= 0) {
      return { success: false, message: 'ID kategori tidak valid', error: 'INVALID_ID' };
    }

    const kategori = await prisma.kategoriPengeluaran.update({
      where: { id: input.id },
      data: { aktif: input.aktif },
    });

    return {
      success: true,
      message: input.aktif ? 'Kategori diaktifkan' : 'Kategori dinonaktifkan',
      data: { id: kategori.id, aktif: kategori.aktif },
    };
  } catch (error) {
    console.error('Error toggleKategoriPengeluaran:', error);
    return { success: false, message: 'Gagal mengubah status kategori', error: error instanceof Error ? error.message : 'UNKNOWN' };
  }
}

// ============================================
// ADMIN: LIST SEMUA KATEGORI (TERMASUK NONAKTIF)
// ============================================

export async function getAllKategoriPengeluaran(): Promise<
  ActionResponse<Array<{ id: number; nama: string; aktif: boolean }>>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }
    if ((session.user as any).role !== 'ADMIN') {
      return { success: false, message: 'Forbidden', error: 'FORBIDDEN' };
    }

    const list = await prisma.kategoriPengeluaran.findMany({
      orderBy: [{ aktif: 'desc' }, { nama: 'asc' }],
    });

    return {
      success: true,
      message: 'OK',
      data: list.map((k) => ({ id: k.id, nama: k.nama, aktif: k.aktif })),
    };
  } catch (error) {
    console.error('Error getAllKategoriPengeluaran:', error);
    return { success: false, message: 'Gagal mengambil kategori', error: 'FETCH_ERROR' };
  }
}
