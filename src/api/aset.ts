import api from './axios';
import type { JenisAset } from './jenisAset';
import type { Supplier } from './supplier';
import type { KelengkapanMaster } from './kelengkapanMaster';

export type AsetStatus = 'tersedia' | 'dipakai' | 'rusak' | 'diperbaiki';

export interface KaryawanUser {
  id: number;
  name: string;
  pekerja?: {
    id: number;
    nip: string;
    departemen?: { id: number; nama: string } | null;
    jabatan?: { id: number; nama: string } | null;
  } | null;
}

export interface AsetKelengkapan {
  id: number;
  aset_id: number;
  kelengkapan_master_id: number;
  kelengkapan_master?: KelengkapanMaster;
  keterangan: string | null;
}

export interface AsetPemakai {
  id: number;
  aset_id: number;
  pekerja_id: number;
  pekerja?: { id: number; nip: string; user?: { id: number; name: string } };
  nomor_penerimaan: string | null;
  tanggal_penerimaan: string;
  catatan_penerimaan: string | null;
  nomor_pengembalian: string | null;
  tanggal_pengembalian: string | null;
  catatan_pengembalian: string | null;
}

export interface AsetPerbaikan {
  id: number;
  aset_id: number;
  tanggal_perbaikan: string;
  keterangan_kerusakan: string;
  teknisi_vendor: string | null;
  biaya: number | null;
  status: 'proses' | 'selesai';
  tanggal_selesai: string | null;
}

export interface AsetPenggantianSparepart {
  id: number;
  aset_id: number;
  tanggal: string;
  nama_sparepart: string;
  keterangan: string | null;
  biaya: number | null;
}

export interface Aset {
  id: number;
  kode_aset: string;
  jenis_id: number | null;
  jenis?: JenisAset | null;
  merek: string | null;
  tipe: string | null;
  warna: string | null;
  serial_number: string | null;
  perusahaan: string | null;
  keterangan: string | null;
  foto: string | null;
  supplier_id: number | null;
  supplier?: Supplier | null;
  tanggal_pembelian: string | null;
  no_surat_jalan: string | null;
  no_good_receive: string | null;
  status: AsetStatus;
  kelengkapan?: AsetKelengkapan[];
  pemakaiSaatIni?: AsetPemakai | null;
  pemakai?: AsetPemakai[]; // riwayat lengkap, cuma keisi di endpoint show()
  perbaikan?: AsetPerbaikan[];
  penggantianSparepart?: AsetPenggantianSparepart[];
}

export interface AsetFormValues {
  jenis_id?: number | null;
  merek?: string;
  tipe?: string;
  warna?: string;
  serial_number?: string;
  perusahaan?: string;
  keterangan?: string;
  foto?: File | null;
  supplier_id?: number | null;
  tanggal_pembelian?: string;
  no_surat_jalan?: string;
  no_good_receive?: string;
  kelengkapan?: { kelengkapan_master_id: number; keterangan?: string }[];
}

function buildAsetFormData(values: AsetFormValues): FormData {
  const fd = new FormData();
  if (values.jenis_id != null) fd.append('jenis_id', String(values.jenis_id));
  if (values.merek) fd.append('merek', values.merek);
  if (values.tipe) fd.append('tipe', values.tipe);
  if (values.warna) fd.append('warna', values.warna);
  if (values.serial_number) fd.append('serial_number', values.serial_number);
  if (values.perusahaan) fd.append('perusahaan', values.perusahaan);
  if (values.keterangan) fd.append('keterangan', values.keterangan);
  if (values.foto) fd.append('foto', values.foto);
  if (values.supplier_id != null) fd.append('supplier_id', String(values.supplier_id));
  if (values.tanggal_pembelian) fd.append('tanggal_pembelian', values.tanggal_pembelian);
  if (values.no_surat_jalan) fd.append('no_surat_jalan', values.no_surat_jalan);
  if (values.no_good_receive) fd.append('no_good_receive', values.no_good_receive);
  if (values.kelengkapan) fd.append('kelengkapan', JSON.stringify(values.kelengkapan));
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

// POST /aset (multipart) — dibatasi backend ke role admin.
export async function createAset(values: AsetFormValues): Promise<Aset> {
  const res = await api.post<Aset>('/aset', buildAsetFormData(values));
  return res.data;
}

// POST /aset/{id} + _method=PUT (multipart, krn ada file upload) — dibatasi backend ke role admin.
export async function updateAset(id: number, values: AsetFormValues): Promise<Aset> {
  const fd = buildAsetFormData(values);
  fd.append('_method', 'PUT');
  const res = await api.post<Aset>(`/aset/${id}`, fd);
  return res.data;
}

// DELETE /aset/{id} — dibatasi backend ke role admin.
export async function deleteAset(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/aset/${id}`);
  return res.data;
}

/**
 * Cari karyawan (buat dipilih sebagai pemakai aset). Pakai endpoint /karyawan
 * yang sudah ada (UserController::index), yang eager-load relasi pekerja.
 */
export async function searchKaryawan(query: string): Promise<KaryawanUser[]> {
  const res = await api.get<KaryawanUser[]>('/karyawan', { params: { search: query } });
  return res.data;
}

// POST /aset/{aset}/pemakai — serah-terima aset ke pekerja. Dibatasi backend ke role admin.
export async function serahTerimaAset(
  asetId: number,
  payload: {
    pekerja_id: number;
    nomor_penerimaan?: string;
    tanggal_penerimaan: string;
    catatan_penerimaan?: string;
  }
): Promise<AsetPemakai> {
  const res = await api.post<AsetPemakai>(`/aset/${asetId}/pemakai`, payload);
  return res.data;
}

// POST /aset-pemakai/{id}/kembalikan — dibatasi backend ke role admin.
export async function kembalikanAset(
  asetPemakaiId: number,
  payload: {
    nomor_pengembalian?: string;
    tanggal_pengembalian: string;
    catatan_pengembalian?: string;
  }
): Promise<AsetPemakai> {
  const res = await api.post<AsetPemakai>(`/aset-pemakai/${asetPemakaiId}/kembalikan`, payload);
  return res.data;
}
