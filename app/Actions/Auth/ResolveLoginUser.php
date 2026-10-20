<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Cari user dari kredensial login (email / no HP / nama + password).
 * Dipakai bareng oleh API (AuthController::login) dan web (AuthController::login).
 */
class ResolveLoginUser
{
    public static function run(string $login, string $password): User
    {
        // Login bisa pakai email, no HP, ATAU nama. Nama tidak unik di tabel users, jadi kalau ada
        // beberapa akun dengan nama yang sama, cek password ke SEMUA kandidat -- biar tetap masuk ke
        // akun yang password-nya cocok, bukan cuma ambil satu secara acak.
        $candidates = User::where('email', $login)
            ->orWhere('phone', $login)
            ->orWhere('name', $login)
            ->get();

        $user = $candidates->first(
            fn (User $candidate) => Hash::check($password, $candidate->password)
        );

        if (!$user) {
            throw ValidationException::withMessages([
                'login' => ['Email/No HP/Nama atau password salah.'],
            ]);
        }

        return $user;
    }
}
