<?php

namespace App\Http\Controllers\Notifikasi;

use Illuminate\Http\Request;
use NotificationChannels\WebPush\PushSubscription;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifikasi\StorePushSubscriptionRequest;
use App\Http\Requests\Notifikasi\DestroyPushSubscriptionRequest;

class PushSubscriptionController extends Controller
{
    // simpan/update subscription push browser milik user yang login
    public function store(StorePushSubscriptionRequest $request)
    {
        $validated = $request->validated();

        // Endpoint = device/browser, bukan sesi login. Kalau device ini
        // sebelumnya subscribe pake akun lain (device sharing, lupa
        // unsubscribe), kolom endpoint unique global bikin insert user
        // sekarang gagal (500). Reassign ke user sekarang dulu.
        PushSubscription::where('endpoint', $validated['endpoint'])
            ->where(function ($q) use ($request) {
                $q->where('subscribable_type', '!=', get_class($request->user()))
                  ->orWhere('subscribable_id', '!=', $request->user()->id);
            })
            ->delete();

        $request->user()->updatePushSubscription(
            $validated['endpoint'],
            $validated['keys']['p256dh'],
            $validated['keys']['auth']
        );

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    // browser matiin izin notif / user logout dari device ini -> hapus subscription-nya aja
    public function destroy(DestroyPushSubscriptionRequest $request)
    {
        $validated = $request->validated();

        $request->user()->deletePushSubscription($validated['endpoint']);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }
}