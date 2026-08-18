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
  tanggal_rusak: string | null; // ISO datetime, keisi otomatis begitu status jadi 'rusak' (laporRusak)
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

// ================================================================
// Kelengkapan Rusak → Lepas Otomatis → Ganti Pengganti
// ================================================================

export interface PaginatedAsetKelengkapan {
  data: AsetKelengkapan[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

//ini data dummy// — dipakai bareng ketiga fungsi dummy di bawah, biar list
// Rusak & simulasi lapor-rusak/pasang-pengganti konsisten satu sama lain
// selama backend orang 2/3 belum deploy endpoint aslinya.
const DUMMY_KELENGKAPAN_RUSAK: AsetKelengkapan[] = [
  {
    id: 9001,
    kode_kelengkapan: 'KLP-0091',
    aset_id: null,
    aset: null,
    lokasi_kantor_id: 1,
    lokasiKantor: { id: 1, nama: 'Kantor Pusat' } as LokasiKantor,
    nama: 'Tas Laptop',
    merek: 'Targus',
    tipe: 'Backpack',
    warna: 'Hitam',
    serial_number: null,
    tanggal_garansi: null,
    perusahaan: null,
    keterangan: 'Retsleting jebol, gak bisa dipake lagi.',
    foto: null,
    supplier_id: null,
    tanggal_pembelian: null,
    no_surat_jalan: null,
    no_good_receive: null,
    status: 'rusak',
    tanggal_rusak: '2026-08-15T09:12:00Z',
  },
  {
    id: 9002,
    kode_kelengkapan: 'KLP-0104',
    aset_id: null,
    aset: null,
    lokasi_kantor_id: null,
    lokasiKantor: null,
    nama: 'Charger Laptop',
    merek: 'Dell',
    tipe: '65W',
    warna: null,
    serial_number: 'SN-CHG-4471',
    tanggal_garansi: null,
    perusahaan: null,
    keterangan: 'Kabel putus di dalam, gak ngecas.',
    foto: null,
    supplier_id: null,
    tanggal_pembelian: null,
    no_surat_jalan: null,
    no_good_receive: null,
    status: 'rusak',
    tanggal_rusak: '2026-08-10T14:30:00Z',
  },
];

function dummyDelay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// POST /aset-kelengkapan/{id}/lapor-rusak — lepas dari induk (kalau ada),
// tutup paksa peminjaman aktif, status jadi 'rusak'. TODO: ganti ke fetch
// beneran begitu endpoint backend siap.
export async function laporRusak(id: number): Promise<AsetKelengkapan> {
  //ini data dummy//
  const found = DUMMY_KELENGKAPAN_RUSAK.find((k) => k.id === id);
  return dummyDelay(
    found || {
      ...DUMMY_KELENGKAPAN_RUSAK[0],
      id,
      aset_id: null,
      aset: null,
      status: 'rusak',
      tanggal_rusak: new Date().toISOString(),
    }
  );
}

// POST /aset-kelengkapan/{id}/pasang-pengganti — body { aset_id } (induk
// tujuan), status pengganti nyesuain kondisi induk sekali pas assign. TODO:
// ganti ke fetch beneran begitu endpoint backend siap.
export async function pasangPengganti(id: number, asetId: number): Promise<AsetKelengkapan> {
  //ini data dummy//
  return dummyDelay({
    ...DUMMY_KELENGKAPAN_RUSAK[0],
    id,
    aset_id: asetId,
    status: 'tersedia', // asumsi induk lagi nganggur — sesuaiin manual pas testing kalau perlu
    tanggal_rusak: null,
  });
}

// GET /aset-kelengkapan/rusak?page=&per_page=&search= — list arsip
// kelengkapan berstatus 'rusak', paginated, order by tanggal_rusak desc.
// TODO: ganti ke fetch beneran begitu endpoint backend siap.
export async function getRusak(params?: { page?: number; per_page?: number; search?: string }): Promise<PaginatedAsetKelengkapan> {
  //ini data dummy//
  const page = params?.page ?? 1;
  const perPage = params?.per_page ?? 10;
  const search = (params?.search ?? '').trim().toLowerCase();

  const filtered = search
    ? DUMMY_KELENGKAPAN_RUSAK.filter((k) =>
        [k.kode_kelengkapan, k.nama, k.merek].filter(Boolean).join(' ').toLowerCase().includes(search)
      )
    : DUMMY_KELENGKAPAN_RUSAK;

  return dummyDelay({
    data: filtered.slice((page - 1) * perPage, page * perPage),
    current_page: page,
    last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
    total: filtered.length,
    per_page: perPage,
  });
}