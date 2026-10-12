// Daftar path yang SUDAH dimigrasi ke Inertia. Dipakai useAppNavigate untuk memutuskan
// apakah pindah halaman cukup client-side atau harus full page load (karena SPA lama
// dan app Inertia adalah dua aplikasi JS yang berbeda).
//
// Tambahkan path di sini setiap kali satu menu selesai dimigrasi (langkah 4 di template),
// dan hapus path-nya dari react-router (App.tsx) di langkah 5.
export const INERTIA_PATHS: string[] = [
  // contoh nanti: '/audit-log', '/settings'
];

// Cocok kalau path sama persis, atau berada di bawahnya (mis. '/karyawan' juga cocok '/karyawan/3/edit').
export function isInertiaPath(path: string): boolean {
  const clean = (path.split(/[?#]/)[0].replace(/\/+$/, '')) || '/';
  return INERTIA_PATHS.some((p) => clean === p || clean.startsWith(p + '/'));
}
