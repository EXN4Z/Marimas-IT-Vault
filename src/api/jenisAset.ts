import api from './axios';

// kategori nentuin jenis aset ini masuk grup "Aset Utama" (laptop, proyektor,
// dst) atau "Kelengkapan" (tas, charger, dst). Kelengkapan tetap dilacak per
// unit fisik kayak aset biasa (kode unik, S/N, bisa dipinjam/dikembalikan) --
// bedanya cuma di kategori jenis-nya, struktur tabel aset-nya sama persis.
export type JenisAsetKategori = 'aset_utama' | 'kelengkapan';

export interface JenisAset {
  id: number;
  nama: string;
  kategori: JenisAsetKategori;
}

// GET /jenis-aset — kategori opsional buat filter: 'aset_utama' (dropdown
// Tambah Aset) atau 'kelengkapan' (checklist kelengkapan). Kosongkan buat
// ambil semua.
export async function getJenisAset(kategori?: JenisAsetKategori): Promise<JenisAset[]> {
  const res = await api.get<JenisAset[]>('/jenis-aset', {
    params: kategori ? { kategori } : undefined,
  });
  return res.data;
}

// POST /jenis-aset — dibatasi backend ke role admin.
export async function createJenisAset(nama: string, kategori: JenisAsetKategori = 'aset_utama'): Promise<JenisAset> {
  const res = await api.post<JenisAset>('/jenis-aset', { nama, kategori });
  return res.data;
}

// PUT /jenis-aset/{id} — dibatasi backend ke role admin.
export async function updateJenisAset(
  id: number,
  nama: string,
  kategori: JenisAsetKategori = 'aset_utama'
): Promise<JenisAset> {
  const res = await api.put<JenisAset>(`/jenis-aset/${id}`, { nama, kategori });
  return res.data;
}

// DELETE /jenis-aset/{id} — dibatasi backend ke role admin.
export async function deleteJenisAset(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/jenis-aset/${id}`);
  return res.data;
}