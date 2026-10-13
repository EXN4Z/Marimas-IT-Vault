// P9 — Migrasi menu Laporan (/laporan, admin-only) dari SPA ke Inertia. CUMA PINDAH SHELL:
// data & export (exceljs/csv, modal export) tetap axios, sama persis seperti sekarang.
//
// Jalankan dari ROOT project:
//   node scripts/p9-laporan.mjs --dry        -> cek doang
//   node scripts/p9-laporan.mjs              -> tulis + cek (tsc, route:list)
//   node scripts/p9-laporan.mjs --no-check   -> tulis, skip tsc/route:list
//
// Yang dilakukan:
//  Backend
//   + Laporan/LaporanPageController.php   (GET /laporan?tab=; tab kosong/ngawur -> redirect ?tab=export_data)
//   ~ routes/web.php                      (GET /laporan di grup auth + role:admin; alias /inventaris -> /laporan)
//  Frontend
//   + inertia/pages/Laporan/Index.tsx     (COPY dari pages/laporan/Laporan.tsx; cuma logika tab yang diganti:
//                                          react-router useSearchParams -> prop `tab` dari server + router.get)
//   ~ lib/inertiaRoutes.ts                (+ '/laporan')
//   ~ App.tsx                             (hapus import + route /laporan (AdminRoute) + alias /inventaris)
//   - pages/laporan/Laporan.tsx           (file lama)
//
// AdminRoute TIDAK dihapus: masih dipakai route Karyawan (dibereskan di P12).
// Komponen anak (components/laporan/*) tidak disentuh.
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
  pageCtrl: R('app/Http/Controllers/Laporan/LaporanPageController.php'),
  web: R('routes/web.php'),
  page: R('resources/js/inertia/pages/Laporan/Index.tsx'),
  routesTs: R('resources/js/lib/inertiaRoutes.ts'),
  appTsx: R('resources/js/App.tsx'),
  oldPage: R('resources/js/pages/laporan/Laporan.tsx'),
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
  if (fs.existsSync(F[k])) fail(`${path.relative('.', F[k])} sudah ada — P9 kelihatannya sudah dikerjakan.`);
}
if (!fs.existsSync(F.oldPage)) fail('pages/laporan/Laporan.tsx tidak ada — P9 kelihatannya sudah dikerjakan.');
if (!fs.existsSync(R('resources/js/components/layout/InertiaAppLayout.tsx'))) fail('InertiaAppLayout.tsx belum ada — jalankan P5 dulu.');
if (!readNorm(F.web).text.includes('DashboardPageController')) fail('routes/web.php belum memuat Dashboard — jalankan P8 dulu.');

// Tidak boleh ada file lain (selain App.tsx yang diedit di sini) yang meng-import Laporan lama.
{
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const re = /from\s+['"][^'"]*pages\/laporan\/Laporan['"]/;
  const users = walk(R('resources/js'))
    .filter((p) => p !== F.appTsx && p !== F.oldPage)
    .filter((p) => re.test(fs.readFileSync(p, 'utf8')));
  if (users.length) fail(`Masih ada yang meng-import pages/laporan/Laporan: ${users.map((u) => path.relative('.', u)).join(', ')}`);
}

const edits = []; // { path, eol, text }
const newFiles = []; // { path, text }

// 1. Controller halaman
newFiles.push({
  path: F.pageCtrl,
  text: String.raw`<?php

namespace App\Http\Controllers\Laporan;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LaporanPageController extends Controller
{
    private const TABS = ['export_data', 'foto_inventory', 'riwayat_inventory'];

    // GET /laporan?tab=export_data|foto_inventory|riwayat_inventory   (middleware: auth + role:admin, lihat routes/web.php)
    // Tab kosong / tidak dikenal -> redirect ke ?tab=export_data (dulu dilakukan effect di React lewat setSearchParams).
    // Data tab masih lewat /api (axios) -- dipindah ke props di tahap F7/F8.
    public function __invoke(Request $request)
    {
        $tab = $request->query('tab');

        if (!in_array($tab, self::TABS, true)) {
            return redirect('/laporan?tab=export_data');
        }

        return Inertia::render('Laporan/Index', ['tab' => $tab]);
    }
}
`,
});

