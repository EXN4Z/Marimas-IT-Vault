import type { Inventory } from '../inventory/types/inventory';

interface PenangananPemakai {
  id: number;
  user?: {
    id: number;
    name: string;
  };
}

export interface InventoryPenanganan {
  id: number;
  inventory_id: number;
  inventory_pemakai_id: number | null;
  // Satu daftar gabungan buat item apapun, gak lagi tergantung kategori/
  // posisi (induk vs menempel): 'hardware' | 'software' | 'tidak_berfungsi'
  // | 'hancur' | 'terputus_sobek'. Dibiarkan string biasa (bukan union)
  // biar longgar -- lihat JENIS_KERUSAKAN_OPTIONS di inventoryHelpers.ts.
  jenis_kerusakan: string;
  keluhan: string;
  tanggal_lapor: string;
  // waktu kejadian akurat (jam-menit-detik lengkap) -- kolom tanggal_lapor
  // di atas cuma nyimpen tanggal doang, jamnya selalu 00:00:00.
  lapor_at: string | null;
  foto: string | null;
  tanggal_diterima: string | null;
  // waktu akurat (dengan jam) -- kolom tanggal_* cuma nyimpen tanggal.
  diterima_at?: string | null;
  tanggal_selesai: string | null;
  selesai_at?: string | null;
  harga_jasa: number | null;
  biaya_komponen: number | null;
  hasil: string | null;
  no_struk: string | null;
  catatan: string | null;
  total_biaya?: number;
  durasi_hari?: number | null;
  // total durasi lapor -> selesai dalam detik; format tampilan pakai formatDurasi()
  durasi_detik?: number | null;
  inventory?: Inventory;
  pemakai?: PenangananPemakai | null;
  // siapa yang BENERAN submit laporan (bisa admin lapor saat audit gudang,
  // jadi pemakai bisa kosong). Sumber kebenaran buat "Pelapor".
  dilaporkan_oleh?: { id: number; name: string } | null;
}

// [F6-INERTIA] Bentuk props halaman Penanganan dari server (PenangananInventoryPageController -> InventoryPenangananWebController).
export type PenangananTab = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';

export interface PenangananList {
  data: InventoryPenanganan[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  counts: Record<PenangananTab, number>;
  // Papan 4 kolom (kanban): total + baris teratas per status.
  board: Record<PenangananTab, { total: number; data: InventoryPenanganan[] }>;
  filters: {
    tab: PenangananTab;
    search: string;
    jenis: string;
  };
}
