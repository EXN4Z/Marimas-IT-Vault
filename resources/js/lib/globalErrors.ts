import { router } from '@inertiajs/react';
import toast from 'react-hot-toast';

// Peringatan global untuk SEMUA request Inertia yang gagal bukan karena validasi:
//  - 'httpException' : server balas non-Inertia (500, 419, 403, 404, dst). Tanpa ini Inertia menampilkan
//                      halaman HTML mentah di modal putih ("500 | Server Error").
//  - 'networkError'  : koneksi putus / server tidak terjangkau.
// Error validasi (422) tetap ditangani onError di masing-masing halaman.
// Error aslinya tetap tercatat di log server (Railway Logs).

let suppressed = 0;

// Dipakai untuk aksi yang sengaja mengabaikan error (mis. logout saat sesi sudah habis).
// Kembalikan fungsi untuk mengakhiri penekanan.
export function suppressGlobalErrorToast(): () => void {
  suppressed += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressed = Math.max(0, suppressed - 1);
  };
}

function messageForStatus(status?: number): string {
  if (status === 401) return 'Sesi Anda telah berakhir. Silakan login kembali.';
  if (status === 403) return 'Anda tidak memiliki akses untuk melakukan tindakan ini.';
  if (status === 404) return 'Halaman atau data yang diminta tidak ditemukan.';
  if (status === 419) return 'Sesi telah kedaluwarsa. Muat ulang halaman lalu coba lagi.';
  if (status === 422) return 'Data yang dikirim tidak valid. Periksa kembali isian Anda.';
  if (status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (status && status >= 500) return 'Terjadi kesalahan pada server. Coba lagi nanti.';
  return 'Permintaan gagal diproses. Coba lagi.';
}

let installed = false;

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  router.on('httpException', (event) => {
    event.preventDefault(); // cegah modal HTML mentah
    if (suppressed > 0) return;
    const status = (event.detail as { response?: { status?: number } }).response?.status;
    toast.error(messageForStatus(status), { id: 'http-error' });
  });

  router.on('networkError', (event) => {
    event.preventDefault();
    if (suppressed > 0) return;
    toast.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', { id: 'network-error' });
  });

  // Error dari server yang bukan milik field tertentu (kunci "server", lihat bootstrap/app.php).
  router.on('error', (event) => {
    const msg = (event.detail.errors as Record<string, string>).server;
    if (msg) toast.error(msg, { id: 'server-error' });
  });
}
