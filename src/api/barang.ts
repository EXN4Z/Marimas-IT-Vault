import api from './axios';

export interface KategoriBarang {
  id: number;
  nama: string;
}

export interface Barang {
  id: number;
  kode_barang: string;
  nama: string;
  kategori_id: number | null;
  kategori_barang?: {
    id: number;
    nama: string;
  } | null;
  satuan: string;
  stok: number;
  stok_minimum: number;
  stok_dipinjam: number;
  stok_tersedia: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Mutasi {
  id: number;
  barang_id: number;
  tipe: 'masuk' | 'keluar';
  jumlah: number;
  stok_sebelum: number;
  stok_sesudah: number;
  catatan: string | null;
  created_at: string;
  barang?: { id: number; nama: string; satuan: string };
  user?: { id: number; name: string };
}

export const getBarang = async (): Promise<Barang[]> => {
  const res = await api.get('/barang');
  return res.data;
};

export const getBarangById = async (id: number): Promise<Barang> => {
  const res = await api.get(`/barang/${id}`);
  return res.data;
};

export const createBarang = async (payload: {
  nama: string;
  kategori_id?: number | null;
  satuan?: string;
  stok?: number;
  stok_minimum?: number;
}): Promise<Barang> => {
  // kode_barang tidak dikirim, auto-generate di database
  const res = await api.post('/barang', payload);
  return res.data;
};

export const updateBarang = async (
  id: number,
  payload: {
    nama?: string;
    kategori_id?: number | null;
    satuan?: string;
    stok_minimum?: number;
  }
): Promise<Barang> => {
  const res = await api.put(`/barang/${id}`, payload);
  return res.data;
};

export const deleteBarang = async (id: number): Promise<{ message: string }> => {
  const res = await api.delete(`/barang/${id}`);
  return res.data;
};

export const scanMasuk = async (
  id: number,
  jumlah: number,
  catatan?: string
): Promise<{ message: string; barang: Barang; mutasi: Mutasi }> => {
  const res = await api.post(`/barang/${id}/masuk`, { jumlah, catatan });
  return res.data;
};

export const scanKeluar = async (
  id: number,
  jumlah: number,
  catatan?: string
): Promise<{ message: string; barang: Barang; mutasi: Mutasi }> => {
  const res = await api.post(`/barang/${id}/keluar`, { jumlah, catatan });
  return res.data;
};

export const getRiwayatBarang = async (id: number): Promise<Mutasi[]> => {
  const res = await api.get(`/barang/${id}/riwayat`);
  return res.data;
};

export const getRiwayatSemua = async (limit = 10): Promise<Mutasi[]> => {
  const res = await api.get(`/mutasi-barang?limit=${limit}`);
  return res.data;
};

/**
 * Cari barang berdasarkan kode_barang hasil scan QR code.
 * Melempar error (axios) jika barang tidak ditemukan (404).
 */
export const getBarangByKode = async (kodeBarang: string): Promise<Barang> => {
  const res = await api.get(`/barang/kode/${encodeURIComponent(kodeBarang)}`);
  return res.data;
};

// ── Kategori Barang ─────────────────────────────

export const getKategoriBarang = async (): Promise<KategoriBarang[]> => {
  const res = await api.get('/kategori-barang');
  return res.data;
};

export const createKategoriBarang = async (nama: string): Promise<KategoriBarang> => {
  const res = await api.post('/kategori-barang', { nama });
  return res.data;
};

export const updateKategoriBarang = async (
  id: number,
  nama: string
): Promise<KategoriBarang> => {
  const res = await api.put(`/kategori-barang/${id}`, { nama });
  return res.data;
};

export const deleteKategoriBarang = async (id: number): Promise<{ message: string }> => {
  const res = await api.delete(`/kategori-barang/${id}`);
  return res.data;
};