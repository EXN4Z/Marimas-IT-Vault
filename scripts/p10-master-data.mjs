// P10 — Migrasi menu Master Data (/master-data?tab=...) dari SPA ke Inertia. CUMA PINDAH SHELL:
// semua tab tetap axios. Alias lama /inventory, /karyawan, /cabang pindah jadi redirect di web.php.
//
// Jalankan dari ROOT project:
//   node scripts/p10-master-data.mjs --dry        -> cek doang
//   node scripts/p10-master-data.mjs              -> tulis + cek (tsc, route:list)
//   node scripts/p10-master-data.mjs --no-check   -> tulis, skip tsc/route:list
//
// Yang dilakukan:
//  Backend
//   + MasterData/MasterDataPageController.php  (GET /master-data?tab=; tab kosong/ngawur/bukan hak role -> 'inventory')
//   ~ routes/web.php                           (GET /master-data di grup auth; alias /inventory /karyawan /cabang)
//  Frontend
//   + inertia/pages/MasterData/Index.tsx       (COPY dari pages/masterData/MasterData.tsx; cuma logika tab yang
//                                               diganti: useSearchParams -> prop `tab` dari server + router.get)
//   ~ lib/inertiaRoutes.ts                     (+ '/master-data')
//   ~ App.tsx                                  (hapus import + route /master-data + alias /inventory /karyawan /cabang)
//   ~ components/masterData/TabKaryawan.tsx    (useNavigate/useLocation -> useAppNavigate; SEMENTARA full page ke
//                                               /karyawan/create|:id|:id/edit, tanpa backgroundLocation. Overlay = P12)
//   ~ pages/masterData/karyawan/Karyawan{Create,Detail,Edit}.tsx
//                                              (navigate('/karyawan') -> useAppNavigate('/master-data?tab=karyawan');
//                                               kalau tidak, balik dari halaman ini jadi layar kosong)
//   - pages/masterData/MasterData.tsx          (file lama; folder karyawan/ TETAP sampai P12)
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
  pageCtrl: R('app/Http/Controllers/MasterData/MasterDataPageController.php'),
  web: R('routes/web.php'),
  page: R('resources/js/inertia/pages/MasterData/Index.tsx'),
  routesTs: R('resources/js/lib/inertiaRoutes.ts'),
  appTsx: R('resources/js/App.tsx'),
  oldPage: R('resources/js/pages/masterData/MasterData.tsx'),
  tabKaryawan: R('resources/js/components/masterData/TabKaryawan.tsx'),
  kCreate: R('resources/js/pages/masterData/karyawan/KaryawanCreate.tsx'),
  kDetail: R('resources/js/pages/masterData/karyawan/KaryawanDetail.tsx'),
  kEdit: R('resources/js/pages/masterData/karyawan/KaryawanEdit.tsx'),
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
function replaceN(text, label, oldStr, newStr, n) {
  const count = text.split(oldStr).length - 1;
  if (count !== n) fail(`[${label}] ketemu ${count}x, seharusnya ${n}x. File sumber beda dari yang diasumsikan.`);
  return text.split(oldStr).join(newStr);
}

// ── precondition ───────────────────────────────────────────────────────────
for (const k of ['pageCtrl', 'page']) {
  if (fs.existsSync(F[k])) fail(`${path.relative('.', F[k])} sudah ada — P10 kelihatannya sudah dikerjakan.`);
}
if (!fs.existsSync(F.oldPage)) fail('pages/masterData/MasterData.tsx tidak ada — P10 kelihatannya sudah dikerjakan.');
if (!fs.existsSync(R('resources/js/components/layout/InertiaAppLayout.tsx'))) fail('InertiaAppLayout.tsx belum ada — jalankan P5 dulu.');
if (!readNorm(F.web).text.includes('LaporanPageController')) fail('routes/web.php belum memuat Laporan — jalankan P8 dan P9 dulu.');

// Tidak boleh ada file lain (selain App.tsx yang diedit di sini) yang meng-import MasterData lama.
{
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const re = /from\s+['"][^'"]*pages\/masterData\/MasterData['"]/;
  const users = walk(R('resources/js'))
    .filter((p) => p !== F.appTsx && p !== F.oldPage)
    .filter((p) => re.test(fs.readFileSync(p, 'utf8')));
  if (users.length) fail(`Masih ada yang meng-import pages/masterData/MasterData: ${users.map((u) => path.relative('.', u)).join(', ')}`);
}

