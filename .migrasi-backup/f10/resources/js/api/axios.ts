import axios from 'axios';
import { router } from '@inertiajs/react';

// Autentikasi 100% session cookie (same-origin): cookie + header X-XSRF-TOKEN dikirim otomatis
// oleh axios. Tidak ada lagi header Bearer / token di localStorage.
// Syarat di server: host yang dipakai harus ada di SANCTUM_STATEFUL_DOMAINS, kalau tidak
// request /api dianggap tidak stateful dan auth:sanctum membalas 401.
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api' : '/api'),
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
  },
});

// Sesi habis / tidak valid (401) di request MANAPUN -> balik ke halaman login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      router.visit('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
