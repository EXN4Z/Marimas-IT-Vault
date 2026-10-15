<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\WebAuthController;
use App\Http\Controllers\AuditLog\AuditLogPageController;
use App\Http\Controllers\Dashboard\DashboardPageController;
use App\Http\Controllers\Laporan\LaporanPageController;
use App\Http\Controllers\MasterData\KaryawanWebController;
use App\Http\Controllers\MasterData\MasterDataPageController;
use App\Http\Controllers\MasterData\CabangWebController;
use App\Http\Controllers\MasterData\PerusahaanWebController;
use App\Http\Controllers\MasterData\DepartemenWebController;
use App\Http\Controllers\MasterData\KategoriWebController;
use App\Http\Controllers\MasterData\SupplierWebController;
use App\Http\Controllers\MasterData\InventoryWebController;
use App\Http\Middleware\LogActivity;
use App\Http\Controllers\Settings\SettingsController;
use App\Http\Controllers\Transaksi\PenangananInventoryPageController;
use App\Http\Controllers\Transaksi\InventoryPemakaiWebController;

// Login & verifikasi OTP: halaman Inertia, auth session penuh. Nama 'login' = tujuan redirect middleware 'auth'.
Route::get('/login', [WebAuthController::class, 'showLogin'])->name('login');
Route::post('/login', [WebAuthController::class, 'login']);
Route::get('/verify-otp', [WebAuthController::class, 'showVerifyOtp']);
Route::post('/verify-otp', [WebAuthController::class, 'verifyOtp']);
Route::redirect('/', '/dashboard'); // belum login -> middleware 'auth' di /dashboard melempar ke /login

// Alias lama (tadinya Navigate di App.tsx). Di luar grup auth: kalau belum login, /dashboard yang akan
// melempar ke /login.
Route::redirect('/dashboard-analytics', '/dashboard?tab=analytics');
Route::redirect('/inventaris', '/laporan');
Route::redirect('/inventory', '/master-data?tab=inventory');
Route::redirect('/karyawan', '/master-data?tab=karyawan'); // alias lama [F3-INERTIA]: create/detail/edit sekarang modal di tab Karyawan, bukan route
Route::redirect('/cabang', '/master-data?tab=cabang');

