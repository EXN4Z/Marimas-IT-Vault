// P11 — Migrasi menu Penanganan Inventory (/penanganan-inventory) dari SPA ke Inertia. CUMA PINDAH SHELL:
// data tetap axios (usePenangananData: GET /api/inventory-penanganan + polling 10 detik), scoping non-admin
// (hanya laporan terkait pemakaiannya) tetap di InventoryPenangananController::index -- TIDAK disentuh.
//
// Jalankan dari ROOT project:
//   node scripts/p11-penanganan-inventory.mjs --dry        -> cek doang
//   node scripts/p11-penanganan-inventory.mjs              -> tulis + cek (tsc, route:list)
//   node scripts/p11-penanganan-inventory.mjs --no-check   -> tulis, skip tsc/route:list
//
// Yang dilakukan:
//  Backend
//   + Transaksi/PenangananInventoryPageController.php  (GET /penanganan-inventory -> Inertia::render)
//   ~ routes/web.php                                   (GET /penanganan-inventory di grup auth, semua role)
//  Frontend
//   + inertia/pages/PenangananInventory/Index.tsx      (wrapper tipis; isi halaman TETAP di pages/transaksi/PenangananInventory/)
//   ~ lib/inertiaRoutes.ts                             (+ '/penanganan-inventory')
//   ~ App.tsx                                          (hapus import + route /penanganan-inventory)
//
// Folder pages/transaksi/PenangananInventory/ (index.tsx, usePenangananData, modal, tabel, dst) TIDAK dipindah:
// halaman ini tidak memakai react-router sama sekali, jadi tidak ada yang perlu diubah di dalamnya.
// Wrapper-nya sengaja TIDAK meneruskan props Inertia ke halaman (prop `onCount` milik halaman lama).
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
  pageCtrl: R('app/Http/Controllers/Transaksi/PenangananInventoryPageController.php'),
  web: R('routes/web.php'),
  page: R('resources/js/inertia/pages/PenangananInventory/Index.tsx'),
  routesTs: R('resources/js/lib/inertiaRoutes.ts'),
  appTsx: R('resources/js/App.tsx'),
  oldIndex: R('resources/js/pages/transaksi/PenangananInventory/index.tsx'),
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
  if (fs.existsSync(F[k])) fail(`${path.relative('.', F[k])} sudah ada — P11 kelihatannya sudah dikerjakan.`);
}
if (!fs.existsSync(R('resources/js/components/layout/InertiaAppLayout.tsx'))) fail('InertiaAppLayout.tsx belum ada — jalankan P5 dulu.');
if (!readNorm(F.web).text.includes('MasterDataPageController')) fail('routes/web.php belum memuat Master Data — jalankan P8, P9, P10 dulu.');
{
  const idx = readNorm(F.oldIndex).text;
  if (/react-router/.test(idx)) fail('pages/transaksi/PenangananInventory/index.tsx memakai react-router — wrapper tipis tidak cukup, cek manual.');
  if (!/export default function PenangananInventory\(/.test(idx)) fail('index.tsx bukan `export default function PenangananInventory(` — cek manual.');
}

const edits = []; // { path, eol, text }
const newFiles = []; // { path, text }

// 1. Controller halaman
newFiles.push({
  path: F.pageCtrl,
  text: String.raw`<?php

namespace App\Http\Controllers\Transaksi;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class PenangananInventoryPageController extends Controller
{
    // GET /penanganan-inventory   (middleware: auth; semua role)
    // Scoping non-admin (hanya laporan terkait pemakaiannya) ada di InventoryPenangananController::index
    // (GET /api/inventory-penanganan) dan TIDAK diubah. Data masih lewat /api (axios) -- dipindah ke props di F6.
    public function __invoke()
    {
        return Inertia::render('PenangananInventory/Index');
    }
}
`,
});

// 2. routes/web.php
{
  const f = readNorm(F.web);
  if (f.text.includes('PenangananInventoryPageController')) fail('routes/web.php sudah memuat PenangananInventoryPageController.');
  let t = f.text;
  t = replaceOnce(
    t,
    'web use',
    'use App\\Http\\Controllers\\Settings\\SettingsController;\n',
    'use App\\Http\\Controllers\\Settings\\SettingsController;\nuse App\\Http\\Controllers\\Transaksi\\PenangananInventoryPageController;\n'
  );
  t = replaceOnce(
    t,
    'web group',
    "    Route::get('/master-data', MasterDataPageController::class);\n",
    "    Route::get('/master-data', MasterDataPageController::class);\n\n" +
      '    // Penanganan Inventory (semua role; non-admin hanya lihat laporan miliknya -- scoping di controller API)\n' +
      "    Route::get('/penanganan-inventory', PenangananInventoryPageController::class);\n"
  );
  edits.push({ path: F.web, eol: f.eol, text: t });
}

// 3. Halaman Inertia (wrapper tipis)
newFiles.push({
  path: F.page,
  text: `import PenangananInventory from '../../../pages/transaksi/PenangananInventory';

// Tahap P11: SHELL doang. Isi halaman (usePenangananData: axios + polling 10 detik, modal, tabel) TETAP di
// pages/transaksi/PenangananInventory/. Props Inertia sengaja tidak diteruskan (halaman lama punya prop
// \`onCount\` sendiri, tidak ada hubungannya dengan props server).
export default function PenangananInventoryPage() {
  return <PenangananInventory />;
}
`,
});

// 4. lib/inertiaRoutes.ts
{
  const f = readNorm(F.routesTs);
  if (/'\/penanganan-inventory'/.test(f.text)) fail("inertiaRoutes.ts sudah memuat '/penanganan-inventory'.");
  const t = replaceOnce(f.text, 'inertiaRoutes', "  '/master-data',\n];", "  '/master-data',\n  '/penanganan-inventory',\n];");
  edits.push({ path: F.routesTs, eol: f.eol, text: t });
}

// 5. App.tsx
{
  const f = readNorm(F.appTsx);
  let t = f.text;
  t = replaceOnce(t, 'App import', "import PenangananInventory from './pages/transaksi/PenangananInventory';\n", '');
  t = replaceOnce(t, 'App route', "          <Route path='/penanganan-inventory' element={<PenangananInventory />} />\n", '');
  edits.push({ path: F.appTsx, eol: f.eol, text: t });
}

// ── ringkasan ──────────────────────────────────────────────────────────────
const rel = (p) => path.relative('.', p).replace(/\\/g, '/');
console.log('Rencana:');
for (const n of newFiles) console.log(`  + ${rel(n.path)}`);
for (const e of edits) console.log(`  ~ ${rel(e.path)}`);

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
ok = run('php artisan route:list --path=penanganan') && ok;

console.log(
  ok
    ? '\n✓ Cek lolos. Lanjut: npm run build, tes manual (lihat bawah), lalu commit.'
    : '\n✗ Ada cek yang gagal. Rollback: git checkout . ; git clean -fd app/Http/Controllers/Transaksi/PenangananInventoryPageController.php resources/js/inertia/pages/PenangananInventory'
);
console.log(`
Tes manual (INI checkpoint tes sebelum Karyawan -- sekalian tes P8-P10):
  1. Login admin -> /penanganan-inventory: KPI, tab status, tabel muncul. Polling 10 detik jalan (lihat tab Network).
  2. Aksi: lapor, terima, update, hapus/import -> data ter-update (masih axios).
  3. Login non-admin (role user) -> hanya laporan terkait pemakaiannya (scoping API tidak berubah).
  4. Hard refresh di /penanganan-inventory.
  5. Klik Penanganan dari sidebar halaman SPA (mis. halaman Karyawan) -> full load; dari sini ke Master Data/Dashboard/Laporan -> client-side (semuanya Inertia).
  6. Dari Dashboard klik widget "Proses Perbaikan" -> masuk sini.

Checkpoint sidebar (semua menu Inertia kecuali Karyawan): klik tiap menu bolak-balik, dropdown Master Data & Laporan, logout, login lagi.
`);
process.exit(ok ? 0 : 1);
