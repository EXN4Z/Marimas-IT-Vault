<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Queries\Dashboard\DashboardQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;

// [F8-INERTIA] GET /dashboard   (middleware: auth, lihat routes/web.php)
// Semua role boleh. Data dikirim sebagai deferred props (halaman tampil dulu, skeleton sampai data datang):
//  - admin     -> `analitik` (ringkasan/tren/status inventory, distribusi departemen, aktivitas kalender)
//  - non-admin -> `pribadi`  (inventory milik sendiri, ringkasan & feed aktivitas milik sendiri)
// DashboardAdmin vs DashboardUser dipilih di sisi React dari auth.user.role (sama dengan isAdmin() di sini).
// Notifikasi sengaja belum di sini (F9).
class DashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();
        $admin = $user->isAdmin();

        return Inertia::render('Dashboard/Index', [
            'analitik' => $admin ? Inertia::defer(fn () => DashboardQuery::admin($user)) : null,
            'pribadi' => !$admin ? Inertia::defer(fn () => DashboardQuery::pribadi($user)) : null,
        ]);
    }
}
