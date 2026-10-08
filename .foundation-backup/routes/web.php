<?php

use Illuminate\Support\Facades\Route;

// ── Menu yang sudah dimigrasi ke Inertia didaftarkan DI SINI (harus di atas catch-all) ──
// Contoh nanti:
// Route::get('/audit-log', fn () => Inertia::render('AuditLog/Index'))->middleware('auth');

// ── Sisanya: SPA lama (react-router) tetap dilayani lewat satu view ──
// /api, /storage, /build, /up, /sanctum dikecualikan supaya tidak ketangkap catch-all.
Route::get('/{any?}', fn () => view('spa'))
    ->where('any', '(?!api(/|$)|storage(/|$)|build(/|$)|sanctum(/|$)|up$).*');
