import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function parseRupiah(value: string): number {
  return parseInt(value.replace(/[^\d]/g, ''), 10)
}

/**
 * Normalisasi nomor WhatsApp ke format internasional Indonesia (62...).
 * Menerima berbagai input umum:
 *   "08123456789", "+628123456789", "8123456789", "62 812 3456 789".
 *
 * Return:
 *   - String "628..." kalau valid
 *   - null kalau input kosong / tidak valid
 *
 * Aturan validasi:
 *   - Hanya digit setelah dibersihkan
 *   - Panjang akhir 10–15 digit (sesuai standar E.164)
 */
export function normalizeWaNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  // Buang semua karakter non-digit
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;

  // Konversi awalan: "0..." → "62...", "8..." → "628..."
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (!digits.startsWith('62')) {
    // Kalau langsung 8xx... (tanpa 0 atau 62), anggap nomor Indo
    if (digits.startsWith('8')) {
      digits = '62' + digits;
    }
  }

  // Validasi panjang final
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * Bangun URL wa.me untuk membuka WhatsApp dengan pesan otomatis.
 * Return null kalau nomor tidak valid sehingga UI bisa disable tombolnya.
 */
export function buildWaUrl(phone: string | null | undefined, message?: string): string | null {
  const normalized = normalizeWaNumber(phone);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
