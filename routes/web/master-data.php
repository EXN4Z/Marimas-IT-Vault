<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MasterData\KaryawanController;
use App\Http\Controllers\MasterData\UserController;
use App\Http\Controllers\MasterData\MasterDataPageController;
use App\Http\Controllers\MasterData\CabangController;
use App\Http\Controllers\MasterData\PerusahaanController;
use App\Http\Controllers\MasterData\DepartemenController;
use App\Http\Controllers\MasterData\KategoriController;
use App\Http\Controllers\MasterData\SupplierController;
use App\Http\Controllers\MasterData\InventoryController;
use App\Http\Middleware\LogActivity;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

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

    Route::post('/kategori/import', [KategoriController::class, 'import']);
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
});