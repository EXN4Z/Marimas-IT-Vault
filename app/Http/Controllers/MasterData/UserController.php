<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;

use App\Actions\MasterData\KaryawanAction;
use App\Models\User;
use App\Queries\MasterData\KaryawanQuery;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        // [F3-INERTIA] Eager-load relasi role juga (frontend baca nama/warna role tanpa request tambahan).
        // Filter role/status/search dipakai bareng halaman web lewat KaryawanQuery.
        // Role 'cabang' diperlakukan identik dengan 'user' -- tidak ada scoping khusus lokasi_kantor_id
        // (lihat catatan di User::isAdmin(): akses cuma 2 tingkat, admin vs role lain).
        $query = KaryawanQuery::filter(
            User::with('departemen', 'lokasiKantor', 'roleRef'),
            $request->filled('role') ? (string) $request->role : null,
            $request->filled('status') ? (string) $request->status : null,
            $request->filled('search') ? (string) $request->search : null,
        );

        // Autocomplete modal Serah-Terima: WAJIB JSON (bukan redirect), karena dipanggil via fetch per ketikan.
        return response()->json($query->orderBy('name')->get());
    }

    public function edit(User $user)
    {
        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    // [F3-INERTIA] store/update/destroy: aturan & logikanya dipindah ke KaryawanAction (dipakai bareng halaman web).
    // Bentuk response JSON dipertahankan sama seperti dulu.
    public function store(Request $request)
    {
        $validated = $request->validate(KaryawanAction::rulesBuat());

        try {
            $user = KaryawanAction::buat($validated);
        } catch (ValidationException $e) {
            return $this->responseValidasi($e);
        }

        return response()->json([
            'message' => 'User berhasil dibuat.',
            'user' => $user->load('departemen', 'lokasiKantor', 'roleRef'),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate(KaryawanAction::rulesUbah($user));

        try {
            KaryawanAction::perbarui($user, $validated);
        } catch (ValidationException $e) {
            return $this->responseValidasi($e);
        }

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    public function destroy(User $user)
    {
        try {
            KaryawanAction::hapus($user);
        } catch (ValidationException $e) {
            return $this->responseValidasi($e);
        }

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    /**
     * 422 JSON seperti dulu: 'message' = pesan asli untuk pelanggaran pinjaman aktif (key `status`),
     * selain itu 'The given data was invalid.'; 'errors' = error per field.
     */
    private function responseValidasi(ValidationException $e)
    {
        $errors = $e->errors();

        return response()->json([
            'message' => $errors['status'][0] ?? 'The given data was invalid.',
            'errors' => $errors,
        ], 422);
    }
}
