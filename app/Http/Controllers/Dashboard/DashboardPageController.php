<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class DashboardPageController extends Controller
{
    // GET /dashboard   (middleware: auth, lihat routes/web.php)
    // Semua role boleh. DashboardAdmin vs DashboardUser dipilih di sisi React dari auth.user.role.
    // Data dashboard SENGAJA masih lewat /api (react-query) -- dipindah ke props di tahap F9.
    public function __invoke()
    {
        return Inertia::render('Dashboard/Index');
    }
}