// Halaman Inertia (butuh login).
Route::middleware('auth')->group(function () {
    Route::post('/logout', [WebAuthController::class, 'logout']);

    // Dashboard (semua role; DashboardAdmin vs DashboardUser dipilih di halaman dari auth.user.role)
    Route::get('/dashboard', DashboardPageController::class);

    // Laporan (admin-only; non-admin web/Inertia -> redirect /dashboard, API/JSON tetap 403)
    Route::get('/laporan', LaporanPageController::class)->middleware('role:admin');

    // Master Data (semua role boleh buka halamannya; tab admin-only dibatasi di controller + API)
    Route::get('/master-data', MasterDataPageController::class);

    // Master Data: Cabang, Perusahaan, Departemen, Kategori, Supplier, Karyawan (admin-only). Mutasi lewat Inertia (redirect back + flash).
    // LogActivity dipasang manual di sini karena di bootstrap/app.php audit log cuma nempel di grup 'api'.
    // Route statis (/import) HARUS di atas route {id}.
    Route::middleware(['role:admin', LogActivity::class])->prefix('master-data')->group(function () {
        Route::post('/cabang/import', [CabangWebController::class, 'import']);
        Route::post('/cabang', [CabangWebController::class, 'store']);
        Route::put('/cabang/{id}', [CabangWebController::class, 'update'])->whereNumber('id');
        Route::delete('/cabang/{id}', [CabangWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/perusahaan/import', [PerusahaanWebController::class, 'import']);
        Route::post('/perusahaan', [PerusahaanWebController::class, 'store']);
        Route::put('/perusahaan/{id}', [PerusahaanWebController::class, 'update'])->whereNumber('id');
        Route::delete('/perusahaan/{id}', [PerusahaanWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/departemen/import', [DepartemenWebController::class, 'import']);
        Route::post('/departemen', [DepartemenWebController::class, 'store']);
        Route::put('/departemen/{id}', [DepartemenWebController::class, 'update'])->whereNumber('id');
        Route::delete('/departemen/{id}', [DepartemenWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/kategori', [KategoriWebController::class, 'store']);
        Route::put('/kategori/{id}', [KategoriWebController::class, 'update'])->whereNumber('id');
        Route::delete('/kategori/{id}', [KategoriWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/supplier/import', [SupplierWebController::class, 'import']);
        Route::post('/supplier', [SupplierWebController::class, 'store']);
        Route::put('/supplier/{id}', [SupplierWebController::class, 'update'])->whereNumber('id');
        Route::delete('/supplier/{id}', [SupplierWebController::class, 'destroy'])->whereNumber('id');

        // [F3-INERTIA] Karyawan (Data User): modal Tambah/Edit/Hapus/Ubah Password + import. Statis (/import) di atas {id}.
        Route::post('/karyawan/import', [KaryawanWebController::class, 'import']);
        Route::post('/karyawan', [KaryawanWebController::class, 'store']);
        Route::put('/karyawan/{id}/password', [KaryawanWebController::class, 'setPassword'])->whereNumber('id');
        Route::put('/karyawan/{id}', [KaryawanWebController::class, 'update'])->whereNumber('id');
        Route::delete('/karyawan/{id}', [KaryawanWebController::class, 'destroy'])->whereNumber('id');

        // [F4-INERTIA] Inventory: modal Tambah/Edit/Hapus/Jual/Pasang ke Induk/Lepas dari Induk + import. Statis (/import) di atas {inventory}.
        // {inventory} = route model binding (LogActivity butuh model-nya buat deskripsi audit "mengubah/menghapus aset <kode>").
        // Update dengan foto: klien kirim POST + _method=put, jadi route-nya WAJIB didaftarkan PUT.
        Route::post('/inventory/import', [InventoryWebController::class, 'import']);
        Route::post('/inventory', [InventoryWebController::class, 'store']);
        Route::post('/inventory/{inventory}/jual', [InventoryWebController::class, 'jual'])->whereNumber('inventory');
        Route::post('/inventory/{inventory}/pasang-ke-induk', [InventoryWebController::class, 'pasangKeInduk'])->whereNumber('inventory');
        Route::post('/inventory/{inventory}/lepas-dari-induk', [InventoryWebController::class, 'lepasDariInduk'])->whereNumber('inventory');
        Route::put('/inventory/{inventory}', [InventoryWebController::class, 'update'])->whereNumber('inventory');
        Route::delete('/inventory/{inventory}', [InventoryWebController::class, 'destroy'])->whereNumber('inventory');

        // [F5-INERTIA] Transaksi pemakai (admin-only): serah-terima (multipart foto_penerimaan[]) & hapus riwayat pemakaian.
        // {inventory} = route model binding (LogActivity butuh model-nya buat deskripsi audit "meminjamkan aset <kode>").
        Route::post('/inventory/{inventory}/pemakai', [InventoryPemakaiWebController::class, 'store'])->whereNumber('inventory');
        Route::delete('/inventory-pemakai/{inventoryPemakai}', [InventoryPemakaiWebController::class, 'destroy'])->whereNumber('inventoryPemakai');
    });

    // [F5-INERTIA] Kembalikan inventory: BUKAN admin-only. Admin ATAU pemakai yang lagi pegang item ini (karyawan/cabang) --
    // sama seperti route API aslinya (cuma auth). Otorisasi "admin atau pemilik" dicek di InventoryPemakaiWebController::kembalikan().
    Route::middleware(LogActivity::class)->prefix('master-data')->group(function () {
        Route::post('/inventory-pemakai/{inventoryPemakai}/kembalikan', [InventoryPemakaiWebController::class, 'kembalikan'])->whereNumber('inventoryPemakai');
    });

    // Penanganan Inventory (semua role; non-admin hanya lihat laporan miliknya -- scoping di controller API)
    Route::get('/penanganan-inventory', PenangananInventoryPageController::class);

    // Settings (semua role yang login)
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::put('/settings/password', [SettingsController::class, 'updatePassword']);

    // Audit Log (admin-only)
    Route::get('/audit-log', AuditLogPageController::class)->middleware('role:admin');
});
