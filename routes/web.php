<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Semua halaman dilayani Inertia. Auth masih di sisi klien (token Sanctum +
// AuthContext), jadi route ini sengaja BELUM dipasangi middleware 'auth'.
// API tetap diproteksi auth:sanctum di routes/api.php.

Route::get('/', fn () => Inertia::render('Auth/Login'));
Route::get('/login', fn () => Inertia::render('Auth/Login'))->name('login');
Route::get('/verify-otp', fn () => Inertia::render('Auth/VerifyOtp'));

Route::get('/dashboard', fn () => Inertia::render('Dashboard'));
Route::get('/master-data', fn () => Inertia::render('MasterData'));
Route::get('/laporan', fn () => Inertia::render('Laporan'));
Route::get('/audit-log', fn () => Inertia::render('AuditLog'));
Route::get('/settings', fn () => Inertia::render('Settings'));
Route::get('/penanganan-inventory', fn () => Inertia::render('PenangananInventory'));

// create HARUS di atas {id}
Route::get('/karyawan/create', fn () => Inertia::render('Karyawan/Create'));
Route::get('/karyawan/{id}/edit', fn (string $id) => Inertia::render('Karyawan/Edit', ['params' => ['id' => $id]]))
    ->whereNumber('id');
Route::get('/karyawan/{id}', fn (string $id) => Inertia::render('Karyawan/Detail', ['params' => ['id' => $id]]))
    ->whereNumber('id');

// Alias lama (bookmark / link lama), sama seperti di App.tsx.
Route::redirect('/inventaris', '/laporan');
Route::redirect('/inventory', '/master-data?tab=inventory');
Route::redirect('/karyawan', '/master-data?tab=karyawan');
Route::redirect('/cabang', '/master-data?tab=cabang');
Route::redirect('/dashboard-analytics', '/dashboard?tab=analytics');
