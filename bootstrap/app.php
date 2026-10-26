<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\EnsureUserIsMember;
use App\Http\Middleware\LogActivity;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'role' => EnsureUserIsMember::class,
        ]);

        $middleware->api(append: [
            LogActivity::class,
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
    })
    // Endpoint /broadcasting/auth (Pusher/Echo private channel) + definisi channel di routes/channels.php.
    // Auth lewat session (web + auth), bukan lagi Bearer token Sanctum.
    ->withBroadcasting(__DIR__.'/../routes/channels.php', ['middleware' => ['web', 'auth']])
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();