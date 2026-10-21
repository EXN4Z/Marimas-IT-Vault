<?php

namespace App\Actions\Profile;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Update profil user yang sedang login (nama, email, no HP).
 * Dipakai bareng oleh API (AuthController::updateProfile) dan web (SettingsController::updateProfile).
 * Gagal validasi -> ValidationException: API balas 422 JSON, web redirect back + errors (Inertia).
 */
class UpdateProfile
{
    public static function run(Request $request): User
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|unique:users,phone,' . $user->id,
        ]);

        $user->update($validated);

        return $user->fresh();
    }
}
