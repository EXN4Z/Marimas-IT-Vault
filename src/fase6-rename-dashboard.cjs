// Fase 6 - (1) rename pages/Dashboard -> pages/dashboard  (2) bersihin komentar basi di App.tsx
// Jalanin dari folder src:   node fase6-rename-dashboard.cjs --dry    (preview, gak nulis apa-apa)
//                            node fase6-rename-dashboard.cjs          (eksekusi)
// Prasyarat: Fase 5a-5c beres, git bersih (commit dulu).
// Rename beda huruf besar-kecil di Windows/macOS harus 2 langkah (Dashboard -> tmp -> dashboard), script ini
// pakai `git mv` kalau repo git (history aman), kalau bukan pakai fs.rename.
// Aman dijalankan ulang: kalau pages/dashboard sudah ada dan pages/Dashboard sudah gak ada, berhenti tanpa ngubah apa-apa.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DRY = process.argv.includes('--dry');
if (!fs.existsSync('App.tsx')) { console.error('Jalanin dari folder src (yang ada App.tsx)!'); process.exit(1); }

const OLD = 'pages/Dashboard', NEW = 'pages/dashboard', TMP = 'pages/__dashboard_tmp';

// nama folder sebenarnya di disk (case-sensitive), karena existsSync di Windows gak peduli huruf besar-kecil
const onDisk = fs.readdirSync('pages');
const hasOld = onDisk.includes('Dashboard');
const hasNew = onDisk.includes('dashboard');
if (!hasOld && hasNew) console.log('pages/dashboard sudah ada (rename sudah dilakukan), lanjut cek komentar saja.');
else if (!hasOld) { console.error('pages/Dashboard gak ketemu. Fase 1-5 sudah selesai?'); process.exit(1); }
else if (hasOld && hasNew) { console.error('pages/Dashboard dan pages/dashboard dua-duanya ada. Beresin manual dulu.'); process.exit(1); }

// ───── daftar edit teks ─────
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []);
}
const edits = []; // {file, from, to, label}
const rep = (file, from, to, label) => edits.push({ file, from, to, label });

// import path ke folder lama (App.tsx dan komentar di index.tsx)
for (const f of walk('.')) {
  const t = fs.readFileSync(f, 'utf8');
  if (/pages\/Dashboard\b/.test(t)) rep(f, /pages\/Dashboard\b/g, 'pages/dashboard', 'path pages/Dashboard -> pages/dashboard');
}

// komentar basi di App.tsx (nyebut file yang sudah dihapus). Pencocokan teks persis; kalau gak ketemu dilewati.
rep('App.tsx',
  '(lihat navigate() di\n  // Karyawan.tsx)',
  '(lihat navigate() di\n  // components/masterData/TabKaryawan.tsx)',
  'App.tsx: komentar backgroundLocation');
rep('App.tsx',
  '{/* Inventaris.tsx udah dihapus -- Inventory & Kelengkapan Inventory pindah ke\n              Master Data, Foto Inventory & Riwayat Inventory pindah ke Laporan, dan\n              Penanganan Inventory punya halaman sendiri. Alias ini jaga-jaga buat\n              bookmark/link lama ke /inventaris. */}',
  '{/* Halaman Inventaris sudah dihapus -- Inventory pindah ke Master Data, Foto\n              Inventory & Riwayat Inventory pindah ke Laporan, dan Penanganan Inventory\n              punya halaman sendiri. Alias ini jaga-jaga buat bookmark/link lama ke\n              /inventaris. */}',
  'App.tsx: komentar /inventaris');
rep('App.tsx',
  '{/* Data User (Karyawan.tsx) & Cabang (CabangPage.tsx) sekarang jadi tab\n              di dalam Master Data (tab "karyawan" & "cabang"), bukan halaman\n              sendiri lagi -- alias ini jaga-jaga buat bookmark/link lama. */}',
  '{/* Data User & Cabang sekarang jadi tab di dalam Master Data (tab "karyawan" &\n              "cabang"), bukan halaman sendiri lagi -- alias ini jaga-jaga buat\n              bookmark/link lama. */}',
  'App.tsx: komentar /karyawan & /cabang');

// ───── terapkan ke teks (CRLF-aware: cocokkan versi LF, tulis balik pakai eol asli) ─────
const plan = [];
const byFile = new Map();
for (const e of edits) (byFile.get(e.file) || byFile.set(e.file, []).get(e.file)).push(e);
for (const [file, list] of byFile) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let t = raw.replace(/\r\n/g, '\n');
  const done = [];
  for (const e of list) {
    const before = t;
    t = typeof e.from === 'string' ? (t.includes(e.from) ? t.replace(e.from, e.to) : t) : t.replace(e.from, e.to);
    if (t !== before) done.push(e.label);
    else if (file === 'App.tsx' && typeof e.from === 'string') console.log(`  (lewati) ${e.label}: teks sudah beda / sudah dibersihkan`);
  }
  if (done.length) plan.push({ file, text: t.replace(/\n/g, eol), done });
}

console.log((DRY ? '[dry] ' : '') + (hasOld ? `rename ${OLD} -> ${NEW}` : 'rename: sudah beres'));
for (const p of plan) console.log(`  edit ${p.file}: ${p.done.join('; ')}`);
if (DRY) { console.log('\nDry-run selesai, belum ada file yang diubah.'); process.exit(0); }

// ───── rename 2 langkah ─────
if (hasOld) {
  let isGit = false;
  try { execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); isGit = true; } catch { /* bukan repo git */ }
  const mv = (a, b) => (isGit ? execFileSync('git', ['mv', a, b], { stdio: 'inherit' }) : fs.renameSync(a, b));
  mv(OLD, TMP);
  mv(TMP, NEW);
}
// file di dalam pages/Dashboard sekarang sudah pindah ke pages/dashboard
const moved = (f) => (hasOld ? f.replace(/^pages[\\/]Dashboard(?=[\\/])/, 'pages/dashboard') : f);
for (const p of plan) fs.writeFileSync(moved(p.file), p.text, 'utf8');

// ───── cek: import relatif ketemu semua ─────
const exts = ['', '.ts', '.tsx', '.css', '/index.ts', '/index.tsx'];
let problems = 0;
console.log('\n== Cek ==');
for (const f of walk('.')) {
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/);
    if (!m || /^\s*(\/\/|\*)/.test(line)) return;
    const t = path.normalize(path.join(path.dirname(f), m[1]));
    if (!exts.some((e) => fs.existsSync(t + e))) { console.log('IMPORT RUSAK', f + ':' + (i + 1), m[1]); problems++; }
  });
}
console.log(problems ? `\n${problems} masalah, lihat di atas.` : '\nBersih, semua import ketemu filenya.');
console.log('Lanjut: npm run build, buka /dashboard (admin & user). Kalau build lolos di Windows tapi gagal di Linux/CI, biasanya masih ada import yang nulis "Dashboard" huruf besar -- script ini sudah ngecek, harusnya bersih.');
