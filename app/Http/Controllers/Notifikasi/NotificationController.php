<?php

namespace App\Http\Controllers\Notifikasi;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class NotificationController extends Controller
{
    // GET /api/notifications
    public function index(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'data' => $user->notifications()->latest()->limit(20)->get(),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    // POST /api/notifications/{id}/read
    public function markAsRead(Request $request, $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    // POST /api/notifications/read-all
    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }
    public function destroy(Request $request, $id) {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->delete();

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }
}