import type { User } from './user';
import type { Inventory } from '../features/inventory/types/inventory';
import type { InventoryPemakai } from '../features/inventory/types/inventoryPemakai';

// [F5-INERTIA] Data struk yang dikirim server lewat flash setelah serah-terima / pengembalian sukses (lihat
// InventoryPemakaiWebController). `inventory` pada serah_terima cuma berisi id, kode_inventory, nama -- klien menggabungkannya
// dengan baris inventory yang sudah dia punya.
export type StrukFlash =
  | { tipe: 'serah_terima'; results: { inventory: Pick<Inventory, 'id' | 'kode_inventory' | 'nama'>; pemakai: InventoryPemakai }[] }
  | { tipe: 'pengembalian'; pemakai: InventoryPemakai };

export interface Flash {
  success?: string | null;
  error?: string | null;
  struk?: StrukFlash | null;
}

// Props yang selalu ada di SETIAP halaman Inertia (lihat HandleInertiaRequests::share).
export interface SharedProps {
  auth: { user: User | null };
  flash: Flash;
  [key: string]: unknown;
}
