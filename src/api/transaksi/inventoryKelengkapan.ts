import api from '../axios';
import type { Inventory, PaginatedInventory } from '../masterData/inventory';

// ================================================================
// Kelengkapan Rusak → Lepas Otomatis → Ganti Pengganti
// (eks api/asetKelengkapan.ts: laporRusak / pasangPengganti / getRusak)
// ================================================================

// POST /inventory/{id}/lapor-rusak-kelengkapan — cuma berlaku buat item
// berkategori Kelengkapan. Lepas otomatis dari parent (kalau ada), tutup
// paksa peminjaman aktif, status -> 'rusak'. Final, gak ada opsi
// "diperbaiki". Status barang utama TIDAK terpengaruh (keputusan #1 dokumen migrasi).
export async function laporRusakKelengkapan(id: number): Promise<Inventory> {
  const res = await api.post<Inventory>(`/inventory/${id}/lapor-rusak-kelengkapan`);
  return res.data;
}

// POST /inventory/{id}/pasang-pengganti-kelengkapan — body { parent_id },
// nempelin kelengkapan yang 'tersedia' ke barang utama tertentu.
export async function pasangPenggantiKelengkapan(id: number, parentId: number): Promise<Inventory> {
  const res = await api.post<Inventory>(`/inventory/${id}/pasang-pengganti-kelengkapan`, { parent_id: parentId });
  return res.data;
}

// GET /inventory/kelengkapan/rusak?page=&per_page=&search= — daftar
// kelengkapan berstatus 'rusak', paginated, order by tanggal_rusak desc.
export async function getRusakKelengkapan(params?: {
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<PaginatedInventory> {
  const res = await api.get<PaginatedInventory>('/inventory/kelengkapan/rusak', {
    params: {
      page: params?.page,
      per_page: params?.per_page,
      search: params?.search || undefined,
    },
  });
  return res.data;
}
