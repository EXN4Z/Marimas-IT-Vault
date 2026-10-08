import api from '../axios';

// Sekarang full CRUD (halaman Master Data -> tab "Kategori"). Cuma soal
// golongan barang (mis. "Barang Utama" & "Kelengkapan"), TIDAK ADA kolom
// `kode` lagi -- logic sistem cek golongan langsung dari `nama` persis.
// Admin bisa tambah/ubah/hapus baris bebas lewat UI ini.
export interface Kategori {
  id: number;
  nama: string;
}

export interface KategoriFormValues {
  nama: string;
}

// GET /kategori
export async function getKategori(): Promise<Kategori[]> {
  const res = await api.get<Kategori[]>('/kategori');
  return res.data;
}

// POST /kategori -- dibatasi backend ke role admin.
export async function createKategori(values: KategoriFormValues): Promise<Kategori> {
  const res = await api.post<Kategori>('/kategori', values);
  return res.data;
}

// PUT /kategori/{id} -- dibatasi backend ke role admin.
export async function updateKategori(id: number, values: KategoriFormValues): Promise<Kategori> {
  const res = await api.put<Kategori>(`/kategori/${id}`, values);
  return res.data;
}

// DELETE /kategori/{id} -- dibatasi backend ke role admin. Ditolak backend
// (422, bukan error SQL mentah) kalau masih dipakai baris Inventory (FK
// restrictOnDelete). Perhatian: baris ini bisa "Barang Utama"/"Kelengkapan"
// yang dipakai logic sistem -- hapus/rename lewat sini bisa bikin fitur lain
// salah baca (risiko yang sudah diterima, lihat dokumen migrasi).
export async function deleteKategori(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/kategori/${id}`);
  return res.data;
}