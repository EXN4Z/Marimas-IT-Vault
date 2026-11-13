<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuditLog\AuditLogPageController;
use App\Http\Controllers\AuditLog\AuditLogRestoreController;
use App\Http\Middleware\LogActivity;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

// Audit Log (admin-only)
Route::get('/audit-log', AuditLogPageController::class)->middleware('role:admin');

// Pulihkan data yang terhapus (soft delete) dari entri Audit Log. LogActivity dipasang manual, sama seperti route mutasi lain.
Route::post('/audit-log/{id}/pulihkan', AuditLogRestoreController::class)
    ->whereNumber('id')
    ->middleware(['role:admin', LogActivity::class]);