const edits = []; // { path, eol, text }
const newFiles = []; // { path, text }

// 1. Controller halaman
newFiles.push({
  path: F.pageCtrl,
  text: String.raw`<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MasterDataPageController extends Controller
{
    // Semua tab selain inventory admin-only (sinkron dengan routes/api.php dan daftar TABS di halaman React).
    private const ADMIN_TABS = ['kategori', 'karyawan', 'cabang', 'perusahaan', 'departemen', 'supplier'];

    // GET /master-data?tab=inventory|kategori|karyawan|cabang|perusahaan|departemen|supplier   (middleware: auth)
    // Tab kosong / tidak dikenal / bukan hak role ini -> 'inventory' (perilaku lama, tanpa redirect supaya
    // query lain di URL tidak hilang). Data tiap tab masih lewat /api (axios) -- dipindah ke props di F1-F5.
    public function __invoke(Request $request)
    {
        $allowed = $request->user()->isAdmin()
            ? array_merge(['inventory'], self::ADMIN_TABS)
            : ['inventory'];

        $tab = (string) $request->query('tab', '');

        return Inertia::render('MasterData/Index', [
            'tab' => in_array($tab, $allowed, true) ? $tab : 'inventory',
        ]);
    }
}
`,
});

// 2. routes/web.php
{
  const f = readNorm(F.web);
  if (f.text.includes('MasterDataPageController')) fail('routes/web.php sudah memuat MasterDataPageController.');
  let t = f.text;
  t = replaceOnce(
    t,
    'web use',
    'use App\\Http\\Controllers\\Laporan\\LaporanPageController;\n',
    'use App\\Http\\Controllers\\Laporan\\LaporanPageController;\nuse App\\Http\\Controllers\\MasterData\\MasterDataPageController;\n'
  );
  t = replaceOnce(
    t,
    'web alias',
    "Route::redirect('/inventaris', '/laporan');\n",
    "Route::redirect('/inventaris', '/laporan');\n" +
      "Route::redirect('/inventory', '/master-data?tab=inventory');\n" +
      "Route::redirect('/karyawan', '/master-data?tab=karyawan'); // cuma persis /karyawan; /karyawan/create|:id tetap SPA (P12)\n" +
      "Route::redirect('/cabang', '/master-data?tab=cabang');\n"
  );
  t = replaceOnce(
    t,
    'web group',
    "    Route::get('/laporan', LaporanPageController::class)->middleware('role:admin');\n",
    "    Route::get('/laporan', LaporanPageController::class)->middleware('role:admin');\n\n" +
      '    // Master Data (semua role boleh buka halamannya; tab admin-only dibatasi di controller + API)\n' +
      "    Route::get('/master-data', MasterDataPageController::class);\n"
  );
  edits.push({ path: F.web, eol: f.eol, text: t });
}

