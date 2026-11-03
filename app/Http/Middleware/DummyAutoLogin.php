<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

// DUMMY-AUTOLOGIN (sementara) -- hapus dengan: node scripts/dummy-autologin.mjs --revert
// Belum login -> otomatis login sebagai admin pertama (fallback: user pertama).
class DummyAutoLogin
{
    public function handle(Request $request, Closure $next): Response
    {
        $aktif = !app()->isProduction() || filter_var(env('DUMMY_AUTOLOGIN'), FILTER_VALIDATE_BOOLEAN);

        if ($aktif && !Auth::check()) {
            $user = User::where('role', 'admin')->orderBy('id')->first() ?? User::orderBy('id')->first();
            if ($user) {
                Auth::login($user);
            }
        }

        return $next($request);
    }
}
