<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;

// Di-require dari routes/web.php DI LUAR grup 'auth' (login & OTP publik).

// Login & verifikasi OTP: halaman Inertia, auth session penuh. Nama 'login' = tujuan redirect middleware 'auth'.
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::get('/verify-otp', [AuthController::class, 'showVerifyOtp']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/resend-otp', [AuthController::class, 'resendOtp'])->middleware('throttle:3,1'); // [F9-INERTIA] tombol "Kirim ulang kode" di halaman verifikasi OTP

// Logout butuh sesi login (dulu di dalam grup 'auth').
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth');
