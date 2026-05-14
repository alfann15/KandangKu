'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

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
      aktif: boolean;
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
            jumlah_ekor: Math.abs(perubahan_bebas),
            tipe_mutasi: perubahan_bebas > 0 ? 'TAMBAH_STOK' : 'AYAM_MATI',
            id_kasir: session.user.id,
          },
        });
      }

      // Catat mutasi stok booking jika ada perubahan
      if (perubahan_booking !== 0) {
        await tx.mutasiStok.create({
          data: {
            id_kategori: validated.id_kategori,
            jumlah_ekor: Math.abs(perubahan_booking),
            tipe_mutasi: perubahan_booking > 0 ? 'TAMBAH_STOK' : 'AYAM_MATI',
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
 * Create kategori ayam baru
 */
const CreateKategoriSchema = z.object({
  nama_kategori: z.string().min(1, 'Nama kategori harus diisi').max(100),
  harga_hari_ini: z.number().int().positive('Harga harus lebih dari 0'),
});

type CreateKategoriInput = z.infer<typeof CreateKategoriSchema>;

export async function createKategori(
  input: CreateKategoriInput
): Promise<ActionResponse> {
  try {
    const validated = CreateKategoriSchema.parse(input);

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
        message: 'Hanya admin yang bisa membuat kategori',
        error: 'FORBIDDEN',
      };
    }

    // Check if kategori already exists
    const existing = await prisma.kategoriAyam.findFirst({
      where: {
        nama_kategori: {
          equals: validated.nama_kategori,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return {
        success: false,
        message: 'Kategori dengan nama ini sudah ada',
        error: 'DUPLICATE',
      };
    }

    // Create kategori
    const kategori = await prisma.kategoriAyam.create({
      data: {
        nama_kategori: validated.nama_kategori,
        harga_hari_ini: validated.harga_hari_ini,
        stok_bebas: 0,
        stok_booking: 0,
      },
    });

    return {
      success: true,
      message: `Kategori ${kategori.nama_kategori} berhasil dibuat`,
      data: kategori,
    };
  } catch (error) {
    console.error('Error creating kategori:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal membuat kategori',
      error: 'CREATE_ERROR',
    };
  }
}

/**
 * Toggle aktif/nonaktif kategori ayam
 */
const ToggleKategoriAyamSchema = z.object({
  id: z.number().int().positive(),
  aktif: z.boolean(),
});

type ToggleKategoriAyamInput = z.infer<typeof ToggleKategoriAyamSchema>;

export async function toggleKategoriAyam(
  input: ToggleKategoriAyamInput
): Promise<ActionResponse> {
  try {
    const validated = ToggleKategoriAyamSchema.parse(input);

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
        message: 'Hanya admin yang bisa mengubah status',
        error: 'FORBIDDEN',
      };
    }

    const kategori = await prisma.kategoriAyam.findUnique({
      where: { id: validated.id },
    });

    if (!kategori) {
      return {
        success: false,
        message: 'Kategori ayam tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    await prisma.kategoriAyam.update({
      where: { id: validated.id },
      data: { aktif: validated.aktif },
    });

    return {
      success: true,
      message: `Kategori ${kategori.nama_kategori} ${validated.aktif ? 'diaktifkan' : 'dinonaktifkan'}`,
    };
  } catch (error) {
    console.error('Error toggling kategori ayam:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal mengubah status kategori',
      error: 'UPDATE_ERROR',
    };
  }
}

/**
 * Delete kategori ayam
 */
const DeleteKategoriAyamSchema = z.object({
  id: z.number().int().positive(),
});

type DeleteKategoriAyamInput = z.infer<typeof DeleteKategoriAyamSchema>;

export async function deleteKategoriAyam(
  input: DeleteKategoriAyamInput
): Promise<ActionResponse> {
  try {
    const validated = DeleteKategoriAyamSchema.parse(input);

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
        message: 'Hanya admin yang bisa menghapus kategori',
        error: 'FORBIDDEN',
      };
    }

    const kategori = await prisma.kategoriAyam.findUnique({
      where: { id: validated.id },
    });

    if (!kategori) {
      return {
        success: false,
        message: 'Kategori ayam tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    // Check if kategori has transactions
    const hasTransactions = await prisma.detailTransaksi.findFirst({
      where: { id_kategori: validated.id },
    });

    if (hasTransactions) {
      return {
        success: false,
        message: 'Tidak bisa menghapus kategori yang sudah memiliki transaksi',
        error: 'HAS_TRANSACTIONS',
      };
    }

    await prisma.kategoriAyam.delete({
      where: { id: validated.id },
    });

    return {
      success: true,
      message: `Kategori ${kategori.nama_kategori} berhasil dihapus`,
    };
  } catch (error) {
    console.error('Error deleting kategori ayam:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal menghapus kategori',
      error: 'DELETE_ERROR',
    };
  }
}

/**
 * Delete kategori pengeluaran
 */
const DeleteKategoriPengeluaranSchema = z.object({
  id: z.number().int().positive(),
});

type DeleteKategoriPengeluaranInput = z.infer<typeof DeleteKategoriPengeluaranSchema>;

export async function deleteKategoriPengeluaran(
  input: DeleteKategoriPengeluaranInput
): Promise<ActionResponse> {
  try {
    const validated = DeleteKategoriPengeluaranSchema.parse(input);

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
        message: 'Hanya admin yang bisa menghapus kategori',
        error: 'FORBIDDEN',
      };
    }

    const kategori = await prisma.kategoriPengeluaran.findUnique({
      where: { id: validated.id },
    });

    if (!kategori) {
      return {
        success: false,
        message: 'Kategori pengeluaran tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    // Check if kategori has pengeluaran
    const hasPengeluaran = await prisma.pengeluaran.findFirst({
      where: { id_kategori: validated.id },
    });

    if (hasPengeluaran) {
      return {
        success: false,
        message: 'Tidak bisa menghapus kategori yang sudah memiliki pengeluaran',
        error: 'HAS_PENGELUARAN',
      };
    }

    await prisma.kategoriPengeluaran.delete({
      where: { id: validated.id },
    });

    return {
      success: true,
      message: `Kategori ${kategori.nama} berhasil dihapus`,
    };
  } catch (error) {
    console.error('Error deleting kategori pengeluaran:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal menghapus kategori',
      error: 'DELETE_ERROR',
    };
  }
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<
  ActionResponse<
    Array<{
      id: number;
      nama: string;
      username: string;
      role: string;
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
        message: 'Hanya admin yang bisa mengakses',
        error: 'FORBIDDEN',
      };
    }

    const users = await prisma.user.findMany({
      select: { id: true, nama: true, username: true, role: true },
      orderBy: { nama: 'asc' },
    });

    return {
      success: true,
      message: 'Users berhasil diambil',
      data: users,
    };
  } catch (error) {
    console.error('Error getting users:', error);
    return {
      success: false,
      message: 'Gagal mengambil data users',
      error: 'FETCH_ERROR',
    };
  }
}

/**
 * Create user baru
 */
const CreateUserSchema = z.object({
  nama: z.string().min(1, 'Nama harus diisi').max(100),
  username: z.string().min(3, 'Username minimal 3 karakter').max(50),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['ADMIN', 'KASIR']),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

export async function createUser(
  input: CreateUserInput
): Promise<ActionResponse> {
  try {
    const validated = CreateUserSchema.parse(input);

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
        message: 'Hanya admin yang bisa membuat user',
        error: 'FORBIDDEN',
      };
    }

    // Check if username exists
    const existing = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (existing) {
      return {
        success: false,
        message: 'Username sudah digunakan',
        error: 'DUPLICATE',
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    const user = await prisma.user.create({
      data: {
        nama: validated.nama,
        username: validated.username,
        password: hashedPassword,
        role: validated.role,
      },
    });

    return {
      success: true,
      message: `User ${user.nama} berhasil dibuat`,
    };
  } catch (error) {
    console.error('Error creating user:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal membuat user',
      error: 'CREATE_ERROR',
    };
  }
}

/**
 * Delete user
 */
const DeleteUserSchema = z.object({
  id: z.number().int().positive(),
});

type DeleteUserInput = z.infer<typeof DeleteUserSchema>;

export async function deleteUser(
  input: DeleteUserInput
): Promise<ActionResponse> {
  try {
    const validated = DeleteUserSchema.parse(input);

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
        message: 'Hanya admin yang bisa menghapus user',
        error: 'FORBIDDEN',
      };
    }

    // Prevent deleting self
    if (validated.id === session.user.id) {
      return {
        success: false,
        message: 'Tidak bisa menghapus user sendiri',
        error: 'CANNOT_DELETE_SELF',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: validated.id },
    });

    if (!user) {
      return {
        success: false,
        message: 'User tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    await prisma.user.delete({
      where: { id: validated.id },
    });

    return {
      success: true,
      message: `User ${user.nama} berhasil dihapus`,
    };
  } catch (error) {
    console.error('Error deleting user:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal menghapus user',
      error: 'DELETE_ERROR',
    };
  }
}

