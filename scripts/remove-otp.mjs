// Hapus fitur OTP registrasi (user sekarang dibuat admin / langsung dari database).
// Jalankan dari root project:  node scripts/remove-otp.mjs   (atau: node remove-otp.mjs [path/project])
// Aman dijalankan berulang kali. Kolom DB (mis. phone_verified_at) TIDAK disentuh.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());

// ---------- 1. File yang dihapus ----------
const hapus = [
  'app/Actions/Auth/ResendRegistrationOtp.php',
  'app/Actions/Auth/VerifyRegistrationOtp.php',
  'app/Http/Requests/Auth/ResendOtpAuthRequest.php',
  'app/Http/Requests/Auth/VerifyOtpAuthRequest.php',
  'app/Mail/OtpMail.php',
  'resources/views/emails/otp.blade.php',
  'resources/js/pages/Auth/VerifyOtp.tsx',
];

// ---------- 2. File yang diedit ----------
// op: { replace: [lama, baru] } | { removeLines: /regex/ } | { removeBetween: [awal, akhir] } (awal ikut dihapus, akhir tidak)
const edits = [
  {
    file: 'app/Http/Controllers/Auth/AuthController.php',
    ops: [
      { replace: ['use App\\Actions\\Auth\\ResendRegistrationOtp;\n', ''] },
      { replace: ['use App\\Actions\\Auth\\VerifyRegistrationOtp;\n', ''] },
      { replace: ['use App\\Http\\Requests\\Auth\\VerifyOtpAuthRequest;\n', ''] },
      { replace: ['use App\\Http\\Requests\\Auth\\ResendOtpAuthRequest;\n', ''] },
      { removeBetween: ['    // GET /verify-otp', '    // POST /logout'] },
    ],
  },
  {
    file: 'routes/web/auth.php',
    ops: [
      { removeLines: /verify-otp|resend-otp/ },
      { replace: ['// Di-require dari routes/web.php DI LUAR grup \'auth\' (login & OTP publik).', '// Di-require dari routes/web.php DI LUAR grup \'auth\' (login publik).'] },
      { replace: ['// Login & verifikasi OTP: halaman Inertia', '// Login: halaman Inertia'] },
    ],
  },
  {
    file: 'routes/web.php',
    ops: [{ replace: ['// Login, verifikasi OTP, logout:', '// Login & logout:'] }],
  },
  {
    file: 'lang/id/validation.php',
    ops: [
      { removeLines: /^\s*'otp_code'\s*=>/ },
      { removeLines: /^\s*'registration_id'\s*=>/ },
    ],
  },
  {
    file: 'resources/js/app.tsx',
    ops: [{ replace: ['Halaman tanpa sidebar/header (Login, VerifyOtp di P13)', 'Halaman tanpa sidebar/header (Login)'] }],
  },
];

let masalah = 0;

for (const f of hapus) {
  const p = join(root, f);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log(`✓ dihapus   ${f}`);
  } else {
    console.log(`- sudah tidak ada ${f}`);
  }
}

for (const { file, ops } of edits) {
  const p = join(root, file);
  if (!existsSync(p)) {
    console.log(`✗ ${file}: file tidak ditemukan (jalankan dari root project)`);
    masalah++;
    continue;
  }
  const mentah = readFileSync(p, 'utf8');
  const crlf = mentah.includes('\r\n');
  let t = crlf ? mentah.replace(/\r\n/g, '\n') : mentah;
  let berubah = 0;
  const gagal = [];

  ops.forEach((op, i) => {
    if (op.replace) {
      const [lama, baru] = op.replace;
      if (t.includes(lama)) { t = t.replace(lama, () => baru); berubah++; }
      else if (baru === '' || t.includes(baru)) { /* sudah beres */ }
      else gagal.push(i + 1);
    } else if (op.removeLines) {
      const baris = t.split('\n');
      const sisa = baris.filter((l) => !op.removeLines.test(l));
      if (sisa.length !== baris.length) { t = sisa.join('\n'); berubah++; }
    } else if (op.removeBetween) {
      const [awal, akhir] = op.removeBetween;
      const a = t.indexOf(awal);
      if (a === -1) return; // sudah beres
      const b = t.indexOf(akhir, a);
      if (b === -1) { gagal.push(i + 1); return; }
      t = t.slice(0, a) + t.slice(b);
      berubah++;
    }
  });

  if (berubah > 0) writeFileSync(p, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  if (gagal.length) { masalah++; console.log(`✗ ${file}: op #${gagal.join(', #')} tidak cocok`); }
  else console.log(berubah ? `✓ diedit    ${file} (${berubah} perubahan)` : `- sudah beres ${file}`);
}

console.log(masalah ? `\nSelesai, ${masalah} file bermasalah.` : '\nSelesai.');
process.exit(masalah ? 1 : 0);
