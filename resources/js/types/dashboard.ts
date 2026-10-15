// [F8-INERTIA] Tipe data dashboard (dulu di pages/dashboard/useDashboardData.ts) + bentuk props dari server
// (DashboardPageController -> DashboardQuery).
import type { RiwayatInventoryEvent } from '../api/transaksi/inventoryPemakai';

export interface DepartemenDistribusi {
  departemen: string;
  jumlah: number;
  percent: number;
}

// Ringkasan status seluruh inventory/barang inventaris — dipakai kartu
// "Ringkasan Status Inventory" di dashboard.
// Catatan: status backend inventory ada 6 (tersedia, dipakai, menunggu_perbaikan,
// diperbaiki, rusak_berat, dijual). Supaya kartu tetap simpel 4 kategori,
// menunggu_perbaikan & diperbaiki (inventory yang lagi dalam proses penanganan)
// digabung ke bucket "dipakai" karena sama-sama belum tersedia dipinjam.
export interface RingkasanInventory {
  total: number;
  tersedia: number;
  dipakai: number;
  rusakBerat: number;
  dijual: number;
}

// Distribusi jumlah inventory per nama (Laptop Lenovo, Mouse Logitech, dst)
// — dulu per `merek`+`jenis_id`, tapi kedua kolom itu udah dihapus dari
// tabel inventory (merek/tipe sekarang digabung jadi satu kolom `nama`),
// jadi sumbernya sekarang kolom `nama` langsung.
// NB: widget "Distribusi Inventory per Merek" ini disabled di semua
// dashboard yang ada saat ini (lihat inventoryPerMerek: false di
// DashboardAdmin.tsx) — gak ada card yang benar-benar render datanya.
export interface InventoryPerMerek {
  nama: string;
  jumlah: number;
}

// Tren jumlah inventory dibeli per bulan (6 bulan terakhir, dari tanggal_invoice)
// — dipakai hero chart "Tren Pembelian Inventory per Bulan" di dashboard admin.
export interface TrenPembelianInventory {
  bulan: string;
  jumlah: number;
}

// Distribusi jumlah inventory per status (tersedia/dipakai/dst) — dipakai
// donut chart "Distribusi Status Inventory" di dashboard admin.
export interface StatusInventoryDistribusi {
  status: string;
  jumlah: number;
}

// Ringkasan inventory yang butuh perhatian: lagi rusak/proses perbaikan, atau
// garansinya bakal habis dalam 30 hari ke depan — dipakai kartu
// "Inventory Butuh Perhatian" di dashboard admin.
export interface InventoryPerhatian {
  rusak: number; // status rusak_berat
  dalamPenanganan: number; // status menunggu_perbaikan + diperbaiki
  garansiSegeraHabis: number; // tanggal_garansi <= 30 hari dari sekarang
}

// 5 aktivitas inventory terbaru (pinjam/kembali/lapor rusak/dst) — dipakai
// widget "Aktivitas Inventory Terbaru" di dashboard admin, biar histori inventory
// gak cuma keliatan kalau user sadar buka tab Riwayat di dalam Inventaris.
export type AktivitasInventoryTerbaru = RiwayatInventoryEvent;

// Ringkasan aktivitas inventory PRIBADI user yang lagi login -- dipakai kartu
// KPI "Sedang Dipinjam" di DashboardUser, gantiin "Total Karyawan" yang
// gak seharusnya keliatan buat role non-admin. `totalTersedia` juga dihitung
// dari list yang sama (gak perlu request tambahan) -- ini AMAN buat non-admin
// karena GET /inventory buat role non-admin sudah balikin SEMUA item
// 'tersedia' apa adanya (independen dari siapa yang punya), lihat
// InventoryController::index().
// Catatan: gak ada field "menunggu persetujuan" -- app ini gak punya alur
// request/approve buat pinjam inventory (InventoryPemakaiController::store()
// selalu langsung set status 'disetujui', admin serah-terima langsung tanpa
// approval), jadi status 'pending' di enum gak pernah kepakai di praktiknya.
export interface NotificationItem {
  id: string;
  data: { message: string; [key: string]: any };
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  unread_count: number;
}


/** Props `analitik` (admin; deferred -> undefined/null selama belum dimuat). */
export interface DashboardAdminData {
  ringkasanInventory: RingkasanInventory;
  inventoryPerMerek: InventoryPerMerek[];
  inventoryPerhatian: InventoryPerhatian;
  trenPembelianInventory: TrenPembelianInventory[];
  statusInventoryDistribusi: StatusInventoryDistribusi[];
  aktivitasKalender: AktivitasInventoryTerbaru[];
  departemen: DepartemenDistribusi[];
}

/** Props `pribadi` (non-admin; deferred). */
export interface DashboardUserData {
  sedangDipinjam: number;
  totalTersedia: number;
  totalPernahDipinjam: number;
  totalLaporRusak: number;
  aktivitasTerbaru: AktivitasInventoryTerbaru[];
  aktivitasKalender: AktivitasInventoryTerbaru[];
}
