// P8 — Migrasi menu Dashboard (/dashboard) dari SPA ke Inertia. CUMA PINDAH SHELL:
// data tetap lewat react-query (useDashboardData) ke /api. Realtime (Echo) belum jalan di
// halaman Inertia karena butuh token localStorage -> diberesin di P14.
//
// Jalankan dari ROOT project:
//   node scripts/p8-dashboard.mjs --dry        -> cek doang
//   node scripts/p8-dashboard.mjs              -> tulis + cek (tsc, route:list)
//   node scripts/p8-dashboard.mjs --no-check   -> tulis, skip tsc/route:list
//
// Yang dilakukan:
//  Backend
//   + Dashboard/DashboardPageController.php   (GET /dashboard -> Inertia::render('Dashboard/Index'))
//   ~ routes/web.php                          (GET /dashboard di grup auth + redirect /dashboard-analytics)
//  Frontend
//   + inertia/pages/Dashboard/Index.tsx       (pilih DashboardAdmin/DashboardUser dari auth.user.role)
//   ~ lib/inertiaRoutes.ts                    (+ '/dashboard')
//   ~ App.tsx                                 (hapus import + route /dashboard & /dashboard-analytics)
//   ~ pages/auth/Login.tsx                    (useNavigate -> useAppNavigate; putus loop redirect kalau session habis)
//   ~ pages/auth/VerifyOtp.tsx                (useNavigate -> useAppNavigate)
//   ~ components/layout/AdminRoute.tsx        (redirect ke /dashboard jadi full page load)
//   - pages/dashboard/index.tsx               (file lama; DashboardAdmin/User, widgets, hook TETAP)
//
// Kenapa Login/VerifyOtp/AdminRoute ikut diubah: mereka navigate('/dashboard') lewat react-router.
// Setelah route /dashboard dihapus dari App.tsx, SPA tidak punya route itu lagi -> layar kosong.
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
  pageCtrl: R('app/Http/Controllers/Dashboard/DashboardPageController.php'),
  web: R('routes/web.php'),
  page: R('resources/js/inertia/pages/Dashboard/Index.tsx'),
  routesTs: R('resources/js/lib/inertiaRoutes.ts'),
  appTsx: R('resources/js/App.tsx'),
  login: R('resources/js/pages/auth/Login.tsx'),
  otp: R('resources/js/pages/auth/VerifyOtp.tsx'),
  adminRoute: R('resources/js/components/layout/AdminRoute.tsx'),
  oldPage: R('resources/js/pages/dashboard/index.tsx'),
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
for (const k of ['pageCtrl', 'page']) {
  if (fs.existsSync(F[k])) fail(`${path.relative('.', F[k])} sudah ada — P8 kelihatannya sudah dikerjakan.`);
}
if (!fs.existsSync(F.oldPage)) fail('pages/dashboard/index.tsx tidak ada — P8 kelihatannya sudah dikerjakan.');
if (!fs.existsSync(R('resources/js/components/layout/InertiaAppLayout.tsx'))) fail('InertiaAppLayout.tsx belum ada — jalankan P5 dulu.');
if (!fs.existsSync(R('resources/js/hooks/useAppNavigate.ts'))) fail('useAppNavigate.ts belum ada — jalankan P3 dulu.');

// index.tsx lama harus versi yang diasumsikan (switch role doang).
{
  const old = readNorm(F.oldPage).text;
  if (!old.includes("const REVIEWER_ROLES = ['admin'];")) fail("pages/dashboard/index.tsx: REVIEWER_ROLES bukan ['admin'] — logika role berubah, cek manual dulu.");
  if (!old.includes('<DashboardAdmin />') || !old.includes('<DashboardUser />')) fail('pages/dashboard/index.tsx bukan switch DashboardAdmin/DashboardUser.');
}

// Tidak boleh ada file lain (selain App.tsx yang diedit di sini) yang meng-import index.tsx lama.
{
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const re = /from\s+['"][^'"]*\/dashboard(\/index)?['"]/;
  const users = walk(R('resources/js'))
    .filter((p) => p !== F.appTsx && p !== F.oldPage)
    .filter((p) => re.test(fs.readFileSync(p, 'utf8')));
  if (users.length) fail(`Masih ada yang meng-import pages/dashboard (index): ${users.map((u) => path.relative('.', u)).join(', ')}`);
}

const edits = []; // { path, eol, text }
const newFiles = []; // { path, text }

// 1. Controller halaman
newFiles.push({
  path: F.pageCtrl,
  text: String.raw`<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class DashboardPageController extends Controller
{
    // GET /dashboard   (middleware: auth, lihat routes/web.php)
    // Semua role boleh. DashboardAdmin vs DashboardUser dipilih di sisi React dari auth.user.role.
    // Data dashboard SENGAJA masih lewat /api (react-query) -- dipindah ke props di tahap F9.
    public function __invoke()
    {
        return Inertia::render('Dashboard/Index');
    }
}
`,
});

