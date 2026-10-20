<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\AuditLog\AuditLogPageController;
use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Laporan\LaporanPageController;
use App\Http\Controllers\MasterData\KaryawanController;
use App\Http\Controllers\MasterData\UserController;
use App\Http\Controllers\MasterData\MasterDataPageController;
use App\Http\Controllers\MasterData\CabangController;
use App\Http\Controllers\MasterData\PerusahaanController;
use App\Http\Controllers\MasterData\DepartemenController;
use App\Http\Controllers\MasterData\KategoriController;
use App\Http\Controllers\MasterData\SupplierController;
use App\Http\Controllers\MasterData\InventoryController;
use App\Http\Controllers\Notifikasi\NotificationController;
use App\Http\Controllers\Notifikasi\PushSubscriptionController;
use App\Http\Middleware\LogActivity;
use App\Http\Controllers\Settings\SettingsController;
use App\Http\Controllers\Transaksi\PenangananPageController;
use App\Http\Controllers\Transaksi\InventoryPemakaiController;
use App\Http\Controllers\Transaksi\InventoryPenangananController;

// Login & verifikasi OTP: halaman Inertia, auth session penuh. Nama 'login' = tujuan redirect middleware 'auth'.
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::get('/verify-otp', [AuthController::class, 'showVerifyOtp']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/resend-otp', [AuthController::class, 'resendOtp']); // [F9-INERTIA] tombol "Kirim ulang kode" di halaman verifikasi OTP
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
    Route::post('/logout', [AuthController::class, 'logout']);

    // Dashboard (semua role; DashboardAdmin vs DashboardUser dipilih di halaman dari auth.user.role)
    Route::get('/dashboard', DashboardController::class);

    // Laporan (admin-only; non-admin web/Inertia -> redirect /dashboard, API/JSON tetap 403)
    Route::get('/laporan', LaporanPageController::class)->middleware('role:admin');

    // Master Data (semua role boleh buka halamannya; tab admin-only dibatasi di controller + API)
    Route::get('/master-data', MasterDataPageController::class);

    // Master Data: Cabang, Perusahaan, Departemen, Kategori, Supplier, Karyawan (admin-only). Mutasi lewat Inertia (redirect back + flash).
    // LogActivity dipasang manual di sini karena di bootstrap/app.php audit log cuma nempel di grup 'api'.
    // Route statis (/import) HARUS di atas route {id}.
    Route::middleware(['role:admin', LogActivity::class])->prefix('master-data')->group(function () {
        Route::post('/cabang/import', [CabangController::class, 'import']);
        Route::post('/cabang', [CabangController::class, 'store']);
        Route::put('/cabang/{id}', [CabangController::class, 'update'])->whereNumber('id');
        Route::delete('/cabang/{id}', [CabangController::class, 'destroy'])->whereNumber('id');

        Route::post('/perusahaan/import', [PerusahaanController::class, 'import']);
        Route::post('/perusahaan', [PerusahaanController::class, 'store']);
        Route::put('/perusahaan/{id}', [PerusahaanController::class, 'update'])->whereNumber('id');
        Route::delete('/perusahaan/{id}', [PerusahaanController::class, 'destroy'])->whereNumber('id');

        Route::post('/departemen/import', [DepartemenController::class, 'import']);
        Route::post('/departemen', [DepartemenController::class, 'store']);
        Route::put('/departemen/{id}', [DepartemenController::class, 'update'])->whereNumber('id');
        Route::delete('/departemen/{id}', [DepartemenController::class, 'destroy'])->whereNumber('id');

        Route::post('/kategori', [KategoriController::class, 'store']);
        Route::put('/kategori/{id}', [KategoriController::class, 'update'])->whereNumber('id');
        Route::delete('/kategori/{id}', [KategoriController::class, 'destroy'])->whereNumber('id');

        Route::post('/supplier/import', [SupplierController::class, 'import']);
        Route::post('/supplier', [SupplierController::class, 'store']);
        Route::put('/supplier/{id}', [SupplierController::class, 'update'])->whereNumber('id');
        Route::delete('/supplier/{id}', [SupplierController::class, 'destroy'])->whereNumber('id');

        // [F3-INERTIA] Karyawan (Data User): modal Tambah/Edit/Hapus/Ubah Password + import. Statis (/import) di atas {id}.
        // [F9b-INERTIA] Autocomplete karyawan (modal Serah-Terima): SENGAJA JSON (per ketikan, bukan visit Inertia).
        // Controller SAMA dengan GET /api/karyawan (filter search/role), admin-only seperti aslinya. Statis di atas {id}.
        Route::get('/karyawan/cari', [UserController::class, 'index']);
        Route::post('/karyawan/import', [KaryawanController::class, 'import']);
        Route::post('/karyawan', [KaryawanController::class, 'store']);
        Route::put('/karyawan/{id}/password', [KaryawanController::class, 'setPassword'])->whereNumber('id');
        Route::put('/karyawan/{id}', [KaryawanController::class, 'update'])->whereNumber('id');
        Route::delete('/karyawan/{id}', [KaryawanController::class, 'destroy'])->whereNumber('id');

        // [F4-INERTIA] Inventory: modal Tambah/Edit/Hapus/Jual/Pasang ke Induk/Lepas dari Induk + import. Statis (/import) di atas {inventory}.
        // {inventory} = route model binding (LogActivity butuh model-nya buat deskripsi audit "mengubah/menghapus aset <kode>").
        // Update dengan foto: klien kirim POST + _method=put, jadi route-nya WAJIB didaftarkan PUT.
        Route::post('/inventory/import', [InventoryController::class, 'import']);
        Route::post('/inventory', [InventoryController::class, 'store']);
        Route::post('/inventory/{inventory}/jual', [InventoryController::class, 'jual'])->whereNumber('inventory');
        Route::post('/inventory/{inventory}/pasang-ke-induk', [InventoryController::class, 'pasangKeInduk'])->whereNumber('inventory');
        Route::post('/inventory/{inventory}/lepas-dari-induk', [InventoryController::class, 'lepasDariInduk'])->whereNumber('inventory');
        Route::put('/inventory/{inventory}', [InventoryController::class, 'update'])->whereNumber('inventory');
        Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy'])->whereNumber('inventory');

        // [F5-INERTIA] Transaksi pemakai (admin-only): serah-terima (multipart foto_penerimaan[]) & hapus riwayat pemakaian.
        // {inventory} = route model binding (LogActivity butuh model-nya buat deskripsi audit "meminjamkan aset <kode>").
        Route::post('/inventory/{inventory}/pemakai', [InventoryPemakaiController::class, 'store'])->whereNumber('inventory');
        Route::delete('/inventory-pemakai/{inventoryPemakai}', [InventoryPemakaiController::class, 'destroy'])->whereNumber('inventoryPemakai');
    });

    // [F5-INERTIA] Kembalikan inventory: BUKAN admin-only. Admin ATAU pemakai yang lagi pegang item ini (karyawan/cabang) --
    // sama seperti route API aslinya (cuma auth). Otorisasi "admin atau pemilik" dicek di InventoryPemakaiController::kembalikan().
    Route::middleware(LogActivity::class)->prefix('master-data')->group(function () {
        Route::post('/inventory-pemakai/{inventoryPemakai}/kembalikan', [InventoryPemakaiController::class, 'kembalikan'])->whereNumber('inventoryPemakai');
    });

    // Penanganan Inventory (semua role; non-admin hanya lihat laporan miliknya -- scoping di InventoryPenangananQuery::populasi())
    Route::get('/penanganan-inventory', PenangananPageController::class);

    // [F6-INERTIA] Mutasi penanganan (redirect back + flash). LogActivity dipasang manual (audit log cuma nempel di grup 'api'); prefix
    // penanganan-inventory dipetakan ke pola URI API-nya di LogActivity supaya deskripsi audit tetap sama.
    // POST / (lapor kerusakan, multipart foto) = semua role yang login -- dipicu dari modal di tab Inventory (Master Data),
    // sama seperti route API aslinya (cuma auth). Sisanya admin-only. Route statis (/import) HARUS di atas {inventoryPenanganan}.
    Route::middleware(LogActivity::class)->prefix('penanganan-inventory')->group(function () {
        Route::post('/', [InventoryPenangananController::class, 'store']);

        Route::middleware('role:admin')->group(function () {
            Route::post('/import', [InventoryPenangananController::class, 'import']);
            Route::post('/{inventoryPenanganan}/terima', [InventoryPenangananController::class, 'terima'])->whereNumber('inventoryPenanganan');
            Route::put('/{inventoryPenanganan}', [InventoryPenangananController::class, 'update'])->whereNumber('inventoryPenanganan');
            Route::delete('/{inventoryPenanganan}', [InventoryPenangananController::class, 'destroy'])->whereNumber('inventoryPenanganan');
        });
    });

    // [F9-INERTIA] Notifikasi (bell + kartu Dashboard) & push subscription: SENGAJA tetap JSON, bukan Inertia (pengecualian).
    //  - GET /notifications dipoll klien tiap 5 detik; aksinya (tandai dibaca / hapus) optimistic dari state lokal dan
    //    tidak mengubah props halaman manapun, jadi tidak perlu redirect + render ulang halaman aktif.
    //  - /push-subscriptions dipanggil di background (izin browser, dan sebelum logout), bukan aksi halaman.
    // Controller-nya SAMA dengan route /api lama (tidak ada logic ganda). LogActivity sengaja tidak dipasang: ini bukan
    // perubahan data bisnis (dulu tercatat generik di audit log lewat grup 'api').
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']); // statis di atas {id}
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store']);
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy']);

    // Settings (semua role yang login)
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::put('/settings/password', [SettingsController::class, 'updatePassword']);

    // Audit Log (admin-only)
    Route::get('/audit-log', AuditLogPageController::class)->middleware('role:admin');
});
