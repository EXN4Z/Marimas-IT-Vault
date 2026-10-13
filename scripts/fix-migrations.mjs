#!/usr/bin/env node
// Rapihin migration (tanpa mengubah skema hasil `migrate`):
//   1. 2026_09_23_000000_remove_cabang_role  -> tambah ekstensi .php (tanpa .php Laravel meng-SKIP file ini,
//      jadi role 'cabang' + user-nya tidak pernah dibersihin di DB lama)
//   2. down() yang rusak, supaya migrate:rollback / migrate:refresh tidak error:
//        - add_perusahaan_id_to_users_table : dropForeign("perusahaan_id") -> dropConstrainedForeignId
//        - add_status_to_user_table         : down() kosong & salah tabel -> dropColumn('status') di users
//        - add_unique_*_lokasi_kantor/perusahaan : dropUnique('alamat') -> dropUnique(['alamat'])
//
// Taruh di <root>\scripts\fix-migrations.mjs, jalankan dari ROOT project:
//   node scripts/fix-migrations.mjs
// Aman dijalankan berulang. Kalau anchor tidak ketemu, TIDAK ADA yang diubah. CRLF/LF dipertahankan.
// Hanya mengubah isi down() + nama file; DB yang sudah ter-migrate tidak terpengaruh.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'database', 'migrations');
if (!fs.existsSync(path.join(root, 'artisan')) || !fs.existsSync(dir)) {
  console.error('artisan / database/migrations tidak ketemu. Jalankan dari ROOT project.');
  process.exit(1);
}

const nl = (s) => s.replace(/\r\n/g, '\n');
const plan = []; // { file, content, crlf, note }
const renames = [];
const errors = [];
const notes = [];

function patch(pattern, fn) {
  const matches = fs.readdirSync(dir).filter((n) => n.includes(pattern) && n.endsWith('.php'));
  if (matches.length !== 1) {
    errors.push(`migration "*${pattern}*.php": ketemu ${matches.length} file (harus tepat 1)`);
    return;
  }
  const file = path.join(dir, matches[0]);
  const raw = fs.readFileSync(file, 'utf8');
  const before = nl(raw);
  try {
    const after = fn(before);
    if (after === before) return notes.push(`= ${matches[0]} (sudah beres, dilewati)`);
    plan.push({ file, content: after, crlf: raw.includes('\r\n'), note: `~ database/migrations/${matches[0]}` });
  } catch (e) {
    errors.push(`${matches[0]}: ${e.message}`);
  }
}

function must(s, re, to, label) {
  if (!re.test(s)) throw new Error(`anchor tidak ketemu: ${label}`);
  return s.replace(re, to);
}

// ---- 1. rename file tanpa .php ----
const noExt = fs.readdirSync(dir).filter((n) => /^\d{4}_\d{2}_\d{2}_\d{6}_/.test(n) && !n.endsWith('.php'));
for (const n of noExt) {
  const target = n + '.php';
  if (fs.existsSync(path.join(dir, target))) errors.push(`${n}: ${target} sudah ada`);
  else renames.push([n, target]);
}

// ---- 2. down() ----
patch('add_perusahaan_id_to_users_table', (s) => {
  if (s.includes('dropConstrainedForeignId')) return s;
  return must(
    s,
    /\$table->dropForeign\(\s*["']perusahaan_id["']\s*\);\s*\n\s*\$table->dropColumn\(\s*["']perusahaan_id["']\s*\);/,
    "$table->dropConstrainedForeignId('perusahaan_id');",
    'dropForeign("perusahaan_id") + dropColumn',
  );
});

patch('add_status_to_user_table', (s) => {
  if (/dropColumn\(\s*["']status["']\s*\)/.test(s)) return s;
  return must(
    s,
    /(public function down\(\): void\s*\{\s*)Schema::table\(\s*["']inventory["'],\s*function \(Blueprint \$table\) \{\s*\/\/\s*\}\);/,
    "$1Schema::table('users', function (Blueprint $table) {\n            $table->dropColumn('status');\n        });",
    "down() kosong di tabel 'inventory'",
  );
});

for (const tabel of ['lokasi_kantor', 'perusahaan']) {
  patch(tabel === 'lokasi_kantor' ? 'add_unique_to_lokasi_kantor' : 'add_unique_columns_to_perusahaan', (s) => {
    if (s.includes("dropUnique(['alamat'])")) return s;
    s = must(s, /\$table->dropUnique\(\s*["']alamat["']\s*\);/, "$table->dropUnique(['alamat']);", 'dropUnique alamat');
    s = must(s, /\$table->dropUnique\(\s*["']link["']\s*\);/, "$table->dropUnique(['link']);", 'dropUnique link');
    return s;
  });
}

if (errors.length) {
  console.error('\nBATAL, tidak ada yang diubah:\n');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

for (const p of plan) {
  fs.writeFileSync(p.file, p.crlf ? p.content.replace(/\n/g, '\r\n') : p.content);
  console.log(p.note);
}
for (const [from, to] of renames) {
  fs.renameSync(path.join(dir, from), path.join(dir, to));
  console.log(`> rename ${from} -> ${to}`);
}
for (const n of notes) console.log(n);
console.log(`\nSelesai: ${plan.length} file diubah, ${renames.length} di-rename.`);
if (renames.length) {
  console.log('Catatan: migration yang tadinya di-skip akan JALAN di migrate berikutnya (di DB lama: role "cabang" dihapus,');
  console.log('user-nya dipindah ke role "user"). Di DB baru efeknya no-op.');
}
