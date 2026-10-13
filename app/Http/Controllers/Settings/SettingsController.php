<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Profile\UpdatePassword;
use App\Actions\Profile\UpdateProfile;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SettingsController extends Controller
{
    // GET /settings — data user sudah ada di shared props (auth.user)
    public function index()
    {
        return Inertia::render('Settings/Index');
    }

    // PUT /settings/profile
    public function updateProfile(Request $request)
    {
        UpdateProfile::run($request);

        // auth.user di shared props otomatis ikut ter-update di response berikutnya
        return back()->with('success', 'Profil berhasil diperbarui.');
    }

    // PUT /settings/password
    public function updatePassword(Request $request)
    {
        UpdatePassword::run($request);

        return back()->with('success', 'Password berhasil diperbarui.');
    }
}
