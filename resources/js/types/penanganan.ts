import type { InventoryPenanganan } from '../api/transaksi/inventoryPenanganan';

// [F6-INERTIA] Bentuk data halaman Penanganan Inventory dari server (InventoryPenangananWebController, lewat
// PenangananInventoryPageController).

export type PenangananTab = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';

// Props `penanganan`: satu halaman laporan untuk tab aktif + jumlah per tab (kartu KPI) + filter aktif
// (query string = sumber kebenaran).
export interface PenangananList {
  data: InventoryPenanganan[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  counts: Record<PenangananTab, number>;
  filters: { tab: PenangananTab; search: string; jenis: string };
}