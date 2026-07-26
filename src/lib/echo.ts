import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const pusherKey = import.meta.env.VITE_PUSHER_KEY || import.meta.env.VITE_PUSHER_APP_KEY;

// @ts-ignore
if (pusherKey) window.Pusher = Pusher;

let _echo: any = null;
let _tokenAtInit: string | null = null;

// Token dulu dibaca sekali pas modul di-import (bisa null kalau Dashboard
// ke-load sebelum login selesai) lalu dipakai selamanya -> auth header
// jadi "Bearer null" permanen, /broadcasting/auth 401/500 terus walau udah
// login. Sekarang instance dibuat ulang tiap token di localStorage beda.
export function getEcho() {
  if (!pusherKey) return null;

  const token = localStorage.getItem('token');
  if (!token) return null;

  if (_echo && _tokenAtInit === token) return _echo;

  if (_echo) {
    _echo.disconnect();
  }

  _tokenAtInit = token;
  _echo = new Echo({
    broadcaster: 'pusher',
    key: pusherKey,
    cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    forceTLS: true,
    authEndpoint: `${import.meta.env.VITE_API_URL}/api/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return _echo;
}

export function disconnectEcho() {
  if (_echo) {
    _echo.disconnect();
    _echo = null;
    _tokenAtInit = null;
  }
}