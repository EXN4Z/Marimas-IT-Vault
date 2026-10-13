<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\ResolveLoginUser;
use App\Actions\Auth\VerifyRegistrationOtp;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class WebAuthController extends Controller
{
    // true = login web pakai cookie "remember" (panjang umur), jadi user tidak kena logout cuma
    // karena SESSION_LIFETIME habis -- mirip token lama yang tidak pernah kedaluwarsa.
    // Ubah ke false kalau mau murni session (logout otomatis setelah idle SESSION_LIFETIME menit).
    private const REMEMBER = true;

    // GET /login
    public function showLogin()
    {
        if (Auth::check()) {
            return redirect('/dashboard');
        }

        return Inertia::render('Auth/Login');
    }

    // POST /login   (error validasi -> props errors.login, halaman Login yang menampilkan)
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required',
        ]);

        $user = ResolveLoginUser::run((string) $request->input('login'), (string) $request->input('password'));

        Auth::guard('web')->login($user, self::REMEMBER);
        $request->session()->regenerate();

        return $this->toIntended();
    }

    // GET /verify-otp?registration_id=...   (tidak ada registration_id -> balik ke /login; belum ada halaman register)
    public function showVerifyOtp(Request $request)
    {
        $registrationId = (string) $request->query('registration_id', '');

        if ($registrationId === '') {
            return redirect('/login');
        }

        return Inertia::render('Auth/VerifyOtp', ['registrationId' => $registrationId]);
    }

    // POST /verify-otp
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'registration_id' => 'required|string',
            'otp_code' => 'required|string',
        ]);

        $user = VerifyRegistrationOtp::run($request->input('registration_id'), $request->input('otp_code'));

        Auth::guard('web')->login($user, self::REMEMBER);
        $request->session()->regenerate();

        return $this->toIntended();
    }

    // POST /logout
    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Inertia::location('/login');
    }

    // Setelah login: full page load ke tujuan semula (intended) atau /dashboard, supaya state SPA
    // (AuthProvider, koneksi Echo, cache react-query) mulai bersih dengan user yang baru.
    private function toIntended()
    {
        return Inertia::location(redirect()->intended('/dashboard')->getTargetUrl());
    }
}
