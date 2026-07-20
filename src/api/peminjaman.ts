// Sesuaikan import 'api' ini dengan axios client yang sudah dipakai di project
// (biasanya di api/client.ts, yang juga dipakai oleh api/barang.ts)
import api from './axios';
import type { Barang } from './barang';

export interface User {
  id: number;
  name: string;
}

export interface Peminjaman {
  id: number;
  barang_id: number;
  user_id: number;
  user?: User;
  jumlah: number;
  tanggal_pinjam: string;
  tanggal_kembali_rencana: string;
  tanggal_kembali_aktual: string | null;
  status: 'dipinjam' | 'dikembalikan';
}

/**
 * Cari user terdaftar untuk dijadikan peminjam (autocomplete).
 * Pakai endpoint /karyawan yang udah ada (UserController::index), BUKAN /users.
 * PENTING: cek UserController@index kamu — parameter query-nya apa (search / q / nama)
 * dan bentuk response-nya (array langsung, atau { data: [...] } ala pagination).
 * Sesuaikan baris di bawah kalau beda.
 */
export async function searchUser(query: string): Promise<User[]> {
  const { data } = await api.get('/karyawan', { params: { search: query } });
  // Kalau response-nya ke-paginate (ada .data di dalamnya), pakai: return data.data;
  return data;
}

/**
 * Daftar peminjaman yang masih aktif (belum dikembalikan) untuk 1 barang.
 * Dipakai untuk menampilkan "siapa saja yang sedang meminjam" barang ini.
 */
export async function getPeminjamanAktifByBarang(barangId: number): Promise<Peminjaman[]> {
  const { data } = await api.get(`/barang/${barangId}/peminjaman`, {
    params: { status: 'dipinjam' },
  });
  return data;
}

/**
 * Riwayat global (dipinjam + dikembalikan), untuk panel riwayat di halaman utama.
 */
export async function getRiwayatPeminjaman(limit = 10): Promise<Peminjaman[]> {
  const { data } = await api.get('/peminjaman', { params: { limit } });
  return data;
}

/**
 * Catat peminjaman baru untuk beberapa orang sekaligus dalam 1 kali submit.
 * tanggal_kembali_rencana berlaku sama untuk semua item di batch ini.
 */
export async function pinjamkanBarang(
  barangId: number,
  payload: {
    items: { user_id: number; jumlah: number }[];
    tanggal_kembali_rencana: string;
  }
): Promise<{ barang: Barang; peminjaman: Peminjaman[] }> {
  const { data } = await api.post(`/barang/${barangId}/pinjamkan`, payload);
  return data;
}

/**
 * Tutup peminjaman: kembalikan stok, ubah status jadi 'dikembalikan', isi tanggal_kembali_aktual.
 */
export async function kembalikanPeminjaman(
  peminjamanId: number
): Promise<{ barang: Barang; peminjaman: Peminjaman }> {
  const { data } = await api.post(`/peminjaman/${peminjamanId}/kembalikan`);
  return data;
}