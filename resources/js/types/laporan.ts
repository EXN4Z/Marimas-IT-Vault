// [F7-INERTIA] Bentuk data halaman Laporan dari server (LaporanPageController). Tab yang tidak aktif = null.
import type { Inventory } from '../api/masterData/inventory';
import type { Karyawan } from '../api/masterData/karyawan';
import type { Kategori } from '../api/masterData/kategori';
import type { Departemen } from '../api/masterData/departemen';
import type { Cabang } from '../api/masterData/cabang';
import type { Perusahaan } from '../api/masterData/perusahaan';
import type { Supplier } from '../api/masterData/supplier';
import type { InventoryPemakai, FotoPemakaiEntry, RiwayatInventoryEvent } from '../api/transaksi/inventoryPemakai';
import type { InventoryPenanganan } from '../api/transaksi/inventoryPenanganan';

/** Props `exportData` (deferred; undefined/null = belum dimuat). */
export interface LaporanExportData {
  inventory: Inventory[];
  karyawan: Karyawan[];
  kategori: Kategori[];
  departemen: Departemen[];
  cabang: Cabang[];
  perusahaan: Perusahaan[];
  supplier: Supplier[];
  pemakai: InventoryPemakai[];
}

export type FotoSub = 'inventory' | 'peminjaman' | 'pengembalian' | 'rusak';

interface Halaman<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

/** Props `foto`: satu halaman sub-tab aktif (query string = sumber kebenaran: ?sub=&search=&page=). */
export type LaporanFotoProps =
  | (Halaman<Inventory> & { sub: 'inventory'; filters: { search: string } })
  | (Halaman<FotoPemakaiEntry> & { sub: 'peminjaman' | 'pengembalian'; filters: { search: string } })
  | (Halaman<InventoryPenanganan> & { sub: 'rusak'; filters: { search: string } });

/** Props `riwayat` (?type=&search=&page=). type 'semua' = tanpa filter. */
export type LaporanRiwayatProps = Halaman<RiwayatInventoryEvent> & {
  filters: { type: 'semua' | RiwayatInventoryEvent['type']; search: string };
};
