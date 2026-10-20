<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Notifikasi\NotificationController;
use App\Http\Controllers\Notifikasi\PushSubscriptionController;

// Di-require dari routes/web.php DI DALAM Route::middleware('auth')->group(...).

// [F9-INERTIA] Notifikasi (bell + kartu Dashboard) & push subscription: SENGAJA tetap JSON, bukan Inertia (pengecualian).
//  - GET /notifications dipoll klien tiap 5 detik; aksinya (tandai dibaca / hapus) optimistic dari state lokal dan
//    tidak mengubah props halaman manapun, jadi tidak perlu redirect + render ulang halaman aktif.
//  - /push-subscriptions dipanggil di background (izin browser, dan sebelum logout), bukan aksi halaman.
// Controller-nya SAMA dengan route /api lama (tidak ada logic ganda). LogActivity sengaja tidak dipasang: ini bukan
// perubahan data bisnis (dulu tercatat generik di audit log lewat grup 'api').
Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']); // statis di atas {id}
Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store']);
Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy']);
