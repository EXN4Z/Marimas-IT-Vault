<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Settings\SettingsController;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

// Settings (semua role yang login)
Route::get('/settings', [SettingsController::class, 'index']);
Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
Route::put('/settings/password', [SettingsController::class, 'updatePassword']);
