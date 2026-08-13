import api from './axios';
import type { Supplier } from './supplier';
import type { Departemen } from './departemen';
import type { AsetKelengkapan } from './asetKelengkapan';

export type AsetStatus = 'tersedia' | 'dipakai' | 'menunggu_perbaikan' | 'diperbaiki' | 'rusak_berat' | 'dijual';
export type AsetPemakaiStatus = 'pending' | 'disetujui' | 'ditolak';

export interface KaryawanUser {
  id: number;
  name: string;
  role?: string;
  pekerja?: {
    id: number;
    nik: string;
    departemen?: { id: number; nama: string } | null;
    jabatan?: { id: number; nama: string } | null;
  } | null;
}

export interface AsetPemakai {
  created_at: string;
  id: number;
  aset_id: number;
  // salah satu dari dua ini yang terisi: pekerja_id buat karyawan, user_id buat akun cabang
  pekerja_id: number | null;
  pekerja?: { id: number; nik: string; departemen?: { id: number; nama: string } | null; user?: { id: number; name: string } };
  user_id: number | null;
  user?: { id: number; name: string } | null;
  status: AsetPemakaiStatus;
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
  aset?: Aset; // keisi kalau di-load dari endpoint /aset-pemakai/pending
}

export interface AsetPenanganan {
  aset: any;
  id: number;
  aset_id: number;
  aset_pemakai_id: number | null;
  jenis_kerusakan: 'software' | 'hardware';
  keluhan: string;
  tanggal_lapor: string;
  foto: string | null;
  tanggal_diterima: string | null;
  tanggal_selesai: string | null;
  harga_jasa: number | null;
  biaya_komponen: number | null;
  hasil: string | null;
  no_struk: string | null;
  catatan: string | null;
  // dikirim backend lewat accessor, bukan kolom asli
  total_biaya?: number;
  durasi_hari?: number | null;
  // siapa yang lagi pegang aset ini pas dilaporkan rusak (nullable — bisa juga ketauan pas audit gudang)
  // NOTE: sama seperti AsetPemakai, penerima bisa karyawan (lewat pekerja.user)
  // ATAU akun cabang (lewat user langsung) — makanya dua-duanya perlu ada di sini.
  // ⚠️ Pastikan endpoint backend yang isi field ini (aset-penanganan) juga
  // eager-load relasi `user`, bukan cuma `pekerja.user`, kalau belum, field
  // ini tetap kosong walau frontend sudah baca dari sini.
  pemakai?: {
    id: number;
    pekerja?: { id: number; user?: { id: number; name: string } };
    user?: { id: number; name: string } | null;
  } | null;
}

export interface Aset {
  id: number;
  kode_aset: string;
  departemen_id: number | null;
  departemen?: Departemen | null;
  merek: string | null;
  tipe: string | null;
  warna: string | null;
  serial_number: string | null;
  jumlah: number;
  tanggal_garansi: string | null;
  perusahaan: string | null;
  keterangan: string | null;
  foto: string | null;
  supplier_id: number | null;
  supplier?: Supplier | null;
  tanggal_pembelian: string | null;
  no_surat_jalan: string | null;
  no_good_receive: string | null;
  status: AsetStatus;
  pemakai_saat_ini?: AsetPemakai | null;
  pemakai?: AsetPemakai[]; // riwayat lengkap, cuma keisi di endpoint show()
  penanganan?: AsetPenanganan[]; // riwayat lengkap, cuma keisi di endpoint show()
  penanganan_aktif?: { id: number; jenis_kerusakan: string; keluhan: string; tanggal_lapor: string } | null;
  // daftar kelengkapan (aksesoris) yang nempel di aset ini — cuma keisi di endpoint show()
  aset_kelengkapan?: AsetKelengkapan[];
  // catatan penjualan/writeoff — cuma keisi kalau status aset 'dijual'
  writeoff?: {
    id: number;
    alasan: string;
    no_berita_acara: string | null;
    tanggal_writeoff: string;
    catatan: string | null;
    penyetuju?: { id: number; name: string } | null;
    created_at: string;
  } | null;
}

