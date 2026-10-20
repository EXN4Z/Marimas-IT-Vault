<?php

namespace App\Actions\Auth;

use App\Mail\OtpMail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Kirim ulang OTP registrasi (dipindah apa adanya dari AuthController::resendOtp).
 * Dipakai bareng oleh API (AuthController::resendOtp) dan web (AuthController::resendOtp).
 */
class ResendRegistrationOtp
{
    public static function run(string $registrationId): void
    {
        $data = Cache::get("register:{$registrationId}");

        if (!$data) {
            throw ValidationException::withMessages([
                'registration_id' => ['Sesi registrasi kedaluwarsa, silakan daftar ulang.'],
            ]);
        }

        $otp = rand(100000, 999999);
        $data['otp_code'] = $otp;

        Cache::put("register:{$registrationId}", $data, now()->addMinutes(5));

        Mail::to($data['email'])->send(new OtpMail($otp));
    }
}