// 2. routes/web.php
{
  const f = readNorm(F.web);
  if (f.text.includes('DashboardPageController')) fail('routes/web.php sudah memuat DashboardPageController.');
  let t = f.text;
  t = replaceOnce(
    t,
    'web use',
    'use App\\Http\\Controllers\\Settings\\SettingsController;\n',
    'use App\\Http\\Controllers\\Dashboard\\DashboardPageController;\nuse App\\Http\\Controllers\\Settings\\SettingsController;\n'
  );
  t = replaceOnce(
    t,
    'web login route',
    "Route::get('/login', fn () => view('spa'))->name('login');\n",
    "Route::get('/login', fn () => view('spa'))->name('login');\n\n" +
      '// Alias lama (tadinya Navigate di App.tsx). Di luar grup auth: kalau belum login, /dashboard yang akan\n' +
      '// melempar ke /login.\n' +
      "Route::redirect('/dashboard-analytics', '/dashboard?tab=analytics');\n"
  );
  t = replaceOnce(
    t,
    'web group',
    '    // Settings (semua role yang login)\n',
    '    // Dashboard (semua role; DashboardAdmin vs DashboardUser dipilih di halaman dari auth.user.role)\n' +
      "    Route::get('/dashboard', DashboardPageController::class);\n\n" +
      '    // Settings (semua role yang login)\n'
  );
  edits.push({ path: F.web, eol: f.eol, text: t });
}

// 3. Halaman Inertia
newFiles.push({
  path: F.page,
  text: String.raw`import DashboardAdmin from '../../../pages/dashboard/DashboardAdmin';
import DashboardUser from '../../../pages/dashboard/DashboardUser';
import { useSharedProps } from '../../../hooks/useSharedProps';

// Role yang dapet DashboardAdmin (full analytics + inventaris). Sama persis dengan
// pages/dashboard/index.tsx yang lama: cuma 'admin'; semua role lain (user, cabang) dapet DashboardUser.
// Role dibaca dari shared props (dari server), jadi tidak ada kedip DashboardUser sebelum role ketahuan.
const REVIEWER_ROLES = ['admin'];

// Tahap P8: SHELL doang. Data tetap lewat react-query (useDashboardData) ke /api.
// DashboardAdmin / DashboardUser / widgets / useDashboardData TETAP di pages/dashboard/ dan di-import dari sini.
export default function DashboardIndex() {
  const { auth } = useSharedProps();
  const role = auth?.user?.role ?? '';

  if (REVIEWER_ROLES.includes(role)) return <DashboardAdmin />;
  return <DashboardUser />;
}
`,
});

// 4. lib/inertiaRoutes.ts
{
  const f = readNorm(F.routesTs);
  if (/'\/dashboard'/.test(f.text)) fail("inertiaRoutes.ts sudah memuat '/dashboard'.");
  const t = replaceOnce(f.text, 'inertiaRoutes', "  '/settings',\n];", "  '/settings',\n  '/dashboard',\n];");
  edits.push({ path: F.routesTs, eol: f.eol, text: t });
}

// 5. App.tsx
{
  const f = readNorm(F.appTsx);
  let t = f.text;
  t = replaceOnce(t, 'App import', "import Dashboard from './pages/dashboard';\n", '');
  t = replaceOnce(t, 'App route dashboard', '          <Route path="/dashboard" element={<Dashboard />} />\n', '');
  t = replaceOnce(
    t,
    'App route dashboard-analytics',
    '          {/* Dashboard Analytics sekarang jadi tab di dalam /dashboard, bukan halaman sendiri.\n' +
      '              Redirect ini cuma buat jaga-jaga kalau ada bookmark/link lama ke /dashboard-analytics. */}\n' +
      '          <Route path="/dashboard-analytics" element={<Navigate to="/dashboard?tab=analytics" replace />} />\n',
    ''
  );
  edits.push({ path: F.appTsx, eol: f.eol, text: t });
}

