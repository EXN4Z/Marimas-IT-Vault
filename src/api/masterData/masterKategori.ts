import api from '../axios';
import type { Kategori } from './kategori';

// Pengganti `jenis_aset` lama — jenis/tipe barang (mis. Laptop, Proyektor,
// Charger, Tas), relasi ke Kategori. Ini yang diatur admin lewat Master Data
// (CRUD biasa) — beda dari `kategori` yang cuma 2 baris fix.
export interface MasterKategori {
  id: number;
  nama: string;
  kode: string | null; // dipakai di generate kode_inventory, mis. "LAPTOP", "CHRG"
  kategori_id: number;
  kategori?: Kategori;
}

export interface MasterKategoriFormValues {
  nama: string;
  kode?: string | null;
  kategori_id: number;
}

// GET /master-kategori — ?kategori_id=1 buat filter dropdown per Kategori
// (mis. cuma nunjukin jenis-jenis Kelengkapan waktu bikin Kelengkapan baru).
export async function getMasterKategori(kategoriId?: number): Promise<MasterKategori[]> {
  const res = await api.get<MasterKategori[]>('/master-kategori', {
    params: kategoriId != null ? { kategori_id: kategoriId } : undefined,
  });
  return res.data;
}

// POST /master-kategori — dibatasi backend ke role admin.
export async function createMasterKategori(values: MasterKategoriFormValues): Promise<MasterKategori> {
  const res = await api.post<MasterKategori>('/master-kategori', values);
  return res.data;
}

// PUT /master-kategori/{id} — dibatasi backend ke role admin.
export async function updateMasterKategori(id: number, values: MasterKategoriFormValues): Promise<MasterKategori> {
  const res = await api.put<MasterKategori>(`/master-kategori/${id}`, values);
  return res.data;
}

// DELETE /master-kategori/{id} — dibatasi backend ke role admin. Ditolak
// backend (422, bukan error SQL mentah) kalau masih dipakai baris Inventory
// (FK restrictOnDelete).
export async function deleteMasterKategori(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/master-kategori/${id}`);
  return res.data;
}