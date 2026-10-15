<?php

namespace App\Http\Controllers\MasterData;

use Illuminate\Http\Request;
use App\Models\MasterData\Role;
use App\Http\Controllers\Controller;

class RoleController extends Controller
{
    // [F3-INERTIA] Daftar role yang boleh dipilih (tanpa 'cabang'). Dipakai bareng GET /api/roles dan
    // props `karyawanOpsi` di tab Karyawan (KaryawanWebController::opsi).
    public static function daftar()
    {
        return Role::where('nama', '!=', 'cabang')->orderBy('id')->get(['id', 'nama']);
    }

    public function index() {
        return response()->json(self::daftar());
    }
}
