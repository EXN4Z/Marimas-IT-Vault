import type { Supplier } from './supplier';
import type { Perusahaan } from './perusahaan';
import type { Kategori } from './kategori';
import type { InventoryPenanganan } from './penanganan';
import type { InventoryPemakai } from './inventoryPemakai';

export type InventoryStatus = 'tersedia' | 'dipakai' | 'menunggu_perbaikan' | 'diperbaiki' | 'rusak_berat' | 'dijual';

export interface Inventory {
  id: number;
  kode_inventory: string;
  parent_id: number | null;
  parent?: Inventory | null;
  children?: Inventory[];
  merk: string | null;
  type: string | null;
  kategori_id: number | null;
  kategori?: Kategori | null;
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
  tanggal_rusak: string | null;
  pemakai_saat_ini?: InventoryPemakai | null;
  pemakai?: InventoryPemakai[];
  penanganan?: InventoryPenanganan[];
  penanganan_aktif?: { id: number; jenis_kerusakan: string; keluhan: string; tanggal_lapor: string } | null;
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
