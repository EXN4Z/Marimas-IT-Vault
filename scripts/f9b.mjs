#!/usr/bin/env node
// F9b — autocomplete karyawan (Serah-Terima Inventory) lepas dari axios & /api: route web JSON + requestJson.
// Jalankan dari root project:  node f9b.mjs --dry | node f9b.mjs | node f9b.mjs --revert
// Prasyarat: f9.mjs sudah dijalankan (butuh lib/http.ts).
import fs from 'node:fs';
import path from 'node:path';

const R = String.raw;
const ROOT = process.cwd();
const PHASE = 'f9b';
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', PHASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const argv = new Set(process.argv.slice(2));
const DRY = argv.has('--dry');
const REVERT = argv.has('--revert');

const P = (p) => path.join(ROOT, ...p.split('/'));
const exists = (p) => fs.existsSync(P(p));

if (!exists('artisan') || !exists('routes/web.php')) {
  console.error('GAGAL: jalankan dari root project Laravel (artisan / routes/web.php tidak ditemukan).');
  process.exit(1);
}
if (!exists('resources/js/lib/http.ts')) {
  console.error('GAGAL: resources/js/lib/http.ts tidak ada. Jalankan node f9.mjs dulu.');
  process.exit(1);
}

const NEW_FILES = {};
const EDITS = {};

EDITS['routes/web.php'] = [
  {
    name: 'use UserController',
    marker: R`use App\Http\Controllers\MasterData\UserController;`,
    find: R`use App\Http\Controllers\MasterData\KaryawanWebController;`,
    replace: R`use App\Http\Controllers\MasterData\KaryawanWebController;
use App\Http\Controllers\MasterData\UserController;`,
  },
  {
    name: 'route cari karyawan',
    marker: `'/karyawan/cari'`,
    find: `        Route::post('/karyawan/import', [KaryawanWebController::class, 'import']);`,
    replace: `        // [F9b-INERTIA] Autocomplete karyawan (modal Serah-Terima): SENGAJA JSON (per ketikan, bukan visit Inertia).
        // Controller SAMA dengan GET /api/karyawan (filter search/role), admin-only seperti aslinya. Statis di atas {id}.
        Route::get('/karyawan/cari', [UserController::class, 'index']);
        Route::post('/karyawan/import', [KaryawanWebController::class, 'import']);`,
  },
];

EDITS['resources/js/components/masterData/inventory/InventorySerahTerimaModal.tsx'] = [
  {
    name: 'import',
    marker: `import { requestJson } from '../../../lib/http';`,
    start: `// [F5-INERTIA] Submit lewat router.post ke /master-data/inventory/{id}/pemakai (bukan axios). searchKaryawan TETAP axios:`,
    end: `import { searchKaryawan, type InventoryPemakai, type KaryawanUser } from '../../../api/transaksi/inventoryPemakai';`,
    replace: `// [F5-INERTIA] Submit lewat router.post ke /master-data/inventory/{id}/pemakai. Autocomplete karyawan = pengecualian JSON
// (per ketikan, tidak cocok jadi visit Inertia): GET /master-data/karyawan/cari lewat requestJson [F9b], bukan axios.
import { requestJson } from '../../../lib/http';
import type { InventoryPemakai, KaryawanUser } from '../../../api/transaksi/inventoryPemakai';`,
  },
  {
    name: 'panggilan',
    marker: `/master-data/karyawan/cari?search=`,
    find: `        const data = await searchKaryawan(query.trim());`,
    replace: `        const data = await requestJson<KaryawanUser[]>(
          'GET',
          '/master-data/karyawan/cari?search=' + encodeURIComponent(query.trim()),
        );`,
  },
];

// ---------------------------------------------------------------------------------------------
// MESIN (tidak perlu diubah)
// ---------------------------------------------------------------------------------------------
const log = (...a) => console.log(...a);

