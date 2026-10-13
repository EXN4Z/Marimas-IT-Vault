<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;

use App\Actions\Profile\UpdatePassword;
use App\Actions\Auth\ResolveLoginUser;
use App\Actions\Auth\VerifyRegistrationOtp;
use App\Actions\Profile\UpdateProfile;
use App\Mail\OtpMail;
use App\Models\User;
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

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'registration_id' => 'required|string',
            'otp_code' => 'required|string',
        ]);

        // Cek OTP + bikin user ada di App\Actions\Auth\VerifyRegistrationOtp (dipakai juga verify-otp web).
        $user = VerifyRegistrationOtp::run($request->registration_id, $request->otp_code);

        $token = $user->createToken('auth-token')->plainTextToken;

        $this->startWebSession($request, $user);

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function resendOtp(Request $request)
    {
        $request->validate([
            'registration_id' => 'required|string',
        ]);

        $data = Cache::get("register:{$request->registration_id}");

        if (!$data) {
            throw ValidationException::withMessages([
                'registration_id' => ['Sesi registrasi kedaluwarsa, silakan daftar ulang.'],
            ]);
        }

        $otp = rand(100000, 999999);
        $data['otp_code'] = $otp;

        Cache::put("register:{$request->registration_id}", $data, now()->addMinutes(5));

        $this->sendOtpEmail($data['email'], $otp);

        return response()->json(['message' => 'Kode OTP baru sudah dikirim']);
    }

    private function sendOtpEmail(string $email, int $otp): void
    {
        Mail::to($email)->send(new OtpMail($otp));
    }

    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required',
        ]);

        // Logika kandidat login (email/no HP/nama + cek password) ada di App\Actions\Auth\ResolveLoginUser (dipakai juga login web).
        $user = ResolveLoginUser::run((string) $request->login, (string) $request->password);

        $token = $user->createToken('auth-token')->plainTextToken;

        $this->startWebSession($request, $user);

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
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
        $user = $request->user();

        // Kalau request-nya autentikasi lewat cookie sesi, currentAccessToken()
        // itu TransientToken (gak punya delete()), makanya dicek dulu.
        $currentToken = $user->currentAccessToken();
        if ($currentToken && method_exists($currentToken, 'delete')) {
            $currentToken->delete();
        }

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Bikin sesi cookie (guard web) di samping token Sanctum, supaya halaman
     * Inertia (route web + middleware 'auth') ikut kenal user yang login.
     * Token tetap dikirim buat SPA lama. Cuma jalan kalau request stateful
     * (same-origin, domain ada di SANCTUM_STATEFUL_DOMAINS).
     */
    private function startWebSession(Request $request, User $user): void
    {
        if (!$request->hasSession()) {
            return;
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
    }
}
