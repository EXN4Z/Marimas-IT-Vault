import api from '../axios';
import type { Inventory } from '../masterData/inventory';

export type InventoryPemakaiStatus = 'pending' | 'disetujui' | 'ditolak';

export interface KaryawanUser {
  id: number;
  name: string;
  role?: string;
  nik?: string | null;
  departemen?: { id: number; nama: string } | null;
}

export interface InventoryPemakai {
  created_at: string;
  id: number;
  inventory_id: number;
  user_id: number | null;
  user?: { id: number; name: string; role?: string; nik?: string | null; departemen?: { id: number; nama: string } | null } | null;
  status: InventoryPemakaiStatus;
  requested_by_user_id: number | null;
  nomor_penerimaan: string | null;
  no_struk_penerimaan: string | null;
  tanggal_penerimaan: string | null; // nullable — request pending belum ada tanggal penerimaan
  catatan_penerimaan: string | null;
  nomor_pengembalian: string | null;
  no_struk_pengembalian: string | null;
  tanggal_pengembalian: string | null;
  catatan_pengembalian: string | null;
  catatan_penolakan: string | null;
  inventory?: Inventory; // keisi kalau di-load dari endpoint /inventory-pemakai/riwayat
}

export interface FotoPemakaiEntry {
  id: number;
  inventory_id: number;
  inventory?: { id: number; kode_inventory: string; merek: string | null; tipe: string | null } | null;
  user_id: number | null;
  user?: { id: number; name: string } | null;
  tanggal_penerimaan: string | null;
  tanggal_pengembalian: string | null;
  diterima_at: string | null;
  dikembalikan_at: string | null;
  foto_penerimaan: string[] | null;
  foto_pengembalian: string[] | null;
  created_at: string;
}

export interface PaginatedFotoPemakai {
  data: FotoPemakaiEntry[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

// Satu entri riwayat aktivitas inventory — dari peminjaman (pinjam/kembali),
// penanganan kerusakan, atau penjualan/writeoff (dijual), digabung backend.
export interface RiwayatInventoryEvent {
  type: 'pinjam' | 'kembali' | 'lapor_rusak' | 'mulai_perbaikan' | 'selesai_perbaikan' | 'dijual';
  waktu: string;
  nama: string | null;
  inventory: { id: number; kode_inventory?: string; merek: string | null; tipe: string | null } | null;
  tipe_item: 'barang_utama' | 'kelengkapan';
  keluhan?: string | null; // dipakai lapor_rusak (keluhan) & dijual (alasan)
  hasil?: string | null;
}

export interface PaginatedRiwayatInventory {
  data: RiwayatInventoryEvent[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

// BE riwayat masih kirim key `aset` + tipe_item `'aset'` (Tahap 6.5).
// Normalisasi di sini biar semua consumer (tab Riwayat, dashboard) baca
// bentuk kanonik: `inventory` + `barang_utama` | `kelengkapan`.
type RiwayatInventoryEventRaw = Omit<RiwayatInventoryEvent, 'inventory' | 'tipe_item'> & {
  inventory?: RiwayatInventoryEvent['inventory'];
  aset?: RiwayatInventoryEvent['inventory'];
  tipe_item?: 'barang_utama' | 'kelengkapan' | 'aset';
};

function normalizeRiwayatEvent(ev: RiwayatInventoryEventRaw): RiwayatInventoryEvent {
  return {
    type: ev.type,
    waktu: ev.waktu,
    nama: ev.nama,
    inventory: ev.inventory ?? ev.aset ?? null,
    tipe_item: ev.tipe_item === 'kelengkapan' ? 'kelengkapan' : 'barang_utama',
    keluhan: ev.keluhan,
    hasil: ev.hasil,
  };
}

/**
 * Cari karyawan atau akun cabang (buat dipilih sebagai pemakai inventory).
 * Kirim role='cabang' buat nampilin akun cabang aja. Kosongkan (undefined)
 * buat perilaku lama (semua role, biasanya dipakai buat cari karyawan).
 */
export async function searchKaryawan(query: string, role?: string): Promise<KaryawanUser[]> {
  const res = await api.get<KaryawanUser[]>('/karyawan', {
    params: { search: query, ...(role ? { role } : {}) },
  });
  return res.data;
}

// POST /inventory/{inventory}/pemakai — serah-terima inventory ke karyawan
// ATAU akun cabang. Kirim user_id. Dibatasi backend ke role admin.
// Kalau item ini barang utama, kelengkapan anaknya yang 'tersedia' ikut
// otomatis di-set 'dipakai' & dicatat riwayatnya di backend (rule #2 dokumen migrasi).
export async function serahTerimaInventory(inventoryId: number, formData: FormData) {
  const res = await api.post(`/inventory/${inventoryId}/pemakai`, formData);
  return res.data;
}

// POST /inventory-pemakai/{id}/kembalikan — admin ATAU pemakai yang lagi
// pegang inventory ini sendiri (karyawan/cabang). Wajib sertain
// no_struk_penerimaan (struk asli pas serah-terima) buat validasi backend.
// Kalau item ini barang utama, kelengkapan yang ikut 'dipakai' bareng ikut balik 'tersedia'.
export async function kembalikanInventory(pemakaiId: number, formData: FormData) {
  const res = await api.post(`/inventory-pemakai/${pemakaiId}/kembalikan`, formData);
  return res.data;
}

// DELETE /inventory-pemakai/{id} — admin hapus satu entri riwayat pemakaian.
// Ditolak backend kalau entri ini punya laporan perbaikan yang nempel.
export async function deletePemakaiInventory(pemakaiId: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/inventory-pemakai/${pemakaiId}`);
  return res.data;
}

export async function getFotoPemakaiInventory(
  page = 1,
  perPage = 12,
  search?: string,
  type?: 'peminjaman' | 'pengembalian'
): Promise<PaginatedFotoPemakai> {
  const res = await api.get<PaginatedFotoPemakai>('/inventory-pemakai/foto', {
    params: { page, per_page: perPage, search: search || undefined, type },
  });
  return res.data;
}

// GET /inventory-pemakai/riwayat — riwayat SEMUA aktivitas inventory (pinjam,
// kembali, lapor rusak, selesai perbaikan), terbaru duluan, terpaginasi.
// Admin lihat riwayat SEMUA inventory; role lain cuma lihat riwayat MEREKA
// SENDIRI (difilter di backend).
export async function getRiwayatInventory(
  page = 1,
  perPage = 10,
  type?: RiwayatInventoryEvent['type'],
  search?: string
): Promise<PaginatedRiwayatInventory> {
  const res = await api.get<Omit<PaginatedRiwayatInventory, 'data'> & { data: RiwayatInventoryEventRaw[] }>(
    '/inventory-pemakai/riwayat',
    {
      params: { page, per_page: perPage, type: type || undefined, search: search || undefined },
    }
  );
  return {
    ...res.data,
    data: res.data.data.map(normalizeRiwayatEvent),
  };
}
