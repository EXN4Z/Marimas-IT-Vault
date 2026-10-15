import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import api from '../api/axios';

const pusherKey = import.meta.env.VITE_PUSHER_KEY || import.meta.env.VITE_PUSHER_APP_KEY;

// @ts-ignore
if (pusherKey) window.Pusher = Pusher;

let _echo: any = null;

// Autentikasi channel private lewat session cookie: POST /broadcasting/auth (route web, middleware
// web+auth, lihat withBroadcasting di bootstrap/app.php) dikirim pakai instance axios aplikasi
// (same-origin, cookie + XSRF otomatis). baseURL di-override ke '/' karena instance ini default-nya /api.
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
        api
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name }, { baseURL: '/' })
          .then((response) => callback(false, response.data))
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
