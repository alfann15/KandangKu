'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { ActionResponse } from '@/lib/types';

/**
 * Dashboard summary hari ini.
 *
 * Definisi:
 * - total_penjualan (omzet) = Σ (jumlah_ekor × harga_satuan) untuk semua transaksi hari ini.
 *   Diambil dari snapshot harga_satuan supaya tetap akurat meskipun
 *   ada transaksi BELUM_BAYAR (utang) atau harga harian sudah berubah.
 * - total_kas_masuk        = Σ total_bayar untuk transaksi hari ini (uang yang sungguh masuk).
 * - total_piutang          = Σ sisa tagihan untuk SEMUA transaksi (lintas hari) yang masih DP/BELUM_BAYAR.
 *   Untuk PRE_ORDER, sisa dihitung pakai harga_hari_ini saat ini (harga belum dikunci).
 */
export async function getDashboardSummaryHariIni(): Promise<
  ActionResponse<{
    tanggal: string;
    total_transaksi: number;
    total_penjualan: number;
    total_kas_masuk: number;
    total_pengeluaran: number;
    kas_bersih: number;
    total_piutang: number;
    kasir_breakdown: Array<{
      kasir_id: number;
      kasir_nama: string;
      jumlah_transaksi: number;
      total_kas: number;
    }>;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Anda harus login terlebih dahulu', error: 'UNAUTHORIZED' };
    }

    const now = new Date();
    const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today_end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [transactions, piutangList, pengeluaranList] = await Promise.all([
      prisma.transaksi.findMany({
        where: {
          waktu_transaksi: { gte: today_start, lt: today_end },
          dibatalkan_pada: null,
        },
        include: {
          kasir: { select: { id: true, nama: true } },
          detail_pesanan: { select: { jumlah_ekor: true, harga_satuan: true } },
        },
      }),
      prisma.transaksi.findMany({
        where: {
          status_bayar: { in: ['DP', 'BELUM_BAYAR'] },
          dibatalkan_pada: null,
        },
        include: {
          detail_pesanan: {
            include: { kategori: { select: { harga_hari_ini: true } } },
          },
        },
      }),
      prisma.pengeluaran.findMany({
        where: { waktu: { gte: today_start, lt: today_end } },
        select: { jumlah: true },
      }),
    ]);

    // ===== Hari ini =====
    const total_transaksi = transactions.length;
    const total_penjualan = transactions.reduce((sum, t) => {
      const omzet_t = t.detail_pesanan.reduce(
        (s, d) => s + d.jumlah_ekor * d.harga_satuan,
        0
      );
      return sum + omzet_t;
    }, 0);
    const total_kas_masuk = transactions.reduce((sum, t) => sum + t.total_bayar, 0);
    const total_pengeluaran = pengeluaranList.reduce((sum, p) => sum + p.jumlah, 0);
    const kas_bersih = total_kas_masuk - total_pengeluaran;

    // ===== Piutang (lintas hari) =====
    const total_piutang = piutangList.reduce((sum, t) => {
      const isPO = t.tipe_transaksi === 'PRE_ORDER';
      const total_efektif = t.detail_pesanan.reduce((s, d) => {
        const harga = isPO ? d.kategori.harga_hari_ini : d.harga_satuan;
        return s + d.jumlah_ekor * harga;
      }, 0);
      const sisa = Math.max(0, total_efektif - t.diskon - t.total_bayar);
      return sum + sisa;
    }, 0);

    // ===== Group by kasir =====
    const kasir_map = new Map<
      number,
      { kasir_id: number; kasir_nama: string; jumlah_transaksi: number; total_kas: number }
    >();

    transactions.forEach((t) => {
      if (!kasir_map.has(t.id_kasir)) {
        kasir_map.set(t.id_kasir, {
          kasir_id: t.id_kasir,
          kasir_nama: t.kasir.nama,
          jumlah_transaksi: 0,
          total_kas: 0,
        });
      }
      const entry = kasir_map.get(t.id_kasir)!;
      entry.jumlah_transaksi += 1;
      entry.total_kas += t.total_bayar;
    });

    const kasir_breakdown = Array.from(kasir_map.values()).sort(
      (a, b) => b.total_kas - a.total_kas
    );

    return {
      success: true,
      message: 'Dashboard summary berhasil diambil',
      data: {
        tanggal: today_start.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        total_transaksi,
        total_penjualan,
        total_kas_masuk,
        total_pengeluaran,
        kas_bersih,
        total_piutang,
        kasir_breakdown,
      },
    };
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    return { success: false, message: 'Gagal mengambil summary dashboard', error: 'FETCH_ERROR' };
  }
}

