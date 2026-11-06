<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;

use App\Models\User;
use App\Queries\MasterData\KaryawanQuery;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        // [F3-INERTIA] Eager-load relasi role juga (frontend baca nama/warna role tanpa request tambahan).
        // Filter role/status/search dipakai bareng halaman web lewat KaryawanQuery.
        // Role 'cabang' diperlakukan identik dengan 'user' -- tidak ada scoping khusus cabang_id
        // (lihat catatan di User::isAdmin(): akses cuma 2 tingkat, admin vs role lain).
        $query = KaryawanQuery::filter(
            User::with('departemen', 'cabang', 'roleRef'),
            $request->filled('role') ? (string) $request->role : null,
            $request->filled('status') ? (string) $request->status : null,
            $request->filled('search') ? (string) $request->search : null,
        );

        // Autocomplete modal Serah-Terima: WAJIB JSON (bukan redirect), karena dipanggil via fetch per ketikan.
        return response()->json($query->orderBy('name')->get());
    }
}
