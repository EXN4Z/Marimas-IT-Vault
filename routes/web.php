<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuditLog\AuditLogPageController;
use App\Http\Controllers\Settings\SettingsController;
use Inertia\Inertia;

// ── Menu yang sudah dimigrasi ke Inertia didaftarkan DI SINI (harus di atas catch-all) ──
// Contoh nanti:
// Route::get('/audit-log', fn () => Inertia::render('AuditLog/Index'))->middleware('auth');

// Tujuan redirect middleware 'auth' kalau belum login (halaman login tetap SPA lama).
Route::get('/login', fn () => view('spa'))->name('login');

// Halaman Inertia yang sudah dimigrasi didaftarkan di grup ini (HARUS di atas catch-all).
Route::middleware('auth')->group(function () {
    // Settings (semua role yang login)
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::put('/settings/password', [SettingsController::class, 'updatePassword']);

    // Audit Log (admin-only)
    Route::get('/audit-log', AuditLogPageController::class)->middleware('role:admin');
});

// ── Sisanya: SPA lama (react-router) tetap dilayani lewat satu view ──
// /api, /storage, /build, /up, /sanctum dikecualikan supaya tidak ketangkap catch-all.
Route::get('/{any?}', fn () => view('spa'))
    ->where('any', '(?!api(/|$)|storage(/|$)|build(/|$)|sanctum(/|$)|up$).*');
