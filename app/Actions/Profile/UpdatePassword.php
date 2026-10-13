<?php

namespace App\Actions\Profile;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Ganti password user yang sedang login.
 * Dipakai bareng oleh API (AuthController::updatePassword) dan web (SettingsController::updatePassword).
 */
class UpdatePassword
{
    public static function run(Request $request): void
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|confirmed',
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Password saat ini tidak sesuai.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);
    }
}
