<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Dashboard\DashboardController;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

// Dashboard (semua role; DashboardAdmin vs DashboardUser dipilih di halaman dari auth.user.role)
Route::get('/dashboard', DashboardController::class);
