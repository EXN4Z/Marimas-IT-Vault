# Marimas IT Vault

Sistem manajemen inventory IT internal PT Marimas Putera Kencana.

## Stack

- Backend: Laravel (Inertia), PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind
- Realtime: Laravel Echo (Pusher), Web Push (VAPID)
- Deploy: Railway (Nixpacks)

## Modul

Master Data (perusahaan, cabang, departemen, kategori, supplier, karyawan/user, inventory),
Transaksi (pemakai, penanganan/perbaikan), Laporan, Dashboard, Notifikasi, Audit Log, Settings.

## Setup lokal

1. `composer install` dan `npm install`
2. Siapkan file `.env` (DB PostgreSQL, mail, VAPID, Pusher/Echo), lalu `php artisan key:generate`
3. `php artisan migrate --seed`
4. Jalankan `php artisan serve` dan `npm run dev`

## Build produksi

`npm run build`, lalu `php artisan migrate --force` (lihat `nixpacks.toml`).
