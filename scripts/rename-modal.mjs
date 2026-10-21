// Pakai: node scripts/rename-modal.mjs [--commit]
// Rename identifier RouteModal -> Modal (komponen di components/modal/Modal.tsx + semua pemakainya). Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = 'resources/js';
const SKIP = new Set([path.normalize('resources/js/components/layout/PageCard.tsx')]); // komentar sejarah, biarkan
const changed = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name) && !SKIP.has(path.normalize(p))) patch(p);
  }
}
function patch(p) {
  const s = fs.readFileSync(p, 'utf8');
  const n = s.replace(/\bRouteModalProps\b/g, 'ModalProps').replace(/\bRouteModal\b/g, 'Modal');
  if (n !== s) { fs.writeFileSync(p, n); changed.push(p.replaceAll('\\', '/')); console.log(`~ ${p}`); }
}
walk(ROOT);
if (!changed.length) { console.log('= tidak ada yang perlu diubah (sudah di-rename)'); process.exit(0); }

// verifikasi: tidak boleh ada error TypeScript baru
try { execSync('npx tsc --noEmit', { stdio: 'inherit' }); console.log('  tsc: OK'); }
catch { console.error('X tsc GAGAL -- cek error di atas. Rollback: git checkout -- resources/js'); process.exit(1); }

if (process.argv.includes('--commit')) {
  execSync(`git add ${changed.map((f) => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
  execSync('git commit -m "refactor(fase-1): rename identifier RouteModal -> Modal"', { stdio: 'inherit' });
}
console.log('Selesai.');
