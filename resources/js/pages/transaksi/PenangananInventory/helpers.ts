export const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/storage/' : '/storage/');

export function todayIso() {
  // tanggal lokal (bukan toISOString yang UTC -- jam 00.00-07.00 WIB bisa mundur sehari)
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatRupiah(n?: number | string | null) {
  if (n == null) return '-';
  // harga_jasa/biaya_komponen dikirim backend sebagai string decimal
  // ("50000.00"), jadi dinormalisasi ke number dulu biar kebaca "Rp 50.000".
  return `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
}

export function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type TabStatus = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';

export const ITEMS_PER_PAGE = 8;
