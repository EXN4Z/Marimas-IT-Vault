<?php

use Illuminate\Support\Facades\Route;

// Login, verifikasi OTP, logout: routes/web/auth.php (publik, di luar grup 'auth').
require __DIR__.'/web/auth.php';

Route::redirect('/', '/dashboard'); // belum login -> middleware 'auth' di /dashboard melempar ke /login

// Alias lama (tadinya Navigate di App.tsx). Di luar grup auth: kalau belum login, /dashboard yang akan
// melempar ke /login.
Route::redirect('/dashboard-analytics', '/dashboard?tab=analytics');
Route::redirect('/inventaris', '/laporan');
Route::redirect('/inventory', '/master-data?tab=inventory');
Route::redirect('/karyawan', '/master-data?tab=karyawan'); // alias lama [F3-INERTIA]: create/detail/edit sekarang modal di tab Karyawan, bukan route
Route::redirect('/cabang', '/master-data?tab=cabang');

// Halaman Inertia (butuh login). Satu file per modul di routes/web/.
Route::middleware('auth')->group(function () {
    require __DIR__.'/web/dashboard.php';
    require __DIR__.'/web/laporan.php';
    require __DIR__.'/web/master-data.php';
    require __DIR__.'/web/transaksi.php';
    require __DIR__.'/web/notifikasi.php';
    require __DIR__.'/web/settings.php';
    require __DIR__.'/web/audit-log.php';
});