/**
 * Change user role
 */
const ChangeUserRoleSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(['ADMIN', 'KASIR']),
});

type ChangeUserRoleInput = z.infer<typeof ChangeUserRoleSchema>;

export async function changeUserRole(
  input: ChangeUserRoleInput
): Promise<ActionResponse> {
  try {
    const validated = ChangeUserRoleSchema.parse(input);

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
        message: 'Hanya admin yang bisa mengubah role',
        error: 'FORBIDDEN',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: validated.id },
    });

    if (!user) {
      return {
        success: false,
        message: 'User tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    await prisma.user.update({
      where: { id: validated.id },
      data: { role: validated.role },
    });

    return {
      success: true,
      message: `Role ${user.nama} diubah menjadi ${validated.role}`,
    };
  } catch (error) {
    console.error('Error changing user role:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal mengubah role',
      error: 'UPDATE_ERROR',
    };
  }
}

/**
 * Reset password user
 */
const ResetPasswordSchema = z.object({
  id: z.number().int().positive(),
  password_baru: z.string().min(6, 'Password minimal 6 karakter'),
});

type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export async function resetUserPassword(
  input: ResetPasswordInput
): Promise<ActionResponse> {
  try {
    const validated = ResetPasswordSchema.parse(input);

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
        message: 'Hanya admin yang bisa reset password',
        error: 'FORBIDDEN',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: validated.id },
    });

    if (!user) {
      return {
        success: false,
        message: 'User tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(validated.password_baru, 10);

    await prisma.user.update({
      where: { id: validated.id },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: `Password ${user.nama} berhasil direset`,
    };
  } catch (error) {
    console.error('Error resetting password:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal reset password',
      error: 'UPDATE_ERROR',
    };
  }
}

/**
 * Get transaksi detail untuk edit (admin only)
 */
export async function getTransaksiForEdit(id: string): Promise<
  ActionResponse<{
    id: string;
    nama_pelanggan: string;
    tipe_transaksi: string;
    status_bayar: string;
    total_bayar: number;
    diskon: number;
    detail_pesanan: Array<{
      id: number;
      id_kategori: number;
      nama_kategori: string;
      jumlah_ekor: number;
      harga_satuan: number;
    }>;
  }>
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
        message: 'Hanya admin yang bisa edit transaksi',
        error: 'FORBIDDEN',
      };
    }

    const transaksi = await prisma.transaksi.findUnique({
      where: { id },
      include: {
        detail_pesanan: {
          include: {
            kategori: { select: { nama_kategori: true } },
          },
        },
      },
    });

    if (!transaksi) {
      return {
        success: false,
        message: 'Transaksi tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    return {
      success: true,
      message: 'Transaksi berhasil diambil',
      data: {
        id: transaksi.id,
        nama_pelanggan: transaksi.nama_pelanggan,
        tipe_transaksi: transaksi.tipe_transaksi,
        status_bayar: transaksi.status_bayar,
        total_bayar: transaksi.total_bayar,
        diskon: transaksi.diskon,
        detail_pesanan: transaksi.detail_pesanan.map((d) => ({
          id: d.id,
          id_kategori: d.id_kategori,
          nama_kategori: d.kategori.nama_kategori,
          jumlah_ekor: d.jumlah_ekor,
          harga_satuan: d.harga_satuan,
        })),
      },
    };
  } catch (error) {
    console.error('Error getting transaksi:', error);
    return {
      success: false,
      message: 'Gagal mengambil transaksi',
      error: 'FETCH_ERROR',
    };
  }
}

