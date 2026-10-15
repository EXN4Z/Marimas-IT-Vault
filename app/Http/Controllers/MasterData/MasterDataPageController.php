<?php

namespace App\Http\Controllers\MasterData;

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
            'cabang' => $tab === 'cabang' ? fn () => CabangWebController::daftar() : null,
            'perusahaan' => $tab === 'perusahaan' ? fn () => PerusahaanWebController::daftar() : null,
            'departemen' => $tab === 'departemen' ? fn () => DepartemenWebController::daftar() : null,
            'kategori' => $tab === 'kategori' ? fn () => KategoriWebController::daftar() : null,
            'supplier' => $tab === 'supplier' ? fn () => SupplierWebController::daftar() : null,
            // [F3-INERTIA] Tab Karyawan: satu halaman data (pagination/search/filter role dari query string),
            // pilihan dropdown form, dan SEMUA hasil filter buat Export (optional = baru dihitung saat diminta
            // lewat partial reload `only: ['karyawanExport']`).
            'karyawan' => $tab === 'karyawan' ? fn () => KaryawanWebController::daftar($request) : null,
            'karyawanOpsi' => $tab === 'karyawan' ? fn () => KaryawanWebController::opsi() : null,
            'karyawanExport' => $tab === 'karyawan' ? Inertia::optional(fn () => KaryawanWebController::untukExport($request)) : null,
            // [F4-INERTIA] Tab Inventory: satu halaman list (pagination/search/status/kategori dari query string), card
            // "sedang dipakai" (non-admin), pilihan dropdown form. Optional = baru dihitung saat diminta lewat partial reload:
            // SEMUA hasil filter buat Export, kandidat induk (saat modal dibuka), dan detail satu item (?detail=<id>).
            'inventory' => $tab === 'inventory' ? fn () => InventoryWebController::daftar($request) : null,
            'inventoryDipakai' => $tab === 'inventory' ? fn () => InventoryWebController::dipakai($request) : null,
            'inventoryOpsi' => $tab === 'inventory' ? fn () => InventoryWebController::opsi($request) : null,
            'inventoryExport' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryWebController::untukExport($request)) : null,
            'inventoryIndukOpsi' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryWebController::indukOpsi()) : null,
            'inventoryDetail' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryWebController::detail($request)) : null,
        ]);
    }
}
