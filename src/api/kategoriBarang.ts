import api from './axios';

export interface KategoriBarang {
  id: number;
  nama: string;
}

export async function getKategoriBarang(): Promise<KategoriBarang[]> {
  const res = await api.get<KategoriBarang[]>('/kategori-barang');
  return res.data;
}

// POST /kategori-barang — dibatasi backend ke role admin/hr.
export async function createKategoriBarang(nama: string): Promise<KategoriBarang> {
  const res = await api.post<KategoriBarang>('/kategori-barang', { nama });
  return res.data;
}

// PUT /kategori-barang/{id} — dibatasi backend ke role admin/hr.
export async function updateKategoriBarang(id: number, nama: string): Promise<KategoriBarang> {
  const res = await api.put<KategoriBarang>(`/kategori-barang/${id}`, { nama });
  return res.data;
}

// DELETE /kategori-barang/{id} — dibatasi backend ke role admin/hr.
export async function deleteKategoriBarang(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/kategori-barang/${id}`);
  return res.data;
}