/**
 * Edit detail transaksi (jumlah ekor)
 */
const EditDetailTransaksiSchema = z.object({
  id_detail: z.number().int().positive(),
  jumlah_ekor_baru: z.number().int().positive('Jumlah harus lebih dari 0'),
});

type EditDetailTransaksiInput = z.infer<typeof EditDetailTransaksiSchema>;

export async function editDetailTransaksi(
  input: EditDetailTransaksiInput
): Promise<ActionResponse> {
  try {
    const validated = EditDetailTransaksiSchema.parse(input);

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
        message: 'Hanya admin yang bisa edit transaksi',
        error: 'FORBIDDEN',
      };
    }

    const detail = await prisma.detailTransaksi.findUnique({
      where: { id: validated.id_detail },
      include: {
        transaksi: true,
        kategori: true,
      },
    });

    if (!detail) {
      return {
        success: false,
        message: 'Detail transaksi tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    const selisih_ekor = validated.jumlah_ekor_baru - detail.jumlah_ekor;
    const selisih_harga = selisih_ekor * detail.harga_satuan;

    // Update dalam transaction
    await prisma.$transaction(async (tx) => {
      // Update detail transaksi
      await tx.detailTransaksi.update({
        where: { id: validated.id_detail },
        data: { jumlah_ekor: validated.jumlah_ekor_baru },
      });

      // Update total_bayar transaksi
      await tx.transaksi.update({
        where: { id: detail.transaksi.id },
        data: {
          total_bayar: detail.transaksi.total_bayar + selisih_harga,
        },
      });

      // Update stok jika LANGSUNG
      if (detail.transaksi.tipe_transaksi === 'LANGSUNG') {
        await tx.kategoriAyam.update({
          where: { id: detail.id_kategori },
          data: {
            stok_bebas: detail.kategori.stok_bebas - selisih_ekor,
          },
        });
      } else if (detail.transaksi.tipe_transaksi === 'PRE_ORDER') {
        // Update booking stok untuk PO
        await tx.kategoriAyam.update({
          where: { id: detail.id_kategori },
          data: {
            stok_booking: detail.kategori.stok_booking - selisih_ekor,
          },
        });
      }
    });

    return {
      success: true,
      message: `Detail transaksi berhasil diubah (${detail.jumlah_ekor} → ${validated.jumlah_ekor_baru} ekor)`,
    };
  } catch (error) {
    console.error('Error editing detail transaksi:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal edit transaksi',
      error: 'UPDATE_ERROR',
    };
  }
}

