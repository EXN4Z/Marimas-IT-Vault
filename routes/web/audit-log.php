<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuditLog\AuditLogPageController;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

// Audit Log (admin-only)
Route::get('/audit-log', AuditLogPageController::class)->middleware('role:admin');
