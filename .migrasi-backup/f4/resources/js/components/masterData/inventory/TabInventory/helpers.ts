import type { InventoryStatus } from '../../../../api/masterData/inventory';

// Kategori sekarang bebas (bukan lagi cuma 2 baris "Barang Utama"/
// "Kelengkapan") -- filter kategori di tabel gabungan pakai kategori_id
// (multi-select, lihat selectedKategoriIds), BUKAN nama kategori. Struktur
// induk/menempel (parent_id) sekarang murni independen dari kategori --
// item kategori apapun boleh jadi induk atau nempel ke item lain.

// Status yang cuma bisa dipunyai item yang BUKAN child (parent_id === null)
// -- endpoint jual() (writeoff) masih menolak item yang punya parent_id
// (lihat InventoryController::jual()), apapun kategorinya. Status
// penanganan/perbaikan (menunggu_perbaikan, diperbaiki, rusak_berat) TIDAK
// termasuk di sini karena alur InventoryPenanganan berlaku buat item
// manapun, induk maupun yang menempel.
// Disembunyikan dari tab status kalau semua item yang lolos filter kategori
// aktif punya parent_id (artinya gak ada satupun yang bisa dijual) --
// lihat adaIndukDiFilterAktif di bawah.
export const STATUS_KHUSUS_INDUK: InventoryStatus[] = ['dijual'];

export const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/storage/' : '/storage/');

export const STATUS_LABEL: Record<InventoryStatus, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  menunggu_perbaikan: 'Menunggu Perbaikan',
  diperbaiki: 'Sedang Diperbaiki',
  rusak_berat: 'Rusak Berat',
  dijual: 'Dijual',
};

export const STATUS_STYLE: Record<InventoryStatus, string> = {
  tersedia: 'bg-emerald-50 text-emerald-700',
  dipakai: 'bg-amber-50 text-amber-700',
  menunggu_perbaikan: 'bg-yellow-50 text-yellow-700',
  diperbaiki: 'bg-orange-50 text-orange-700',
  rusak_berat: 'bg-red-100 text-red-800',
  dijual: 'bg-purple-50 text-purple-700',
};

// urutan tampil di tabel: tersedia paling atas, lalu dipakai, lalu status
// yang lagi dalam proses penanganan, rusak_berat, dan dijual paling
// bawah -- dipakai sebagai key sort di filteredInventory, BUKAN untuk urutan
// dropdown filter (dropdown tetap ikut urutan STATUS_LABEL di atas).
export const STATUS_PRIORITY: Record<InventoryStatus, number> = {
  tersedia: 1,
  dipakai: 2,
  menunggu_perbaikan: 3,
  diperbaiki: 4,
  rusak_berat: 5,
  dijual: 6,
};

export function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}

export const ASET_PER_PAGE = 10;

// Pagination + dropdown detail buat Riwayat Perbaikan & Riwayat Pemakai --
// style ringkas, limit 5 per halaman (beda dari Pagination tabel inventory yg 10).
export const RIWAYAT_PERBAIKAN_PER_PAGE = 5;

export const RIWAYAT_PEMAKAI_PER_PAGE = 5;