/**
 * Daftar transaksi terbaru hari ini (untuk table view di dashboard).
 * total_efektif = Σ jumlah_ekor × harga_satuan untuk transaksi tsb.
 */
export async function getTransaksiHariIni(limit: number = 50): Promise<
  ActionResponse<
    Array<{
      id: string;
      nama_pelanggan: string;
      kasir_nama: string;
      tipe_transaksi: string;
      status_bayar: string;
      total_bayar: number;
      total_efektif: number;
      diskon: number;
      waktu: string;
      dibatalkan: boolean;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const now = new Date();
    const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today_end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const transactions = await prisma.transaksi.findMany({
      where: { waktu_transaksi: { gte: today_start, lt: today_end } },
      include: {
        kasir: { select: { nama: true } },
        detail_pesanan: { select: { jumlah_ekor: true, harga_satuan: true } },
      },
      orderBy: { waktu_transaksi: 'desc' },
      take: limit,
    });

    const formatted = transactions.map((t) => ({
      id: t.id,
      nama_pelanggan: t.nama_pelanggan,
      kasir_nama: t.kasir.nama,
      tipe_transaksi: t.tipe_transaksi,
      status_bayar: t.status_bayar,
      total_bayar: t.total_bayar,
      total_efektif: t.detail_pesanan.reduce(
        (s, d) => s + d.jumlah_ekor * d.harga_satuan,
        0
      ),
      diskon: t.diskon,
      waktu: t.waktu_transaksi.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      dibatalkan: t.dibatalkan_pada !== null,
    }));

    return { success: true, message: 'Transaksi hari ini berhasil diambil', data: formatted };
  } catch (error) {
    console.error('Error getting transaksi hari ini:', error);
    return { success: false, message: 'Gagal mengambil data transaksi', error: 'FETCH_ERROR' };
  }
}

/**
 * Stok real-time semua kategori.
 */
export async function getStokRealtime(): Promise<
  ActionResponse<
    Array<{
      id: number;
      nama_kategori: string;
      harga_hari_ini: number;
      stok_bebas: number;
      stok_booking: number;
      total_stok: number;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const kategori = await prisma.kategoriAyam.findMany({
      orderBy: { nama_kategori: 'asc' },
    });

    const data = kategori.map((k) => ({
      id: k.id,
      nama_kategori: k.nama_kategori,
      harga_hari_ini: k.harga_hari_ini,
      stok_bebas: k.stok_bebas,
      stok_booking: k.stok_booking,
      total_stok: k.stok_bebas + k.stok_booking,
    }));

    return { success: true, message: 'Stok berhasil diambil', data };
  } catch (error) {
    console.error('Error getting stok:', error);
    return { success: false, message: 'Gagal mengambil data stok', error: 'FETCH_ERROR' };
  }
}



/**
 * Omzet 7 hari terakhir (termasuk hari ini) untuk grafik tren di dashboard.
 * Exclude transaksi yang dibatalkan. Hitung dari snapshot harga_satuan.
 */
export async function getOmzet7Hari(): Promise<
  ActionResponse<
    Array<{
      tanggal: string;        // YYYY-MM-DD
      label: string;          // "Sen 12"
      omzet: number;
      jumlah_transaksi: number;
      is_today: boolean;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    start.setDate(start.getDate() - 6); // 7 hari ke belakang termasuk hari ini
    const end = new Date(today);
    end.setDate(end.getDate() + 1);

    const transactions = await prisma.transaksi.findMany({
      where: {
        waktu_transaksi: { gte: start, lt: end },
        dibatalkan_pada: null,
      },
      select: {
        waktu_transaksi: true,
        detail_pesanan: { select: { jumlah_ekor: true, harga_satuan: true } },
      },
    });

    const toKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    // Pre-fill 7 hari dengan zero
    const map = new Map<string, { tanggal: string; label: string; omzet: number; jumlah_transaksi: number; is_today: boolean }>();
    const todayKey = toKey(today);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = toKey(d);
      map.set(key, {
        tanggal: key,
        label: `${HARI[d.getDay()]} ${d.getDate()}`,
        omzet: 0,
        jumlah_transaksi: 0,
        is_today: key === todayKey,
      });
    }

    transactions.forEach((t) => {
      const key = toKey(t.waktu_transaksi);
      const entry = map.get(key);
      if (entry) {
        entry.jumlah_transaksi += 1;
        const omzet_t = t.detail_pesanan.reduce(
          (s, d) => s + d.jumlah_ekor * d.harga_satuan,
          0
        );
        entry.omzet += omzet_t;
      }
    });

    return { success: true, message: 'OK', data: Array.from(map.values()) };
  } catch (error) {
    console.error('Error getOmzet7Hari:', error);
    return { success: false, message: 'Gagal mengambil data omzet', error: 'FETCH_ERROR' };
  }
}

