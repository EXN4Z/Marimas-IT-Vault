#!/usr/bin/env node
// script.mjs -- pasang peringatan (toast) untuk SEMUA jalur error di Marimas IT Vault.
//
// Cara pakai (dari root project, folder yang ada package.json):
//   node script.mjs --dry     # cuma lihat apa yang akan diubah, tidak menulis apa pun
//   node script.mjs           # terapkan perubahan (backup otomatis ke .error-warn-backup/)
//   node script.mjs --path D:\\Marimas-IT-Vault-main   # kalau dijalankan dari folder lain
//
// Aman dijalankan berulang kali (idempotent). Kalau ada anchor yang tidak ketemu
// (file sudah berubah), bagian itu DILEWATI dan dilaporkan, file lain tetap jalan.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const pathArgIdx = args.indexOf('--path');
const ROOT = path.resolve(pathArgIdx >= 0 ? args[pathArgIdx + 1] : process.cwd());
const JS = path.join(ROOT, 'resources', 'js');
const BACKUP = path.join(ROOT, '.error-warn-backup');

if (!fs.existsSync(path.join(ROOT, 'package.json')) || !fs.existsSync(path.join(JS, 'app.tsx'))) {
  console.error(`x Bukan root project Marimas IT Vault: ${ROOT}\n  Jalankan dari folder yang ada package.json, atau pakai --path <folder>.`);
  process.exit(1);
}

const report = [];
const log = (file, status, note = '') => report.push({ file, status, note });

// ---------- helper ----------
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function readFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  return { text: crlf ? raw.replace(/\r\n/g, '\n') : raw, crlf };
}

function writeFile(p, text, crlf) {
  if (DRY) return;
  const dest = path.join(BACKUP, rel(p));
  if (fs.existsSync(p) && !fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(p, dest);
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, crlf ? text.replace(/\n/g, '\r\n') : text);
}

// Sisipkan import setelah import terakhir di file.
function addImport(src, line) {
  const matches = [...src.matchAll(/^import\s[^;]*?;[ \t]*$/gm)];
  if (!matches.length) return src;
  const last = matches[matches.length - 1];
  const at = last.index + last[0].length;
  return src.slice(0, at) + '\n' + line + src.slice(at);
}