// 3. Halaman Inertia = COPY MasterData.tsx lama, hanya logika tab + path import yang diganti
{
  const old = readNorm(F.oldPage);
  let t = old.text;

  // import sisi-efek index.css: sudah di-import inertia-app.tsx
  t = replaceOnce(t, 'masterdata css import', "import '../../index.css';\n", '');

  // semua import relatif harus berbentuk '../../x' (file pindah 1 level lebih dalam -> '../../../x')
  const rel = t.match(/from\s+'\.{1,2}\/[^']*'/g) || [];
  if (rel.some((s) => !s.startsWith("from '../../"))) fail('MasterData.tsx punya import relatif selain "../../" — path tidak bisa diubah otomatis.');
  t = t.replace(/from '\.\.\/\.\.\//g, "from '../../../");

  t = replaceOnce(t, 'masterdata router import', "import { useSearchParams } from 'react-router-dom';\n", "import { router, usePage } from '@inertiajs/react';\n");

  const start = '  const [searchParams, setSearchParams] = useSearchParams();\n';
  const endMarker = '  }, [searchParams, user]);\n';
  const i = t.indexOf(start);
  const j = t.indexOf(endMarker);
  if (i === -1 || j === -1 || t.indexOf(start, i + 1) !== -1 || t.indexOf(endMarker, j + 1) !== -1 || j < i) {
    fail('Blok tab (useSearchParams ... [searchParams, user]) tidak ketemu persis 1x — MasterData.tsx bukan versi yang diasumsikan.');
  }
  const block = t.slice(i, j + endMarker.length);
  if (!block.includes('setSearchParams') || !block.includes('setActiveTabState')) fail('Isi blok tab beda dari yang diasumsikan.');

  const replacement =
    '  // Tab aktif = prop `tab` dari server (MasterDataPageController: kosong/ngawur/bukan hak role -> \'inventory\',\n' +
    '  // sama seperti perilaku lama). Ganti tab = visit ringan ke /master-data: replace (history gak numpuk),\n' +
    '  // preserveState (komponen halaman tidak di-reset).\n' +
    '  const pageProps = usePage().props as unknown as { tab?: string };\n' +
    '  const tabFromServer = pageProps.tab ?? null;\n' +
    "  const activeTab: TabKey = isTabKey(tabFromServer) && canViewTab(tabFromServer) ? tabFromServer : 'inventory';\n\n" +
    '  const setActiveTab = (tab: TabKey) => {\n' +
    '    if (tab === activeTab) return;\n' +
    "    router.get('/master-data', { tab }, { replace: true, preserveState: true, preserveScroll: true });\n" +
    '  };\n';
  t = t.slice(0, i) + replacement + t.slice(j + endMarker.length);

  // useState/useEffect tidak dipakai lagi kalau cuma dipakai blok tab tadi -> buang import-nya (noUnusedLocals).
  const code = t.replace(/\/\/.*$/gm, '');
  if (!/\buseState\(|\buseEffect\(/.test(code)) {
    t = replaceOnce(t, 'masterdata react import', "import { useEffect, useState } from 'react';\n", '');
  }

  if (/react-router|useSearchParams|setSearchParams|searchParams/.test(t.replace(/\/\/.*$/gm, ''))) {
    fail('Masih ada sisa react-router/searchParams di halaman baru (di luar komentar) — cek manual.');
  }
  newFiles.push({ path: F.page, text: t, eol: old.eol });
}

// 4. lib/inertiaRoutes.ts
{
  const f = readNorm(F.routesTs);
  if (/'\/master-data'/.test(f.text)) fail("inertiaRoutes.ts sudah memuat '/master-data'.");
  const t = replaceOnce(f.text, 'inertiaRoutes', "  '/laporan',\n];", "  '/laporan',\n  '/master-data',\n];");
  edits.push({ path: F.routesTs, eol: f.eol, text: t });
}

// 5. App.tsx
{
  const f = readNorm(F.appTsx);
  let t = f.text;
  t = replaceOnce(t, 'App import', "import MasterData from './pages/masterData/MasterData';\n", '');
  t = replaceOnce(
    t,
    'App alias + route master-data',
    '          {/* Inventory sekarang isinya di halaman Master Data (tab "inventory"), bukan\n' +
      '              lagi di Inventaris -- alias lama ini diarahin ke sana. */}\n' +
      '          <Route path="/inventory" element={<Navigate to="/master-data?tab=inventory" replace />} />\n' +
      '          {/* Data User & Cabang sekarang jadi tab di dalam Master Data (tab "karyawan" &\n' +
      '              "cabang"), bukan halaman sendiri lagi -- alias ini jaga-jaga buat\n' +
      '              bookmark/link lama. */}\n' +
      '          <Route path="/karyawan" element={<Navigate to="/master-data?tab=karyawan" replace />} />\n' +
      '          <Route path="/cabang" element={<Navigate to="/master-data?tab=cabang" replace />} />\n' +
      '          <Route path="/master-data" element={<MasterData />} />\n',
    ''
  );
  // Navigate tidak dipakai lagi -> buang dari import (noUnusedLocals)
  const body = t.replace(/^import .*$/gm, '');
  if (!/<Navigate\b|\bNavigate\(/.test(body)) {
    t = replaceOnce(t, 'App react-router import', 'Route, Navigate, useLocation', 'Route, useLocation');
  }
  edits.push({ path: F.appTsx, eol: f.eol, text: t });
}

// 6. TabKaryawan.tsx — SEMENTARA: full page ke halaman Karyawan SPA (tanpa backgroundLocation)
{
  const f = readNorm(F.tabKaryawan);
  if (f.text.includes('useAppNavigate')) fail('TabKaryawan.tsx sudah memakai useAppNavigate.');
  let t = f.text;
  t = replaceOnce(
    t,
    'tabkaryawan import',
    "import { useNavigate, useLocation } from 'react-router-dom';\n",
    "import { useAppNavigate } from '../../hooks/useAppNavigate';\n"
  );
  t = replaceOnce(
    t,
    'tabkaryawan hooks',
    '    const navigate = useNavigate();\n    const location = useLocation();\n',
    '    // SEMENTARA (P10): halaman Karyawan masih SPA (overlay RouteModal) -> useAppNavigate = full page load.\n' +
      '    // Overlay-nya dikerjakan di P12.\n' +
      '    const navigate = useAppNavigate();\n'
  );
  t = replaceN(t, 'tabkaryawan state', ', { state: { backgroundLocation: location } })', ')', 5);
  if (/\blocation\b/.test(t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) fail('TabKaryawan.tsx masih memakai `location` di tempat lain — cek manual.');
  edits.push({ path: F.tabKaryawan, eol: f.eol, text: t });
}

// 7. Halaman Karyawan SPA — balik ke list = full page load ke Master Data
function patchKaryawan(file, label, { combined, indent, navCalls, fallbacks }) {
  const f = readNorm(file);
  if (f.text.includes('useAppNavigate')) fail(`${label} sudah memakai useAppNavigate.`);
  let t = f.text;
  if (combined) {
    t = replaceOnce(
      t,
      `${label} import`,
      "import { useNavigate, useParams } from 'react-router-dom';\n",
      "import { useParams } from 'react-router-dom';\nimport { useAppNavigate } from '../../../hooks/useAppNavigate';\n"
    );
  } else {
    t = replaceOnce(
      t,
      `${label} import`,
      "import { useNavigate } from 'react-router-dom';\n",
      "import { useAppNavigate } from '../../../hooks/useAppNavigate';\n"
    );
  }
  t = replaceOnce(t, `${label} hook`, `${indent}const navigate = useNavigate();\n`, `${indent}const navigate = useAppNavigate();\n`);
  t = replaceN(t, `${label} navigate('/karyawan'`, "navigate('/karyawan'", "navigate('/master-data?tab=karyawan'", navCalls);
  t = replaceN(t, `${label} fallbackPath`, 'fallbackPath="/karyawan"', 'fallbackPath="/master-data?tab=karyawan"', fallbacks);
  edits.push({ path: file, eol: f.eol, text: t });
}
patchKaryawan(F.kCreate, 'KaryawanCreate.tsx', { combined: false, indent: '    ', navCalls: 2, fallbacks: 1 });
patchKaryawan(F.kDetail, 'KaryawanDetail.tsx', { combined: true, indent: '  ', navCalls: 1, fallbacks: 3 });
patchKaryawan(F.kEdit, 'KaryawanEdit.tsx', { combined: true, indent: '    ', navCalls: 3, fallbacks: 2 });

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
  fs.writeFileSync(n.path, n.text.replace(/\n/g, n.eol ?? '\n'), 'utf8');
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
ok = run('php artisan route:list --path=master-data') && ok;

console.log(
  ok
    ? '\n✓ Cek lolos. Lanjut: npm run build, tes manual (lihat bawah), lalu commit.'
    : '\n✗ Ada cek yang gagal. Rollback: git checkout . ; git clean -fd app/Http/Controllers/MasterData/MasterDataPageController.php resources/js/inertia/pages/MasterData'
);
console.log(`
Tes manual (boleh digabung nanti di checkpoint setelah P11):
  1. Login admin -> /master-data: tab Inventory tampil. Pindah semua tab (Kategori, Data User, Cabang, ...): URL ikut berubah (?tab=), tanpa full reload.
  2. Hard refresh di /master-data?tab=supplier -> langsung ke tab itu. /master-data tanpa query -> tab Inventory.
  3. Login non-admin -> /master-data?tab=kategori -> jatuh ke tab Inventory, tab bar cuma Inventory.
  4. Tab Data User: klik "Tambah", lihat (mata), edit (pensil) -> SEMENTARA full page ke halaman Karyawan SPA (bukan overlay lagi).
     Di sana tutup / simpan / hapus -> balik ke /master-data?tab=karyawan (full load), BUKAN layar kosong.
  5. Buka /inventory, /karyawan, /cabang -> redirect ke tab masing-masing di /master-data.
  6. Klik "Master Data" di sidebar dari halaman SPA (mis. Penanganan) -> full load; dari sini ke Penanganan -> full load.
  7. Dari Dashboard klik widget inventory -> masuk /master-data?tab=inventory.
`);
process.exit(ok ? 0 : 1);
