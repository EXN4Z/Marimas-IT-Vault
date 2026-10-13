#!/usr/bin/env node
// P13 -- Login + VerifyOtp jadi halaman Inertia, auth jadi SESSION penuh (tanpa token Bearer).
//
// Taruh di <root>\scripts\p13.mjs, lalu jalankan dari ROOT project (folder yang ada artisan + package.json):
//   git status                          # pastikan P12b sudah di-commit
//   node .\scripts\p13.mjs --dry-run    # cuma tampilkan rencana
//   node .\scripts\p13.mjs              # terapkan
//
// All-or-nothing: semua anchor dicek di memori dulu. Ada satu yang tidak cocok -> berhenti, tidak ada file berubah.

import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const root = process.cwd();

// ───────────────────────── helpers ─────────────────────────
const abs = (rel) => path.join(root, ...rel.split('/'));
const exists = (rel) => fs.existsSync(abs(rel));

function fail(msg) {
  console.error('\nX GAGAL: ' + msg);
  console.error('  Tidak ada file yang diubah.');
  process.exit(1);
}

function read(rel) {
  if (!exists(rel)) fail('File tidak ditemukan: ' + rel + ' (jalankan dari root project?)');
  let raw = fs.readFileSync(abs(rel), 'utf8');
  const bom = raw.startsWith('\uFEFF');
  if (bom) raw = raw.slice(1);
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { text: raw.replace(/\r\n/g, '\n'), eol, bom };
}

// sub(text, pola, pengganti, label, jumlahYangDiharapkan)
function sub(text, pattern, replacement, label, expected = 1) {
  let count;
  if (typeof pattern === 'string') {
    count = text.split(pattern).length - 1;
  } else {
    const g = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    count = (text.match(g) || []).length;
    pattern = g;
  }
  if (count !== expected) fail(`${label}: ketemu ${count}x, seharusnya ${expected}x`);
  if (typeof pattern === 'string') {
    return text.split(pattern).join(typeof replacement === 'function' ? replacement(pattern) : replacement);
  }
  return text.replace(pattern, replacement);
}

const ops = [];
const planned = new Map();

function edit(rel, fn) {
  const cur = planned.get(rel) ?? read(rel);
  planned.set(rel, { ...cur, text: fn(cur.text) });
}
function create(rel, text) {
  if (exists(rel)) fail('File sudah ada (migrasi sudah pernah dijalankan?): ' + rel);
  planned.set(rel, { text, eol: '\n', bom: false, isNew: true });
}
const del = (rel) => ops.push({ kind: 'delete', rel });

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const relOf = (f) => path.relative(root, f).split(path.sep).join('/');

// ───────────────────────── preflight ─────────────────────────
if (!exists('artisan') || !exists('package.json')) fail('Jalankan dari root project (harus ada artisan & package.json).');
if (!exists('resources/js/inertia/pages/Karyawan/Create.tsx')) fail('P12b belum diterapkan (inertia/pages/Karyawan tidak ada). Urutan: P12b dulu, baru P13.');
if (exists('app/Http/Controllers/Auth/WebAuthController.php') || exists('resources/js/inertia/pages/Auth/Login.tsx')) {
  fail('Tampaknya P13 sudah pernah diterapkan (WebAuthController / inertia/pages/Auth sudah ada).');
}

// ───────────────────────── 1. Backend: Action bersama (API + web) ─────────────────────────
create(
  'app/Actions/Auth/ResolveLoginUser.php',
  String.raw`<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Cari user dari kredensial login (email / no HP / nama + password).
 * Dipakai bareng oleh API (AuthController::login) dan web (WebAuthController::login).
 */
class ResolveLoginUser
{
    public static function run(string $login, string $password): User
    {
        // Login bisa pakai email, no HP, ATAU nama. Nama tidak unik di tabel users, jadi kalau ada
        // beberapa akun dengan nama yang sama, cek password ke SEMUA kandidat -- biar tetap masuk ke
        // akun yang password-nya cocok, bukan cuma ambil satu secara acak.
        $candidates = User::where('email', $login)
            ->orWhere('phone', $login)
            ->orWhere('name', $login)
            ->get();

        $user = $candidates->first(
            fn (User $candidate) => Hash::check($password, $candidate->password)
        );

        if (!$user) {
            throw ValidationException::withMessages([
                'login' => ['Email/No HP/Nama atau password salah.'],
            ]);
        }

        return $user;
    }
}
`,
);

