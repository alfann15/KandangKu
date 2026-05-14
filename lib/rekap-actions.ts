'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

export type ActionResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
};

// ============================================
// SCHEMA & TYPES
// ============================================

const RekapInputSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
});

export type RekapInput = z.infer<typeof RekapInputSchema>;

export type RekapData = {
  periode_label: string;
  start_date: string;
  end_date: string;
  jumlah_hari: number;
  summary: {
    total_penjualan: number;        // sebelum diskon (omzet kotor)
    total_kas_masuk: number;        // setelah diskon (uang yang benar-benar masuk)
    total_diskon: number;
    total_pengeluaran: number;      // kas keluar
    jumlah_transaksi: number;
    rata_rata_kas_per_hari: number;
  };
  daily_breakdown: Array<{
    tanggal: string;                // YYYY-MM-DD
    label: string;                  // "Sen, 12 Mei"
    jumlah_transaksi: number;
    total_kas: number;
    total_penjualan: number;
  }>;
  kasir_breakdown: Array<{
    kasir_id: number;
    kasir_nama: string;
    jumlah_transaksi: number;
    total_kas: number;
    persentase: number;
  }>;
  kategori_breakdown: Array<{
    kategori_id: number;
    nama_kategori: string;
    total_ekor: number;
    estimasi_pendapatan: number;    // estimasi pakai harga_hari_ini saat ini
  }>;
  pengeluaran_breakdown: Array<{
    kategori_nama: string;
    total_pengeluaran: number;
  }>;
  mutasi_summary: {
    total_tambah_stok: number;
    total_ayam_mati: number;
    detail_per_kategori: Array<{
      kategori_id: number;
      nama_kategori: string;
      tambah: number;
      mati: number;
    }>;
  };
};

