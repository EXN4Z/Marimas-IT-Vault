<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// ── Menu yang sudah dimigrasi ke Inertia didaftarkan DI SINI (harus di atas catch-all) ──
// Contoh nanti:
// Route::get('/audit-log', fn () => Inertia::render('AuditLog/Index'))->middleware('auth');

// Tujuan redirect middleware 'auth' kalau belum login (halaman login tetap SPA lama).
Route::get('/login', fn () => view('spa'))->name('login');

// Halaman Inertia yang sudah dimigrasi didaftarkan di grup ini (HARUS di atas catch-all).
Route::middleware('auth')->group(function () {
    // TES SEMENTARA (P1) -- hapus setelah lolos.
    Route::get('/_ping', fn () => Inertia::render('Test/Ping'));
});

// ── Sisanya: SPA lama (react-router) tetap dilayani lewat satu view ──
// /api, /storage, /build, /up, /sanctum dikecualikan supaya tidak ketangkap catch-all.
Route::get('/{any?}', fn () => view('spa'))
    ->where('any', '(?!api(/|$)|storage(/|$)|build(/|$)|sanctum(/|$)|up$).*');