function relImport(fromFile, toFileNoExt) {
  let r = path.relative(path.dirname(fromFile), toFileNoExt).split(path.sep).join('/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

// patch(file, steps): tiap step = { name, done(src)->bool, apply(src)->src|null }
function patch(relPath, steps) {
  const p = path.join(JS, relPath);
  if (!fs.existsSync(p)) {
    log(rel(p), 'SKIP', 'file tidak ditemukan');
    return;
  }
  const { text, crlf } = readFile(p);
  let src = text;
  const notes = [];
  let changed = false;
  let failed = false;

  for (const step of steps) {
    if (step.done(src)) {
      notes.push(`${step.name}: sudah ada`);
      continue;
    }
    const out = step.apply(src);
    if (out == null || out === src) {
      notes.push(`${step.name}: ANCHOR TIDAK KETEMU`);
      failed = true;
      continue;
    }
    src = out;
    changed = true;
    notes.push(`${step.name}: ok`);
  }

  if (changed) writeFile(p, src, crlf);
  log(rel(p), failed ? (changed ? 'PARTIAL' : 'GAGAL') : changed ? 'PATCHED' : 'SUDAH', notes.join('; '));
}

function replaceOnce(src, from, to) {
  const i = src.indexOf(from);
  if (i < 0 || src.indexOf(from, i + 1) >= 0) return null; // harus unik
  return src.slice(0, i) + to + src.slice(i + from.length);
}

// ---------- 1. lib/globalErrors.ts (file baru) ----------
const GLOBAL_ERRORS = `import { router } from '@inertiajs/react';
import toast from 'react-hot-toast';

// Peringatan global untuk SEMUA request Inertia yang gagal bukan karena validasi:
//  - 'httpException' : server balas non-Inertia (500, 419, 403, 404, dst). Tanpa ini Inertia menampilkan
//                      halaman HTML mentah di modal putih ("500 | Server Error").
//  - 'networkError'  : koneksi putus / server tidak terjangkau.
// Error validasi (422) tetap ditangani onError di masing-masing halaman.
// Error aslinya tetap tercatat di log server (Railway Logs).

let suppressed = 0;

// Dipakai untuk aksi yang sengaja mengabaikan error (mis. logout saat sesi sudah habis).
// Kembalikan fungsi untuk mengakhiri penekanan.
export function suppressGlobalErrorToast(): () => void {
  suppressed += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressed = Math.max(0, suppressed - 1);
  };
}

function messageForStatus(status?: number): string {
  if (status === 401) return 'Sesi Anda telah berakhir. Silakan login kembali.';
  if (status === 403) return 'Anda tidak memiliki akses untuk melakukan tindakan ini.';
  if (status === 404) return 'Halaman atau data yang diminta tidak ditemukan.';
  if (status === 419) return 'Sesi telah kedaluwarsa. Muat ulang halaman lalu coba lagi.';
  if (status === 422) return 'Data yang dikirim tidak valid. Periksa kembali isian Anda.';
  if (status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (status && status >= 500) return 'Terjadi kesalahan pada server. Coba lagi nanti.';
  return 'Permintaan gagal diproses. Coba lagi.';
}

let installed = false;

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  router.on('httpException', (event) => {
    event.preventDefault(); // cegah modal HTML mentah
    if (suppressed > 0) return;
    const status = (event.detail as { response?: { status?: number } }).response?.status;
    toast.error(messageForStatus(status), { id: 'http-error' });
  });

  router.on('networkError', (event) => {
    event.preventDefault();
    if (suppressed > 0) return;
    toast.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', { id: 'network-error' });
  });
}
`;

{
  const p = path.join(JS, 'lib', 'globalErrors.ts');
  if (fs.existsSync(p)) {
    const { text } = readFile(p);
    log(rel(p), text.trim() === GLOBAL_ERRORS.trim() ? 'SUDAH' : 'SKIP', text.trim() === GLOBAL_ERRORS.trim() ? '' : 'sudah ada tapi isinya berbeda, tidak ditimpa');
  } else {
    writeFile(p, GLOBAL_ERRORS, false);
    log(rel(p), 'DIBUAT');
  }
}

const GE = path.join(JS, 'lib', 'globalErrors');

// ---------- 2. app.tsx: pasang handler global ----------
{
  const file = path.join(JS, 'app.tsx');
  patch('app.tsx', [
    {
      name: 'import',
      done: (s) => s.includes('installGlobalErrorHandlers'),
      apply: (s) => addImport(s, `import { installGlobalErrorHandlers } from '${relImport(file, GE)}';`),
    },
    {
      name: 'panggil',
      done: (s) => /installGlobalErrorHandlers\(\);/.test(s),
      apply: (s) => replaceOnce(s, 'createInertiaApp({', 'installGlobalErrorHandlers();\n\ncreateInertiaApp({'),
    },
  ]);
}

// ---------- 3. Login.tsx: toast untuk username/password salah ----------
patch('pages/Auth/Login.tsx', [
  {
    name: 'import toast',
    done: (s) => /from 'react-hot-toast'/.test(s),
    apply: (s) => addImport(s, `import toast from 'react-hot-toast';`),
  },
  {
    name: 'toast onError',
    done: (s) => s.includes('toast.error(msg'),
    apply: (s) =>
      replaceOnce(
        s,
        `onError: (errors) => setError(errors.login || errors.password || 'Email/No HP/Nama atau password salah'),`,
        `onError: (errors) => {
          const msg = errors.login || errors.password || 'Email/No HP/Nama atau password salah';
          setError(msg);
          toast.error(msg, { id: 'login-error' });
        },`,
      ),
  },
]);

// ---------- 4. AuthContext.tsx: logout tidak memunculkan toast error ----------
{
  const file = path.join(JS, 'context', 'AuthContext.tsx');
  patch('context/AuthContext.tsx', [
    {
      name: 'import',
      done: (s) => s.includes('suppressGlobalErrorToast'),
      apply: (s) => addImport(s, `import { suppressGlobalErrorToast } from '${relImport(file, GE)}';`),
    },
    {
      name: 'suppress',
      done: (s) => s.includes('restoreToast'),
      apply: (s) =>
        replaceOnce(
          s,
          `const stopInvalid = router.on('httpException', (event) => event.preventDefault());`,
          `const stopInvalid = router.on('httpException', (event) => event.preventDefault());\n      const restoreToast = suppressGlobalErrorToast();`,
        ),
    },
    {
      name: 'restore',
      done: (s) => /restoreToast\(\);/.test(s),
      apply: (s) => replaceOnce(s, `stopInvalid();\n            resolve();`, `stopInvalid();\n            restoreToast();\n            resolve();`),
    },
  ]);
}

// ---------- 5. InventoryFormModal.tsx: simpan inventory tanpa onError ----------
patch('features/inventory/form/InventoryFormModal.tsx', [
  {
    name: 'import toast',
    done: (s) => /from 'react-hot-toast'/.test(s),
    apply: (s) => addImport(s, `import toast from 'react-hot-toast';`),
  },
  {
    name: 'onError',
    done: (s) => s.includes('Gagal menyimpan inventory'),
    apply: (s) =>
      replaceOnce(
        s,
        `      onSuccess: () => onSaved(),\n    });`,
        `      onSuccess: () => onSaved(),\n      // Pesan error validasi pertama dari server ikut tampil sebagai toast (selain di field).\n      onError: (errs: Record<string, string>) => {\n        toast.error(Object.values(errs)[0] || 'Gagal menyimpan inventory. Periksa kembali isian Anda.');\n      },\n    });`,
      ),
  },
]);

// ---------- 6. NotificationsContext.tsx: aksi notifikasi gagal ----------
{
  const file = path.join(JS, 'features', 'notifications', 'NotificationsContext.tsx');
  patch('features/notifications/NotificationsContext.tsx', [
    {
      name: 'import toast',
      done: (s) => /from 'react-hot-toast'/.test(s),
      apply: (s) => addImport(s, `import toast from 'react-hot-toast';`),
    },
    {
      name: 'toast 3 aksi',
      done: (s) => s.includes('notif-action'),
      apply: (s) => {
        // markAsRead, markAllAsRead, remove: catch { void refresh(); }
        // (polling refresh() pakai catch (err) jadi sengaja TIDAK disentuh -> tidak spam toast tiap tick)
        let count = 0;
        const out = s.replace(/\} catch \{\n(\s*)void refresh\(\);/g, (_m, indent) => {
          count += 1;
          return `} catch {\n${indent}toast.error('Gagal memperbarui notifikasi. Coba lagi.', { id: 'notif-action' });\n${indent}void refresh();`;
        });
        return count === 3 ? out : null;
      },
    },
  ]);
  void file;
}

// ---------- 7. SerahTerimaModal.tsx: pencarian karyawan gagal ----------
patch('features/inventory/aksi/SerahTerimaModal.tsx', [
  {
    name: 'import toast',
    done: (s) => /from 'react-hot-toast'/.test(s),
    apply: (s) => addImport(s, `import toast from 'react-hot-toast';`),
  },
  {
    name: 'toast cari',
    done: (s) => s.includes('cari-karyawan'),
    apply: (s) =>
      replaceOnce(
        s,
        `} catch {\n        setResults([]);\n      } finally {`,
        `} catch {\n        setResults([]);\n        toast.error('Gagal mencari karyawan. Coba lagi.', { id: 'cari-karyawan' });\n      } finally {`,
      ),
  },
]);

// ---------- laporan ----------
const icon = { DIBUAT: '+', PATCHED: '~', PARTIAL: '!', GAGAL: 'x', SKIP: '-', SUDAH: '=' };
console.log(`\nMarimas IT Vault - peringatan error ${DRY ? '(DRY RUN, tidak menulis apa pun)' : ''}\n`);
for (const r of report) console.log(` ${icon[r.status] ?? '?'} ${r.status.padEnd(8)} ${r.file}${r.note ? `\n             ${r.note}` : ''}`);

const bad = report.filter((r) => r.status === 'GAGAL' || r.status === 'PARTIAL');
console.log(
  `\n${report.filter((r) => ['DIBUAT', 'PATCHED'].includes(r.status)).length} file diubah/dibuat, ` +
    `${report.filter((r) => r.status === 'SUDAH').length} sudah beres, ${bad.length} perlu dicek manual.`,
);
if (!DRY && fs.existsSync(BACKUP)) console.log(`Backup file asli: ${rel(BACKUP)}/ (hapus kalau sudah yakin)`);
if (bad.length) {
  console.log('\nAda anchor yang tidak ketemu (file mungkin sudah berubah dari versi yang di-scan). Kirim output ini ke chat.');
  process.exit(2);
}
