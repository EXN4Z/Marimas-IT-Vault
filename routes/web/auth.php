<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;

// Di-require dari routes/web.php DI LUAR grup 'auth' (login publik).

// Login: halaman Inertia, auth session penuh. Nama 'login' = tujuan redirect middleware 'auth'.
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// Logout butuh sesi login (dulu di dalam grup 'auth').
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth');
