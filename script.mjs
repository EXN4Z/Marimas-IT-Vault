#!/usr/bin/env node
// script.mjs -- pasang peringatan untuk SEMUA jalur error di Marimas IT Vault:
//   - toast untuk error server / koneksi / login salah (frontend)
//   - pesan validasi Bahasa Indonesia, mis. "Email tidak boleh kosong!" (backend + form)
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
function patch(relPath, steps, base = JS) {
  const p = path.join(base, relPath);
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

  // Error dari server yang bukan milik field tertentu (kunci "server", lihat bootstrap/app.php).
  router.on('error', (event) => {
    const msg = (event.detail.errors as Record<string, string>).server;
    if (msg) toast.error(msg, { id: 'server-error' });
  });
}
`;

if (!fs.existsSync(path.join(JS, 'lib', 'globalErrors.ts'))) {
  const p = path.join(JS, 'lib', 'globalErrors.ts');
  writeFile(p, GLOBAL_ERRORS, false);
  log(rel(p), 'DIBUAT');
} else {
  // sudah ada (script versi sebelumnya): tambahkan listener error "server" kalau belum ada
  patch('lib/globalErrors.ts', [
    {
      name: 'listener server',
      done: (s) => s.includes("id: 'server-error'"),
      apply: (s) =>
        replaceOnce(
          s,
          `{ id: 'network-error' });\n  });\n}`,
          `{ id: 'network-error' });\n  });\n\n  // Error dari server yang bukan milik field tertentu (kunci "server", lihat bootstrap/app.php).\n  router.on('error', (event) => {\n    const msg = (event.detail.errors as Record<string, string>).server;\n    if (msg) toast.error(msg, { id: 'server-error' });\n  });\n}`,
        ),
    },
  ]);
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


// =====================================================================
// VALIDASI: pesan Indonesia + email wajib diisi (berlaku di semua form)
// =====================================================================

const PHP = ROOT; // file PHP relatif ke root project

