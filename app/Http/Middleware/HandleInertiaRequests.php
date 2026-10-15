<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                // Bentuk SAMA dengan response GET /api/user (AuthController::user):
                // model User apa adanya ($hidden buang password, $appends bawa 'role').
                'user' => fn () => $request->user(),
            ],
            // [F4-INERTIA] Inertia::always: flash ikut di SETIAP response, termasuk partial reload (polling, pagination,
            // search). Tanpa ini, flash dari mutasi terakhir tetap menempel di props klien dan FlashToaster menampilkan
            // toast yang sama lagi di setiap partial reload berikutnya.
            'flash' => Inertia::always(fn () => [
                'success' => $request->hasSession() ? $request->session()->get('success') : null,
                'error' => $request->hasSession() ? $request->session()->get('error') : null,
            ]),
        ];
    }
}
