import api from './axios';
import type { Supplier } from './supplier';
import type { Aset, KaryawanUser } from './aset';
import type { LokasiKantor } from './lokasiKantor';

export type AsetKelengkapanStatus = 'tersedia' | 'dipakai' | 'rusak' | 'diperbaiki';

export interface AsetKelengkapan {
  id: number;
  kode_kelengkapan: string;
  aset_id: number | null;
  aset?: Aset | null; // aset induk tempat kelengkapan ini menempel
  lokasi_kantor_id: number | null;
  lokasiKantor?: LokasiKantor | null; // lokasi kelengkapan kalau berdiri sendiri (tanpa aset induk)
  nama: string;
  merek: string | null;
  tipe: string | null;
  warna: string | null;
  serial_number: string | null;
  tanggal_garansi: string | null;
  perusahaan: string | null;
  keterangan: string | null;
  foto: string | null;
  supplier_id: number | null;
  supplier?: Supplier | null;
  tanggal_pembelian: string | null;
  no_surat_jalan: string | null;
  no_good_receive: string | null;
  status: AsetKelengkapanStatus;
  pemakai_saat_ini?: AsetKelengkapanPemakai | null;
  pemakai?: AsetKelengkapanPemakai[]; // riwayat lengkap, cuma keisi di endpoint show()
}

export interface AsetKelengkapanPemakai {
  created_at: string;
  id: number;
  aset_kelengkapan_id: number;
  user_id: number | null;
  user?: { id: number; name: string; nik?: string | null } | null;
  status: 'pending' | 'disetujui' | 'ditolak';
  requested_by_user_id: number | null;
  no_struk_penerimaan: string | null;
  tanggal_penerimaan: string | null;
  catatan_penerimaan: string | null;
  no_struk_pengembalian: string | null;
  tanggal_pengembalian: string | null;
  catatan_pengembalian: string | null;
  asetKelengkapan?: AsetKelengkapan;
}

export interface AsetKelengkapanFormValues {
  aset_id?: number | null;
  lokasi_kantor_id?: number | null;
  nama?: string;
  merek?: string;
  tipe?: string;
  warna?: string;
  serial_number?: string;
  tanggal_garansi?: string;
  perusahaan?: string;
  keterangan?: string;
  foto?: File | null;
  supplier_id?: number | null;
  tanggal_pembelian?: string;
  no_surat_jalan?: string;
  no_good_receive?: string;
  status?: AsetKelengkapanStatus;
}

function buildAsetKelengkapanFormData(values: AsetKelengkapanFormValues): FormData {
  const fd = new FormData();
  if (values.aset_id != null) fd.append('aset_id', String(values.aset_id));
  if (values.lokasi_kantor_id != null) fd.append('lokasi_kantor_id', String(values.lokasi_kantor_id));
  if (values.nama != null) fd.append('nama', String(values.nama));
  if (values.merek) fd.append('merek', values.merek);
  if (values.tipe) fd.append('tipe', values.tipe);
  if (values.warna) fd.append('warna', values.warna);
  if (values.serial_number) fd.append('serial_number', values.serial_number);
  if (values.tanggal_garansi) fd.append('tanggal_garansi', values.tanggal_garansi);
  if (values.perusahaan) fd.append('perusahaan', values.perusahaan);
  if (values.keterangan) fd.append('keterangan', values.keterangan);
  if (values.foto) fd.append('foto', values.foto);
  if (values.supplier_id != null) fd.append('supplier_id', String(values.supplier_id));
  if (values.tanggal_pembelian) fd.append('tanggal_pembelian', values.tanggal_pembelian);
  if (values.no_surat_jalan) fd.append('no_surat_jalan', values.no_surat_jalan);
  if (values.no_good_receive) fd.append('no_good_receive', values.no_good_receive);
  if (values.status) fd.append('status', values.status);
  return fd;
}

// GET /aset-kelengkapan
export async function getAsetKelengkapan(): Promise<AsetKelengkapan[]> {
  const res = await api.get<AsetKelengkapan[]>('/aset-kelengkapan');
  return res.data;
}