// ============================================
// HELPERS
// ============================================

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Date → 'YYYY-MM-DD' menggunakan local timezone server */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTanggalIndo(d: Date): string {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatLabelHarian(d: Date): string {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}

// ============================================
// SERVER ACTION: GET REKAP PERIODE
// ============================================

/**
 * Get rekap penjualan untuk rentang tanggal tertentu.
 * - start_date & end_date dalam format YYYY-MM-DD (inklusif keduanya).
 * - Timezone mengikuti local time server (set env TZ=Asia/Jakarta untuk WIB).
 */
export async function getRekapPeriode(
  input: RekapInput
): Promise<ActionResponse<RekapData>> {
  try {
    const validated = RekapInputSchema.parse(input);

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    // Parse tanggal dengan local timezone (bukan UTC)
    const [sy, sm, sd] = validated.start_date.split('-').map(Number);
    const [ey, em, ed] = validated.end_date.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endDateExclusive = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0); // +1 hari (eksklusif)

    if (endDateExclusive <= startDate) {
      return {
        success: false,
        message: 'Tanggal akhir harus sama atau setelah tanggal mulai',
        error: 'INVALID_DATE_RANGE',
      };
    }

    const jumlah_hari = Math.round(
      (endDateExclusive.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Batasi maksimal 366 hari supaya query tidak meledak
    if (jumlah_hari > 366) {
      return {
        success: false,
        message: 'Rentang tanggal maksimal 366 hari',
        error: 'RANGE_TOO_LARGE',
      };
    }

    // ===== FETCH DATA =====
    const [transactions, mutasi, pengeluaran] = await Promise.all([
      prisma.transaksi.findMany({
        where: {
          waktu_transaksi: { gte: startDate, lt: endDateExclusive },
          dibatalkan_pada: null,
        },
        include: {
          kasir: { select: { id: true, nama: true } },
          detail_pesanan: {
            include: {
              kategori: {
                select: { id: true, nama_kategori: true, harga_hari_ini: true },
              },
            },
          },
        },
        orderBy: { waktu_transaksi: 'asc' },
      }),
      prisma.mutasiStok.findMany({
        where: { waktu_mutasi: { gte: startDate, lt: endDateExclusive } },
        include: {
          kategori: { select: { id: true, nama_kategori: true } },
        },
      }),
      prisma.pengeluaran.findMany({
        where: { waktu: { gte: startDate, lt: endDateExclusive } },
        include: {
          kategori: { select: { nama: true } },
        },
      }),
    ]);

    // Helper: omzet sebuah transaksi dari snapshot harga_satuan.
    // Untuk PRE_ORDER yang masih DP/BELUM_BAYAR, harga belum dikunci jadi
    // omzet pakai harga_hari_ini sekarang (lebih representatif).
    const omzetTransaksi = (t: typeof transactions[number]): number =>
      t.detail_pesanan.reduce((s, d) => {
        const isPoBelumLunas =
          t.tipe_transaksi === 'PRE_ORDER' && t.status_bayar !== 'LUNAS';
        const harga = isPoBelumLunas ? d.kategori.harga_hari_ini : d.harga_satuan;
        return s + d.jumlah_ekor * harga;
      }, 0);

    // ===== SUMMARY =====
    const total_kas_masuk = transactions.reduce((s, t) => s + t.total_bayar, 0);
    const total_diskon = transactions.reduce((s, t) => s + t.diskon, 0);
    const total_penjualan = transactions.reduce((s, t) => s + omzetTransaksi(t), 0);
    const total_pengeluaran = pengeluaran.reduce((s, p) => s + p.jumlah, 0);
    const jumlah_transaksi = transactions.length;
    const rata_rata_kas_per_hari =
      jumlah_hari > 0 ? Math.round(total_kas_masuk / jumlah_hari) : 0;

    // ===== DAILY BREAKDOWN =====
    const dailyMap = new Map<
      string,
      { tanggal: string; jumlah_transaksi: number; total_kas: number; total_penjualan: number }
    >();

    // Pre-fill semua hari dalam rentang dengan zero (supaya hari kosong tetap muncul)
    for (let i = 0; i < jumlah_hari; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      dailyMap.set(key, {
        tanggal: key,
        jumlah_transaksi: 0,
        total_kas: 0,
        total_penjualan: 0,
      });
    }

    transactions.forEach((t) => {
      const key = toDateKey(t.waktu_transaksi);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.jumlah_transaksi += 1;
        entry.total_kas += t.total_bayar;
        entry.total_penjualan += omzetTransaksi(t);
      }
    });

    const daily_breakdown = Array.from(dailyMap.values()).map((d) => {
      const [yy, mm, dd] = d.tanggal.split('-').map(Number);
      const dt = new Date(yy, mm - 1, dd);
      return { ...d, label: formatLabelHarian(dt) };
    });

    // ===== KASIR BREAKDOWN =====
    const kasirMap = new Map<
      number,
      { kasir_id: number; kasir_nama: string; jumlah_transaksi: number; total_kas: number }
    >();

    transactions.forEach((t) => {
      if (!kasirMap.has(t.id_kasir)) {
        kasirMap.set(t.id_kasir, {
          kasir_id: t.id_kasir,
          kasir_nama: t.kasir.nama,
          jumlah_transaksi: 0,
          total_kas: 0,
        });
      }
      const e = kasirMap.get(t.id_kasir)!;
      e.jumlah_transaksi += 1;
      e.total_kas += t.total_bayar;
    });

    const kasir_breakdown = Array.from(kasirMap.values())
      .map((k) => ({
        ...k,
        persentase:
          total_kas_masuk > 0
            ? Math.round((k.total_kas / total_kas_masuk) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.total_kas - a.total_kas);

    // ===== KATEGORI BREAKDOWN =====
    // Akumulasi pendapatan per kategori menggunakan snapshot harga_satuan
    // dari setiap DetailTransaksi (sudah akurat & tidak terpengaruh perubahan harga harian).
    const kategoriMap = new Map<
      number,
      { kategori_id: number; nama_kategori: string; total_ekor: number; pendapatan: number }
    >();

    transactions.forEach((t) => {
      const isPoBelumLunas =
        t.tipe_transaksi === 'PRE_ORDER' && t.status_bayar !== 'LUNAS';
      t.detail_pesanan.forEach((d) => {
        if (!kategoriMap.has(d.id_kategori)) {
          kategoriMap.set(d.id_kategori, {
            kategori_id: d.id_kategori,
            nama_kategori: d.kategori.nama_kategori,
            total_ekor: 0,
            pendapatan: 0,
          });
        }
        const e = kategoriMap.get(d.id_kategori)!;
        e.total_ekor += d.jumlah_ekor;
        const harga = isPoBelumLunas ? d.kategori.harga_hari_ini : d.harga_satuan;
        e.pendapatan += d.jumlah_ekor * harga;
      });
    });

    const kategori_breakdown = Array.from(kategoriMap.values())
      .map((k) => ({
        kategori_id: k.kategori_id,
        nama_kategori: k.nama_kategori,
        total_ekor: k.total_ekor,
        estimasi_pendapatan: k.pendapatan,
      }))
      .sort((a, b) => b.total_ekor - a.total_ekor);

    // ===== MUTASI SUMMARY =====
    const total_tambah_stok = mutasi
      .filter((m) => m.tipe_mutasi === 'TAMBAH_STOK')
      .reduce((s, m) => s + m.jumlah_ekor, 0);
    const total_ayam_mati = mutasi
      .filter((m) => m.tipe_mutasi === 'AYAM_MATI')
      .reduce((s, m) => s + m.jumlah_ekor, 0);

    const mutasiKategoriMap = new Map<
      number,
      { kategori_id: number; nama_kategori: string; tambah: number; mati: number }
    >();

    mutasi.forEach((m) => {
      if (!mutasiKategoriMap.has(m.id_kategori)) {
        mutasiKategoriMap.set(m.id_kategori, {
          kategori_id: m.id_kategori,
          nama_kategori: m.kategori.nama_kategori,
          tambah: 0,
          mati: 0,
        });
      }
      const e = mutasiKategoriMap.get(m.id_kategori)!;
      if (m.tipe_mutasi === 'TAMBAH_STOK') e.tambah += m.jumlah_ekor;
      else if (m.tipe_mutasi === 'AYAM_MATI') e.mati += m.jumlah_ekor;
    });

    const detail_per_kategori = Array.from(mutasiKategoriMap.values()).sort((a, b) =>
      a.nama_kategori.localeCompare(b.nama_kategori)
    );

    // ===== PENGELUARAN BREAKDOWN =====
    const pengeluaranMap = new Map<
      string,
      { kategori_nama: string; total_pengeluaran: number }
    >();

    pengeluaran.forEach((p) => {
      const kategoriNama = p.kategori?.nama || 'Lain-lain';
      if (!pengeluaranMap.has(kategoriNama)) {
        pengeluaranMap.set(kategoriNama, {
          kategori_nama: kategoriNama,
          total_pengeluaran: 0,
        });
      }
      const e = pengeluaranMap.get(kategoriNama)!;
      e.total_pengeluaran += p.jumlah;
    });

    const pengeluaran_breakdown = Array.from(pengeluaranMap.values()).sort((a, b) =>
      b.total_pengeluaran - a.total_pengeluaran
    );

    // ===== PERIODE LABEL =====
    const lastDay = new Date(endDateExclusive);
    lastDay.setDate(lastDay.getDate() - 1);
    const periode_label =
      jumlah_hari === 1
        ? formatTanggalIndo(startDate)
        : `${formatTanggalIndo(startDate)} – ${formatTanggalIndo(lastDay)}`;

    return {
      success: true,
      message: 'Rekap berhasil diambil',
      data: {
        periode_label,
        start_date: validated.start_date,
        end_date: validated.end_date,
        jumlah_hari,
        summary: {
          total_penjualan,
          total_kas_masuk,
          total_diskon,
          total_pengeluaran,
          jumlah_transaksi,
          rata_rata_kas_per_hari,
        },
        daily_breakdown,
        kasir_breakdown,
        kategori_breakdown,
        pengeluaran_breakdown,
        mutasi_summary: {
          total_tambah_stok,
          total_ayam_mati,
          detail_per_kategori,
        },
      },
    };
  } catch (error) {
    console.error('Error getRekapPeriode:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.errors[0].message,
        error: 'VALIDATION_ERROR',
      };
    }
    return {
      success: false,
      message: 'Gagal membuat rekap',
      error: error instanceof Error ? error.message : 'UNKNOWN',
    };
  }
}



/**
 * Export rekap ke Excel
 */
export async function exportRekapToExcel(
  input: RekapInput,
  rekapData: RekapData
): Promise<ActionResponse> {
  try {
    const XLSX = require('xlsx');

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['REKAP PERIODE', rekapData.periode_label],
      [],
      ['Metrik', 'Nilai'],
      ['Total Penjualan', rekapData.summary.total_penjualan],
      ['Total Kas Masuk', rekapData.summary.total_kas_masuk],
      ['Total Diskon', rekapData.summary.total_diskon],
      ['Total Pengeluaran', rekapData.summary.total_pengeluaran],
      ['Jumlah Transaksi', rekapData.summary.jumlah_transaksi],
      ['Rata-rata Kas/Hari', rekapData.summary.rata_rata_kas_per_hari],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Sheet 2: Daily Breakdown
    const dailyData = [
      ['Tanggal', 'Transaksi', 'Total Kas', 'Total Penjualan'],
      ...rekapData.daily_breakdown.map((d) => [d.tanggal, d.jumlah_transaksi, d.total_kas, d.total_penjualan]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Harian');

    // Sheet 3: Kasir Breakdown
    const kasirData = [
      ['Kasir', 'Transaksi', 'Total Kas', 'Persentase'],
      ...rekapData.kasir_breakdown.map((k) => [k.kasir_nama, k.jumlah_transaksi, k.total_kas, `${k.persentase}%`]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(kasirData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Per Kasir');

    // Sheet 4: Kategori Breakdown
    const kategoriData = [
      ['Kategori', 'Total Ekor', 'Estimasi Pendapatan'],
      ...rekapData.kategori_breakdown.map((k) => [k.nama_kategori, k.total_ekor, k.estimasi_pendapatan]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(kategoriData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Per Kategori');

    // Sheet 5: Pengeluaran Breakdown
    const pengeluaranData = [
      ['Kategori', 'Total Pengeluaran'],
      ...rekapData.pengeluaran_breakdown.map((p) => [p.kategori_nama, p.total_pengeluaran]),
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(pengeluaranData);
    XLSX.utils.book_append_sheet(wb, ws5, 'Pengeluaran');

    // Write file
    const filename = `Rekap_${input.start_date}_${input.end_date}.xlsx`;
    XLSX.writeFile(wb, filename);

    return {
      success: true,
      message: `File ${filename} berhasil diunduh`,
    };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return {
      success: false,
      message: 'Gagal export ke Excel',
      error: 'EXPORT_ERROR',
    };
  }
}
