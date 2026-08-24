import api from '../axios';
import type { KategoriKode } from './inventory';

// Read-only dengan sengaja: cuma 2 baris fix ("Barang Utama" & "Kelengkapan"),
// di-seed langsung lewat migration backend — BUKAN dikelola admin lewat CRUD
// Master Data (beda sama Master Kategori). Jangan bikin form create/edit/delete
// buat entity ini di UI.
export interface Kategori {
  id: number;
  nama: string;
  kode: KategoriKode;
}

// GET /kategori — dipakai buat dropdown pilih Kategori waktu bikin/edit Master Kategori.
export async function getKategori(): Promise<Kategori[]> {
  const res = await api.get<Kategori[]>('/kategori');
  return res.data;
}