// GET /aset-kelengkapan/{id}
export async function getAsetKelengkapanById(id: number): Promise<AsetKelengkapan> {
  const res = await api.get<AsetKelengkapan>(`/aset-kelengkapan/${id}`);
  return res.data;
}

// POST /aset-kelengkapan (multipart) — dibatasi backend ke role admin.
// kode_kelengkapan digenerate otomatis lewat trigger DB, jangan dikirim dari sini.
export async function createAsetKelengkapan(values: AsetKelengkapanFormValues): Promise<AsetKelengkapan> {
  const res = await api.post<AsetKelengkapan>('/aset-kelengkapan', buildAsetKelengkapanFormData(values));
  return res.data;
}

// POST /aset-kelengkapan/{id} + _method=PUT (multipart, krn ada file upload) — dibatasi backend ke role admin.
export async function updateAsetKelengkapan(id: number, values: AsetKelengkapanFormValues): Promise<AsetKelengkapan> {
  const fd = buildAsetKelengkapanFormData(values);
  fd.append('_method', 'PUT');
  const res = await api.post<AsetKelengkapan>(`/aset-kelengkapan/${id}`, fd);
  return res.data;
}

// DELETE /aset-kelengkapan/{id} — dibatasi backend ke role admin.
// force=true lewatin guard riwayat pemakai (buat bersihin data lama/test).
export async function deleteAsetKelengkapan(id: number, force = false): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/aset-kelengkapan/${id}`, {
    params: force ? { force: 1 } : undefined,
  });
  return res.data;
}

// Cari karyawan/akun cabang buat dipilih sebagai pemakai kelengkapan — pakai
// endpoint yang sama kayak searchKaryawan() di aset.ts.
export async function searchKaryawanUntukKelengkapan(query: string, role?: string): Promise<KaryawanUser[]> {
  const res = await api.get<KaryawanUser[]>('/karyawan', {
    params: { search: query, ...(role ? { role } : {}) },
  });
  return res.data;
}

// POST /aset-kelengkapan/{id}/pemakai — serah-terima kelengkapan ke karyawan
// ATAU akun cabang. Kirim user_id (tabel pekerja sudah dihapus, satu-satunya
// identitas pemakai). Dibatasi backend ke role admin.
export async function serahTerimaKelengkapan(asetKelengkapanId: number, formData: FormData) {
  const res = await api.post(`/aset-kelengkapan/${asetKelengkapanId}/pemakai`, formData);
  return res.data;
}

// POST /aset-pemakai/{id}/kembalikan — endpoint SAMA dengan pengembalian
// aset utama (tabel aset_pemakai dipakai bareng, dibedakan lewat kolom
// aset_kelengkapan_id di backend). Wajib sertain no_struk_penerimaan.
export async function kembalikanKelengkapan(pemakaiId: number, formData: FormData) {
  const res = await api.post(`/aset-pemakai/${pemakaiId}/kembalikan`, formData);
  return res.data;
}

// DELETE /aset-pemakai/{id} — endpoint SAMA dengan hapus riwayat pemakaian
// aset utama, dipakai bareng buat riwayat pemakaian kelengkapan juga.
export async function deletePemakaiKelengkapan(pemakaiId: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/aset-pemakai/${pemakaiId}`);
  return res.data;
}

// POST /aset-kelengkapan/import — import massal dari file Excel (.xlsx/.xls),
// dibatasi backend ke role admin. Format kolom: Kode Aset Induk | Lokasi
// Kantor | Nama | Merek | Tipe | Warna | Serial Number | Perusahaan |
// Supplier | Tanggal Pembelian | No Surat Jalan | No Good Receive |
// Tanggal Garansi | Status | Keterangan. Isi salah satu per baris: "Kode
// Aset Induk" (kalau kelengkapan nempel ke aset yang sudah ada) ATAU
// "Lokasi Kantor" (kalau berdiri sendiri, harus cocok nama lokasi/cabang
// yang sudah ada) — kalau dua-duanya diisi, "Kode Aset Induk" menang.
export async function importAsetKelengkapan(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<{ success: boolean; message: string }>('/aset-kelengkapan/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}