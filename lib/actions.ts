'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

// ============================================
// SHARED TYPES & VALIDATION HELPERS
// ============================================

type ActionResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
};

// ============================================
// PELANGGAN HELPER
// ============================================

/** Normalize nama untuk dedup: trim + lowercase + collapse whitespace */
function normalizeNama(nama: string): string {
  return nama.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find-or-create Pelanggan dari nama transaksi. Dipakai di dalam Prisma
 * transaction (kasih `tx`) supaya atomic dengan create transaksi.
 *
 * - Lookup case-insensitive lewat field nama_normalized (@unique)
 * - Kalau ditemukan, update nomor_wa jadi yang terbaru (kalau diisi)
 * - Kalau belum ada, create baru
 *
 * Return: id pelanggan (untuk dipakai sebagai FK)
 */
async function upsertPelanggan(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  nama_input: string,
  nomor_wa_input: string | null
): Promise<number> {
  const nama_clean = nama_input.trim();
  const nama_normalized = normalizeNama(nama_clean);
  const nomor_wa_clean = nomor_wa_input?.trim() || null;

  const existing = await tx.pelanggan.findUnique({ where: { nama_normalized } });

  if (existing) {
    // Update nomor_wa kalau ada nomor baru. Kalau pelanggan ganti nomor,
    // ini akan menimpa yang lama (asumsi: nomor terbaru = nomor benar).
    if (nomor_wa_clean && nomor_wa_clean !== existing.nomor_wa) {
      await tx.pelanggan.update({
        where: { id: existing.id },
        data: { nomor_wa: nomor_wa_clean },
      });
    }
    return existing.id;
  }

  const created = await tx.pelanggan.create({
    data: {
      nama: nama_clean,
      nama_normalized,
      nomor_wa: nomor_wa_clean,
    },
  });
  return created.id;
}

const NomorWaSchema = z
  .string()
  .trim()
  .max(25, 'Nomor WA terlalu panjang')
  .optional()
  .or(z.literal('').transform(() => undefined));

const TransaksiLangsungSchema = z.object({
  nama_pelanggan: z.string().min(1, 'Nama pelanggan harus diisi'),
  nomor_wa: NomorWaSchema,
  items: z.array(
    z.object({
      id_kategori: z.number().int().positive(),
      jumlah_ekor: z.number().int().positive('Jumlah harus lebih dari 0'),
    })
  ).min(1, 'Minimal harus ada 1 item'),
  diskon: z.number().int().min(0).default(0),
  status_bayar: z.enum(['LUNAS', 'DP', 'BELUM_BAYAR']),
  total_bayar: z.number().int().min(0),
  tanggal_jatuh_tempo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

type TransaksiLangsungInput = z.infer<typeof TransaksiLangsungSchema>;

// ============================================
// SERVER ACTION: TRANSAKSI LANGSUNG
// ============================================

/**
 * Buat transaksi penjualan langsung.
 *
 * Catatan untuk piutang:
 * - status_bayar 'BELUM_BAYAR' boleh total_bayar = 0 (ayam keluar, uang nyusul).
 * - status_bayar 'DP' boleh total_bayar < total_setelah_diskon (cicilan).
 * - Snapshot harga_satuan disimpan di setiap DetailTransaksi sehingga
 *   omzet tetap akurat meskipun harga harian berubah / pelanggan belum bayar.
 */
export async function createTransaksiLangsung(
  input: TransaksiLangsungInput
): Promise<ActionResponse<{ transaksi_id: string }>> {
  try {
    const validated = TransaksiLangsungSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Anda harus login terlebih dahulu', error: 'UNAUTHORIZED' };
    }
    const id_kasir = parseInt(session.user.id as string, 10);

    // Ambil semua kategori yang dibutuhkan
    const kategori_ids = validated.items.map((i) => i.id_kategori);
    const kategoriList = await prisma.kategoriAyam.findMany({
      where: { id: { in: kategori_ids } },
    });
    if (kategoriList.length !== kategori_ids.length) {
      return { success: false, message: 'Beberapa kategori ayam tidak ditemukan', error: 'INVALID_KATEGORI' };
    }
    const kategoriDict = Object.fromEntries(kategoriList.map((k) => [k.id, k]));

    // Hitung total harga & validasi stok
    let total_harga_asli = 0;
    for (const item of validated.items) {
      const k = kategoriDict[item.id_kategori];
      if (k.stok_bebas < item.jumlah_ekor) {
        return {
          success: false,
          message: `Stok ${k.nama_kategori} tidak cukup. Tersedia: ${k.stok_bebas}, diminta: ${item.jumlah_ekor}`,
          error: 'INSUFFICIENT_STOCK',
        };
      }
      total_harga_asli += k.harga_hari_ini * item.jumlah_ekor;
    }

    if (validated.diskon > total_harga_asli) {
      return {
        success: false,
        message: `Diskon (Rp${validated.diskon}) tidak boleh melebihi total harga (Rp${total_harga_asli})`,
        error: 'INVALID_DISKON',
      };
    }
    const total_setelah_diskon = total_harga_asli - validated.diskon;

    // Validasi total_bayar konsisten dengan status
    if (validated.status_bayar === 'LUNAS' && validated.total_bayar !== total_setelah_diskon) {
      return {
        success: false,
        message: `Status LUNAS mengharuskan total_bayar = ${total_setelah_diskon}`,
        error: 'INVALID_TOTAL_BAYAR',
      };
    }
    if (validated.status_bayar === 'BELUM_BAYAR' && validated.total_bayar !== 0) {
      return {
        success: false,
        message: 'Status BELUM_BAYAR mengharuskan total_bayar = 0',
        error: 'INVALID_TOTAL_BAYAR',
      };
    }
    if (validated.status_bayar === 'DP') {
      if (validated.total_bayar <= 0 || validated.total_bayar >= total_setelah_diskon) {
        return {
          success: false,
          message: `DP harus > 0 dan < total setelah diskon (Rp${total_setelah_diskon})`,
          error: 'INVALID_TOTAL_BAYAR',
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const id_pelanggan = await upsertPelanggan(tx, validated.nama_pelanggan, validated.nomor_wa || null);

      const transaksi = await tx.transaksi.create({
        data: {
          nama_pelanggan: validated.nama_pelanggan,
          nomor_wa: validated.nomor_wa || null,
          id_pelanggan,
          tipe_transaksi: 'LANGSUNG',
          status_bayar: validated.status_bayar,
          total_bayar: validated.total_bayar,
          diskon: validated.diskon,
          id_kasir,
          waktu_transaksi: new Date(),
          tanggal_jatuh_tempo: parseJatuhTempo(validated.tanggal_jatuh_tempo),
        },
      });

      for (const item of validated.items) {
        const k = kategoriDict[item.id_kategori];
        await tx.detailTransaksi.create({
          data: {
            id_transaksi: transaksi.id,
            id_kategori: item.id_kategori,
            jumlah_ekor: item.jumlah_ekor,
            harga_satuan: k.harga_hari_ini, // SNAPSHOT
          },
        });

        const updated = await tx.kategoriAyam.update({
          where: { id: item.id_kategori },
          data: { stok_bebas: { decrement: item.jumlah_ekor } },
        });
        if (updated.stok_bebas < 0) {
          throw new Error(`Race condition: stok ${item.id_kategori} negatif`);
        }
      }

      return transaksi;
    }, { isolationLevel: 'Serializable' });

    return { success: true, message: 'Transaksi berhasil disimpan', data: { transaksi_id: result.id } };
  } catch (error) {
    console.error('Error creating transaksi langsung:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Data tidak valid: ' + error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Terjadi kesalahan saat menyimpan transaksi', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' };
  }
}

// ============================================
// SERVER ACTION: GET KATEGORI AYAM & STOK
// ============================================

export async function getKategoriAyamDenganStok() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const kategori = await prisma.kategoriAyam.findMany({
      orderBy: { nama_kategori: 'asc' },
      select: {
        id: true,
        nama_kategori: true,
        harga_hari_ini: true,
        stok_bebas: true,
        stok_booking: true,
      },
    });

    return { success: true, message: 'Kategori berhasil diambil', data: kategori };
  } catch (error) {
    console.error('Error fetching kategori:', error);
    return { success: false, message: 'Gagal mengambil data kategori', error: 'FETCH_ERROR' };
  }
}

// ============================================
// SERVER ACTION: GET DETAIL TRANSAKSI
// ============================================

export async function getDetailTransaksi(transaksi_id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const transaksi = await prisma.transaksi.findUnique({
      where: { id: transaksi_id },
      include: {
        detail_pesanan: {
          include: {
            kategori: { select: { id: true, nama_kategori: true, harga_hari_ini: true } },
          },
        },
        kasir: { select: { id: true, nama: true, username: true } },
      },
    });

    if (!transaksi) {
      return { success: false, message: 'Transaksi tidak ditemukan', error: 'NOT_FOUND' };
    }

    return { success: true, message: 'Detail transaksi berhasil diambil', data: transaksi };
  } catch (error) {
    console.error('Error fetching transaksi detail:', error);
    return { success: false, message: 'Gagal mengambil detail transaksi', error: 'FETCH_ERROR' };
  }
}