// 2. routes/web.php
{
  const f = readNorm(F.web);
  if (f.text.includes('LaporanPageController')) fail('routes/web.php sudah memuat LaporanPageController.');
  let t = f.text;
  t = replaceOnce(
    t,
    'web use',
    'use App\\Http\\Controllers\\Dashboard\\DashboardPageController;\n',
    'use App\\Http\\Controllers\\Dashboard\\DashboardPageController;\nuse App\\Http\\Controllers\\Laporan\\LaporanPageController;\n'
  );
  t = replaceOnce(
    t,
    'web alias',
    "Route::redirect('/dashboard-analytics', '/dashboard?tab=analytics');\n",
    "Route::redirect('/dashboard-analytics', '/dashboard?tab=analytics');\nRoute::redirect('/inventaris', '/laporan');\n"
  );
  t = replaceOnce(
    t,
    'web group',
    "    Route::get('/dashboard', DashboardPageController::class);\n",
    "    Route::get('/dashboard', DashboardPageController::class);\n\n" +
      '    // Laporan (admin-only; non-admin web/Inertia -> redirect /dashboard, API/JSON tetap 403)\n' +
      "    Route::get('/laporan', LaporanPageController::class)->middleware('role:admin');\n"
  );
  edits.push({ path: F.web, eol: f.eol, text: t });
}

