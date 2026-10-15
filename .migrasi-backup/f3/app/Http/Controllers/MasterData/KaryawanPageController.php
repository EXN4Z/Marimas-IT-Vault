<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Models\User;
use Inertia\Inertia;

class KaryawanPageController extends Controller
{
    // Halaman web (Inertia) untuk create / detail / edit Karyawan. Admin-only: dijaga middleware
    // role:admin di routes/web.php (web/Inertia -> redirect /dashboard, API/JSON tetap 403).
    // Datanya masih diambil halaman lewat /api/karyawan (axios); pindah jadi props di F11.
    // {user} di-resolve route model binding, jadi id yang tidak ada -> 404.

    // GET /karyawan/create
    public function create()
    {
        return Inertia::render('Karyawan/Create');
    }

    // GET /karyawan/{user}
    public function show(User $user)
    {
        return Inertia::render('Karyawan/Show', ['id' => $user->id]);
    }

    // GET /karyawan/{user}/edit
    public function edit(User $user)
    {
        return Inertia::render('Karyawan/Edit', ['id' => $user->id]);
    }
}