// ============================================
// SERVER ACTION: CATAT AYAM MATI
// ============================================

const CatatAyamMatiSchema = z.object({
  id_kategori: z.number().int().positive(),
  jumlah_ekor: z.number().int().positive('Jumlah harus lebih dari 0'),
  keterangan: z.string().optional(),
});

type CatatAyamMatiInput = z.infer<typeof CatatAyamMatiSchema>;

export async function catatAyamMati(
  input: CatatAyamMatiInput
): Promise<ActionResponse<{ mutasi_id: number }>> {
  try {
    const validated = CatatAyamMatiSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Anda harus login terlebih dahulu', error: 'UNAUTHORIZED' };
    }
    const id_kasir = parseInt(session.user.id as string, 10);

    const kategori = await prisma.kategoriAyam.findUnique({ where: { id: validated.id_kategori } });
    if (!kategori) {
      return { success: false, message: 'Kategori ayam tidak ditemukan', error: 'KATEGORI_NOT_FOUND' };
    }
    if (kategori.stok_bebas < validated.jumlah_ekor) {
      return {
        success: false,
        message: `Stok ${kategori.nama_kategori} tidak cukup. Tersedia: ${kategori.stok_bebas}, diklaim: ${validated.jumlah_ekor}`,
        error: 'INSUFFICIENT_STOCK',
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.kategoriAyam.update({
        where: { id: validated.id_kategori },
        data: { stok_bebas: { decrement: validated.jumlah_ekor } },
      });
      if (updated.stok_bebas < 0) throw new Error('Race condition: stok would go negative');

      return await tx.mutasiStok.create({
        data: {
          id_kategori: validated.id_kategori,
          jumlah_ekor: validated.jumlah_ekor,
          tipe_mutasi: 'AYAM_MATI',
          id_kasir,
          waktu_mutasi: new Date(),
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { success: true, message: 'Ayam mati berhasil dicatat', data: { mutasi_id: result.id } };
  } catch (error) {
    console.error('Error catat ayam mati:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Data tidak valid: ' + error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Terjadi kesalahan saat mencatat ayam mati', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' };
  }
}

// ============================================
// SERVER ACTION: TAMBAH STOK
// ============================================

const TambahStokSchema = z.object({
  id_kategori: z.number().int().positive(),
  jumlah_ekor: z.number().int().positive('Jumlah harus lebih dari 0'),
});

type TambahStokInput = z.infer<typeof TambahStokSchema>;

export async function tambahStok(
  input: TambahStokInput
): Promise<ActionResponse<{ mutasi_id: number }>> {
  try {
    const validated = TambahStokSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Anda harus login terlebih dahulu', error: 'UNAUTHORIZED' };
    }
    const id_kasir = parseInt(session.user.id as string, 10);

    const kategori = await prisma.kategoriAyam.findUnique({ where: { id: validated.id_kategori } });
    if (!kategori) {
      return { success: false, message: 'Kategori ayam tidak ditemukan', error: 'KATEGORI_NOT_FOUND' };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.kategoriAyam.update({
        where: { id: validated.id_kategori },
        data: { stok_bebas: { increment: validated.jumlah_ekor } },
      });

      return await tx.mutasiStok.create({
        data: {
          id_kategori: validated.id_kategori,
          jumlah_ekor: validated.jumlah_ekor,
          tipe_mutasi: 'TAMBAH_STOK',
          id_kasir,
          waktu_mutasi: new Date(),
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { success: true, message: 'Stok berhasil ditambahkan', data: { mutasi_id: result.id } };
  } catch (error) {
    console.error('Error tambah stok:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Data tidak valid: ' + error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Terjadi kesalahan saat menambah stok', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' };
  }
}

// ============================================
// SERVER ACTION: BUAT PRE-ORDER
// ============================================

const CreatePreOrderSchema = z.object({
  nama_pelanggan: z.string().min(1, 'Nama pelanggan harus diisi'),
  nomor_wa: NomorWaSchema,
  items: z.array(
    z.object({
      id_kategori: z.number().int().positive(),
      jumlah_ekor: z.number().int().positive(),
    })
  ).min(1),
  dp: z.number().int().min(0),
  diskon: z.number().int().min(0).default(0),
  tanggal_jatuh_tempo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

type CreatePreOrderInput = z.infer<typeof CreatePreOrderSchema>;

/** Parse tanggal yyyy-mm-dd ke Date pada akhir hari (23:59:59 local time) */
function parseJatuhTempo(yyyy_mm_dd: string | undefined): Date | null {
  if (!yyyy_mm_dd) return null;
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * Buat Pre-Order (booking ayam, harga belum dikunci sampai pelunasan).
 * harga_satuan di-snapshot pakai harga_hari_ini saat PO dibuat;
 * akan di-update lagi saat pelunasan supaya konsisten dengan kebijakan
 * "harga PO = harga hari ini saat ambil".
 */
export async function createPreOrder(
  input: CreatePreOrderInput
): Promise<ActionResponse<{ transaksi_id: string }>> {
  try {
    const validated = CreatePreOrderSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }
    const id_kasir = parseInt(session.user.id as string, 10);

    const kategori_ids = validated.items.map((i) => i.id_kategori);
    const kategoriList = await prisma.kategoriAyam.findMany({ where: { id: { in: kategori_ids } } });
    if (kategoriList.length !== kategori_ids.length) {
      return { success: false, message: 'Beberapa kategori tidak ditemukan', error: 'INVALID_KATEGORI' };
    }
    const kategoriDict = Object.fromEntries(kategoriList.map((k) => [k.id, k]));

    for (const item of validated.items) {
      const k = kategoriDict[item.id_kategori];
      if (k.stok_bebas < item.jumlah_ekor) {
        return {
          success: false,
          message: `Stok ${k.nama_kategori} tidak cukup. Tersedia: ${k.stok_bebas}`,
          error: 'INSUFFICIENT_STOCK',
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const id_pelanggan = await upsertPelanggan(tx, validated.nama_pelanggan, validated.nomor_wa || null);

      const transaksi = await tx.transaksi.create({
        data: {
          nama_pelanggan: validated.nama_pelanggan,
          nomor_wa: validated.nomor_wa || null,
          id_pelanggan,
          tipe_transaksi: 'PRE_ORDER',
          status_bayar: validated.dp > 0 ? 'DP' : 'BELUM_BAYAR',
          total_bayar: validated.dp,
          diskon: validated.diskon,
          id_kasir,
          tanggal_jatuh_tempo: parseJatuhTempo(validated.tanggal_jatuh_tempo),
        },
      });

      for (const item of validated.items) {
        const k = kategoriDict[item.id_kategori];
        await tx.detailTransaksi.create({
          data: {
            id_transaksi: transaksi.id,
            id_kategori: item.id_kategori,
            jumlah_ekor: item.jumlah_ekor,
            harga_satuan: k.harga_hari_ini, // initial snapshot, akan di-update saat lunas
          },
        });

        const updated = await tx.kategoriAyam.update({
          where: { id: item.id_kategori },
          data: {
            stok_bebas: { decrement: item.jumlah_ekor },
            stok_booking: { increment: item.jumlah_ekor },
          },
        });
        if (updated.stok_bebas < 0) {
          throw new Error(`Race condition: stok ${item.id_kategori} negatif`);
        }
      }

      return transaksi;
    }, { isolationLevel: 'Serializable' });

    return { success: true, message: 'Pre-Order berhasil dibuat', data: { transaksi_id: result.id } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Gagal membuat Pre-Order', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' };
  }
}

// ============================================
// SERVER ACTION: LUNASI TRANSAKSI (GENERIC)
// ============================================

const LunasiTransaksiSchema = z.object({
  transaksi_id: z.string().min(1),
  tambahan_bayar: z.number().int().min(0),
  diskon_tambahan: z.number().int().min(0).default(0),
});

type LunasiTransaksiInput = z.infer<typeof LunasiTransaksiSchema>;

/**
 * Lunasi (atau bayar sebagian) sebuah transaksi yang masih punya tagihan.
 * Bekerja untuk LANGSUNG (utang) maupun PRE_ORDER (booking).
 *
 * Aturan:
 * - LANGSUNG: total efektif = Σ jumlah_ekor × harga_satuan (snapshot, sudah dikunci sejak awal).
 *             Stok TIDAK disentuh (ayam sudah keluar saat transaksi dibuat).
 * - PRE_ORDER: total efektif = Σ jumlah_ekor × kategori.harga_hari_ini (kunci saat lunas).
 *              Saat status berubah jadi LUNAS, stok_booking dikurangi & harga_satuan
 *              di-update ke harga_hari_ini sekarang sebagai "locked price".
 *
 * Status hasil:
 * - sisa_setelah_pembayaran <= 0  → LUNAS
 * - tambahan_bayar > 0            → DP
 * - selain itu                    → BELUM_BAYAR
 */
export async function lunasiTransaksi(
  input: LunasiTransaksiInput
): Promise<ActionResponse<{ status_baru: string; sisa_setelah: number; total_efektif: number }>> {
  try {
    const validated = LunasiTransaksiSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const transaksi = await prisma.transaksi.findUnique({
      where: { id: validated.transaksi_id },
      include: { detail_pesanan: { include: { kategori: true } } },
    });

    if (!transaksi) {
      return { success: false, message: 'Transaksi tidak ditemukan', error: 'NOT_FOUND' };
    }
    if (transaksi.status_bayar === 'LUNAS') {
      return { success: false, message: 'Transaksi sudah lunas', error: 'ALREADY_LUNAS' };
    }

    const isPreOrder = transaksi.tipe_transaksi === 'PRE_ORDER';

    // Hitung total efektif sesuai tipe
    const total_efektif = transaksi.detail_pesanan.reduce((sum, d) => {
      const harga = isPreOrder ? d.kategori.harga_hari_ini : d.harga_satuan;
      return sum + d.jumlah_ekor * harga;
    }, 0);

    const diskon_baru = transaksi.diskon + validated.diskon_tambahan;
    if (diskon_baru > total_efektif) {
      return {
        success: false,
        message: `Diskon total (Rp${diskon_baru}) melebihi total harga (Rp${total_efektif})`,
        error: 'INVALID_DISKON',
      };
    }

    const total_bayar_baru = transaksi.total_bayar + validated.tambahan_bayar;
    const piutang_setelah_diskon = total_efektif - diskon_baru;

    if (total_bayar_baru > piutang_setelah_diskon) {
      return {
        success: false,
        message: `Total pembayaran (Rp${total_bayar_baru}) melebihi tagihan setelah diskon (Rp${piutang_setelah_diskon})`,
        error: 'OVERPAYMENT',
      };
    }

    const sisa_setelah = piutang_setelah_diskon - total_bayar_baru;
    const status_baru = sisa_setelah <= 0 ? 'LUNAS' : (total_bayar_baru > 0 ? 'DP' : 'BELUM_BAYAR');

    const id_kasir = parseInt(session.user.id as string, 10);

    await prisma.$transaction(async (tx) => {
      await tx.transaksi.update({
        where: { id: validated.transaksi_id },
        data: {
          status_bayar: status_baru,
          total_bayar: total_bayar_baru,
          diskon: diskon_baru,
        },
      });

      // Audit trail: catat setiap pembayaran (cicilan / pelunasan) ke PembayaranLog
      await tx.pembayaranLog.create({
        data: {
          id_transaksi: validated.transaksi_id,
          jumlah: validated.tambahan_bayar,
          diskon_tambahan: validated.diskon_tambahan,
          status_sebelum: transaksi.status_bayar,
          status_sesudah: status_baru,
          id_kasir,
        },
      });

      // PRE_ORDER yang berubah jadi LUNAS: lock harga + lepas booking
      if (isPreOrder && status_baru === 'LUNAS') {
        for (const d of transaksi.detail_pesanan) {
          const harga_lock = d.kategori.harga_hari_ini;
          if (harga_lock !== d.harga_satuan) {
            await tx.detailTransaksi.update({
              where: { id: d.id },
              data: { harga_satuan: harga_lock },
            });
          }

          const updated = await tx.kategoriAyam.update({
            where: { id: d.id_kategori },
            data: { stok_booking: { decrement: d.jumlah_ekor } },
          });
          if (updated.stok_booking < 0) {
            throw new Error(`Race condition: stok_booking ${d.id_kategori} negatif`);
          }
        }
      }
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,
      message: status_baru === 'LUNAS' ? 'Transaksi berhasil dilunasi' : 'Pembayaran berhasil dicatat',
      data: { status_baru, sisa_setelah, total_efektif },
    };
  } catch (error) {
    console.error('Error lunasi transaksi:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Gagal melunasi transaksi', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' };
  }
}

// ============================================
// SERVER ACTION: GET TRANSAKSI BELUM LUNAS
// ============================================

/**
 * Ambil semua transaksi yang masih punya piutang (LANGSUNG atau PRE_ORDER,
 * status DP atau BELUM_BAYAR). Ini menggantikan getPreOrderAktif lama —
 * sekarang piutang LANGSUNG juga ikut ke-listed supaya kasir bisa follow up.
 */
export async function getTransaksiBelumLunas() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const list = await prisma.transaksi.findMany({
      where: {
        status_bayar: { in: ['DP', 'BELUM_BAYAR'] },
        dibatalkan_pada: null,
      },
      include: {
        detail_pesanan: {
          include: { kategori: { select: { id: true, nama_kategori: true, harga_hari_ini: true } } },
        },
        kasir: { select: { nama: true } },
      },
      orderBy: { waktu_transaksi: 'desc' },
    });

    const data = list.map((t) => {
      const isPreOrder = t.tipe_transaksi === 'PRE_ORDER';
      const total_harga_efektif = t.detail_pesanan.reduce((sum, d) => {
        const harga = isPreOrder ? d.kategori.harga_hari_ini : d.harga_satuan;
        return sum + d.jumlah_ekor * harga;
      }, 0);
      const sisa_bayar = Math.max(0, total_harga_efektif - t.diskon - t.total_bayar);
      const lewat_tempo = t.tanggal_jatuh_tempo
        ? Date.now() > t.tanggal_jatuh_tempo.getTime()
        : false;

      return {
        id: t.id,
        tipe_transaksi: t.tipe_transaksi as 'LANGSUNG' | 'PRE_ORDER',
        nama_pelanggan: t.nama_pelanggan,
        nomor_wa: t.nomor_wa,
        kasir_nama: t.kasir.nama,
        status_bayar: t.status_bayar,
        sudah_dibayar: t.total_bayar,
        diskon: t.diskon,
        total_harga_efektif,
        sisa_bayar,
        waktu: t.waktu_transaksi.toLocaleString('id-ID'),
        waktu_iso: t.waktu_transaksi.toISOString(),
        tanggal_jatuh_tempo: t.tanggal_jatuh_tempo
          ? t.tanggal_jatuh_tempo.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
          : null,
        lewat_tempo,
        items: t.detail_pesanan.map((d) => ({
          nama_kategori: d.kategori.nama_kategori,
          jumlah_ekor: d.jumlah_ekor,
          // Harga yang dipakai utk hitung sisa: snapshot kalau LANGSUNG, terkini kalau PO
          harga_efektif: isPreOrder ? d.kategori.harga_hari_ini : d.harga_satuan,
        })),
      };
    });

    return { success: true, message: 'OK', data };
  } catch (error) {
    console.error('Error get transaksi belum lunas:', error);
    return { success: false, message: 'Gagal mengambil daftar piutang', error: 'FETCH_ERROR' };
  }
}



// ============================================
// SERVER ACTION: GET ALL PELANGGAN (UNTUK AUTOCOMPLETE)
// ============================================

/**
 * Daftar semua pelanggan untuk autocomplete di form transaksi.
 * Diurutkan berdasarkan transaksi terakhir (yang terbaru di atas)
 * supaya pelanggan langganan terbaru muncul duluan saat user mengetik.
 */
export async function getAllPelanggan(): Promise<
  ActionResponse<Array<{ id: number; nama: string; nomor_wa: string | null }>>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const list = await prisma.pelanggan.findMany({
      select: { id: true, nama: true, nomor_wa: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500, // batasi untuk performa; kalau ada > 500 pelanggan, perlu real combobox
    });

    return {
      success: true,
      message: 'OK',
      data: list.map((p) => ({ id: p.id, nama: p.nama, nomor_wa: p.nomor_wa })),
    };
  } catch (error) {
    console.error('Error getAllPelanggan:', error);
    return { success: false, message: 'Gagal mengambil daftar pelanggan', error: 'FETCH_ERROR' };
  }
}


// ============================================
// SERVER ACTION: GET RIWAYAT PEMBAYARAN
// ============================================

/**
 * Riwayat pembayaran sebuah transaksi.
 * - Entry pertama (synthetic): pembayaran awal dari transaksi.total_bayar saat dibuat.
 *   Hanya muncul kalau total_bayar awal > 0 (LUNAS atau DP saat create).
 * - Entry selanjutnya: dari PembayaranLog (cicilan / pelunasan via lunasiTransaksi).
 */
export async function getRiwayatPembayaran(transaksi_id: string): Promise<
  ActionResponse<
    Array<{
      id: string;
      jumlah: number;
      diskon_tambahan: number;
      status_sebelum: string | null;
      status_sesudah: string;
      kasir_nama: string;
      waktu: string;
      keterangan: string | null;
      is_awal: boolean;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const transaksi = await prisma.transaksi.findUnique({
      where: { id: transaksi_id },
      include: {
        kasir: { select: { nama: true } },
        pembayaran_log: {
          include: { kasir: { select: { nama: true } } },
          orderBy: { waktu: 'asc' },
        },
      },
    });

    if (!transaksi) {
      return { success: false, message: 'Transaksi tidak ditemukan', error: 'NOT_FOUND' };
    }

    const items: Array<{
      id: string;
      jumlah: number;
      diskon_tambahan: number;
      status_sebelum: string | null;
      status_sesudah: string;
      kasir_nama: string;
      waktu: string;
      keterangan: string | null;
      is_awal: boolean;
    }> = [];

    // Hitung berapa total dari log; selisihnya dengan transaksi.total_bayar = pembayaran awal
    const total_dari_log = transaksi.pembayaran_log.reduce((s, p) => s + p.jumlah, 0);
    const pembayaran_awal = transaksi.total_bayar - total_dari_log;

    if (pembayaran_awal > 0) {
      items.push({
        id: 'awal',
        jumlah: pembayaran_awal,
        diskon_tambahan: 0,
        status_sebelum: null,
        status_sesudah: transaksi.pembayaran_log.length > 0
          ? (transaksi.pembayaran_log[0].status_sebelum)
          : transaksi.status_bayar,
        kasir_nama: transaksi.kasir.nama,
        waktu: transaksi.waktu_transaksi.toLocaleString('id-ID'),
        keterangan: transaksi.tipe_transaksi === 'PRE_ORDER' ? 'DP saat PO dibuat' : 'Pembayaran awal',
        is_awal: true,
      });
    }

    transaksi.pembayaran_log.forEach((p) => {
      items.push({
        id: String(p.id),
        jumlah: p.jumlah,
        diskon_tambahan: p.diskon_tambahan,
        status_sebelum: p.status_sebelum,
        status_sesudah: p.status_sesudah,
        kasir_nama: p.kasir.nama,
        waktu: p.waktu.toLocaleString('id-ID'),
        keterangan: p.keterangan,
        is_awal: false,
      });
    });

    return { success: true, message: 'OK', data: items };
  } catch (error) {
    console.error('Error getRiwayatPembayaran:', error);
    return { success: false, message: 'Gagal mengambil riwayat pembayaran', error: 'FETCH_ERROR' };
  }
}



// ============================================
// SERVER ACTION: BATALKAN TRANSAKSI
// ============================================

const BatalkanTransaksiSchema = z.object({
  transaksi_id: z.string().min(1),
  alasan: z.string().min(1, 'Alasan wajib diisi').max(500, 'Alasan terlalu panjang'),
  refund: z.boolean(),
});

type BatalkanTransaksiInput = z.infer<typeof BatalkanTransaksiSchema>;

const KASIR_CANCEL_WINDOW_MS = 60 * 60 * 1000; // 1 jam

/**
 * Batalkan transaksi. Skenario:
 * - LANGSUNG dibatalkan: stok_bebas dikembalikan (asumsi ayam masih hidup di tempat).
 * - PRE_ORDER dibatalkan: stok_booking → stok_bebas (lepas booking).
 * - Refund: kalau pelanggan sudah bayar (DP/LUNAS), kasir refund uang fisik.
 *           Sistem catat sebagai PembayaranLog dengan jumlah NEGATIF untuk audit.
 *
 * Authorization:
 * - ADMIN: kapan saja, bisa batalkan transaksi siapapun.
 * - KASIR: hanya dalam 1 jam setelah waktu_transaksi (mencegah penyalahgunaan).
 *
 * Atomic: stok dikembalikan + log mutasi (PEMBATALAN_LANGSUNG / PEMBATALAN_PO) +
 * mark transaksi.dibatalkan_pada + (kalau refund) PembayaranLog negatif.
 */
export async function batalkanTransaksi(
  input: BatalkanTransaksiInput
): Promise<ActionResponse<{ transaksi_id: string }>> {
  try {
    const validated = BatalkanTransaksiSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const transaksi = await prisma.transaksi.findUnique({
      where: { id: validated.transaksi_id },
      include: { detail_pesanan: true },
    });

    if (!transaksi) {
      return { success: false, message: 'Transaksi tidak ditemukan', error: 'NOT_FOUND' };
    }
    if (transaksi.dibatalkan_pada) {
      return { success: false, message: 'Transaksi sudah dibatalkan sebelumnya', error: 'ALREADY_CANCELLED' };
    }

    const role = (session.user as any).role as string;
    const id_kasir = parseInt(session.user.id as string, 10);

    // KASIR hanya boleh dalam window 1 jam
    if (role !== 'ADMIN') {
      const elapsed = Date.now() - transaksi.waktu_transaksi.getTime();
      if (elapsed > KASIR_CANCEL_WINDOW_MS) {
        return {
          success: false,
          message: 'Pembatalan oleh kasir hanya bisa dalam 1 jam setelah transaksi. Hubungi admin untuk pembatalan transaksi lama.',
          error: 'TIME_LIMIT_EXCEEDED',
        };
      }
    }

    const isPreOrder = transaksi.tipe_transaksi === 'PRE_ORDER';

    await prisma.$transaction(async (tx) => {
      // 1. Mark transaksi sebagai dibatalkan
      await tx.transaksi.update({
        where: { id: validated.transaksi_id },
        data: {
          dibatalkan_pada: new Date(),
          alasan_batal: validated.alasan.trim(),
        },
      });

      // 2. Kembalikan stok per item + log mutasi
      for (const detail of transaksi.detail_pesanan) {
        if (isPreOrder) {
          // PO: pindahkan dari booking ke bebas
          const updated = await tx.kategoriAyam.update({
            where: { id: detail.id_kategori },
            data: {
              stok_booking: { decrement: detail.jumlah_ekor },
              stok_bebas: { increment: detail.jumlah_ekor },
            },
          });
          if (updated.stok_booking < 0) {
            throw new Error(`Race condition: stok_booking ${detail.id_kategori} negatif`);
          }
        } else {
          // LANGSUNG: kembalikan ke bebas (ayam dianggap kembali utuh)
          await tx.kategoriAyam.update({
            where: { id: detail.id_kategori },
            data: { stok_bebas: { increment: detail.jumlah_ekor } },
          });
        }

        await tx.mutasiStok.create({
          data: {
            id_kategori: detail.id_kategori,
            jumlah_ekor: detail.jumlah_ekor,
            tipe_mutasi: isPreOrder ? 'PEMBATALAN_PO' : 'PEMBATALAN_LANGSUNG',
            id_kasir,
          },
        });
      }

      // 3. Log refund kalau ada uang yang dibayar dan kasir konfirmasi refund
      if (validated.refund && transaksi.total_bayar > 0) {
        await tx.pembayaranLog.create({
          data: {
            id_transaksi: transaksi.id,
            jumlah: -transaksi.total_bayar, // negatif = uang keluar
            status_sebelum: transaksi.status_bayar,
            status_sesudah: 'DIBATALKAN_REFUND',
            id_kasir,
            keterangan: `Refund pembatalan: ${validated.alasan.trim()}`,
          },
        });
      } else if (transaksi.total_bayar > 0) {
        // Tidak refund (uang dianggap hangus / commission), tetap log untuk audit
        await tx.pembayaranLog.create({
          data: {
            id_transaksi: transaksi.id,
            jumlah: 0,
            status_sebelum: transaksi.status_bayar,
            status_sesudah: 'DIBATALKAN_TANPA_REFUND',
            id_kasir,
            keterangan: `Dibatalkan tanpa refund: ${validated.alasan.trim()}`,
          },
        });
      }
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,
      message: 'Transaksi berhasil dibatalkan',
      data: { transaksi_id: transaksi.id },
    };
  } catch (error) {
    console.error('Error batalkanTransaksi:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message, error: 'VALIDATION_ERROR' };
    }
    return { success: false, message: 'Gagal membatalkan transaksi', error: error instanceof Error ? error.message : 'UNKNOWN' };
  }
}


/**
 * Substitusi kategori untuk PO yang ayamnya mati
 * - Ubah kategori di detail transaksi
 * - Update stok booking (kurang dari kategori lama, tambah ke kategori baru)
 * - Recalculate total_bayar berdasarkan harga kategori baru
 */
const SubstituteKategoriSchema = z.object({
  id_detail: z.number().int().positive(),
  id_kategori_baru: z.number().int().positive(),
  alasan: z.string().min(1, 'Alasan harus diisi').max(200),
});

type SubstituteKategoriInput = z.infer<typeof SubstituteKategoriSchema>;

export async function substituteKategoriPO(
  input: SubstituteKategoriInput
): Promise<ActionResponse> {
  try {
    const validated = SubstituteKategoriSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const role = (session.user as any).role as string;
    if (role !== 'ADMIN') {
      return {
        success: false,
        message: 'Hanya admin yang bisa substitusi kategori',
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

    // Hanya untuk PRE_ORDER
    if (detail.transaksi.tipe_transaksi !== 'PRE_ORDER') {
      return {
        success: false,
        message: 'Substitusi hanya bisa untuk Pre-Order',
        error: 'INVALID_TYPE',
      };
    }

    const kategori_baru = await prisma.kategoriAyam.findUnique({
      where: { id: validated.id_kategori_baru },
    });

    if (!kategori_baru) {
      return {
        success: false,
        message: 'Kategori baru tidak ditemukan',
        error: 'NOT_FOUND',
      };
    }

    if (kategori_baru.stok_booking < detail.jumlah_ekor) {
      return {
        success: false,
        message: `Stok booking kategori ${kategori_baru.nama_kategori} tidak cukup (tersedia: ${kategori_baru.stok_booking}, butuh: ${detail.jumlah_ekor})`,
        error: 'INSUFFICIENT_STOCK',
      };
    }

    const id_kasir = parseInt(session.user.id as string, 10);
    const harga_lama = detail.harga_satuan;
    const harga_baru = kategori_baru.harga_hari_ini;
    const selisih_harga = (harga_baru - harga_lama) * detail.jumlah_ekor;

    // Atomic update
    await prisma.$transaction(
      async (tx) => {
        // Update detail transaksi
        await tx.detailTransaksi.update({
          where: { id: validated.id_detail },
          data: {
            id_kategori: validated.id_kategori_baru,
            harga_satuan: harga_baru,
          },
        });

        // Update stok booking
        await tx.kategoriAyam.update({
          where: { id: detail.id_kategori },
          data: { stok_booking: detail.kategori.stok_booking - detail.jumlah_ekor },
        });

        await tx.kategoriAyam.update({
          where: { id: validated.id_kategori_baru },
          data: { stok_booking: kategori_baru.stok_booking - detail.jumlah_ekor },
        });

        // Update total_bayar transaksi
        await tx.transaksi.update({
          where: { id: detail.transaksi.id },
          data: {
            total_bayar: detail.transaksi.total_bayar + selisih_harga,
          },
        });

        // Log mutasi stok
        await tx.mutasiStok.create({
          data: {
            id_kategori: detail.id_kategori,
            jumlah_ekor: detail.jumlah_ekor,
            tipe_mutasi: 'SUBSTITUSI_KATEGORI_KELUAR',
            id_kasir,
          },
        });

        await tx.mutasiStok.create({
          data: {
            id_kategori: validated.id_kategori_baru,
            jumlah_ekor: detail.jumlah_ekor,
            tipe_mutasi: 'SUBSTITUSI_KATEGORI_MASUK',
            id_kasir,
          },
        });
      },
      { isolationLevel: 'Serializable' }
    );

    return {
      success: true,
      message: `Kategori berhasil disubstitusi dari ${detail.kategori.nama_kategori} ke ${kategori_baru.nama_kategori}. Selisih harga: ${selisih_harga > 0 ? '+' : ''}${formatRupiah(selisih_harga)}`,
    };
  } catch (error) {
    console.error('Error substituteKategoriPO:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Data tidak valid: ' + error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      message: 'Gagal substitusi kategori',
      error: 'UPDATE_ERROR',
    };
  }
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}
