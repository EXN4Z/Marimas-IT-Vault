#!/usr/bin/env node
/**
 * dummy-autologin.mjs
 *
 * SEMENTARA: lewati halaman login. Setiap request yang belum login otomatis di-login sebagai admin
 * pertama di tabel users, jadi buka URL langsung masuk /dashboard. Middleware 'auth', role, shared props
 * (auth.user), dan broadcasting tetap jalan normal karena user-nya benar-benar login lewat session.
 *
 * Yang diubah:
 *   - BARU  app/Http/Middleware/DummyAutoLogin.php
 *   - UBAH  bootstrap/app.php  (daftarkan middleware di grup web, sebelum HandleInertiaRequests)
 *
 * Pengaman: tidak aktif kalau APP_ENV=production, kecuali .env berisi DUMMY_AUTOLOGIN=true
 * (dibaca lewat env(), jadi tidak berlaku kalau config sudah di-cache: php artisan config:clear).
 *
 * Pemakaian (dari root project):
 *   node scripts/dummy-autologin.mjs             # terapkan
 *   node scripts/dummy-autologin.mjs --dry-run   # cek saja
 *   node scripts/dummy-autologin.mjs --revert    # kembalikan
 *
 * Backup: .migrasi-backup/dummy-autologin/app.php. Idempotent.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REVERT = args.includes('--revert');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const BOOT = path.join(ROOT, 'bootstrap', 'app.php');
const MW = path.join(ROOT, 'app', 'Http', 'Middleware', 'DummyAutoLogin.php');
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', 'dummy-autologin');
const BACKUP = path.join(BACKUP_DIR, 'app.php');
const MARKER = 'DUMMY-AUTOLOGIN';

const exists = (p) => fs.access(p).then(() => true, () => false);

const OLD = `        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);`;

const NEW = `        $middleware->web(append: [
            \\App\\Http\\Middleware\\DummyAutoLogin::class, // ${MARKER}
            HandleInertiaRequests::class,
        ]);`;

const MIDDLEWARE = String.raw`<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

// ${MARKER} (sementara) -- hapus dengan: node scripts/dummy-autologin.mjs --revert
// Belum login -> otomatis login sebagai admin pertama (fallback: user pertama).
class DummyAutoLogin
{
    public function handle(Request $request, Closure $next): Response
    {
        $aktif = !app()->isProduction() || filter_var(env('DUMMY_AUTOLOGIN'), FILTER_VALIDATE_BOOLEAN);

        if ($aktif && !Auth::check()) {
            $user = User::where('role', 'admin')->orderBy('id')->first() ?? User::orderBy('id')->first();
            if ($user) {
                Auth::login($user);
            }
        }

        return $next($request);
    }
}
`;

async function main() {
  if (REVERT) {
    if (!(await exists(BACKUP))) return console.log('Tidak ada backup untuk dikembalikan.');
    if (DRY) return console.log('[dry-run] akan mengembalikan bootstrap/app.php & menghapus DummyAutoLogin.php.');
    await fs.copyFile(BACKUP, BOOT);
    await fs.rm(MW, { force: true });
    await fs.rm(BACKUP_DIR, { recursive: true, force: true });
    return console.log('Dikembalikan: bootstrap/app.php, DummyAutoLogin.php dihapus. Login normal lagi.');
  }

  const src = await fs.readFile(BOOT, 'utf8');
  if (src.includes(MARKER)) return console.log('Sudah diterapkan, tidak ada yang diubah.');
  if (!src.includes(OLD)) return console.log('GAGAL: blok $middleware->web(append: ...) tidak cocok, file tidak diubah.');
  if (DRY) return console.log('[dry-run] bisa diterapkan.');

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.copyFile(BOOT, BACKUP);
  await fs.writeFile(BOOT, src.replace(OLD, NEW));
  await fs.writeFile(MW, MIDDLEWARE);
  console.log('Selesai. Buka URL langsung masuk dashboard. Kalau tidak berubah: php artisan config:clear');
  console.log('Revert: node scripts/dummy-autologin.mjs --revert');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
