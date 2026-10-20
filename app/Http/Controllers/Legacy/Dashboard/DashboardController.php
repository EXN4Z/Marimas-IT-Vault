<?php

namespace App\Http\Controllers\Legacy\Dashboard;

use App\Http\Controllers\Controller;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    // [F8-INERTIA] Logika di App\Queries\Dashboard\DashboardQuery::departemen() (dipakai bareng props halaman Dashboard).
    // Endpoint ini tidak dipanggil frontend lagi; dihapus di F10.
    public function KaryawanPerDepart()
    {
        return response()->json(\App\Queries\Dashboard\DashboardQuery::departemen());
    }
}
