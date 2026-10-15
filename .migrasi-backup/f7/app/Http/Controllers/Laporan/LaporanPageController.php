<?php

namespace App\Http\Controllers\Laporan;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LaporanPageController extends Controller
{
    private const TABS = ['export_data', 'foto_inventory', 'riwayat_inventory'];

    // GET /laporan?tab=export_data|foto_inventory|riwayat_inventory   (middleware: auth + role:admin, lihat routes/web.php)
    // Tab kosong / tidak dikenal -> redirect ke ?tab=export_data (dulu dilakukan effect di React lewat setSearchParams).
    // Data tab masih lewat /api (axios) -- dipindah ke props di tahap F7/F8.
    public function __invoke(Request $request)
    {
        $tab = $request->query('tab');

        if (!in_array($tab, self::TABS, true)) {
            return redirect('/laporan?tab=export_data');
        }

        return Inertia::render('Laporan/Index', ['tab' => $tab]);
    }
}
