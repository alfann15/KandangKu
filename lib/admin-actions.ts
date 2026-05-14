'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

type ActionResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
};

/**
 * Get all kategori untuk admin editing
 */
export async function getKategoriForAdmin(): Promise<
  ActionResponse<
    Array<{
      id: number;
      nama_kategori: string;
      harga_hari_ini: number;
      stok_bebas: number;
      stok_booking: number;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: 'Unauthorized',
        error: 'UNAUTHORIZED',
      };
    }

    // Check if user is ADMIN
    if (session.user.role !== 'ADMIN') {
      return {
        success: false,
        message: 'Hanya admin yang bisa mengakses',
        error: 'FORBIDDEN',
      };
    }

    const kategori = await prisma.kategoriAyam.findMany({
      orderBy: { nama_kategori: 'asc' },
    });

    return {
      success: true,
      message: 'Kategori berhasil diambil',
      data: kategori,
    };
  } catch (error) {
    console.error('Error getting kategori:', error);
    return {
      success: false,
      message: 'Gagal mengambil data kategori',
      error: 'FETCH_ERROR',
    };
  }
}

/**
 * Update harga untuk satu kategori
 */
const UpdateHargaSchema = z.object({
  id_kategori: z.number().int().positive(),
  harga_baru: z.number().int().positive('Harga harus lebih dari 0'),
});

type UpdateHargaInput = z.infer<typeof UpdateHargaSchema>;

export async function updateHargaKategori(
  input: UpdateHargaInput
): Promise<ActionResponse> {
  try {
    const validated = UpdateHargaSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: 'Unauthorized',
        error: 'UNAUTHORIZED',
      };
    }

    // Check if user is ADMIN
    if (session.user.role !== 'ADMIN') {
      return {
        success: false,
        message: 'Hanya admin yang bisa mengubah harga',
        error: 'FORBIDDEN',
      };
    }

    // Check kategori exists
    const kategori = await prisma.kategoriAyam.findUnique({
      where: { id: validated.id_kategori },
    });

    if (!kategori) {
      return {
        success: false,
        message: 'Kategori ayam tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    const harga_lama = kategori.harga_hari_ini;

    // Update harga
    await prisma.kategoriAyam.update({
      where: { id: validated.id_kategori },
      data: {
        harga_hari_ini: validated.harga_baru,
      },
    });

    return {
      success: true,
      message: `Harga ${kategori.nama_kategori} diubah dari ${harga_lama} menjadi ${validated.harga_baru}`,
    };
  } catch (error) {
    console.error('Error updating harga:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal mengubah harga',
      error: 'UPDATE_ERROR',
    };
  }
}

/**
 * Update stok booking (untuk pre-order)
 */
const UpdateStokBookingSchema = z.object({
  id_kategori: z.number().int().positive(),
  stok_bebas: z.number().int().min(0),
  stok_booking: z.number().int().min(0),
});

type UpdateStokBookingInput = z.infer<typeof UpdateStokBookingSchema>;

export async function updateStokKategori(
  input: UpdateStokBookingInput
): Promise<ActionResponse> {
  try {
    const validated = UpdateStokBookingSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: 'Unauthorized',
        error: 'UNAUTHORIZED',
      };
    }

    // Check if user is ADMIN
    if (session.user.role !== 'ADMIN') {
      return {
        success: false,
        message: 'Hanya admin yang bisa mengubah stok',
        error: 'FORBIDDEN',
      };
    }

    // Check kategori exists
    const kategori = await prisma.kategoriAyam.findUnique({
      where: { id: validated.id_kategori },
    });

    if (!kategori) {
      return {
        success: false,
        message: 'Kategori ayam tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    // Calculate changes
    const perubahan_bebas = validated.stok_bebas - kategori.stok_bebas;
    const perubahan_booking = validated.stok_booking - kategori.stok_booking;

    // Update stok dan catat mutasi dalam transaction
    await prisma.$transaction(async (tx) => {
      await tx.kategoriAyam.update({
        where: { id: validated.id_kategori },
        data: {
          stok_bebas: validated.stok_bebas,
          stok_booking: validated.stok_booking,
        },
      });

      // Catat mutasi stok bebas jika ada perubahan
      if (perubahan_bebas !== 0) {
        await tx.mutasiStok.create({
          data: {
            id_kategori: validated.id_kategori,
            jumlah_ekor: perubahan_bebas,
            tipe_mutasi: 'TAMBAH_STOK',
            id_kasir: session.user.id,
          },
        });
      }

      // Catat mutasi stok booking jika ada perubahan
      if (perubahan_booking !== 0) {
        await tx.mutasiStok.create({
          data: {
            id_kategori: validated.id_kategori,
            jumlah_ekor: perubahan_booking,
            tipe_mutasi: 'TAMBAH_STOK',
            id_kasir: session.user.id,
          },
        });
      }
    });

    return {
      success: true,
      message: `Stok ${kategori.nama_kategori} diperbarui`,
    };
  } catch (error) {
    console.error('Error updating stok:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal mengubah stok',
      error: 'UPDATE_ERROR',
    };
  }
}

/**
 * Get history mutasi stok untuk audit
 */
export async function getMutasiStokHistory(limit: number = 50): Promise<
  ActionResponse<
    Array<{
      id: number;
      kategori_nama: string;
      jumlah_ekor: number;
      tipe_mutasi: string;
      kasir_nama: string;
      waktu_mutasi: string;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        message: 'Unauthorized',
        error: 'UNAUTHORIZED',
      };
    }

    if (session.user.role !== 'ADMIN') {
      return {
        success: false,
        message: 'Hanya admin yang bisa melihat history',
        error: 'FORBIDDEN',
      };
    }

    const mutasi = await prisma.mutasiStok.findMany({
      include: {
        kategori: { select: { nama_kategori: true } },
        kasir: { select: { nama: true } },
      },
      orderBy: { waktu_mutasi: 'desc' },
      take: limit,
    });

    const formatted = mutasi.map((m) => ({
      id: m.id,
      kategori_nama: m.kategori.nama_kategori,
      jumlah_ekor: m.jumlah_ekor,
      tipe_mutasi: m.tipe_mutasi,
      kasir_nama: m.kasir.nama,
      waktu_mutasi: m.waktu_mutasi.toLocaleString('id-ID'),
    }));

    return {
      success: true,
      message: 'History mutasi berhasil diambil',
      data: formatted,
    };
  } catch (error) {
    console.error('Error getting mutasi history:', error);
    return {
      success: false,
      message: 'Gagal mengambil history',
      error: 'FETCH_ERROR',
    };
  }
}