// ---------- 8. lang/id/validation.php (file baru) ----------
const LANG_ID = `<?php

// Pesan validasi Bahasa Indonesia. Aktif otomatis karena APP_LOCALE=id (config/app.php).
// Key yang tidak ada di sini jatuh ke bahasa Inggris (fallback_locale).
return [
    'accepted' => ':attribute harus disetujui.',
    'array' => ':attribute harus berupa daftar.',
    'boolean' => ':attribute harus bernilai benar atau salah.',
    'confirmed' => 'Konfirmasi :attribute tidak cocok.',
    'date' => ':attribute bukan tanggal yang valid.',
    'email' => ':attribute harus berupa alamat email yang valid.',
    'exists' => ':attribute yang dipilih tidak valid.',
    'file' => ':attribute harus berupa file.',
    'image' => ':attribute harus berupa gambar.',
    'in' => ':attribute yang dipilih tidak valid.',
    'integer' => ':attribute harus berupa angka bulat.',
    'max' => [
        'array' => ':attribute maksimal :max item.',
        'file' => ':attribute maksimal :max KB.',
        'numeric' => ':attribute maksimal :max.',
        'string' => ':attribute maksimal :max karakter.',
    ],
    'mimes' => ':attribute harus berupa file bertipe: :values.',
    'min' => [
        'array' => ':attribute minimal :min item.',
        'file' => ':attribute minimal :min KB.',
        'numeric' => ':attribute minimal :min.',
        'string' => ':attribute minimal :min karakter.',
    ],
    'numeric' => ':attribute harus berupa angka.',
    'required' => ':attribute tidak boleh kosong!',
    'string' => ':attribute harus berupa teks.',
    'unique' => ':attribute sudah digunakan.',
    'uploaded' => ':attribute gagal diunggah.',
    'url' => ':attribute harus berupa URL yang valid.',

    // Nama field yang tampil di pesan (tanpa ini jadi "role id", "nama", dst).
    'attributes' => [
        'name' => 'Nama',
        'nama' => 'Nama',
        'email' => 'Email',
        'phone' => 'Nomor telepon',
        'telepon' => 'Nomor telepon',
        'nik' => 'NIK',
        'password' => 'Password',
        'current_password' => 'Password saat ini',
        'login' => 'Email/No HP/Nama',
        'otp_code' => 'Kode OTP',
        'registration_id' => 'ID registrasi',
        'role_id' => 'Role',
        'departemen_id' => 'Departemen',
        'lokasi_kantor_id' => 'Cabang / lokasi kantor',
        'perusahaan_id' => 'Perusahaan',
        'supplier_id' => 'Supplier',
        'kategori_id' => 'Kategori',
        'inventory_id' => 'Inventory',
        'parent_id' => 'Barang induk',
        'user_id' => 'Penerima',
        'status' => 'Status',
        'alamat' => 'Alamat',
        'link' => 'Link',
        'file' => 'File',
        'foto' => 'Foto',
        'foto_penerimaan' => 'Foto penerimaan',
        'foto_pengembalian' => 'Foto pengembalian',
        'merk' => 'Merk',
        'type' => 'Tipe',
        'warna' => 'Warna',
        'jumlah' => 'Jumlah',
        'keterangan' => 'Keterangan',
        'keluhan' => 'Keluhan',
        'alasan' => 'Alasan',
        'catatan' => 'Catatan',
        'catatan_penerimaan' => 'Catatan penerimaan',
        'catatan_pengembalian' => 'Catatan pengembalian',
        'jenis_kerusakan' => 'Jenis kerusakan',
        'hasil' => 'Hasil',
        'no_berita_acara' => 'Nomor berita acara',
        'no_good_receive' => 'Nomor good receive',
        'no_surat_jalan' => 'Nomor surat jalan',
        'no_struk_penerimaan' => 'Nomor struk penerimaan',
        'tanggal_masuk' => 'Tanggal masuk',
        'tanggal_garansi' => 'Tanggal garansi',
        'tanggal_input' => 'Tanggal input',
        'tanggal_invoice' => 'Tanggal invoice',
        'tanggal_rusak' => 'Tanggal rusak',
        'tanggal_selesai' => 'Tanggal selesai',
        'tanggal_penerimaan' => 'Tanggal penerimaan',
        'tanggal_pengembalian' => 'Tanggal pengembalian',
        'endpoint' => 'Endpoint',
        'keys.auth' => 'Kunci autentikasi',
    ],
];
`;
{
  const p = path.join(PHP, 'lang', 'id', 'validation.php');
  if (fs.existsSync(p)) {
    const { text } = readFile(p);
    log(rel(p), text.trim() === LANG_ID.trim() ? 'SUDAH' : 'SKIP', text.trim() === LANG_ID.trim() ? '' : 'sudah ada tapi isinya berbeda, tidak ditimpa');
  } else {
    writeFile(p, LANG_ID, false);
    log(rel(p), 'DIBUAT');
  }
}

// ---------- 9. config/app.php: bahasa default Indonesia ----------
patch(
  'config/app.php',
  [
    {
      name: 'locale id',
      done: (s) => s.includes("env('APP_LOCALE', 'id')"),
      apply: (s) => replaceOnce(s, `env('APP_LOCALE', 'en')`, `env('APP_LOCALE', 'id')`),
    },
  ],
  PHP,
);

// ---------- 10. Email (dan NIK) wajib diisi ----------
patch(
  'app/Actions/MasterData/KaryawanAction.php',
  [
    {
      name: 'email buat',
      done: (s) => s.includes(`'email' => 'required|email|unique:users,email',`),
      apply: (s) => replaceOnce(s, `'email' => 'nullable|email|unique:users,email',`, `'email' => 'required|email|unique:users,email',`),
    },
    {
      name: 'email ubah',
      done: (s) => s.includes(`'email' => 'required|email|unique:users,email,' . $user->id,`),
      apply: (s) =>
        replaceOnce(s, `'email' => 'nullable|email|unique:users,email,' . $user->id,`, `'email' => 'required|email|unique:users,email,' . $user->id,`),
    },
    {
      name: 'nik buat',
      done: (s) => s.includes(`'nik' => 'required|string|unique:users,nik',`),
      apply: (s) => replaceOnce(s, `'nik' => 'nullable|string|unique:users,nik',`, `'nik' => 'required|string|unique:users,nik',`),
    },
    {
      name: 'nik ubah',
      done: (s) => s.includes(`'nik' => 'required|string|unique:users,nik,' . $user->id,`),
      apply: (s) =>
        replaceOnce(s, `'nik' => 'nullable|string|unique:users,nik,' . $user->id,`, `'nik' => 'required|string|unique:users,nik,' . $user->id,`),
    },
    {
      name: 'redaksi',
      done: (s) => !WAJIB_RE().test(s),
      apply: (s) => rewriteWajib(s),
    },
  ],
  PHP,
);

