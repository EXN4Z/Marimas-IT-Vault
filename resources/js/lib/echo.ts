import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { requestJson } from './http';

const pusherKey = import.meta.env.VITE_PUSHER_KEY || import.meta.env.VITE_PUSHER_APP_KEY;

// @ts-ignore
if (pusherKey) window.Pusher = Pusher;

let _echo: any = null;

// Autentikasi channel private lewat session cookie: POST /broadcasting/auth (route web, middleware
// web+auth, lihat withBroadcasting di bootstrap/app.php) dikirim lewat requestJson (lib/http.ts: same-origin,
// cookie + header X-XSRF-TOKEN otomatis).
// Instance dibuat sekali; waktu user ganti/logout halaman di-reload penuh (atau disconnectEcho()).
export function getEcho() {
  if (!pusherKey) return null;
  if (_echo) return _echo;

  _echo = new Echo({
    broadcaster: 'pusher',
    key: pusherKey,
    cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    forceTLS: true,
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (error: boolean, data: any) => void) => {
        requestJson('POST', '/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then((data) => callback(false, data))
          .catch((error) => callback(true, error));
      },
    }),
  } as any);

  return _echo;
}

export function disconnectEcho() {
  if (_echo) {
    _echo.disconnect();
    _echo = null;
  }
}
