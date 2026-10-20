<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Cek OTP registrasi lalu bikin user-nya (dipindah apa adanya dari AuthController::verifyOtp).
 * Dipakai bareng oleh API (AuthController::verifyOtp) dan web (AuthController::verifyOtp).
 */
class VerifyRegistrationOtp
{
    public static function run(string $registrationId, string $otpCode): User
    {
        $data = Cache::get("register:{$registrationId}");

        if (!$data) {
            throw ValidationException::withMessages([
                'otp_code' => ['Sesi registrasi kedaluwarsa, silakan daftar ulang.'],
            ]);
        }

        if ((string) $data['otp_code'] !== (string) $otpCode) {
            throw ValidationException::withMessages([
                'otp_code' => ['Kode OTP salah.'],
            ]);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'password' => $data['password'],
            'role' => 'user',
            'phone_verified_at' => now(),
        ]);

        Cache::forget("register:{$registrationId}");

        return $user;
    }
}
