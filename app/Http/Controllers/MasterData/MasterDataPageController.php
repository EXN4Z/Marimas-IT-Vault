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
        ]);
    }
}