patch(
  'app/Actions/Profile/UpdateProfile.php',
  [
    {
      name: 'email wajib',
      done: (s) => s.includes(`'email' => 'required|email|unique:users,email,' . $user->id,`),
      apply: (s) =>
        replaceOnce(s, `'email' => 'nullable|email|unique:users,email,' . $user->id,`, `'email' => 'required|email|unique:users,email,' . $user->id,`),
    },
  ],
  PHP,
);

// Pesan lama "Kolom nama wajib diisi." dihapus -> semua pakai lang/id/validation.php ("Nama tidak boleh kosong!").
for (const f of ['StorePerusahaanRequest', 'UpdatePerusahaanRequest', 'StoreCabangRequest', 'UpdateCabangRequest']) {
  patch(
    `app/Http/Requests/MasterData/${f}.php`,
    [
      {
        name: 'hapus pesan required lama',
        done: (s) => !/^[ \t]*'(nama|alamat|telepon|link)\.required' => '[^'\n]*',\n/m.test(s),
        apply: (s) => s.replace(/^[ \t]*'(nama|alamat|telepon|link)\.required' => '[^'\n]*',\n/gm, ''),
      },
    ],
    PHP,
  );
}

// ---------- 11. Frontend: email wajib + pesan seragam ----------
// "Xxx wajib diisi." -> "Xxx tidak boleh kosong!" (kalimat yang berdiri sendiri; "kolom yang wajib diisi" dibiarkan)
function WAJIB_RE() {
  return /(['"`])([^'"`\n]*?) wajib diisi\.\1/;
}
function rewriteWajib(src) {
  return src.replace(new RegExp(WAJIB_RE().source, 'g'), (m, q, text) =>
    /kolom yang/i.test(text) ? m : `${q}${text} tidak boleh kosong!${q}`,
  );
}
const rewriteStep = {
  name: 'redaksi',
  done: (s) => !new RegExp(WAJIB_RE().source, 'g').test(s.replace(/(['"`])[^'"`\n]*kolom yang[^'"`\n]*wajib diisi\.\1/g, '')),
  apply: (s) => rewriteWajib(s),
};

patch('features/karyawan/modals/KaryawanFormModal.tsx', [
  {
    name: 'cek email',
    done: (s) => s.includes('Email tidak boleh kosong!'),
    apply: (s) =>
      replaceOnce(
        s,
        `if (!data.role_id) clientErrors.role_id = 'Role wajib dipilih.';`,
        `if (!data.role_id) clientErrors.role_id = 'Role wajib dipilih.';\n    if (!data.email.trim()) clientErrors.email = 'Email tidak boleh kosong!';`,
      ),
  },
  {
    name: 'tanda wajib',
    done: (s) => s.includes('<Field label="Alamat Email" error={errors.email} required>'),
    apply: (s) => replaceOnce(s, `<Field label="Alamat Email" error={errors.email}>`, `<Field label="Alamat Email" error={errors.email} required>`),
  },
  {
    name: 'toast pesan server',
    done: (s) => s.includes('Object.values(errs)[0]'),
    apply: (s) =>
      replaceOnce(
        s,
        `toast.error(errs.status || 'Ada data yang belum sesuai dengan format server.');`,
        `toast.error(errs.status || String(Object.values(errs)[0] || 'Ada data yang belum sesuai dengan format server.'));`,
      ),
  },
  rewriteStep,
]);

patch('pages/Settings/Index.tsx', [
  {
    name: 'cek email',
    done: (s) => s.includes('Email tidak boleh kosong!'),
    apply: (s) =>
      replaceOnce(
        s,
        `toast.error('Nama tidak boleh kosong.');\n      return;\n    }\n`,
        `toast.error('Nama tidak boleh kosong.');\n      return;\n    }\n    if (!profile.data.email.trim()) {\n      toast.error('Email tidak boleh kosong!');\n      return;\n    }\n`,
      ),
  },
  rewriteStep,
]);

for (const f of [
  'features/karyawan/modals/KaryawanPasswordModal.tsx',
  'features/master-data/supplier/SupplierTab.tsx',
  'features/master-data/kategori/KategoriTab.tsx',
  'features/master-data/cabang/CabangTab.tsx',
  'features/master-data/departemen/DepartemenTab.tsx',
  'features/master-data/perusahaan/PerusahaanTab.tsx',
  'features/inventory/form/InventoryFormModal.tsx',
  'features/inventory/aksi/LaporKerusakanModal.tsx',
]) {
  patch(f, [rewriteStep]);
}


// =====================================================================
// TOAST VALIDASI CLIENT: tampilkan pesan SPESIFIK, bukan "Mohon lengkapi kolom ..."
// =====================================================================
const TOAST_ERRORS = `import toast from 'react-hot-toast';

// Toast untuk error validasi di sisi client. Menampilkan pesan field pertama yang bermasalah
// (mis. "Email tidak boleh kosong!"); kalau ada beberapa, ditambah jumlah sisanya.
export function toastFormErrors(errors: object, fallback = 'Mohon lengkapi data yang wajib diisi.'): void {
  const messages = Object.values(errors as Record<string, unknown>).filter(
    (m): m is string => typeof m === 'string' && m.length > 0,
  );
  if (messages.length === 0) {
    toast.error(fallback);
    return;
  }
  toast.error(messages.length === 1 ? messages[0] : \`\${messages[0]} (+\${messages.length - 1} kolom lain)\`);
}
`;
{
  const p = path.join(JS, 'lib', 'toastErrors.ts');
  if (fs.existsSync(p)) {
    const { text } = readFile(p);
    log(rel(p), text.trim() === TOAST_ERRORS.trim() ? 'SUDAH' : 'SKIP', text.trim() === TOAST_ERRORS.trim() ? '' : 'sudah ada tapi isinya berbeda, tidak ditimpa');
  } else {
    writeFile(p, TOAST_ERRORS, false);
    log(rel(p), 'DIBUAT');
  }
}

{
  const TE = path.join(JS, 'lib', 'toastErrors');
  const sites = [
    ['features/karyawan/modals/KaryawanFormModal.tsx', `toast.error('Mohon lengkapi kolom yang bertanda bintang (*).');`, 'clientErrors'],
    ['features/inventory/form/InventoryFormModal.tsx', `toast.error('Mohon lengkapi kolom yang bertanda bintang (*).');`, 'next'],
    ['features/master-data/cabang/CabangTab.tsx', `toast.error('Mohon lengkapi semua kolom yang wajib diisi.');`, 'clientErrors'],
    ['features/master-data/perusahaan/PerusahaanTab.tsx', `toast.error('Mohon lengkapi semua kolom yang wajib diisi.');`, 'clientErrors'],
    ['features/inventory/aksi/SerahTerimaModal.tsx', `toast.error('Mohon lengkapi seluruh syarat serah-terima.');`, 'newErrors'],
    ['features/inventory/aksi/LaporKerusakanModal.tsx', `toast.error('Mohon lengkapi seluruh data laporan kerusakan.');`, 'newErrors'],
    ['features/inventory/aksi/PengembalianModal.tsx', `toast.error('Mohon lengkapi syarat pengembalian.');`, 'newErrors'],
  ];
  for (const [f, oldCall, vari] of sites) {
    const file = path.join(JS, f);
    patch(f, [
      {
        name: 'import',
        done: (s) => s.includes('toastFormErrors'),
        apply: (s) => addImport(s, `import { toastFormErrors } from '${relImport(file, TE)}';`),
      },
      {
        name: 'toast spesifik',
        done: (s) => s.includes(`toastFormErrors(${vari})`),
        apply: (s) => replaceOnce(s, oldCall, `toastFormErrors(${vari});`),
      },
    ]);
  }
}

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