create(
  'app/Actions/Auth/VerifyRegistrationOtp.php',
  String.raw`<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Cek OTP registrasi lalu bikin user-nya (dipindah apa adanya dari AuthController::verifyOtp).
 * Dipakai bareng oleh API (AuthController::verifyOtp) dan web (WebAuthController::verifyOtp).
 */
class VerifyRegistrationOtp
{
    public static function run(string $registrationId, string $otpCode): User
    {
        $data = Cache::get("register:{$registrationId}");

        if (!$data) {
            throw ValidationException::withMessages([
                'otp_code' => ['Sesi registrasi kedaluwarsa, silakan daftar ulang.'],
            ]);
        }

        if ((string) $data['otp_code'] !== (string) $otpCode) {
            throw ValidationException::withMessages([
                'otp_code' => ['Kode OTP salah.'],
            ]);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'password' => $data['password'],
            'role' => 'user',
            'phone_verified_at' => now(),
        ]);

        Cache::forget("register:{$registrationId}");

        return $user;
    }
}
`,
);

// AuthController (API) pakai Action yang sama; perilaku API tidak berubah.
edit('app/Http/Controllers/Auth/AuthController.php', (t) => {
  t = sub(
    t,
    String.raw`use App\Actions\Profile\UpdateProfile;` + '\n',
    String.raw`use App\Actions\Auth\ResolveLoginUser;` + '\n' +
      String.raw`use App\Actions\Auth\VerifyRegistrationOtp;` + '\n' +
      String.raw`use App\Actions\Profile\UpdateProfile;` + '\n',
    'AuthController: use Actions',
  );

  // verifyOtp: cek OTP + bikin user -> Action
  t = sub(
    t,
    /(    public function verifyOtp\(Request \$request\)\n    \{\n        \$request->validate\(\[[\s\S]*?\]\);\n\n)[\s\S]*?(        \$token = \$user->createToken\('auth-token'\)->plainTextToken;\n\n        \$this->startWebSession\(\$request, \$user\);\n\n        return response\(\)->json\(\[\n            'user' => \$user,\n            'token' => \$token,\n        \]\);\n    \}\n\n    public function resendOtp)/,
    (_m, head, tail) =>
      head +
      '        // Cek OTP + bikin user ada di App\\Actions\\Auth\\VerifyRegistrationOtp (dipakai juga verify-otp web).\n' +
      '        $user = VerifyRegistrationOtp::run($request->registration_id, $request->otp_code);\n\n' +
      tail,
    'AuthController: verifyOtp',
  );

  // login: logika kandidat (email/no HP/nama + Hash::check) -> Action
  t = sub(
    t,
    /        \/\/ BARU: login sekarang bisa pakai email[\s\S]*?                'login' => \['Email\/No HP\/Nama atau password salah\.'\],\n            \]\);\n        \}\n\n/,
    '        // Logika kandidat login (email/no HP/nama + cek password) ada di App\\Actions\\Auth\\ResolveLoginUser (dipakai juga login web).\n' +
      '        $user = ResolveLoginUser::run((string) $request->login, (string) $request->password);\n\n',
    'AuthController: login',
  );
  return t;
});