function readFile(rel) {
  const raw = fs.readFileSync(P(rel), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { raw, eol, text: eol === '\r\n' ? raw.replace(/\r\n/g, '\n') : raw };
}

const withEol = (text, eol) => (eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
const countOf = (hay, needle) => (needle === '' ? 0 : hay.split(needle).length - 1);

function applyOps(rel, text, ops) {
  const report = [];
  let cur = text;
  for (const op of ops) {
    if (cur.includes(op.marker)) {
      report.push({ op: op.name, status: 'skip' });
      continue;
    }
    if (op.find !== undefined) {
      const n = countOf(cur, op.find);
      if (n !== 1) return { error: `[${rel}] anchor "${op.name}" ${n === 0 ? 'TIDAK ketemu' : 'ketemu ' + n + 'x (harus tepat 1x)'}.` };
      cur = cur.replace(op.find, () => op.replace);
    } else {
      const ns = countOf(cur, op.start);
      const ne = countOf(cur, op.end);
      if (ns !== 1) return { error: `[${rel}] anchor awal "${op.name}" ${ns === 0 ? 'TIDAK ketemu' : 'ketemu ' + ns + 'x (harus tepat 1x)'}.` };
      if (ne !== 1) return { error: `[${rel}] anchor akhir "${op.name}" ${ne === 0 ? 'TIDAK ketemu' : 'ketemu ' + ne + 'x (harus tepat 1x)'}.` };
      const si = cur.indexOf(op.start);
      const ei = cur.indexOf(op.end);
      if (ei < si) return { error: `[${rel}] anchor "${op.name}": akhir berada sebelum awal.` };
      cur = cur.slice(0, si) + op.replace + cur.slice(ei + op.end.length);
    }
    if (!cur.includes(op.marker)) return { error: `[${rel}] "${op.name}": marker tidak muncul setelah edit (bug script).` };
    report.push({ op: op.name, status: 'apply' });
  }
  return { text: cur, report };
}

function copyToBackup(rel) {
  const dest = path.join(BACKUP_DIR, ...rel.split('/'));
  if (fs.existsSync(dest)) return; // jangan timpa backup asli
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(P(rel), dest);
}

function revert() {
  if (!fs.existsSync(MANIFEST)) {
    log('Tidak ada manifest F9b (.migrasi-backup/f9/manifest.json): tidak ada yang bisa di-revert.');
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const restored = [];
  const removed = [];
  for (const rel of m.modified ?? []) {
    const src = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!fs.existsSync(src)) {
      console.error(`PERINGATAN: backup ${rel} hilang, dilewati.`);
      continue;
    }
    if (!DRY) fs.copyFileSync(src, P(rel));
    restored.push(rel);
  }
  for (const rel of m.created ?? []) {
    if (exists(rel)) {
      if (!DRY) fs.unlinkSync(P(rel));
      removed.push(rel);
    }
  }
  if (!DRY) fs.unlinkSync(MANIFEST);
  log(`\n${DRY ? '[DRY] ' : ''}REVERT F9b selesai`);
  log(`  dikembalikan: ${restored.length}`);
  restored.forEach((f) => log('    ~ ' + f));
  log(`  file baru dihapus: ${removed.length}`);
  removed.forEach((f) => log('    - ' + f));
}

function main() {
  if (REVERT) return revert();

  const eolNew = readFile('routes/web.php').eol; // file baru ikut line ending project
  const results = [];
  const errors = [];

  for (const [rel, content] of Object.entries(NEW_FILES)) {
    const text = withEol(content, eolNew);
    if (exists(rel)) {
      const cur = fs.readFileSync(P(rel), 'utf8');
      if (cur === text) results.push({ rel, kind: 'skip', note: 'sudah ada (identik)' });
      else errors.push(`[${rel}] sudah ada tapi isinya beda dari yang diharapkan F9b. Hapus/periksa dulu, script tidak menimpa.`);
    } else {
      results.push({ rel, kind: 'create', text });
    }
  }

  for (const [rel, ops] of Object.entries(EDITS)) {
    if (!exists(rel)) {
      errors.push(`[${rel}] file tidak ditemukan.`);
      continue;
    }
    const { raw, eol, text } = readFile(rel);
    const r = applyOps(rel, text, ops);
    if (r.error) {
      errors.push(r.error);
      continue;
    }
    const changed = r.report.some((x) => x.status === 'apply');
    results.push({
      rel,
      kind: changed ? 'modify' : 'skip',
      note: r.report.map((x) => `${x.status === 'apply' ? '+' : '='} ${x.op}`).join('; '),
      text: changed ? withEol(r.text, eol) : raw,
    });
  }

  if (errors.length) {
    console.error('\nGAGAL — tidak ada file yang diubah:');
    errors.forEach((e) => console.error('  ✗ ' + e));
    console.error('\nKemungkinan file sudah berbeda dari kondisi saat F9b ditulis. Kirim isi file terkait, jangan edit manual dulu.');
    process.exit(1);
  }

  const created = results.filter((r) => r.kind === 'create');
  const modified = results.filter((r) => r.kind === 'modify');
  const skipped = results.filter((r) => r.kind === 'skip');

  if (!DRY) {
    for (const r of modified) copyToBackup(r.rel);
    for (const r of [...created, ...modified]) {
      fs.mkdirSync(path.dirname(P(r.rel)), { recursive: true });
      fs.writeFileSync(P(r.rel), r.text, 'utf8');
    }
    if (created.length || modified.length) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      let prev = { created: [], modified: [] };
      if (fs.existsSync(MANIFEST)) prev = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
      const uni = (a, b) => [...new Set([...(a ?? []), ...b])];
      fs.writeFileSync(
        MANIFEST,
        JSON.stringify(
          {
            created: uni(prev.created, created.map((r) => r.rel)),
            modified: uni(prev.modified, modified.map((r) => r.rel)),
            deleted: [],
          },
          null,
          2,
        ),
        'utf8',
      );
    }
  }

  log(`\n${DRY ? '[DRY RUN — tidak ada yang ditulis] ' : ''}RINGKASAN F9b`);
  log(`  dibuat   (${created.length})`);
  created.forEach((r) => log('    + ' + r.rel));
  log(`  diubah   (${modified.length})`);
  modified.forEach((r) => log('    ~ ' + r.rel + '   [' + r.note + ']'));
  log(`  dihapus  (0)`);
  log(`  dilewati (${skipped.length})${skipped.length ? ' — sudah diterapkan / identik' : ''}`);
  skipped.forEach((r) => log('    = ' + r.rel));

  if (!DRY && (created.length || modified.length)) {
    log(`\nBackup: .migrasi-backup/${PHASE}/   (kembalikan: node f9b.mjs --revert)`);
  }
  log('\nPerintah verifikasi (jalankan sendiri):');
  log('  npx tsc --noEmit');
  log('  npm run build');
  log('  php artisan route:list --path=karyawan/cari');
}

main();