// 6. Login.tsx
{
  const f = readNorm(F.login);
  if (f.text.includes('useAppNavigate')) fail('Login.tsx sudah memakai useAppNavigate.');
  let t = f.text;
  t = replaceOnce(t, 'login react import', "import { useState, useEffect } from 'react';\n", "import { useState, useEffect, useRef } from 'react';\n");
  t = replaceOnce(
    t,
    'login router import',
    "import { useNavigate, useLocation } from 'react-router-dom';\n",
    "import { useLocation } from 'react-router-dom';\nimport { useAppNavigate } from '../../hooks/useAppNavigate';\n"
  );
  t = replaceOnce(t, 'login navigate', '  const navigate = useNavigate();\n', '  const navigate = useAppNavigate();\n  const redirected = useRef(false);\n');
  t = replaceOnce(
    t,
    'login effect',
    "  useEffect(() => {\n    if (isLoading || !user) return;\n    navigate('/dashboard', { replace: true });\n  }, [isLoading, user, navigate]);\n",
    "  useEffect(() => {\n" +
      '    if (isLoading || !user || redirected.current) return;\n' +
      '    redirected.current = true;\n' +
      '    // P8: /dashboard sekarang halaman Inertia (butuh session cookie). Kalau token masih valid tapi\n' +
      '    // session sudah habis, server melempar balik ke /login -> loop tanpa ujung. Balik ke sini <5 detik\n' +
      '    // setelah redirect = session ditolak: buang token, minta login ulang. (Hapus di P13.)\n' +
      "    const last = Number(sessionStorage.getItem('dashboard_redirect_at') || 0);\n" +
      '    if (Date.now() - last < 5000) {\n' +
      "      sessionStorage.removeItem('dashboard_redirect_at');\n" +
      "      localStorage.removeItem('token');\n" +
      "      localStorage.removeItem('user');\n" +
      '      setUser(null);\n' +
      '      return;\n' +
      '    }\n' +
      "    sessionStorage.setItem('dashboard_redirect_at', String(Date.now()));\n" +
      "    navigate('/dashboard', { replace: true });\n" +
      '  }, [isLoading, user, navigate, setUser]);\n'
  );
  edits.push({ path: F.login, eol: f.eol, text: t });
}

// 7. VerifyOtp.tsx
{
  const f = readNorm(F.otp);
  if (f.text.includes('useAppNavigate')) fail('VerifyOtp.tsx sudah memakai useAppNavigate.');
  let t = f.text;
  t = replaceOnce(
    t,
    'otp router import',
    "import { useNavigate, useLocation } from 'react-router-dom';\n",
    "import { useLocation } from 'react-router-dom';\nimport { useAppNavigate } from '../../hooks/useAppNavigate';\n"
  );
  t = replaceOnce(t, 'otp navigate', '  const navigate = useNavigate();\n', '  const navigate = useAppNavigate();\n');
  edits.push({ path: F.otp, eol: f.eol, text: t });
}

// 8. AdminRoute.tsx
{
  const f = readNorm(F.adminRoute);
  if (f.text.includes('HardRedirect')) fail('AdminRoute.tsx sudah dimodifikasi.');
  let t = f.text;
  t = replaceOnce(
    t,
    'adminroute import',
    "import { Navigate } from 'react-router-dom';\n",
    "import { useEffect } from 'react';\nimport { Navigate } from 'react-router-dom';\n"
  );
  t = replaceOnce(
    t,
    'adminroute component',
    'export default function AdminRoute(',
    '// /dashboard bukan route react-router lagi (halaman Inertia) -> harus full page load.\n' +
      'function HardRedirect({ to }: { to: string }) {\n' +
      '    useEffect(() => {\n' +
      '        window.location.replace(to);\n' +
      '    }, [to]);\n' +
      '    return null;\n' +
      '}\n\n' +
      'export default function AdminRoute('
  );
  t = replaceOnce(t, 'adminroute redirect', '        return <Navigate to="/dashboard" replace />;', '        return <HardRedirect to="/dashboard" />;');
  edits.push({ path: F.adminRoute, eol: f.eol, text: t });
}

// ── ringkasan ──────────────────────────────────────────────────────────────
const rel = (p) => path.relative('.', p).replace(/\\/g, '/');
console.log('Rencana:');
for (const n of newFiles) console.log(`  + ${rel(n.path)}`);
for (const e of edits) console.log(`  ~ ${rel(e.path)}`);
console.log(`  - ${rel(F.oldPage)}`);

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
fs.rmSync(F.oldPage);
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
ok = run('php artisan route:list --path=dashboard') && ok;

console.log(
  ok
    ? '\n✓ Cek lolos. Lanjut: npm run build, tes manual (lihat bawah), lalu commit.'
    : '\n✗ Ada cek yang gagal. Rollback: git checkout . ; git clean -fd app/Http/Controllers/Dashboard/DashboardPageController.php resources/js/inertia/pages/Dashboard'
);
console.log(`
Tes manual (kalau mau, boleh digabung nanti di checkpoint setelah P11):
  1. Login admin lewat SPA -> otomatis masuk /dashboard (full load), DashboardAdmin tampil + data muncul.
  2. Hard refresh di /dashboard. Login non-admin -> DashboardUser.
  3. Klik KPI/widget (mis. buka Master Data) -> full load ke SPA; dari Master Data klik Dashboard di sidebar -> full load balik.
  4. Buka /dashboard-analytics -> redirect ke /dashboard?tab=analytics.
  5. Non-admin buka /laporan -> AdminRoute -> balik ke /dashboard (full load, bukan layar kosong).
  6. Realtime (Echo) di halaman ini BELUM jalan -- sengaja, diberesin di P14.
  7. Kalau muncul loop reload /login <-> /dashboard: session cookie tidak ke-set (cek SANCTUM_STATEFUL_DOMAINS / SESSION_DOMAIN).
`);
process.exit(ok ? 0 : 1);
