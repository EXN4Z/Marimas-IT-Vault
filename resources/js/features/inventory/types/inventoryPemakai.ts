import type { Inventory } from './inventory';

export type InventoryPemakaiStatus = 'pending' | 'disetujui' | 'ditolak';

export interface KaryawanUser {
  id: number;
  name: string;
  role?: string;
  nik?: string | null;
  departemen?: { id: number; nama: string } | null;
  status?: 'aktif' | 'nonaktif';
}

export interface InventoryPemakai {
  created_at: string;
  id: number;
  inventory_id: number;
  user_id: number | null;
  user?: { id: number; name: string; role?: string; nik?: string | null; departemen?: { id: number; nama: string } | null } | null;
  status: InventoryPemakaiStatus;
  requested_by_user_id: number | null;
  nomor_penerimaan: string | null;
  no_struk_penerimaan: string | null;
  tanggal_penerimaan: string | null; // nullable — request pending belum ada tanggal penerimaan
  catatan_penerimaan: string | null;
  nomor_pengembalian: string | null;
  no_struk_pengembalian: string | null;
  tanggal_pengembalian: string | null;
  catatan_pengembalian: string | null;
  catatan_penolakan: string | null;
  inventory?: Inventory; // keisi kalau di-load dari endpoint /inventory-pemakai/riwayat atau /inventory-pemakai
}

export interface FotoPemakaiEntry {
  id: number;
  inventory_id: number;
  inventory?: { id: number; kode_inventory: string; nama: string | null; merk?: string | null; type?: string | null } | null;
  user_id: number | null;
  user?: { id: number; name: string } | null;
  tanggal_penerimaan: string | null;
  tanggal_pengembalian: string | null;
  diterima_at: string | null;
  dikembalikan_at: string | null;
  foto_penerimaan: string[] | null;
  foto_pengembalian: string[] | null;
  created_at: string;
}

// Satu entri riwayat aktivitas inventory — dari peminjaman (pinjam/kembali),
// penanganan kerusakan, atau penjualan/writeoff (dijual), digabung backend.
export interface RiwayatInventoryEvent {
  type: 'pinjam' | 'kembali' | 'lapor_rusak' | 'mulai_perbaikan' | 'selesai_perbaikan' | 'dijual';
  waktu: string;
  nama: string | null;
  inventory: { id: number; kode_inventory?: string; nama: string | null } | null;
  tipe_item: 'barang_utama' | 'kelengkapan';
  keluhan?: string | null; // dipakai lapor_rusak (keluhan) & dijual (alasan)
  hasil?: string | null;
}