// 3. Halaman Inertia = COPY Laporan.tsx lama, hanya logika tab + path import yang diganti
{
  const old = readNorm(F.oldPage).text;
  let t = old;

  // semua import relatif harus berbentuk '../../x' (file pindah 1 level lebih dalam -> '../../../x')
  const rel = t.match(/from\s+'\.{1,2}\/[^']*'/g) || [];
  if (rel.some((s) => !s.startsWith("from '../../"))) fail('Laporan.tsx punya import relatif selain "../../" — path tidak bisa diubah otomatis.');
  t = t.replace(/from '\.\.\/\.\.\//g, "from '../../../");

  t = replaceOnce(t, 'laporan router import', "import { useSearchParams } from 'react-router-dom';\n", "import { router, usePage } from '@inertiajs/react';\n");

  // ganti blok state-tab (searchParams -> prop dari server)
  const start = '  const [searchParams, setSearchParams] = useSearchParams();\n';
  const endMarker = '  }, [searchParams]);\n';
  const i = t.indexOf(start);
  const j = t.indexOf(endMarker);
  if (i === -1 || j === -1 || t.indexOf(start, i + 1) !== -1 || t.indexOf(endMarker, j + 1) !== -1 || j < i) {
    fail('Blok tab (useSearchParams ... [searchParams]) tidak ketemu persis 1x — Laporan.tsx bukan versi yang diasumsikan.');
  }
  const block = t.slice(i, j + endMarker.length);
  if (!block.includes('setSearchParams') || !block.includes('setActiveTabState')) fail('Isi blok tab beda dari yang diasumsikan.');

  const replacement =
    '  // Tab aktif = prop `tab` dari server (LaporanPageController memvalidasi; kosong/ngawur -> redirect\n' +
    '  // ke ?tab=export_data). Ganti tab = visit ringan ke URL yang sama: replace (history gak numpuk),\n' +
    '  // preserveState (list data & modal export yang sudah ke-load tidak hilang).\n' +
    '  const pageProps = usePage().props as unknown as { tab?: string };\n' +
    '  const activeTab: TabKey = isTabKey(pageProps.tab ?? null) ? (pageProps.tab as TabKey) : \'export_data\';\n\n' +
    '  const setActiveTab = (tab: TabKey) => {\n' +
    '    if (tab === activeTab) return;\n' +
    "    router.get('/laporan', { tab }, { replace: true, preserveState: true, preserveScroll: true });\n" +
    '  };\n';
  t = t.slice(0, i) + replacement + t.slice(j + endMarker.length);

  if (/react-router|useSearchParams|setSearchParams|searchParams/.test(t.replace(/\/\/.*$/gm, ''))) {
    fail('Masih ada sisa react-router/searchParams di halaman baru (di luar komentar) — cek manual.');
  }
  newFiles.push({ path: F.page, text: t });
}

// 4. lib/inertiaRoutes.ts
{
  const f = readNorm(F.routesTs);
  if (/'\/laporan'/.test(f.text)) fail("inertiaRoutes.ts sudah memuat '/laporan'.");
  const t = replaceOnce(f.text, 'inertiaRoutes', "  '/dashboard',\n];", "  '/dashboard',\n  '/laporan',\n];");
  edits.push({ path: F.routesTs, eol: f.eol, text: t });
}

// 5. App.tsx
{
  const f = readNorm(F.appTsx);
  let t = f.text;
  t = replaceOnce(t, 'App import', "import Laporan from './pages/laporan/Laporan';\n", '');
  t = replaceOnce(
    t,
    'App alias inventaris',
    '          {/* Halaman Inventaris sudah dihapus -- Inventory pindah ke Master Data, Foto\n' +
      '              Inventory & Riwayat Inventory pindah ke Laporan, dan Penanganan Inventory\n' +
      '              punya halaman sendiri. Alias ini jaga-jaga buat bookmark/link lama ke\n' +
      '              /inventaris. */}\n' +
      '          <Route path="/inventaris" element={<Navigate to="/laporan" replace />} />\n',
    ''
  );
  t = replaceOnce(
    t,
    'App route laporan',
    '          {/* /laporan admin-only (sinkron sama backend, role hr/manajer udah\n' +
      '              dihapus -- lihat migration simplify_roles_table) -- non-admin\n' +
      '              di-redirect balik ke /dashboard, bukan cuma ditampilin pesan\n' +
      '              "tidak punya akses" di dalam halamannya. */}\n' +
      '          <Route\n' +
      '            path="/laporan"\n' +
      '            element={\n' +
      '              <AdminRoute>\n' +
      '                <Laporan />\n' +
      '              </AdminRoute>\n' +
      '            }\n' +
      '          />\n',
    ''
  );
  edits.push({ path: F.appTsx, eol: f.eol, text: t });
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
const oldEol = readNorm(F.oldPage).eol;
for (const n of newFiles) {
  fs.mkdirSync(path.dirname(n.path), { recursive: true });
  const eol = n.path === F.page ? oldEol : '\n';
  fs.writeFileSync(n.path, n.text.replace(/\n/g, eol), 'utf8');
}
for (const e of edits) fs.writeFileSync(e.path, e.text.replace(/\n/g, e.eol), 'utf8');
fs.rmSync(F.oldPage);
{
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
ok = run('php artisan route:list --path=laporan') && ok;

console.log(
  ok
    ? '\n✓ Cek lolos. Lanjut: npm run build, tes manual (lihat bawah), lalu commit.'
    : '\n✗ Ada cek yang gagal. Rollback: git checkout . ; git clean -fd app/Http/Controllers/Laporan resources/js/inertia/pages/Laporan'
);
console.log(`
Tes manual (boleh digabung nanti di checkpoint setelah P11):
  1. Login admin -> /laporan (tanpa query) otomatis jadi /laporan?tab=export_data, kartu export tampil.
  2. Pindah tab Foto Inventory / Riwayat Inventory: URL ikut berubah (?tab=), tanpa full reload, tab export tidak ke-fetch ulang.
  3. Export (Excel/CSV) dari beberapa kartu masih jalan (data tetap axios).
  4. Hard refresh di /laporan?tab=riwayat_inventory -> langsung ke tab itu.
  5. Klik Laporan dari sidebar halaman SPA (mis. Master Data) -> full load; dari sini ke Master Data -> full load.
  6. Login non-admin -> buka /laporan langsung -> redirect ke /dashboard.
  7. Buka /inventaris -> redirect ke /laporan?tab=export_data.
  8. Klik "Riwayat Inventory" di widget Dashboard -> masuk /laporan?tab=riwayat_inventory.
`);
process.exit(ok ? 0 : 1);
