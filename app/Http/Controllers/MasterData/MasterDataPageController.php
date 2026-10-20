<?php

namespace App\Http\Controllers\MasterData;

use App\Queries\MasterData\SupplierQuery;
use App\Queries\MasterData\KategoriQuery;
use App\Queries\MasterData\DepartemenQuery;
use App\Queries\MasterData\PerusahaanQuery;
use App\Queries\MasterData\CabangQuery;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MasterDataPageController extends Controller
{
    // Semua tab selain inventory admin-only (sinkron dengan routes/api.php dan daftar TABS di halaman React).
    private const ADMIN_TABS = ['kategori', 'karyawan', 'cabang', 'perusahaan', 'departemen', 'supplier'];

    // GET /master-data?tab=inventory|kategori|karyawan|cabang|perusahaan|departemen|supplier   (middleware: auth)
    // Tab kosong / tidak dikenal / bukan hak role ini -> 'inventory' (perilaku lama, tanpa redirect supaya
    // query lain di URL tidak hilang). Data tiap tab masih lewat /api (axios) -- dipindah ke props di F1-F5.
    public function __invoke(Request $request)
    {
        $allowed = $request->user()->isAdmin()
            ? array_merge(['inventory'], self::ADMIN_TABS)
            : ['inventory'];

        $tab = (string) $request->query('tab', '');

        $tab = in_array($tab, $allowed, true) ? $tab : 'inventory';

        return Inertia::render('MasterData/Index', [
            'tab' => $tab,
            // Data tab dikirim hanya saat tab itu aktif (closure = lazy; null = tidak dikirim isinya).
            'cabang' => $tab === 'cabang' ? fn () => CabangQuery::daftar() : null,
            'perusahaan' => $tab === 'perusahaan' ? fn () => PerusahaanQuery::daftar() : null,
            'departemen' => $tab === 'departemen' ? fn () => DepartemenQuery::daftar() : null,
            'kategori' => $tab === 'kategori' ? fn () => KategoriQuery::daftar() : null,
            'supplier' => $tab === 'supplier' ? fn () => SupplierQuery::daftar() : null,
            // [F3-INERTIA] Tab Karyawan: satu halaman data (pagination/search/filter role dari query string),
            // pilihan dropdown form, dan SEMUA hasil filter buat Export (optional = baru dihitung saat diminta
            // lewat partial reload `only: ['karyawanExport']`).
            'karyawan' => $tab === 'karyawan' ? fn () => KaryawanController::daftar($request) : null,
            'karyawanOpsi' => $tab === 'karyawan' ? fn () => KaryawanController::opsi() : null,
            'karyawanExport' => $tab === 'karyawan' ? Inertia::optional(fn () => KaryawanController::untukExport($request)) : null,
            // [F4-INERTIA] Tab Inventory: satu halaman list (pagination/search/status/kategori dari query string), card
            // "sedang dipakai" (non-admin), pilihan dropdown form. Optional = baru dihitung saat diminta lewat partial reload:
            // SEMUA hasil filter buat Export, kandidat induk (saat modal dibuka), dan detail satu item (?detail=<id>).
            'inventory' => $tab === 'inventory' ? fn () => InventoryController::daftar($request) : null,
            'inventoryDipakai' => $tab === 'inventory' ? fn () => InventoryController::dipakai($request) : null,
            'inventoryOpsi' => $tab === 'inventory' ? fn () => InventoryController::opsi($request) : null,
            'inventoryExport' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryController::untukExport($request)) : null,
            'inventoryIndukOpsi' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryController::indukOpsi()) : null,
            'inventoryDetail' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryController::detail($request)) : null,
        ]);
    }
}