export interface AsetFormValues {
  departemen_id?: number | null;
  merek?: string;
  tipe?: string;
  warna?: string;
  serial_number?: string;
  jumlah?: number;
  tanggal_garansi?: string;
  perusahaan?: string;
  keterangan?: string;
  foto?: File | null;
  supplier_id?: number | null;
  tanggal_pembelian?: string;
  no_surat_jalan?: string;
  no_good_receive?: string;
}
export interface FotoPemakaiEntry {
  id: number;
  aset_id: number;
  aset?: { id: number; kode_aset: string; merek: string | null; tipe: string | null } | null;
  pekerja_id: number | null;
  pekerja?: { user?: { id: number; name: string } };
  user_id: number | null;
  user?: { id: number; name: string } | null;
  tanggal_penerimaan: string | null;
  tanggal_pengembalian: string | null;
  // waktu kejadian akurat (jam-menit-detik lengkap) -- tanggal_penerimaan/
  // tanggal_pengembalian di atas cuma nyimpen tanggal doang. Lihat migration
  // add_waktu_akurat_ke_aset_pemakai_dan_penanganan.
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

function buildAsetFormData(values: AsetFormValues): FormData {
  const fd = new FormData();
  if (values.departemen_id != null) fd.append('departemen_id', String(values.departemen_id));
  if (values.merek) fd.append('merek', values.merek);
  if (values.tipe) fd.append('tipe', values.tipe);
  if (values.warna) fd.append('warna', values.warna);
  if (values.serial_number) fd.append('serial_number', values.serial_number);
  if (values.jumlah != null) fd.append('jumlah', String(values.jumlah));
  if (values.tanggal_garansi) fd.append('tanggal_garansi', values.tanggal_garansi);
  if (values.perusahaan) fd.append('perusahaan', values.perusahaan);
  if (values.keterangan) fd.append('keterangan', values.keterangan);
  if (values.foto) fd.append('foto', values.foto);
  if (values.supplier_id != null) fd.append('supplier_id', String(values.supplier_id));
  if (values.tanggal_pembelian) fd.append('tanggal_pembelian', values.tanggal_pembelian);
  if (values.no_surat_jalan) fd.append('no_surat_jalan', values.no_surat_jalan);
  if (values.no_good_receive) fd.append('no_good_receive', values.no_good_receive);
  return fd;
}

export async function getAset(): Promise<Aset[]> {
  const res = await api.get<Aset[]>('/aset');
  return res.data;
}

export async function getAsetById(id: number): Promise<Aset> {
  const res = await api.get<Aset>(`/aset/${id}`);
  return res.data;
}
export async function getFotoPemakaiAset(
  page = 1,
  perPage = 12,
  search?: string,
  type?: 'peminjaman' | 'pengembalian'
): Promise<PaginatedFotoPemakai> {
  const res = await api.get<PaginatedFotoPemakai>('/aset-pemakai/foto', {
    params: { page, per_page: perPage, search: search || undefined, type },
  });
  return res.data;
}
// POST /aset (multipart) — dibatasi backend ke role admin.
export async function createAset(values: AsetFormValues): Promise<Aset> {
  const res = await api.post<Aset>('/aset', buildAsetFormData(values));
  return res.data;
}

// POST /aset/{id} + _method=PUT (multipart, krn ada file upload) — dibatasi backend ke role admin.
export async function updateAset(id: number, values: AsetFormValues): Promise<Aset> {
  const fd = buildAsetFormData(values);
  const res = await api.post<Aset>(`/aset/${id}`, fd);
  return res.data;
}


// DELETE /aset/{id} — dibatasi backend ke role admin.
// force=true lewatin guard riwayat pemakai/penanganan (buat bersihin data lama/test).
export async function deleteAset(id: number, force = false): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/aset/${id}`, { params: force ? { force: 1 } : undefined });
  return res.data;
}


/**
 * Cari karyawan atau akun cabang (buat dipilih sebagai pemakai aset). Pakai
 * endpoint /karyawan yang sudah ada (UserController::index), yang eager-load
 * relasi pekerja dan sudah support filter ?role=.
 *
 * Kirim role='cabang' buat nampilin akun cabang aja. Kosongkan (undefined)
 * buat perilaku lama (semua role, biasanya dipakai buat cari karyawan).
 */
export async function searchKaryawan(query: string, role?: string): Promise<KaryawanUser[]> {
  const res = await api.get<KaryawanUser[]>('/karyawan', {
    params: { search: query, ...(role ? { role } : {}) },
  });
  return res.data;
}

// POST /aset/{aset}/pemakai — serah-terima aset ke pekerja ATAU akun cabang.
// Kirim salah satu: pekerja_id (karyawan) atau user_id (cabang), jangan dua-duanya.
// Dibatasi backend ke role admin.
export async function serahTerimaAset(asetId: number, formData: FormData) {
  const res = await api.post(`/aset/${asetId}/pemakai`, formData);
  return res.data;
}

// POST /aset-pemakai/{id}/kembalikan — admin ATAU pemakai yang lagi pegang
// aset ini sendiri (karyawan/cabang). Wajib sertain no_struk_penerimaan
// (struk asli pas serah-terima) buat validasi backend.
export async function kembalikanAset(pemakaiId: number, formData: FormData) {
  const res = await api.post(`/aset-pemakai/${pemakaiId}/kembalikan`, formData);
  return res.data;
}

// DELETE /aset-pemakai/{id} — admin hapus satu entri riwayat pemakaian.
// Ditolak backend kalau entri ini punya laporan perbaikan yang nempel.
export async function deletePemakaiAset(pemakaiId: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/aset-pemakai/${pemakaiId}`);
  return res.data;
}

