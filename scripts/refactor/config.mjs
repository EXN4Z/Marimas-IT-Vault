// Mapping lama -> baru. Edit di sini kalau ada yang mau diubah, lalu jalankan ulang `plan`.
// Semua path relatif ke root project. Namespace PHP diturunkan dari path (PSR-4: App\ -> app/).

export const BRANCH = 'refactor/folder-structure';
export const OUT_DIR = '.refactor-out'; // baseline & log. Otomatis di-exclude dari git (.git/info/exclude).

const C = 'app/Http/Controllers';

// ---------------------------------------------------------------------------
// FASE 4 (sisa): pages/dashboard -> pages/Dashboard
// Inertia::render('Dashboard/Index') + resolver app.tsx case-sensitive (./pages/${name}.tsx).
// ---------------------------------------------------------------------------
export const FE_DIR_RENAMES = [{ from: 'resources/js/pages/dashboard', to: 'resources/js/pages/Dashboard' }];

// ---------------------------------------------------------------------------
// FASE 5: Controllers / Queries
// ---------------------------------------------------------------------------
// 5a. Controller API lama (routes/api.php sudah kosong) minggir ke Legacy/ supaya namanya bebas
//     buat controller Inertia (hapus suffix "Web"). TIDAK dihapus. Kandidat hapus: lihat laporan.
export const LEGACY_MOVES = [
  [`${C}/AuditLog/AuditLogController.php`, `${C}/Legacy/AuditLog/AuditLogController.php`],
  [`${C}/Auth/AuthController.php`, `${C}/Legacy/Auth/AuthController.php`],
  [`${C}/Dashboard/DashboardController.php`, `${C}/Legacy/Dashboard/DashboardController.php`],
  [`${C}/MasterData/AdminUserController.php`, `${C}/Legacy/MasterData/AdminUserController.php`],
  [`${C}/MasterData/CabangController.php`, `${C}/Legacy/MasterData/CabangController.php`],
  [`${C}/MasterData/DepartemenController.php`, `${C}/Legacy/MasterData/DepartemenController.php`],
  [`${C}/MasterData/InventoryController.php`, `${C}/Legacy/MasterData/InventoryController.php`],
  [`${C}/MasterData/KategoriController.php`, `${C}/Legacy/MasterData/KategoriController.php`],
  [`${C}/MasterData/PerusahaanController.php`, `${C}/Legacy/MasterData/PerusahaanController.php`],
  [`${C}/MasterData/SupplierController.php`, `${C}/Legacy/MasterData/SupplierController.php`],
  [`${C}/Transaksi/InventoryPemakaiController.php`, `${C}/Legacy/Transaksi/InventoryPemakaiController.php`],
  [`${C}/Transaksi/InventoryPenangananController.php`, `${C}/Legacy/Transaksi/InventoryPenangananController.php`],
  [`${C}/ImportController.php`, `${C}/Legacy/ImportController.php`],
  // RoleController dibelah khusus (lihat splitRoleController di run.mjs): daftar() -> Queries/MasterData/RoleQuery,
  // sisanya (index() JSON) ikut ke Legacy.
  [`${C}/MasterData/RoleController.php`, `${C}/Legacy/MasterData/RoleController.php`],
];

// 5b. Controller Inertia (live): rename + (Dashboard/Penanganan) page controller.
export const LIVE_CONTROLLER_MOVES = [
  [`${C}/Auth/WebAuthController.php`, `${C}/Auth/AuthController.php`],
  [`${C}/Dashboard/DashboardPageController.php`, `${C}/Dashboard/DashboardController.php`],
  [`${C}/MasterData/CabangWebController.php`, `${C}/MasterData/CabangController.php`],
  [`${C}/MasterData/PerusahaanWebController.php`, `${C}/MasterData/PerusahaanController.php`],
  [`${C}/MasterData/DepartemenWebController.php`, `${C}/MasterData/DepartemenController.php`],
  [`${C}/MasterData/KategoriWebController.php`, `${C}/MasterData/KategoriController.php`],
  [`${C}/MasterData/SupplierWebController.php`, `${C}/MasterData/SupplierController.php`],
  [`${C}/MasterData/KaryawanWebController.php`, `${C}/MasterData/KaryawanController.php`],
  [`${C}/MasterData/InventoryWebController.php`, `${C}/MasterData/InventoryController.php`],
  [`${C}/Transaksi/InventoryPemakaiWebController.php`, `${C}/Transaksi/InventoryPemakaiController.php`],
  [`${C}/Transaksi/InventoryPenangananWebController.php`, `${C}/Transaksi/InventoryPenangananController.php`],
  [`${C}/Transaksi/PenangananInventoryPageController.php`, `${C}/Transaksi/PenangananPageController.php`],
];