/**
 * Get analytics dashboard: margin, top kasir, top kategori
 */
export async function getDashboardAnalytics(): Promise<
  ActionResponse<{
    margin_analysis: {
      total_omzet: number;
      total_kas_masuk: number;
      total_diskon: number;
      margin_persen: number;
    };
    top_kasir: Array<{
      kasir_id: number;
      kasir_nama: string;
      jumlah_transaksi: number;
      total_omzet: number;
      total_kas: number;
      margin_persen: number;
    }>;
    top_kategori: Array<{
      kategori_id: number;
      nama_kategori: string;
      total_ekor: number;
      total_omzet: number;
      harga_rata_rata: number;
    }>;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Unauthorized', error: 'UNAUTHORIZED' };
    }

    const now = new Date();
    const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today_end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Get all transactions today
    const transactions = await prisma.transaksi.findMany({
      where: {
        waktu_transaksi: { gte: today_start, lt: today_end },
        dibatalkan_pada: null,
      },
      include: {
        kasir: { select: { id: true, nama: true } },
        detail_pesanan: {
          include: {
            kategori: { select: { nama_kategori: true } },
          },
        },
      },
    });

    // Margin analysis
    let total_omzet = 0;
    let total_kas_masuk = 0;
    let total_diskon = 0;

    transactions.forEach((t) => {
      const omzet = t.detail_pesanan.reduce((s, d) => s + d.jumlah_ekor * d.harga_satuan, 0);
      total_omzet += omzet;
      total_kas_masuk += t.total_bayar;
      total_diskon += t.diskon;
    });

    const margin_persen = total_omzet > 0 ? Math.round((total_kas_masuk / total_omzet) * 1000) / 10 : 0;

    // Top kasir
    const kasirMap = new Map<
      number,
      { kasir_id: number; kasir_nama: string; jumlah_transaksi: number; total_omzet: number; total_kas: number }
    >();

    transactions.forEach((t) => {
      if (!kasirMap.has(t.id_kasir)) {
        kasirMap.set(t.id_kasir, {
          kasir_id: t.id_kasir,
          kasir_nama: t.kasir.nama,
          jumlah_transaksi: 0,
          total_omzet: 0,
          total_kas: 0,
        });
      }
      const entry = kasirMap.get(t.id_kasir)!;
      entry.jumlah_transaksi += 1;
      entry.total_kas += t.total_bayar;
      const omzet = t.detail_pesanan.reduce((s, d) => s + d.jumlah_ekor * d.harga_satuan, 0);
      entry.total_omzet += omzet;
    });

    const top_kasir = Array.from(kasirMap.values())
      .map((k) => ({
        ...k,
        margin_persen: k.total_omzet > 0 ? Math.round((k.total_kas / k.total_omzet) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total_kas - a.total_kas)
      .slice(0, 5);

    // Top kategori
    const kategoriMap = new Map<
      number,
      { kategori_id: number; nama_kategori: string; total_ekor: number; total_omzet: number }
    >();

    transactions.forEach((t) => {
      t.detail_pesanan.forEach((d) => {
        if (!kategoriMap.has(d.id_kategori)) {
          kategoriMap.set(d.id_kategori, {
            kategori_id: d.id_kategori,
            nama_kategori: d.kategori.nama_kategori,
            total_ekor: 0,
            total_omzet: 0,
          });
        }
        const entry = kategoriMap.get(d.id_kategori)!;
        entry.total_ekor += d.jumlah_ekor;
        entry.total_omzet += d.jumlah_ekor * d.harga_satuan;
      });
    });

    const top_kategori = Array.from(kategoriMap.values())
      .map((k) => ({
        ...k,
        harga_rata_rata: k.total_ekor > 0 ? Math.round(k.total_omzet / k.total_ekor) : 0,
      }))
      .sort((a, b) => b.total_ekor - a.total_ekor)
      .slice(0, 5);

    return {
      success: true,
      message: 'Analytics berhasil diambil',
      data: {
        margin_analysis: {
          total_omzet,
          total_kas_masuk,
          total_diskon,
          margin_persen,
        },
        top_kasir,
        top_kategori,
      },
    };
  } catch (error) {
    console.error('Error getDashboardAnalytics:', error);
    return {
      success: false,
      message: 'Gagal mengambil analytics',
      error: 'FETCH_ERROR',
    };
  }
}
