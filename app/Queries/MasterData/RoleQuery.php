<?php

namespace App\Queries\MasterData;

use App\Models\MasterData\Role;

class RoleQuery
{
    // [F3-INERTIA] Daftar role yang boleh dipilih (tanpa 'cabang'). Dipakai bareng props `karyawanOpsi`
    // di tab Karyawan (KaryawanController::opsi) dan RoleController::index() (legacy JSON).
    public static function daftar()
    {
        return Role::where('nama', '!=', 'cabang')->orderBy('id')->get(['id', 'nama']);
    }
}
