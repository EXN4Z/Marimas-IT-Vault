<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;

use App\Actions\Auth\ResendRegistrationOtp;
use App\Actions\Profile\UpdatePassword;
use App\Actions\Profile\UpdateProfile;
use App\Mail\OtpMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Mail\NewPasswordMail;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|unique:users,phone',
            'password' => 'required|min:6|confirmed',
        ]);

        $otp = rand(100000, 999999);
        $registrationId = Str::uuid()->toString();

        Cache::put("register:{$registrationId}", [
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'otp_code' => $otp,
        ], now()->addMinutes(5));

        $this->sendOtpEmail($request->email, $otp);

        return response()->json([
            'message' => 'Kode OTP sudah dikirim ke email kamu',
            'registration_id' => $registrationId,
        ], 200);
    }

    public function resendOtp(Request $request)
    {
        $request->validate([
            'registration_id' => 'required|string',
        ]);

        // Logic ada di App\Actions\Auth\ResendRegistrationOtp (dipakai juga WebAuthController::resendOtp).
        ResendRegistrationOtp::run((string) $request->registration_id);

        return response()->json(['message' => 'Kode OTP baru sudah dikirim']);
    }

    private function sendOtpEmail(string $email, int $otp): void
    {
        Mail::to($email)->send(new OtpMail($otp));
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        // Validasi + update ada di App\Actions\Profile\UpdateProfile (dipakai juga SettingsController web).
        return response()->json(UpdateProfile::run($request));
    }

    public function updatePassword(Request $request)
    {
        // Validasi + ganti password ada di App\Actions\Profile\UpdatePassword.
        UpdatePassword::run($request);

        return response()->json([
            'message' => 'Password berhasil diperbarui.',
        ]);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out']);
    }
}
