<?php

use Illuminate\Support\Facades\Route;
use App\Http\Middleware\LogActivity;
use App\Http\Controllers\Transaksi\PenangananPageController;
use App\Http\Controllers\Transaksi\InventoryPemakaiController;
use App\Http\Controllers\Transaksi\InventoryPenangananController;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).
// Transaksi pemakai & penanganan inventory (grup pemakai dulu 1 grup dengan master-data admin; middleware identik).

Route::middleware(['role:admin', LogActivity::class])->prefix('master-data')->group(function () {
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
