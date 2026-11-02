// Jalankan dari root project:  node fix-logic.mjs   (--dry untuk cek, --revert untuk balikin)
// 1) LogActivity: update inventory (route PUT) sekarang tercatat "mengubah data inventory <kode>"
// 2) InventoryRowActions: renderAksiInventory/renderAksi pakai InventoryRow (punya children_count)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// root project = folder terdekat (naik dari lokasi script / cwd) yang punya package.json + resources/js,
// jadi aman dijalankan dari root maupun dari dalam scripts/
function findRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const start of [process.cwd(), here]) {
    let d = path.resolve(start);
    for (;;) {
      if (fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'resources', 'js'))) return d;
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
  }
  return process.cwd();
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
const root = findRoot(args.find((a) => !a.startsWith('--')));
const BK = path.join(root, '.migrasi-backup', 'fix-logic');

const edits = [
  ['app/Http/Middleware/LogActivity.php', [[
    "($uri === 'inventory/{inventory}' || $uri === 'aset/{aset}') && $method === 'POST' =>",
    "($uri === 'inventory/{inventory}' || $uri === 'aset/{aset}') && in_array($method, ['POST', 'PUT', 'PATCH'], true) =>",
  ]]],
  ['resources/js/features/inventory/list/InventoryRowActions.tsx', [
    ['const renderAksi = (a: Inventory) =>', 'const renderAksi = (a: InventoryRow) =>'],
    ['const renderAksiInventory = (a: Inventory) => {', 'const renderAksiInventory = (a: InventoryRow) => {'],
  ]],
];

for (const [rel] of edits) {
  const f = path.join(root, rel);
  const b = path.join(BK, rel);
  if (REVERT) {
    if (fs.existsSync(b)) { fs.copyFileSync(b, f); console.log('dikembalikan ' + rel); }
    continue;
  }
  let t = fs.readFileSync(f, 'utf8');
  const orig = t;
  for (const [from, to] of edits.find((e) => e[0] === rel)[1]) {
    if (t.includes(to)) { console.log('  sudah ter-patch: ' + rel); continue; }
    if (!t.includes(from)) { console.log('  ! tidak ketemu, dilewati: ' + from.slice(0, 60)); continue; }
    t = t.replace(from, to);
    console.log((DRY ? '  [dry] ' : '  ok ') + rel);
  }
  if (!DRY && t !== orig) {
    fs.mkdirSync(path.dirname(b), { recursive: true });
    if (!fs.existsSync(b)) fs.writeFileSync(b, orig);
    fs.writeFileSync(f, t);
  }
}
