#!/usr/bin/env node
// F10b -- cleanup final pasca migrasi Inertia.
// Taruh di scripts/, jalankan dari root project:
//   node scripts/f10b.mjs --dry      (cuma tampilkan rencana, tidak ubah apa pun)
//   node scripts/f10b.mjs            (terapkan, backup ke .migrasi-backup/f10b/)
//   node scripts/f10b.mjs --revert   (kembalikan semua dari backup)
//
// Isi:
//   1. rename emails/new-password,blade.php -> new-password.blade.php (typo koma)
//   2. throttle di POST /login, /verify-otp, /resend-otp
//   3. hapus app/Http/Controllers/Legacy (kode mati) + baris docblock yang nunjuk ke sana
//   4. rename "Marimas ONE/One" -> "Marimas IT Vault" (teks tampilan, komentar, email, sw.js)
//   5. hapus baseline-routes.txt, current-routes.txt, build_errors.txt
//   6. .gitignore += /.migrasi-backup/
//   7. README.md bawaan Laravel diganti README proyek

import fs from 'node:fs';
import path from 'node:path';

// ---- konfigurasi -----------------------------------------------------------
const NEW_NAME = 'Marimas IT Vault';
const THROTTLE = { '/login': 10, '/verify-otp': 10, '/resend-otp': 3 }; // request per menit
const BRAND_DIRS = ['resources/js', 'resources/views', 'app', 'public/sw.js'];
const BRAND_EXT = ['.ts', '.tsx', '.js', '.php', '.html'];
const JUNK_FILES = ['baseline-routes.txt', 'current-routes.txt', 'build_errors.txt'];
const SKIP_DIRS = new Set(['node_modules', 'vendor', '.git', '.migrasi-backup', 'Legacy']);

// ---- setup -----------------------------------------------------------------
const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');
const BACKUP = path.join(ROOT, '.migrasi-backup', 'f10b');
const MANIFEST = path.join(BACKUP, 'manifest.json');

const abs = (rel) => path.join(ROOT, rel);
const exists = (rel) => fs.existsSync(abs(rel));
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');
const say = (tag, msg) => console.log(`${DRY ? '[dry] ' : ''}${tag.padEnd(8)} ${msg}`);

if (!fs.existsSync(abs('artisan')) || !fs.existsSync(abs('package.json'))) {
  console.error('Jalankan dari root project (folder yang ada artisan + package.json).');
  process.exit(1);
}

// ---- revert ----------------------------------------------------------------
if (REVERT) {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Tidak ada manifest di .migrasi-backup/f10b/ -- tidak ada yang di-revert.');
    process.exit(1);
  }
  const { actions } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const a of [...actions].reverse()) {
    if (a.type === 'rename') {
      if (exists(a.to) && !exists(a.from)) {
        fs.renameSync(abs(a.to), abs(a.from));
        say('revert', `${a.to} -> ${a.from}`);
      }
    } else if (a.type === 'modify' || a.type === 'delete-file') {
      fs.mkdirSync(path.dirname(abs(a.path)), { recursive: true });
      fs.copyFileSync(path.join(BACKUP, a.path), abs(a.path));
      say('revert', a.path);
    } else if (a.type === 'delete-dir') {
      fs.cpSync(path.join(BACKUP, a.path), abs(a.path), { recursive: true });
      say('revert', a.path + '/');
    }
  }
  fs.renameSync(MANIFEST, path.join(BACKUP, `manifest.reverted-${Date.now()}.json`));
  console.log('\nRevert selesai. Kalau sudah sempat `git rm --cached .migrasi-backup`, index git tidak ikut kembali.');
  process.exit(0);
}

// ---- helper tulis + backup -------------------------------------------------
const actions = [];
const counts = { modify: 0, rename: 0, del: 0 };

function backupFile(rel) {
  const dest = path.join(BACKUP, rel);
  if (fs.existsSync(dest)) return; // simpan versi asli saja (aman kalau script dijalankan ulang)
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(abs(rel), dest);
}

function modify(rel, next, note) {
  if (read(rel) === next) return;
  say('ubah', `${rel}  (${note})`);
  counts.modify++;
  if (DRY) return;
  backupFile(rel);
  fs.writeFileSync(abs(rel), next);
  actions.push({ type: 'modify', path: rel });
}

function removeFile(rel, note = '') {
  if (!exists(rel)) return;
  say('hapus', `${rel} ${note}`.trim());
  counts.del++;
  if (DRY) return;
  backupFile(rel);
  fs.rmSync(abs(rel));
  actions.push({ type: 'delete-file', path: rel });
}

