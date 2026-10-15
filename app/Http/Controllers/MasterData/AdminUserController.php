<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;

use App\Actions\MasterData\KaryawanAction;
use App\Models\User;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    // POST /api/admin/users/{id}/set-password -- admin nentuin sendiri password baru.
    public function setPassword(Request $request, int $id)
    {
        // BARU: pastikan cuma admin yang bisa akses (double-check di route middleware juga)
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Tidak diizinkan.'], 403);
        }

        $validated = $request->validate([
            'password' => ['required', 'string', 'confirmed'],
        ]);

        $user = User::findOrFail($id);

        // [F3-INERTIA] logika dipakai bareng halaman web (KaryawanWebController::setPassword)
        KaryawanAction::ubahPassword($user, $validated['password']);

        return response()->json([
            'message' => 'Password berhasil diubah.',
            'user' => $user->only(['id', 'name']),
        ]);
    }
}