// 5c. Queries: hanya kelas yang SUDAH ada (kelas Cabang/Perusahaan/... belum ada, tidak dibuat).
export const QUERY_MOVES = [
  ['app/Queries/AuditLogQuery.php', 'app/Queries/AuditLog/AuditLogQuery.php'],
  ['app/Queries/DashboardQuery.php', 'app/Queries/Dashboard/DashboardQuery.php'],
  ['app/Queries/FotoInventoryQuery.php', 'app/Queries/Laporan/FotoInventoryQuery.php'],
  ['app/Queries/RiwayatInventoryQuery.php', 'app/Queries/Laporan/RiwayatInventoryQuery.php'],
  ['app/Queries/InventoryPenangananQuery.php', 'app/Queries/Transaksi/InventoryPenangananQuery.php'],
  ['app/Queries/InventoryQuery.php', 'app/Queries/MasterData/InventoryQuery.php'],
  ['app/Queries/KaryawanQuery.php', 'app/Queries/MasterData/KaryawanQuery.php'],
];

// ---------------------------------------------------------------------------
// FASE 6: Console + Support
// ---------------------------------------------------------------------------
export const CONSOLE_MOVES = [
  ['app/Console/Commands/AuditCleanup.php', 'app/Console/Commands/Audit/AuditCleanup.php'],
  ['app/Console/Commands/AuditPurge.php', 'app/Console/Commands/Audit/AuditPurge.php'],
  ['app/Console/Commands/AuditVerifyScenario.php', 'app/Console/Commands/Audit/AuditVerifyScenario.php'],
  // Maintenance: TIDAK dihapus. Kandidat hapus kalau sudah sekali jalan (tanya user).
  ['app/Console/Commands/BackfillTanggalPembelianAset.php', 'app/Console/Commands/Maintenance/BackfillTanggalPembelianAset.php'],
  ['app/Console/Commands/FixOrphanedAsetPemakai.php', 'app/Console/Commands/Maintenance/FixOrphanedAsetPemakai.php'],
];

export const SUPPORT_MOVES = [
  [`${C}/Concerns/GeneratesStrukNumber.php`, 'app/Support/Concerns/GeneratesStrukNumber.php'],
  [`${C}/Concerns/SimpanFotoBukti.php`, 'app/Support/Concerns/SimpanFotoBukti.php'],
];

// ---------------------------------------------------------------------------
// FASE 7: Form Request. Controller yang discan (path SETELAH fase 5).
// ---------------------------------------------------------------------------
export const REQUEST_CONTROLLERS = [
  `${C}/MasterData/CabangController.php`,
  `${C}/MasterData/PerusahaanController.php`,
  `${C}/MasterData/DepartemenController.php`,
  `${C}/MasterData/KategoriController.php`,
  `${C}/MasterData/SupplierController.php`,
  `${C}/MasterData/InventoryController.php`,
  `${C}/Transaksi/InventoryPenangananController.php`,
  `${C}/Auth/AuthController.php`,
  `${C}/Notifikasi/PushSubscriptionController.php`,
];

// ---------------------------------------------------------------------------
// FASE 8: routes. Anchor = potongan teks baris di routes/web.php (setelah fase 5).
// ---------------------------------------------------------------------------
export const ROUTES_FILE = 'routes/web.php';
export const ROUTES_DIR = 'routes/web';

// Folder yang ikut dikumpulkan saat commit & scan PHP.
export const PHP_DIRS = ['app', 'routes', 'bootstrap', 'config', 'database', 'tests'];
