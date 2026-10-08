// Fase 1 migrasi SPA -> Inertia (semua halaman dilayani Inertia).
// Jalankan dari ROOT project, SETELAH zip di-extract ke root:
//     node phase1/apply.mjs
// Aman dijalankan ulang. Backup file yang diubah: .phase1-backup/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const f = (...p) => path.join(root, ...p);
const rel = (from, to) => {
  let r = path.relative(path.dirname(from), to).split(path.sep).join('/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
};

// 1. Pastikan file baru dari zip sudah ada
const required = [
  'resources/js/lib/router.tsx',
  'resources/js/inertia-app.tsx',
  'resources/js/inertia/pages/Dashboard.tsx',
  'resources/js/inertia/pages/Auth/Login.tsx',
  'resources/js/inertia/pages/Karyawan/Create.tsx',
  'routes/web.php',
];
const missing = required.filter((p) => !fs.existsSync(f(p)));
if (missing.length) {
  console.error('\nGAGAL: file dari zip belum ada. Extract zip ke ROOT project dulu:\n  ' + missing.join('\n  '));
  process.exit(1);
}

// 2. Cari semua file yang masih import react-router-dom (kecuali SPA lama + shim)
const skip = new Set(['resources/js/App.tsx', 'resources/js/main.tsx', 'resources/js/lib/router.tsx']);
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });

const targets = walk(f('resources/js'))
  .filter((p) => /\.(tsx?|jsx?)$/.test(p))
  .map((p) => path.relative(root, p).split(path.sep).join('/'))
  .filter((p) => !skip.has(p))
  .filter((p) => fs.readFileSync(f(p), 'utf8').includes("'react-router-dom'"));

const backup = (p) => {
  const dest = f('.phase1-backup', p);
  if (fs.existsSync(dest)) return; // jangan timpa backup pertama
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f(p), dest);
};

let changed = 0;
for (const p of targets) {
  let s = fs.readFileSync(f(p), 'utf8');
  const shim = rel(f(p), f('resources/js/lib/router'));
  s = s.replace(/from 'react-router-dom'/g, `from '${shim}'`);

  // RouteModal: history.state.idx itu milik react-router, ganti ke penanda shim.
  if (p === 'resources/js/components/shared/RouteModal.tsx') {
    const cond = 'window.history.state && window.history.state.idx > 0';
    if (!s.includes(cond)) {
      console.error('GAGAL: kondisi history.state.idx di RouteModal.tsx gak ketemu.');
      process.exit(1);
    }
    s = s.replace(cond, 'hasInAppNavigation()');
    s = s.replace(/import \{ useNavigate \} from '([^']+)';/, "import { useNavigate, hasInAppNavigation } from '$1';");
  }

  backup(p);
  fs.writeFileSync(f(p), s);
  changed++;
  console.log('  ✔ ' + p);
}

console.log(`\n${changed} file diarahkan ke lib/router (shim Inertia).`);
console.log('Backup file asli: .phase1-backup/  (inertia-app.tsx & routes/web.php yang lama juga ada di backup foundation)');
console.log('\nLangkah berikut:\n  npm run build   # pastikan lolos\n  git checkout -b inertia-fase1 && git add -A && git commit -m "Fase 1: semua halaman via Inertia"\n');
