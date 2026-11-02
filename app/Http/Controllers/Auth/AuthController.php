<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\ResolveLoginUser;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use App\Http\Requests\Auth\LoginAuthRequest;

class AuthController extends Controller
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
    public function login(LoginAuthRequest $request)
    {
        $user = ResolveLoginUser::run((string) $request->input('login'), (string) $request->input('password'));

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
