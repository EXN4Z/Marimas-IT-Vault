// P7 — Migrasi menu Settings (/settings) dari SPA ke Inertia.
//
// Jalankan dari ROOT project:
//   node scripts/p7-settings.mjs --dry        -> cek doang
//   node scripts/p7-settings.mjs              -> tulis + cek (tsc, route:list)
//   node scripts/p7-settings.mjs --no-check   -> tulis, skip tsc/route:list
//
// Yang dilakukan:
//  Backend
//   + app/Actions/Profile/UpdateProfile.php          (validasi + update profil, dipakai API & web)
//   + app/Actions/Profile/UpdatePassword.php         (validasi + ganti password, dipakai API & web)
//   ~ Auth/AuthController.php                        (updateProfile/updatePassword -> pakai Action; respons API sama)
//   + Settings/SettingsController.php                (GET /settings, PUT /settings/profile, PUT /settings/password)
//   ~ routes/web.php
//  Frontend
//   + inertia/pages/Settings/Index.tsx               (useForm; error lewat props errors)
//   ~ lib/inertiaRoutes.ts                           (+ '/settings')
//   ~ App.tsx                                        (hapus import + route settings)
//   - pages/settings/Settings.tsx                    (file lama)
//
// Berhenti SEBELUM nulis apa pun kalau ada pola yang gak cocok.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const NO_CHECK = args.has('--no-check');

const R = (...p) => path.resolve(...p);
const F = {
  updateProfile: R('app/Actions/Profile/UpdateProfile.php'),
  updatePassword: R('app/Actions/Profile/UpdatePassword.php'),
  authCtrl: R('app/Http/Controllers/Auth/AuthController.php'),
  settingsCtrl: R('app/Http/Controllers/Settings/SettingsController.php'),
  web: R('routes/web.php'),
  page: R('resources/js/inertia/pages/Settings/Index.tsx'),
  routesTs: R('resources/js/lib/inertiaRoutes.ts'),
  appTsx: R('resources/js/App.tsx'),
  oldPage: R('resources/js/pages/settings/Settings.tsx'),
};

const fail = (msg) => {
  console.error(`\n✗ ${msg}\n  Tidak ada file yang diubah.`);
  process.exit(1);
};

