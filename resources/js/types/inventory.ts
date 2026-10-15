import type { Inventory, InventoryStatus } from '../api/masterData/inventory';
import type { Kategori } from '../api/masterData/kategori';
import type { Supplier } from '../api/masterData/supplier';
import type { Perusahaan } from '../api/masterData/perusahaan';

// [F4-INERTIA] Bentuk data tab Inventory dari server (InventoryWebController, lewat MasterDataPageController).

// Satu baris list = Inventory + jumlah kelengkapan yang menempel (dipakai form Edit buat mengunci "Pasang ke Induk").
export interface InventoryRow extends Inventory {
  children_count?: number;
}

// Props `inventory`: satu halaman data + filter aktif (query string = sumber kebenaran).
export interface InventoryList {
  data: InventoryRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  /** Ada item induk (parent_id kosong) di populasi filter kategori aktif -> tab status "Dijual" ditampilkan. */
  ada_induk: boolean;
  filters: { search: string; status: InventoryStatus | ''; kategori: number[] };
}

// Props `inventoryOpsi`: pilihan dropdown form & filter kategori (kosong untuk non-admin, sama seperti dulu).
export interface InventoryOpsi {
  kategori: Kategori[];
  supplier: Supplier[];
  perusahaan: Perusahaan[];
}

// Props `inventoryIndukOpsi` (optional, dimuat saat modal dibuka): kandidat induk.
export interface InventoryIndukOpsi {
  id: number;
  kode_inventory: string;
  nama: string | null;
}