// ───────────────────────── 2. Backend: controller web ─────────────────────────
create(
  'app/Http/Controllers/Auth/WebAuthController.php',
  String.raw`<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\ResolveLoginUser;
use App\Actions\Auth\VerifyRegistrationOtp;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class WebAuthController extends Controller
{
    // true = login web pakai cookie "remember" (panjang umur), jadi user tidak kena logout cuma
    // karena SESSION_LIFETIME habis -- mirip token lama yang tidak pernah kedaluwarsa.
    // Ubah ke false kalau mau murni session (logout otomatis setelah idle SESSION_LIFETIME menit).
    private const REMEMBER = true;

    // GET /login
    public function showLogin()
    {
        if (Auth::check()) {
            return redirect('/dashboard');
        }

        return Inertia::render('Auth/Login');
    }

    // POST /login   (error validasi -> props errors.login, halaman Login yang menampilkan)
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required',
        ]);

        $user = ResolveLoginUser::run((string) $request->input('login'), (string) $request->input('password'));

        Auth::guard('web')->login($user, self::REMEMBER);
        $request->session()->regenerate();

        return $this->toIntended();
    }

    // GET /verify-otp?registration_id=...   (tidak ada registration_id -> balik ke /login; belum ada halaman register)
    public function showVerifyOtp(Request $request)
    {
        $registrationId = (string) $request->query('registration_id', '');

        if ($registrationId === '') {
            return redirect('/login');
        }

        return Inertia::render('Auth/VerifyOtp', ['registrationId' => $registrationId]);
    }

    // POST /verify-otp
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'registration_id' => 'required|string',
            'otp_code' => 'required|string',
        ]);

        $user = VerifyRegistrationOtp::run($request->input('registration_id'), $request->input('otp_code'));

        Auth::guard('web')->login($user, self::REMEMBER);
        $request->session()->regenerate();

        return $this->toIntended();
    }

    // POST /logout
    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Inertia::location('/login');
    }

    // Setelah login: full page load ke tujuan semula (intended) atau /dashboard, supaya state SPA
    // (AuthProvider, koneksi Echo, cache react-query) mulai bersih dengan user yang baru.
    private function toIntended()
    {
        return Inertia::location(redirect()->intended('/dashboard')->getTargetUrl());
    }
}
`,
);

edit('routes/web.php', (t) => {
  t = sub(
    t,
    'use Illuminate\\Support\\Facades\\Route;\n',
    'use Illuminate\\Support\\Facades\\Route;\nuse App\\Http\\Controllers\\Auth\\WebAuthController;\n',
    'web.php: use WebAuthController',
  );
  t = sub(
    t,
    "// Tujuan redirect middleware 'auth' kalau belum login (halaman login tetap SPA lama).\nRoute::get('/login', fn () => view('spa'))->name('login');\n",
    `// Login & verifikasi OTP: halaman Inertia, auth session penuh. Nama 'login' = tujuan redirect middleware 'auth'.
Route::get('/login', [WebAuthController::class, 'showLogin'])->name('login');
Route::post('/login', [WebAuthController::class, 'login']);
Route::get('/verify-otp', [WebAuthController::class, 'showVerifyOtp']);
Route::post('/verify-otp', [WebAuthController::class, 'verifyOtp']);
Route::redirect('/', '/dashboard'); // belum login -> middleware 'auth' di /dashboard melempar ke /login
`,
    'web.php: route login/verify-otp',
  );
  t = sub(
    t,
    "Route::middleware('auth')->group(function () {\n",
    "Route::middleware('auth')->group(function () {\n    Route::post('/logout', [WebAuthController::class, 'logout']);\n\n",
    'web.php: route logout',
  );
  return t;
});