function walk(rel, out = []) {
  if (!exists(rel)) return out;
  if (fs.statSync(abs(rel)).isFile()) {
    out.push(rel);
    return out;
  }
  for (const e of fs.readdirSync(abs(rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const child = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(child, out);
    else out.push(child);
  }
  return out;
}

// ---- 1. rename view email typo ---------------------------------------------
{
  const from = 'resources/views/emails/new-password,blade.php';
  const to = 'resources/views/emails/new-password.blade.php';
  if (exists(from)) {
    if (exists(to)) {
      say('lewati', `${to} sudah ada, ${from} dibiarkan -- cek manual`);
    } else {
      say('rename', `${from} -> ${to}`);
      counts.rename++;
      if (!DRY) {
        fs.renameSync(abs(from), abs(to));
        actions.push({ type: 'rename', from, to });
      }
    }
  }
}

// ---- 2. throttle auth ------------------------------------------------------
{
  const f = 'routes/web/auth.php';
  if (exists(f)) {
    const next = read(f)
      .split('\n')
      .map((line) => {
        const cr = line.endsWith('\r') ? '\r' : '';
        const body = cr ? line.slice(0, -1) : line;
        const m = body.match(/^(Route::post\('(\/login|\/verify-otp|\/resend-otp)'.*?\))(;.*)$/);
        if (!m || body.includes('throttle')) return line;
        return `${m[1]}->middleware('throttle:${THROTTLE[m[2]]},1')${m[3]}${cr}`;
      })
      .join('\n');
    modify(f, next, 'throttle login/OTP');
  }
}

// ---- 3. hapus Legacy controllers + docblock --------------------------------
{
  const dir = 'app/Http/Controllers/Legacy';
  if (exists(dir)) {
    // safety: pastikan tidak ada kode (bukan komentar) di luar Legacy yang masih pakai namespace Legacy
    const refs = [];
    for (const f of [...walk('app'), ...walk('routes'), ...walk('bootstrap'), ...walk('config')]) {
      if (!f.endsWith('.php')) continue;
      read(f)
        .split('\n')
        .forEach((l, i) => {
          const t = l.trim();
          if (/Legacy\\/.test(l) && !/^(\*|\/\/|\/\*|#)/.test(t)) refs.push(`${f}:${i + 1}`);
        });
    }
    if (refs.length) {
      say('BATAL', 'Legacy dipakai di kode, tidak dihapus:');
      refs.forEach((r) => console.log('           ' + r));
    } else {
      say('hapus', dir + '/ (kode mati, tidak ada rute/use yang nunjuk)');
      counts.del++;
      if (!DRY) {
        fs.cpSync(abs(dir), path.join(BACKUP, dir), { recursive: true });
        fs.rmSync(abs(dir), { recursive: true });
        actions.push({ type: 'delete-dir', path: dir });
      }
    }
  }

  // baris docblock "- API : ...Legacy..."
  for (const f of walk('app')) {
    if (!f.endsWith('.php')) continue;
    const src = read(f);
    const next = src.replace(/^[ \t]*\*[ \t]+-[ \t]+API[ \t]*:.*Legacy.*\r?\n/gm, '');
    modify(f, next, 'hapus baris docblock Legacy');
  }
}

// ---- 4. rename brand -------------------------------------------------------
{
  let total = 0;
  const files = BRAND_DIRS.flatMap((d) => walk(d)).filter((f) => BRAND_EXT.some((e) => f.endsWith(e)));
  for (const f of files) {
    const src = read(f);
    let n = 0;
    const next = src.replace(/marimas one/gi, (m) => {
      n++;
      return m === m.toUpperCase() ? NEW_NAME.toUpperCase() : NEW_NAME;
    });
    if (n) {
      total += n;
      modify(f, next, `${n}x Marimas ONE -> ${NEW_NAME}`);
    }
  }
  if (total) say('info', `total ${total} kemunculan nama lama`);
}

// ---- 5. file sampah di root ------------------------------------------------
for (const f of JUNK_FILES) removeFile(f);

// ---- 6. .gitignore ---------------------------------------------------------
{
  const f = '.gitignore';
  if (exists(f)) {
    const src = read(f);
    if (!/^\/?\.migrasi-backup\/?\s*$/m.test(src)) {
      const eol = src.includes('\r\n') ? '\r\n' : '\n';
      modify(f, src.replace(/\s*$/, eol) + '/.migrasi-backup/' + eol, 'abaikan backup migrasi');
    }
  }
}

// ---- 7. README -------------------------------------------------------------
{
  const f = 'README.md';
  if (exists(f) && read(f).includes('About Laravel')) {
    const readme = `# ${NEW_NAME}

Sistem manajemen inventory IT internal PT Marimas Putera Kencana.

## Stack

- Backend: Laravel (Inertia), PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind
- Realtime: Laravel Echo (Pusher), Web Push (VAPID)
- Deploy: Railway (Nixpacks)

## Modul

Master Data (perusahaan, cabang, departemen, kategori, supplier, karyawan/user, inventory),
Transaksi (pemakai, penanganan/perbaikan), Laporan, Dashboard, Notifikasi, Audit Log, Settings.

## Setup lokal

1. \`composer install\` dan \`npm install\`
2. Siapkan file \`.env\` (DB PostgreSQL, mail, VAPID, Pusher/Echo), lalu \`php artisan key:generate\`
3. \`php artisan migrate --seed\`
4. Jalankan \`php artisan serve\` dan \`npm run dev\`

## Build produksi

\`npm run build\`, lalu \`php artisan migrate --force\` (lihat \`nixpacks.toml\`).
`;
    modify(f, readme, 'README bawaan Laravel diganti');
  }
}

// ---- simpan manifest -------------------------------------------------------
if (!DRY && actions.length) {
  fs.mkdirSync(BACKUP, { recursive: true });
  let all = actions;
  if (fs.existsSync(MANIFEST)) all = [...JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).actions, ...actions];
  fs.writeFileSync(MANIFEST, JSON.stringify({ phase: 'f10b', at: new Date().toISOString(), actions: all }, null, 2));
}

console.log(
  `\n${DRY ? 'Rencana' : 'Selesai'}: ${counts.modify} file diubah, ${counts.rename} rename, ${counts.del} dihapus.`,
);
if (!DRY) {
  console.log('\nLangkah lanjut:');
  console.log('  git rm -r --cached .migrasi-backup      (lepas backup dari git, file lokal tetap ada)');
  console.log('  php artisan route:list                  (pastikan rute aman tanpa Legacy)');
  console.log('  npm run build                           (pastikan build lolos)');
  console.log('  Revert kalau perlu: node scripts/f10b.mjs --revert');
}
