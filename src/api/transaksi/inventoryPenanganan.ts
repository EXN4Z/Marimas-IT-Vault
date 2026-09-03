import api from '../axios';
import type { Inventory } from '../masterData/inventory';

interface PenangananPemakai {
  id: number;
  user?: {
    id: number;
    name: string;
  };
}

export interface InventoryPenanganan {
  id: number;
  inventory_id: number;
  inventory_pemakai_id: number | null;
  // Satu daftar gabungan buat item apapun, gak lagi tergantung kategori/
  // posisi (induk vs menempel): 'hardware' | 'software' | 'tidak_berfungsi'
  // | 'hancur' | 'terputus_sobek'. Dibiarkan string biasa (bukan union)
  // biar longgar -- lihat JENIS_KERUSAKAN_OPTIONS di inventoryHelpers.ts.
  jenis_kerusakan: string;
  keluhan: string;
  tanggal_lapor: string;
  // waktu kejadian akurat (jam-menit-detik lengkap) -- kolom tanggal_lapor
  // di atas cuma nyimpen tanggal doang, jamnya selalu 00:00:00.
  lapor_at: string | null;
  foto: string | null;
  tanggal_diterima: string | null;
  tanggal_selesai: string | null;
  harga_jasa: number | null;
  biaya_komponen: number | null;
  hasil: string | null;
  no_struk: string | null;
  catatan: string | null;
  total_biaya?: number;
  durasi_hari?: number | null;
  inventory?: Inventory;
  pemakai?: PenangananPemakai | null;
}

export interface PaginatedInventoryPenanganan {
  data: InventoryPenanganan[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

// GET /inventory-penanganan — daftar SEMUA laporan kerusakan, dibatasi
// backend ke role admin,hr (lihat komentar routes/api.php: data pribadi
// karyawan lain, gak boleh bocor ke karyawan/manajer biasa).
export async function getInventoryPenanganan(): Promise<InventoryPenanganan[]> {
  const res = await api.get<InventoryPenanganan[]>('/inventory-penanganan');
  return res.data;
}

// GET /inventory-penanganan/foto — tab "Rusak" di halaman Foto Inventory
// (paginated + search). Beda dari index() di atas yang narik semua data
// buat halaman penanganan/riwayat.
export async function getFotoKerusakanInventory(
  page = 1,
  perPage = 12,
  search?: string
): Promise<PaginatedInventoryPenanganan> {
  const res = await api.get<PaginatedInventoryPenanganan>('/inventory-penanganan/foto', {
    params: { page, per_page: perPage, search: search || undefined },
  });
  return res.data;
}

// POST /inventory-penanganan — bisa dipanggil siapa aja yang sedang
// memegang item tsb (role:karyawan,manajer,hr,admin). Berlaku buat item
// apapun, induk maupun yang menempel ke induk lain -- endpoint terpisah
// buat "kelengkapan" (laporRusakKelengkapan) sudah dihapus sejak alur ini
// digeneralisasi (lihat komentar InventoryPenangananController::store()).
// `foto` WAJIB diisi (validasi backend: image, max 1MB).
export async function laporKerusakanInventory(payload: {
  inventory_id: number;
  jenis_kerusakan: string;
  keluhan: string;
  foto: File;
}): Promise<InventoryPenanganan> {
  const fd = new FormData();
  fd.append('inventory_id', String(payload.inventory_id));
  fd.append('jenis_kerusakan', payload.jenis_kerusakan);
  fd.append('keluhan', payload.keluhan);
  fd.append('foto', payload.foto);

  const res = await api.post<InventoryPenanganan>('/inventory-penanganan', fd);
  return res.data;
}

// POST /inventory-penanganan/{id}/terima — admin terima & mulai tangani
// laporan, item jadi status "diperbaiki". Dibatasi backend ke role admin.
export async function terimaPenangananInventory(id: number): Promise<InventoryPenanganan> {
  const res = await api.post<InventoryPenanganan>(`/inventory-penanganan/${id}/terima`);
  return res.data;
}

// POST /inventory-penanganan/{id} — admin tandai selesai / isi hasil
// penanganan. no_struk digenerate otomatis backend, gak perlu dikirim dari sini.
export async function selesaikanPenangananInventory(
  id: number,
  payload: Partial<{
    tanggal_selesai: string | null;
    harga_jasa: number | null;
    biaya_komponen: number | null;
    hasil: string | null;
    catatan: string | null;
  }> = {}
): Promise<InventoryPenanganan> {
  const res = await api.post<InventoryPenanganan>(`/inventory-penanganan/${id}`, payload);
  return res.data;
}

// DELETE /inventory-penanganan/{id} — dibatasi backend ke role admin.
export async function deletePenangananInventory(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/inventory-penanganan/${id}`);
  return res.data;
}