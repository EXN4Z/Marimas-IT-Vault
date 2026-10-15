<?php

namespace App\Actions\MasterData;

use App\Models\MasterData\Role;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * [F3-INERTIA] Logika mutasi karyawan (user), dipakai bareng oleh:
 *  - API : App\Http\Controllers\MasterData\UserController (store/update/destroy) + AdminUserController (set-password)
 *  - Web : App\Http\Controllers\MasterData\KaryawanWebController (modal Tambah/Edit/Hapus/Ubah Password)
 *
 * Aturan validasi dan aturan bisnis dipindah APA ADANYA dari UserController. Pelanggaran dilempar sebagai
 * ValidationException; API membungkusnya jadi JSON 422, web membiarkannya jadi redirect back + error bag.
 * (Pemanggil yang validasi: pakai rulesBuat() / rulesUbah() dulu.)
 */
class KaryawanAction
{
    public static function rulesBuat(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:users,email',
            'phone' => 'nullable|string|unique:users,phone',
            'password' => 'required|string',
            'role_id' => 'required|integer|exists:roles,id',
            'nik' => 'nullable|string|unique:users,nik',
            'departemen_id' => 'nullable|exists:departemen,id',
            'lokasi_kantor_id' => 'nullable|exists:lokasi_kantor,id',
            'tanggal_masuk' => 'nullable|date',
            'perusahaan_id' => 'nullable|exists:perusahaan,id',
            'status' => 'sometimes|in:aktif,nonaktif',
        ];
    }

    public static function rulesUbah(User $user): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|unique:users,phone,' . $user->id,
            'role_id' => 'required|integer|exists:roles,id',
            'nik' => 'nullable|string|unique:users,nik,' . $user->id,
            'departemen_id' => 'nullable|exists:departemen,id',
            'perusahaan_id' => 'nullable|exists:perusahaan,id',
            'lokasi_kantor_id' => 'nullable|exists:lokasi_kantor,id',
            'tanggal_masuk' => 'nullable|date',
            'status' => 'sometimes|in:aktif,nonaktif',
        ];
    }

    /** Buat user baru. $validated = hasil validate(rulesBuat()). */
    public static function buat(array $validated): User
    {
        $role = Role::findOrFail($validated['role_id']);
        if ($role->nama === 'cabang') {
            throw ValidationException::withMessages(['role_id' => 'Role cabang sudah tidak digunakan.']);
        }

        if (empty($validated['nik'])) {
            throw ValidationException::withMessages(['nik' => 'NIK karyawan wajib diisi.']);
        }
        if (User::where('nik', $validated['nik'])->exists()) {
            throw ValidationException::withMessages(['nik' => 'NIK sudah digunakan.']);
        }

        return User::create([
            'name' => $validated['name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($validated['password']),
            'role_id' => $validated['role_id'],
            'lokasi_kantor_id' => $validated['lokasi_kantor_id'] ?? null,
            'nik' => $validated['nik'],
            'departemen_id' => $validated['departemen_id'] ?? null,
            'perusahaan_id' => $validated['perusahaan_id'] ?? null,
            'tanggal_masuk' => $validated['tanggal_masuk'] ?? null,
            'status' => $validated['status'] ?? 'aktif',
        ]);
    }

    /** Ubah data user. $validated = hasil validate(rulesUbah($user)). */
    public static function perbarui(User $user, array $validated): User
    {
        $role = Role::findOrFail($validated['role_id']);
        if ($role->nama === 'cabang') {
            throw ValidationException::withMessages(['role_id' => 'Role cabang sudah tidak digunakan.']);
        }

        if (empty($validated['nik'])) {
            throw ValidationException::withMessages(['nik' => 'NIK karyawan wajib diisi.']);
        }

        // Nonaktifkan akun cuma boleh kalau user gak lagi punya pinjaman
        // inventory yang aktif (disetujui/pending & belum dikembalikan).
        $mauNonaktif = ($validated['status'] ?? $user->status) === 'nonaktif'
            && $user->status !== 'nonaktif';

        if ($mauNonaktif) {
            self::pastikanTanpaPinjamanAktif($user, 'menonaktifkan');
        }

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'role_id' => $validated['role_id'],
            'lokasi_kantor_id' => $validated['lokasi_kantor_id'] ?? null,
            'nik' => $validated['nik'],
            'departemen_id' => $validated['departemen_id'] ?? null,
            'perusahaan_id' => $validated['perusahaan_id'] ?? null,
            'tanggal_masuk' => $validated['tanggal_masuk'] ?? null,
            'status' => $validated['status'] ?? $user->status,
        ]);

        // Akun baru saja dinonaktifkan -- cabut semua token login-nya.
        if ($mauNonaktif) {
            $user->tokens()->delete();
        }

        return $user;
    }

    /**
     * Hapus user. Ditolak kalau masih punya pinjaman inventory aktif.
     * $kunciError = key error bag: 'status' (API, sama seperti dulu) atau 'delete' (web, tampil di modal konfirmasi hapus).
     */
    public static function hapus(User $user, string $kunciError = 'status'): void
    {
        self::pastikanTanpaPinjamanAktif($user, 'menghapus akun', $kunciError);

        $user->delete();
    }

    /** Admin menentukan sendiri password baru untuk user. */
    public static function ubahPassword(User $user, string $password): void
    {
        $user->update([
            'password' => Hash::make($password),
        ]);
    }

    /**
     * Lempar ValidationException kalau user masih punya pinjaman inventory aktif
     * (status disetujui/pending dan belum ada tanggal_pengembalian).
     * Default key `status` biar langsung muncul di field "Status Akun" di form edit.
     */
    private static function pastikanTanpaPinjamanAktif(User $user, string $aksi, string $kunciError = 'status'): void
    {
        $pinjaman = InventoryPemakai::with('inventory:id,kode_inventory')
            ->where('user_id', $user->id)
            ->whereIn('status', ['disetujui', 'pending'])
            ->whereNull('tanggal_pengembalian')
            ->get();

        if ($pinjaman->isEmpty()) {
            return;
        }

        $daftar = $pinjaman->map(fn ($p) => $p->inventory?->kode_inventory)
            ->filter()
            ->unique()
            ->implode(', ');

        $detail = $daftar !== '' ? " ($daftar)" : '';

        $pesan = "Karyawan masih punya {$pinjaman->count()} pinjaman inventory{$detail}. Selesaikan/kembalikan dulu sebelum {$aksi}.";

        throw ValidationException::withMessages([$kunciError => $pesan]);
    }
}
