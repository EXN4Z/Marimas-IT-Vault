import api from '../axios';
import type { Supplier } from './supplier';
import type { Departemen } from './departemen';
import type { LokasiKantor } from '../lokasiKantor';

export type InventoryStatus = 'tersedia' | 'dipakai' | 'menunggu_perbaikan' | 'diperbaiki' | 'rusak_berat' | 'rusak' | 'dijual';
// 'barang_utama' = boleh punya children (kelengkapan), gak boleh punya parent_id.
// 'kelengkapan' = parent_id boleh diisi (nempel ke barang utama) atau null (berdiri sendiri).
export type KategoriKode = 'barang_utama' | 'kelengkapan';

export interface KategoriRef {
  id: number;
  nama: string;
}

// Tipe & fungsi penanganan kerusakan (InventoryPenanganan) ada di
// ../transaksi/inventoryPenanganan.ts — import dari sana, jangan didefinisikan ulang di sini.
import type { InventoryPenanganan } from '../transaksi/inventoryPenanganan';
// Tipe pemakai (InventoryPemakai) ada di ../transaksi/inventoryPemakai.ts —
// import dari sana, jangan didefinisikan ulang di sini.
import type { InventoryPemakai } from '../transaksi/inventoryPemakai';

// Satu baris `inventory` bisa berupa Barang Utama ATAU Kelengkapan — dibedakan
// lewat kategori.nama (persis "Barang Utama" / "Kelengkapan"), BUKAN lewat
// ada/tidaknya parent_id (lihat dokumen migrasi #2.3). `parent`/`children`
// cuma keisi di endpoint show(), atau lewat query ?parent_id= di index() buat
// nested/expand view.
export interface Inventory {
  id: number;
  kode_inventory: string;
  parent_id: number | null;
  parent?: Inventory | null;
  children?: Inventory[];
  kategori_id: number | null;
  kategori?: KategoriRef | null;
  departemen_id: number | null;
  departemen?: Departemen | null;
  lokasi_kantor_id: number | null;
  lokasiKantor?: LokasiKantor | null; // lokasi kelengkapan kalau berdiri sendiri (tanpa parent)
  nama: string | null;
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
  status: InventoryStatus;
  tanggal_rusak: string | null; // ISO datetime, keisi otomatis begitu status kelengkapan jadi 'rusak'
  pemakai_saat_ini?: InventoryPemakai | null;
  pemakai?: InventoryPemakai[]; // riwayat lengkap, cuma keisi di endpoint show()
  penanganan?: InventoryPenanganan[]; // riwayat lengkap, cuma keisi di endpoint show()
  penanganan_aktif?: { id: number; jenis_kerusakan: string; keluhan: string; tanggal_lapor: string } | null;
  // catatan penjualan/writeoff — cuma keisi kalau status 'dijual'
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

export interface InventoryFormValues {
  kategori_id?: number | null;
  parent_id?: number | null; // cuma valid kalau kategori-nya 'Kelengkapan', dan harus nunjuk ke barang_utama
  departemen_id?: number | null;
  lokasi_kantor_id?: number | null;
  nama?: string;
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

export interface PaginatedInventory {
  data: Inventory[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

function buildInventoryFormData(values: InventoryFormValues): FormData {
  const fd = new FormData();
  if (values.kategori_id != null) fd.append('kategori_id', String(values.kategori_id));
  if (values.parent_id != null) fd.append('parent_id', String(values.parent_id));
  if (values.departemen_id != null) fd.append('departemen_id', String(values.departemen_id));
  if (values.lokasi_kantor_id != null) fd.append('lokasi_kantor_id', String(values.lokasi_kantor_id));
  if (values.nama) fd.append('nama', values.nama);
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

// GET /inventory — ?kategori=barang_utama|kelengkapan filter berdasar
// kategori.nama (mapped di backend). ?parent_id=123 buat nested/expand view
// (kelengkapan yang nempel ke barang utama tertentu).
export async function getInventory(params?: {
  kategori?: KategoriKode;
  parent_id?: number;
  search?: string;
}): Promise<Inventory[]> {
  const res = await api.get<Inventory[]>('/inventory', { params });
  return res.data;
}

export async function getInventoryById(id: number): Promise<Inventory> {
  const res = await api.get<Inventory>(`/inventory/${id}`);
  return res.data;
}

// POST /inventory (multipart) — dibatasi backend ke role admin.
// kode_inventory digenerate otomatis lewat trigger DB, jangan dikirim dari sini.
export async function createInventory(values: InventoryFormValues): Promise<Inventory> {
  const res = await api.post<Inventory>('/inventory', buildInventoryFormData(values));
  return res.data;
}

// POST /inventory/{id} + _method=PUT (multipart, krn ada file upload) — dibatasi backend ke role admin.
export async function updateInventory(id: number, values: InventoryFormValues): Promise<Inventory> {
  const fd = buildInventoryFormData(values);
  fd.append('_method', 'PUT');
  const res = await api.post<Inventory>(`/inventory/${id}`, fd);
  return res.data;
}

// DELETE /inventory/{id} — dibatasi backend ke role admin.
// force=true lewatin guard riwayat pemakai/penanganan (buat bersihin data lama/test).
export async function deleteInventory(id: number, force = false): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/inventory/${id}`, { params: force ? { force: 1 } : undefined });
  return res.data;
}

// POST /inventory/{inventory}/jual — tandai inventory (status 'tersedia' atau
// 'rusak_berat') sebagai terjual. Status pindah jadi 'dijual'. Dibatasi backend ke role admin.
export async function jualInventory(id: number): Promise<Inventory> {
  const res = await api.post<Inventory>(`/inventory/${id}/jual`);
  return res.data;
}

export async function pasangPenggantiKelengkapanInventory(id: number, parent_id: number): Promise<Inventory> {
  const res = await api.post<Inventory>(`/inventory/${id}/pasang-pengganti-kelengkapan`, { parent_id });
  return res.data;
}

// POST /inventory/{id}/lepas-dari-induk — lepas kelengkapan dari induknya secara manual.
// Hanya bisa dipanggil oleh admin. Cuma memutus parent_id -- status TIDAK
// diubah lewat endpoint ini (sudah dipegang InventoryPemakai/InventoryPenanganan/jual).
// `keterangan` opsional.
export async function lepasDariIndukInventory(
  id: number,
  payload: { keterangan?: string }
): Promise<Inventory> {
  const res = await api.post<Inventory>(`/inventory/${id}/lepas-dari-induk`, payload);
  return res.data;
}

// POST /inventory/import — import massal dari file Excel (.xlsx/.xls),
// dibatasi backend ke role admin.
export async function importInventory(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<{ success: boolean; message: string }>('/inventory/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}