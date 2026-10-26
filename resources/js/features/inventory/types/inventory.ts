import type { Kategori } from '../../master-data/kategori/types';
import type { Supplier } from '../../master-data/supplier/types';
import type { Perusahaan } from '../../master-data/perusahaan/types';
import type { InventoryPenanganan } from '../../penanganan/types';
import type { InventoryPemakai } from './inventoryPemakai';

export type InventoryStatus = 'tersedia' | 'dipakai' | 'menunggu_perbaikan' | 'diperbaiki' | 'rusak_berat' | 'dijual';
// Struktur (induk/menempel) sekarang murni soal parent_id, independen dari
// kategori -- lihat backend InventoryController::index(). 'induk' =
// parent_id === null (boleh punya children, boleh juga berdiri sendiri
// tanpa children). 'menempel' = parent_id !== null.
type InventoryPosisi = 'induk' | 'menempel';

export interface KategoriRef {
  id: number;
  nama: string;
}

// Tipe & fungsi penanganan kerusakan (InventoryPenanganan) ada di
// ../transaksi/inventoryPenanganan.ts — import dari sana, jangan didefinisikan ulang di sini.
// Tipe pemakai (InventoryPemakai) ada di ../transaksi/inventoryPemakai.ts —
// import dari sana, jangan didefinisikan ulang di sini.

// Satu baris `inventory` bisa jadi kategori APA SAJA (bebas, gak lagi cuma 2
// golongan "Barang Utama"/"Kelengkapan") -- struktur induk/menempel murni
// ditentukan `parent_id`, independen dari kategori. `parent`/`children` cuma
// keisi di endpoint show(), atau lewat query ?parent_id= di index() buat
// nested/expand view.
export interface Inventory {
  id: number;
  kode_inventory: string;
  parent_id: number | null;
  parent?: Inventory | null;
  children?: Inventory[];
  merk: string | null;
  type: string | null;
  kategori_id: number | null;
  kategori?: KategoriRef | null;
  nama: string | null;
  warna: string | null;
  serial_number: string | null;
  jumlah: number;
  tanggal_garansi: string | null;
  perusahaan_id: number | null;
  perusahaan?: Perusahaan | null;
  keterangan: string | null;
  foto: string | null;
  supplier_id: number | null;
  supplier?: Supplier | null;
  tanggal_input: string | null;
  tanggal_invoice: string | null;
  no_surat_jalan: string | null;
  no_good_receive: string | null;
  status: InventoryStatus;
  tanggal_rusak: string | null; // ISO datetime, keisi begitu kelengkapan dilaporkan rusak
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
  nama?: string;
  warna?: string;
  serial_number?: string;
  merk?: string;
  type?: string;
  jumlah?: number;
  tanggal_garansi?: string;
  perusahaan_id?: number | null;
  keterangan?: string;
  foto?: File | null;
  supplier_id?: number | null;
  tanggal_input?: string;
  tanggal_invoice?: string;
  no_surat_jalan?: string;
  no_good_receive?: string;
  hapus_foto?: boolean;
}

// [F4-INERTIA] Bentuk props tab Inventory dari server (MasterDataPageController -> InventoryWebController).
// Satu baris list = Inventory + children_count (withCount('children')).
export type InventoryRow = Inventory & { children_count?: number };

export interface InventoryList {
  data: InventoryRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  ada_induk: boolean;
  /** Jumlah inventory per status di populasi filter kategori aktif (untuk bar ringkasan). */
  status_counts: Record<InventoryStatus, number>;
  filters: {
    search: string;
    status: InventoryStatus | '';
    kategori: number[];
  };
}

// Pilihan dropdown form Tambah/Edit & filter kategori (non-admin menerima daftar kosong).
export interface InventoryOpsi {
  kategori: Kategori[];
  supplier: Supplier[];
  perusahaan: Perusahaan[];
}

// Kandidat induk buat "Pasang ke Induk".
export interface InventoryIndukOpsi {
  id: number;
  kode_inventory: string;
  nama: string | null;
}