// ───────────────────────── 3. Frontend: halaman Inertia dari file lama ─────────────────────────
{
  // Login
  let { text: t } = read('resources/js/pages/auth/Login.tsx');
  t = sub(
    t,
    /^[\s\S]*?(?=  return \(\n    <div className="min-h-screen flex bg-slate-50 dark:bg-\[#121214\] text-slate-900)/,
    `import { useEffect, useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import {
  User,
  Lock,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isDark, setTheme } = useTheme();

  // Autentikasi sekarang 100% session cookie. Buang sisa token Bearer / user dari login model lama.
  useEffect(() => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      /* storage diblokir -> abaikan */
    }
  }, []);

  // POST /login (WebAuthController). Sukses -> server membalas full redirect ke dashboard/intended.
  // Gagal -> props errors.login dari server.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    router.post(
      '/login',
      { login: loginId, password },
      {
        onStart: () => setLoading(true),
        onError: (errors) => setError(errors.login || errors.password || 'Email/No HP/Nama atau password salah'),
        onFinish: () => setLoading(false),
      },
    );
  };

`,
    'Login: bagian atas (imports + logic)',
  );
  t = t.replace(/\s*$/, '\n') + '\n// Halaman tanpa sidebar/header: matikan persistent layout default (lihat inertia-app.tsx).\nLogin.layout = (page: ReactNode) => page;\n';
  const bad = t.match(/useAuth|useLocation|react-router|useAppNavigate|Skeleton|toast\(|dashboard_redirect_at|localStorage\.setItem/g);
  if (bad) fail('Login: sisa kode SPA lama: ' + [...new Set(bad)].join(', '));
  create('resources/js/inertia/pages/Auth/Login.tsx', t);
  del('resources/js/pages/auth/Login.tsx');
}

{
  // VerifyOtp
  let { text: t } = read('resources/js/pages/auth/VerifyOtp.tsx');
  t = sub(
    t,
    /^[\s\S]*?(?=  return \(\n    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">)/,
    `import { useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { resendOtp } from '../../../api/auth';

// registrationId dikirim controller (GET /verify-otp?registration_id=...).
export default function VerifyOtp({ registrationId }: { registrationId: string }) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  // POST /verify-otp (WebAuthController). Sukses -> server membalas full redirect ke dashboard.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    router.post(
      '/verify-otp',
      { registration_id: registrationId, otp_code: otp },
      {
        onStart: () => setLoading(true),
        onError: (errors) =>
          setError(errors.otp_code || errors.registration_id || 'Kode OTP salah atau kedaluwarsa'),
        onFinish: () => setLoading(false),
      },
    );
  };

  const handleResend = async () => {
    setResendMsg('');
    try {
      await resendOtp(registrationId);
      setResendMsg('Kode OTP baru sudah dikirim ke email kamu');
    } catch {
      setResendMsg('Gagal mengirim ulang OTP');
    }
  };

`,
    'VerifyOtp: bagian atas',
  );
  t = t.replace(/\s*$/, '\n') + '\n// Halaman tanpa sidebar/header: matikan persistent layout default (lihat inertia-app.tsx).\nVerifyOtp.layout = (page: ReactNode) => page;\n';
  const bad = t.match(/useAuth|useLocation|react-router|useAppNavigate|localStorage/g);
  if (bad) fail('VerifyOtp: sisa kode SPA lama: ' + [...new Set(bad)].join(', '));
  create('resources/js/inertia/pages/Auth/VerifyOtp.tsx', t);
  del('resources/js/pages/auth/VerifyOtp.tsx');
}

// ───────────────────────── 4. Echo: autentikasi channel lewat session, bukan token ─────────────────────────
// Tanpa ini realtime (notifikasi dashboard) mati diam-diam: getEcho() lama return null kalau tidak ada token di localStorage.
edit('resources/js/lib/echo.ts', () => `import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import api from '../api/axios';

const pusherKey = import.meta.env.VITE_PUSHER_KEY || import.meta.env.VITE_PUSHER_APP_KEY;

// @ts-ignore
if (pusherKey) window.Pusher = Pusher;

let _echo: any = null;

// Autentikasi channel private lewat session cookie: request ke /api/broadcasting/auth dikirim pakai
// instance axios aplikasi (same-origin, cookie + XSRF otomatis), BUKAN header Bearer token.
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
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
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
`);

// ───────────────────────── 5. SPA lama: sudah tidak punya route sama sekali ─────────────────────────
edit('resources/js/lib/inertiaRoutes.ts', (t) =>
  sub(t, "  '/penanganan-inventory',\n", "  '/penanganan-inventory',\n  '/login',\n  '/verify-otp',\n", 'inertiaRoutes: tambah /login, /verify-otp'),
);

edit('resources/js/App.tsx', () => `// Semua halaman (termasuk Login & VerifyOtp) sudah Inertia. Tidak ada lagi route react-router.
// File ini + main.tsx + spa.blade.php + catch-all di web.php dihapus di P14.
export default function App() {
  return null;
}
`);

// pastikan tidak ada importer lain ke halaman auth lama
for (const f of walk(abs('resources/js'))) {
  const rel = relOf(f);
  if (rel === 'resources/js/App.tsx' || rel.startsWith('resources/js/pages/auth/')) continue;
  const txt = (planned.get(rel) ?? read(rel)).text;
  if (/pages\/auth\/(Login|VerifyOtp)/.test(txt)) fail('Masih ada import ke halaman auth lama di: ' + rel);
}

// ───────────────────────── terapkan ─────────────────────────
console.log(DRY ? '\n[DRY RUN] Rencana perubahan (tidak ada yang ditulis):\n' : '\nMenerapkan perubahan:\n');
for (const [rel, f] of planned) console.log(`  ${f.isNew ? '+ baru  ' : '~ ubah  '} ${rel}`);
for (const o of ops) console.log(`  - hapus  ${o.rel}`);

if (DRY) process.exit(0);

for (const [rel, f] of planned) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  const body = f.eol === '\r\n' ? f.text.replace(/\n/g, '\r\n') : f.text;
  fs.writeFileSync(abs(rel), (f.bom ? '\uFEFF' : '') + body, 'utf8');
}
for (const o of ops) fs.rmSync(abs(o.rel), { force: true });
try {
  const d = abs('resources/js/pages/auth');
  if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
} catch {}

console.log(`
Selesai. Langkah berikutnya (PowerShell):

  npx tsc --noEmit
  npm run build
  php artisan route:list --path=login
  php artisan route:list --path=verify-otp
  git status

PENTING sebelum tes -- sekarang API ikut autentikasi LEWAT SESSION (tidak ada token lagi). Di tiap environment
(lokal marimas-one.test, server kantor 10.10.1.4, Railway) cek .env:
  SANCTUM_STATEFUL_DOMAINS  harus memuat host (+port) yang dipakai browser, mis. marimas-one.test,10.10.1.4,<domain>.up.railway.app
  SESSION_DOMAIN            kosong (null) / cocok dengan host; SESSION_SECURE_COOKIE=true kalau HTTPS (Railway)
  APP_URL                   sama dengan URL yang dibuka di browser
Kalau salah, gejalanya: login berhasil lalu langsung balik ke /login (API 401). Habis ubah .env: php artisan config:clear

Tes manual:
  1. Buka /login (belum login) -> halaman Inertia tampil; login salah -> pesan error merah muncul, tidak pindah halaman.
  2. Login benar -> masuk /dashboard (full load). DevTools > Application: localStorage TIDAK punya 'token'.
  3. Network: request /api/... sukses TANPA header Authorization (200, bukan 401).
  4. Dashboard: notifikasi realtime masih masuk (kirim notifikasi dari akun lain / buat laporan penanganan).
  5. Buka /master-data saat belum login -> redirect /login; setelah login balik ke /master-data (intended).
  6. Logout lewat sidebar -> /login; tombol Back tidak membuka halaman ber-data lagi.
  7. Sudah login lalu buka /login -> otomatis ke /dashboard. Buka / -> /dashboard.
  8. Login non-admin -> menu admin tidak muncul; /audit-log redirect ke /dashboard.
  9. /verify-otp tanpa ?registration_id= -> redirect /login.
 10. Cek ulang endpoint lama masih jalan: POST /api/login & /api/verify-otp (sengaja belum dihapus, P14).
`);
