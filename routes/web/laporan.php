<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Laporan\LaporanPageController;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

// Laporan (admin-only; non-admin web/Inertia -> redirect /dashboard, API/JSON tetap 403)
Route::get('/laporan', LaporanPageController::class)->middleware('role:admin');