// Satu entri riwayat aktivitas aset — dari peminjaman (pinjam/kembali),
// penanganan kerusakan (lapor_rusak/mulai_perbaikan/selesai_perbaikan), atau
// penjualan/writeoff (dijual), digabung backend. 'waktu' sudah pakai kolom
// datetime akurat di backend (bukan tanggal doang), jadi aman dipakai
// langsung buat hitung waktu relatif ("X menit/jam lalu"). 'tipe_item'
// nunjukin item yang dipinjam itu aset utama atau aset_kelengkapan --
// dipakai buat nentuin baca field 'kode_aset' atau 'kode_kelengkapan' di
// dalam 'aset'. Event selain pinjam/kembali (lapor_rusak, mulai_perbaikan,
// selesai_perbaikan, dijual) SELALU 'aset' (kelengkapan gak lewat alur itu).
export interface RiwayatAsetEvent {
  type: 'pinjam' | 'kembali' | 'lapor_rusak' | 'mulai_perbaikan' | 'selesai_perbaikan' | 'dijual';
  waktu: string;
  nama: string | null;
  aset: { id: number; kode_aset?: string; kode_kelengkapan?: string; merek: string | null; tipe: string | null } | null;
  tipe_item: 'aset' | 'kelengkapan';
  keluhan?: string | null; // dipakai lapor_rusak (keluhan) & dijual (alasan)
  hasil?: string | null;
}

export interface PaginatedRiwayatAset {
  data: RiwayatAsetEvent[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

// GET /aset-pemakai/riwayat — riwayat SEMUA aktivitas aset (pinjam, kembali,
// lapor rusak, selesai perbaikan), terbaru duluan, terpaginasi (minimal 10
// per halaman, dipaksa di server). Admin lihat riwayat SEMUA aset; role lain
// cuma lihat riwayat aktivitas MEREKA SENDIRI (difilter di backend, bukan di
// sini). Dipakai panel Riwayat di tab Aset (BUKAN riwayat peminjaman barang).
export async function getRiwayatAset(
  page = 1,
  perPage = 10,
  type?: RiwayatAsetEvent['type'],
  search?: string
): Promise<PaginatedRiwayatAset> {
  const res = await api.get<PaginatedRiwayatAset>('/aset-pemakai/riwayat', {
    params: { page, per_page: perPage, type: type || undefined, search: search || undefined },
  });
  return res.data;
}

// POST /aset-penanganan — lapor kerusakan aset. aset_id wajib dikirim di payload
// (endpoint ini gak nempel di path /aset/{aset}, beda dari pola lain di file ini).
export async function laporPenangananAset(payload: {
  aset_id: number;
  jenis_kerusakan: 'software' | 'hardware';
  keluhan: string;
}): Promise<AsetPenanganan> {
  const res = await api.post<AsetPenanganan>('/aset-penanganan', payload);
  return res.data;
}

// POST /aset-penanganan/{id}/terima — admin terima/mulai tangani laporan kerusakan,
// aset jadi status "diperbaiki". Dibatasi backend ke role admin.
export async function terimaPenangananAset(asetPenangananId: number): Promise<AsetPenanganan> {
  const res = await api.post<AsetPenanganan>(`/aset-penanganan/${asetPenangananId}/terima`);
  return res.data;
}

// POST /aset-penanganan/{id} — admin tandai selesai + isi hasil/biaya.
// no_struk digenerate otomatis backend, gak perlu dikirim dari sini.
export async function selesaikanPenangananAset(
  asetPenangananId: number,
  payload: Partial<{
    tanggal_selesai: string | null;
    harga_jasa: number | null;
    biaya_komponen: number | null;
    hasil: string | null;
    catatan: string | null;
  }>
): Promise<AsetPenanganan> {
  const res = await api.post<AsetPenanganan>(`/aset-penanganan/${asetPenangananId}`, payload);
  return res.data;
}

// DELETE /aset-penanganan/{id} — dibatasi backend ke role admin.
export async function deletePenangananAset(asetPenangananId: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/aset-penanganan/${asetPenangananId}`);
  return res.data;
}

// BARU: POST /aset/{aset}/jual — tandai aset (status 'tersedia' atau
// 'rusak_berat') sebagai terjual. Aset pindah status jadi 'dijual'. Cuma
// tanda status, gak ada input tambahan (harga/catatan) dari frontend.
// Dibatasi backend ke role admin.
export async function jualAset(asetId: number): Promise<Aset> {
  const res = await api.post<Aset>(`/aset/${asetId}/jual`);
  return res.data;
}