const readNorm = (p) => {
  if (!fs.existsSync(p)) fail(`Gak nemu ${p}. Jalankan dari root project.`);
  const raw = fs.readFileSync(p, 'utf8');
  return { eol: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
};
function replaceOnce(text, label, oldStr, newStr) {
  const count = text.split(oldStr).length - 1;
  if (count !== 1) fail(`[${label}] ketemu ${count}x, seharusnya 1x. File sumber beda dari yang diasumsikan.`);
  return text.replace(oldStr, () => newStr);
}

// ── precondition ───────────────────────────────────────────────────────────
for (const k of ['updateProfile', 'updatePassword', 'settingsCtrl', 'page']) {
  if (fs.existsSync(F[k])) fail(`${path.relative('.', F[k])} sudah ada — P7 kelihatannya sudah dikerjakan.`);
}
if (!fs.existsSync(R('resources/js/components/layout/InertiaAppLayout.tsx'))) fail('InertiaAppLayout.tsx belum ada — jalankan P5 dulu.');

const edits = []; // { path, eol, text }

// 1. AuthController -> pakai Action
{
  const f = readNorm(F.authCtrl);
  if (f.text.includes('UpdateProfile::run')) fail('AuthController.php sudah memakai UpdateProfile.');
  let t = f.text;
  t = replaceOnce(
    t,
    'auth use',
    'use App\\Mail\\OtpMail;\n',
    'use App\\Actions\\Profile\\UpdatePassword;\nuse App\\Actions\\Profile\\UpdateProfile;\nuse App\\Mail\\OtpMail;\n'
  );
  const startMarker = '    public function updateProfile(Request $request)\n';
  const endMarker = '    public function logout(Request $request)\n';
  if (t.split(startMarker).length !== 2 || t.split(endMarker).length !== 2) fail('[auth methods] updateProfile/logout tidak ketemu tepat 1x.');
  const a = t.indexOf(startMarker);
  const b = t.indexOf(endMarker);
  if (a < 0 || b < a) fail('[auth methods] urutan updateProfile/logout tidak seperti yang diasumsikan.');
  const region = t.slice(a, b);
  if (!region.includes('function updatePassword') || !region.includes("'current_password' => 'required|string'")) {
    fail('[auth methods] isi updateProfile/updatePassword beda dari yang diasumsikan.');
  }
  t =
    t.slice(0, a) +
    `    public function updateProfile(Request $request)
    {
        // Validasi + update ada di App\\Actions\\Profile\\UpdateProfile (dipakai juga SettingsController web).
        return response()->json(UpdateProfile::run($request));
    }

    public function updatePassword(Request $request)
    {
        // Validasi + ganti password ada di App\\Actions\\Profile\\UpdatePassword.
        UpdatePassword::run($request);

        return response()->json([
            'message' => 'Password berhasil diperbarui.',
        ]);
    }

` +
    t.slice(b);
  edits.push({ path: F.authCtrl, eol: f.eol, text: t });
}

// 2. routes/web.php
{
  const f = readNorm(F.web);
  if (f.text.includes('SettingsController')) fail('web.php sudah punya route settings.');
  let t = f.text;
  t = replaceOnce(t, 'web use', 'use Inertia\\Inertia;\n', 'use App\\Http\\Controllers\\Settings\\SettingsController;\nuse Inertia\\Inertia;\n');
  t = replaceOnce(
    t,
    'web group',
    "Route::middleware('auth')->group(function () {\n",
    "Route::middleware('auth')->group(function () {\n" +
      "    // Settings (semua role yang login)\n" +
      "    Route::get('/settings', [SettingsController::class, 'index']);\n" +
      "    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);\n" +
      "    Route::put('/settings/password', [SettingsController::class, 'updatePassword']);\n\n"
  );
  edits.push({ path: F.web, eol: f.eol, text: t });
}

// 3. inertiaRoutes.ts
{
  const f = readNorm(F.routesTs);
  const t = replaceOnce(f.text, 'inertiaRoutes', "  // contoh nanti: '/settings'\n", "  '/settings',\n");
  edits.push({ path: F.routesTs, eol: f.eol, text: t });
}

// 4. App.tsx
{
  const f = readNorm(F.appTsx);
  let t = f.text;
  t = replaceOnce(t, 'App import', "import Settings from './pages/settings/Settings';\n", '');
  t = replaceOnce(t, 'App route', '          <Route path="/settings" element={<Settings />} />\n', '');
  edits.push({ path: F.appTsx, eol: f.eol, text: t });
}

// ── file baru ──────────────────────────────────────────────────────────────
const newFiles = [];

newFiles.push({
  path: F.updateProfile,
  text: String.raw`<?php

namespace App\Actions\Profile;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Update profil user yang sedang login (nama, email, no HP).
 * Dipakai bareng oleh API (AuthController::updateProfile) dan web (SettingsController::updateProfile).
 * Gagal validasi -> ValidationException: API balas 422 JSON, web redirect back + errors (Inertia).
 */
class UpdateProfile
{
    public static function run(Request $request): User
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|unique:users,phone,' . $user->id,
        ]);

        $user->update($validated);

        return $user->fresh();
    }
}
`,
});

newFiles.push({
  path: F.updatePassword,
  text: String.raw`<?php

namespace App\Actions\Profile;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Ganti password user yang sedang login.
 * Dipakai bareng oleh API (AuthController::updatePassword) dan web (SettingsController::updatePassword).
 */
class UpdatePassword
{
    public static function run(Request $request): void
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|confirmed',
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Password saat ini tidak sesuai.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);
    }
}
`,
});

newFiles.push({
  path: F.settingsCtrl,
  text: String.raw`<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Profile\UpdatePassword;
use App\Actions\Profile\UpdateProfile;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SettingsController extends Controller
{
    // GET /settings — data user sudah ada di shared props (auth.user)
    public function index()
    {
        return Inertia::render('Settings/Index');
    }

    // PUT /settings/profile
    public function updateProfile(Request $request)
    {
        UpdateProfile::run($request);

        // auth.user di shared props otomatis ikut ter-update di response berikutnya
        return back()->with('success', 'Profil berhasil diperbarui.');
    }

    // PUT /settings/password
    public function updatePassword(Request $request)
    {
        UpdatePassword::run($request);

        return back()->with('success', 'Password berhasil diperbarui.');
    }
}
`,
});

newFiles.push({
  path: F.page,
  text: String.raw`import { useForm } from '@inertiajs/react';
import { User as UserIcon, Mail, Phone, Save, Bell, BellOff, Lock, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { usePushNotifications } from '../../../hooks/usePushNotifications';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  user: 'User', // REVISI (simplify_roles_table): dulu 'hr'/'manajer'/'manager'/'karyawan' 4 entry beda-beda, sekarang cukup 1 karena udah di-merge jadi 'user'
  cabang: 'Cabang',
};

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

// Update profil & ganti password: Inertia useForm -> PUT /settings/profile & /settings/password.
// Error validasi datang lewat props errors; auth.user di shared props ter-update otomatis setelah simpan.
export default function SettingsIndex() {
  const { user } = useAuth();
  const push = usePushNotifications();

  const profile = useForm({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });

  // GANTI PASSWORD -- kartu terpisah dari Profil Saya karena butuh
  // verifikasi current_password & validasi confirmed, beda konteks
  // dari update nama/email/HP yang semuanya opsional.
  const password = useForm({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const isDirty =
    profile.data.name !== (user?.name ?? '') ||
    profile.data.email !== (user?.email ?? '') ||
    profile.data.phone !== (user?.phone ?? '');

  const isPasswordDirty =
    password.data.current_password.length > 0 ||
    password.data.password.length > 0 ||
    password.data.password_confirmation.length > 0;

  const handleSubmit = () => {
    if (!profile.data.name.trim()) {
      toast.error('Nama tidak boleh kosong.');
      return;
    }

    // Email/HP kosong tidak dikirim (sama seperti versi axios): dikirim '' akan jadi null di server.
    profile.transform((d) => ({
      name: d.name.trim(),
      email: d.email.trim() || undefined,
      phone: d.phone.trim() || undefined,
    }));

    profile.put('/settings/profile', {
      preserveScroll: true,
      onSuccess: () => toast.success('Profil berhasil diperbarui.'),
      onError: (errors) =>
        toast.error(errors.email || errors.phone || errors.name || 'Gagal memperbarui profil. Coba lagi.'),
    });
  };

  const handlePasswordSubmit = () => {
    if (!password.data.current_password.trim()) {
      toast.error('Password saat ini wajib diisi.');
      return;
    }
    if (password.data.password !== password.data.password_confirmation) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }

    password.put('/settings/password', {
      preserveScroll: true,
      onSuccess: () => {
        password.reset();
        toast.success('Password berhasil diperbarui.');
      },
      onError: (errors) =>
        toast.error(errors.current_password || errors.password || 'Gagal memperbarui password. Coba lagi.'),
    });
  };

  return (
    <>
      <p className="text-sm text-slate-500 mb-6">Kelola informasi akun kamu di sini.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KARTU IDENTITAS */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center h-fit">
          <div className="w-20 h-20 rounded-full bg-slate-900 text-white text-2xl font-bold flex items-center justify-center mb-4">
            {initials(user?.name)}
          </div>
          <p className="text-base font-semibold text-slate-900 break-words">{user?.name}</p>
          <p className="text-sm text-slate-400 mb-3 break-all">{user?.email}</p>
          {user?.role && (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {roleLabels[user.role] ?? user.role}
            </span>
          )}
        </div>

        {/* FORM PROFIL SAYA */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Profil Saya</h3>
          <p className="text-sm text-slate-400 mb-5">Perbarui nama, email, dan nomor HP kamu.</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nama</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={profile.data.name}
                  onChange={(e) => profile.setData('name', e.target.value)}
                  maxLength={255}
                  placeholder="Nama lengkap"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={profile.errors.name} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={profile.data.email}
                  onChange={(e) => profile.setData('email', e.target.value)}
                  type="email"
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={profile.errors.email} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">No. HP</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={profile.data.phone}
                  onChange={(e) => profile.setData('phone', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={profile.errors.phone} />
            </div>

            <button
              onClick={handleSubmit}
              disabled={profile.processing || !isDirty}
              className="self-start flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Save size={16} />
              {profile.processing ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>

        {/* FORM GANTI PASSWORD */}
        <div className="lg:col-span-3 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Ganti Password</h3>
          <p className="text-sm text-slate-400 mb-5">
            Pastikan gunakan password yang kuat dan tidak dipakai di tempat lain.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Password Saat Ini</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={password.data.current_password}
                  onChange={(e) => password.setData('current_password', e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password sekarang"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={password.errors.current_password} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Password Baru</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={password.data.password}
                  onChange={(e) => password.setData('password', e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <FieldError message={password.errors.password} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Konfirmasi Password Baru</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={password.data.password_confirmation}
                  onChange={(e) => password.setData('password_confirmation', e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 hidden sm:block">
              Kamu akan tetap login setelah password diganti.
            </p>
            <button
              onClick={handlePasswordSubmit}
              disabled={password.processing || !isPasswordDirty}
              className="ml-auto flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {password.processing ? (
                <Lock size={16} className="animate-pulse" />
              ) : (
                <KeyRound size={16} />
              )}
              {password.processing ? 'Menyimpan...' : 'Ganti Password'}
            </button>
          </div>
        </div>

        {/* NOTIFIKASI PUSH */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-fit lg:col-span-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                {push.isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Notifikasi Push</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Aktifkan supaya kamu tetap dapat notifikasi (misal laporan kerusakan inventory)
                  walau tab/browser lagi ketutup atau lagi di device lain.
                </p>
                {push.status === 'denied' && (
                  <p className="text-xs text-red-500 mt-1">
                    Notifikasi diblokir di browser ini. Aktifkan lewat setting izin situs.
                  </p>
                )}
                {!push.isSupported && (
                  <p className="text-xs text-slate-400 mt-1">Browser ini tidak mendukung push notification.</p>
                )}
              </div>
            </div>

            {push.isSupported && push.status !== 'denied' && (
              <button
                onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
                disabled={push.loading}
                className={
                  'flex-shrink-0 text-sm font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-40 ' +
                  (push.isSubscribed
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800')
                }
              >
                {push.loading ? 'Memproses...' : push.isSubscribed ? 'Matikan' : 'Aktifkan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
`,
});

// ── ringkasan ──────────────────────────────────────────────────────────────
const rel = (p) => path.relative('.', p).replace(/\\/g, '/');
console.log('Rencana:');
for (const n of newFiles) console.log(`  + ${rel(n.path)}`);
for (const e of edits) console.log(`  ~ ${rel(e.path)}`);
if (fs.existsSync(F.oldPage)) console.log(`  - ${rel(F.oldPage)}`);

if (DRY) {
  console.log('\n(--dry) tidak ada file yang ditulis.');
  process.exit(0);
}

// ── tulis ──────────────────────────────────────────────────────────────────
for (const n of newFiles) {
  fs.mkdirSync(path.dirname(n.path), { recursive: true });
  fs.writeFileSync(n.path, n.text, 'utf8');
}
for (const e of edits) fs.writeFileSync(e.path, e.text.replace(/\n/g, e.eol), 'utf8');

if (fs.existsSync(F.oldPage)) {
  fs.rmSync(F.oldPage);
  const d = path.dirname(F.oldPage);
  if (fs.readdirSync(d).length === 0) fs.rmdirSync(d);
}
console.log('\n✓ File ditulis.');

if (NO_CHECK) process.exit(0);

const run = (cmd) => {
  console.log(`\n→ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
};

let ok = true;
if (fs.existsSync('tsconfig.json')) ok = run('npx tsc --noEmit') && ok;
else console.log('\n! tsconfig.json tidak ada, tsc dilewati.');
ok = run('php artisan route:list --path=settings') && ok;

console.log(
  ok
    ? '\n✓ Cek lolos. Lanjut: npm run build, tes manual (lihat bawah), lalu commit.'
    : '\n✗ Ada cek yang gagal. Rollback: git checkout . ; git clean -fd app/Actions resources/js/inertia/pages/Settings app/Http/Controllers/Settings'
);
console.log(`
Tes manual:
  1. Hard refresh di /settings (kartu profil + form terisi, push notif tampil).
  2. Ubah nama -> Simpan: toast sukses, kartu identitas & nama di header ikut berubah TANPA reload penuh.
  3. Email/HP yang sudah dipakai user lain -> error muncul (toast + teks merah di bawah field).
  4. Ganti password: salah password lama -> error; sukses -> form kosong, tetap login.
  5. Klik Settings dari sidebar halaman SPA -> full load; dari sini ke Dashboard -> full load.
  6. Login non-admin -> /settings bisa dibuka.
  7. PUT /api/profile & /api/profile/password (SPA/axios) masih normal (respons JSON sama).
`);
process.exit(ok ? 0 : 1);
