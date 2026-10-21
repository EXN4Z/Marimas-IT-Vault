// Pakai: node scripts/fase5-queries.mjs [--commit]
// Pindahkan daftar() static dari 5 controller master-data ke app/Queries/MasterData/{Cabang,Perusahaan,Departemen,Kategori,Supplier}Query.php
// dan arahkan semua pemanggilnya. Isi query dipindah apa adanya. Idempotent.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const CTL_DIR = 'app/Http/Controllers/MasterData';
const Q_DIR = 'app/Queries/MasterData';
const CALLERS = [
  'app/Http/Controllers/Laporan/LaporanPageController.php',
  `${CTL_DIR}/InventoryController.php`,
  `${CTL_DIR}/KaryawanController.php`,
  `${CTL_DIR}/MasterDataPageController.php`,
];
const ENTITIES = [
  { name: 'Cabang', model: 'LokasiKantor' },
  { name: 'Perusahaan', model: 'Perusahaan' },
  { name: 'Departemen', model: 'Departemen' },
  { name: 'Kategori', model: 'Kategori' },
  { name: 'Supplier', model: 'Supplier' },
];
const DAFTAR_RE = /(?:    \/\/[^\n]*\n)*    public static function daftar\(\): array\n    \{\n([\s\S]*?)\n    \}\n\n?/;
const read = (p) => fs.readFileSync(p, 'utf8');
const touched = new Set();
const die = (m) => { console.error('X ' + m); process.exit(1); };

fs.mkdirSync(Q_DIR, { recursive: true });

for (const { name, model } of ENTITIES) {
  const ctlPath = `${CTL_DIR}/${name}Controller.php`;
  const qPath = `${Q_DIR}/${name}Query.php`;
  let s = read(ctlPath);
  const m = s.match(DAFTAR_RE);
  if (!m) {
    if (fs.existsSync(qPath)) { console.log(`= ${name}: sudah dipindah`); continue; }
    die(`daftar() tidak ditemukan di ${ctlPath}`);
  }
  const body = m[1];
  const query = `<?php

namespace App\\Queries\\MasterData;

use App\\Models\\MasterData\\${model};

// Dipindah dari ${name}Controller::daftar() -- isi query identik.
// Data tab ${name} untuk props halaman Master Data (juga dipakai dropdown di Inventory, Karyawan, Laporan).
class ${name}Query
{
    public static function daftar(): array
    {
${body}
    }
}
`;
  fs.writeFileSync(qPath, query); touched.add(qPath);
  console.log(`+ ${qPath}`);

  s = s.replace(DAFTAR_RE, '');
  // hapus import model kalau controller tidak memakainya lagi
  const useLine = `use App\\Models\\MasterData\\${model};\n`;
  if (s.includes(useLine) && s.split(model).length - 1 <= 1) s = s.replace(useLine, '');
  fs.writeFileSync(ctlPath, s); touched.add(ctlPath);
  console.log(`~ ${ctlPath}`);
}

// arahkan pemanggil
for (const p of CALLERS) {
  let s = read(p); const orig = s;
  const used = [];
  for (const { name } of ENTITIES) {
    const re = new RegExp(`\\b${name}Controller::daftar\\(\\)`, 'g');
    if (re.test(s)) { s = s.replace(re, `${name}Query::daftar()`); used.push(name); }
  }
  if (!used.length) continue;
  for (const name of used) {
    const useQ = `use App\\Queries\\MasterData\\${name}Query;\n`;
    if (!s.includes(useQ)) s = s.replace(/^(namespace [^\n]+;\n\n)/m, `$1${useQ}`);
    // buang import controller yang tak terpakai lagi
    const useC = `use App\\Http\\Controllers\\MasterData\\${name}Controller;\n`;
    if (s.includes(useC) && s.split(`${name}Controller`).length - 1 <= 1) s = s.replace(useC, '');
  }
  if (s !== orig) { fs.writeFileSync(p, s); touched.add(p); console.log(`~ ${p}`); }
}

// pastikan tidak ada pemanggil tersisa
try {
  const left = execSync(`git grep -nE "(Cabang|Perusahaan|Departemen|Kategori|Supplier)Controller::daftar" -- app routes tests`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if (left.trim()) die(`masih ada pemanggil lama:\n${left}`);
} catch { /* git grep exit 1 = tidak ada hasil = bagus */ }

const files = [...touched];
for (const f of files) {
  try { execSync(`php -l ${f}`, { stdio: 'pipe' }); }
  catch { die(`php -l GAGAL: ${f}`); }
}
console.log(`  php -l OK (${files.length} file)`);
try { execSync('php artisan route:list --json', { stdio: 'pipe' }); console.log('  route:list OK'); }
catch { die('route:list gagal'); }

if (process.argv.includes('--commit')) {
  execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
  execSync('git commit -m "refactor(fase-5): daftar() master-data -> app/Queries/MasterData/*Query"', { stdio: 'inherit' });
}
console.log('Selesai. Tes manual: tab Cabang/Perusahaan/Departemen/Kategori/Supplier, form Inventory & Karyawan (dropdown), filter Laporan.');