/**
 * Get all kategori pengeluaran
 */
export async function getKategoriPengeluaranForAdmin(): Promise<
  ActionResponse<
    Array<{
      id: number;
      nama: string;
      aktif: boolean;
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
        message: 'Hanya admin yang bisa mengakses',
        error: 'FORBIDDEN',
      };
    }

    const kategori = await prisma.kategoriPengeluaran.findMany({
      orderBy: { nama: 'asc' },
    });

    return {
      success: true,
      message: 'Kategori pengeluaran berhasil diambil',
      data: kategori,
    };
  } catch (error) {
    console.error('Error getting kategori pengeluaran:', error);
    return {
      success: false,
      message: 'Gagal mengambil data kategori pengeluaran',
      error: 'FETCH_ERROR',
    };
  }
}

/**
 * Create kategori pengeluaran baru
 */
const CreateKategoriPengeluaranSchema = z.object({
  nama: z.string().min(1, 'Nama kategori harus diisi').max(100),
});

type CreateKategoriPengeluaranInput = z.infer<typeof CreateKategoriPengeluaranSchema>;

export async function createKategoriPengeluaran(
  input: CreateKategoriPengeluaranInput
): Promise<ActionResponse> {
  try {
    const validated = CreateKategoriPengeluaranSchema.parse(input);

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
        message: 'Hanya admin yang bisa membuat kategori',
        error: 'FORBIDDEN',
      };
    }

    // Check if kategori already exists
    const existing = await prisma.kategoriPengeluaran.findUnique({
      where: { nama: validated.nama },
    });

    if (existing) {
      return {
        success: false,
        message: 'Kategori dengan nama ini sudah ada',
        error: 'DUPLICATE',
      };
    }

    // Create kategori
    const kategori = await prisma.kategoriPengeluaran.create({
      data: {
        nama: validated.nama,
        aktif: true,
      },
    });

    return {
      success: true,
      message: `Kategori pengeluaran ${kategori.nama} berhasil dibuat`,
      data: kategori,
    };
  } catch (error) {
    console.error('Error creating kategori pengeluaran:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal membuat kategori pengeluaran',
      error: 'CREATE_ERROR',
    };
  }
}

/**
 * Toggle aktif/nonaktif kategori pengeluaran
 */
const ToggleKategoriPengeluaranSchema = z.object({
  id: z.number().int().positive(),
  aktif: z.boolean(),
});

type ToggleKategoriPengeluaranInput = z.infer<typeof ToggleKategoriPengeluaranSchema>;

export async function toggleKategoriPengeluaran(
  input: ToggleKategoriPengeluaranInput
): Promise<ActionResponse> {
  try {
    const validated = ToggleKategoriPengeluaranSchema.parse(input);

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
        message: 'Hanya admin yang bisa mengubah status',
        error: 'FORBIDDEN',
      };
    }

    const kategori = await prisma.kategoriPengeluaran.findUnique({
      where: { id: validated.id },
    });

    if (!kategori) {
      return {
        success: false,
        message: 'Kategori pengeluaran tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    await prisma.kategoriPengeluaran.update({
      where: { id: validated.id },
      data: { aktif: validated.aktif },
    });

    return {
      success: true,
      message: `Kategori ${kategori.nama} ${validated.aktif ? 'diaktifkan' : 'dinonaktifkan'}`,
    };
  } catch (error) {
    console.error('Error toggling kategori pengeluaran:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal mengubah status kategori',
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
