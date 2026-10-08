// Fondasi Inertia: session cookie + shared auth + providers.
// Jalankan dari ROOT project:  node foundation/apply.mjs
// Aman dijalankan berulang (idempotent). Kalau ada anchor yang gak ketemu,
// TIDAK ADA file yang diubah. Backup file asli ada di .foundation-backup/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const f = (p) => path.join(root, p);
const read = (p) => fs.readFileSync(f(p), 'utf8');
const nl = (s) => s.replace(/\r\n/g, '\n');

const edits = []; // { file, status, content? }
const errors = [];

function patch(file, fn) {
  if (!fs.existsSync(f(file))) {
    errors.push(`${file}: file tidak ada (jalankan dari root project?)`);
    return;
  }
  const raw = read(file);
  const crlf = raw.includes('\r\n');
  try {
    const out = fn(nl(raw));
    if (out === null) return edits.push({ file, status: 'sudah ada, dilewati' });
    edits.push({ file, status: 'dipatch', content: crlf ? out.replace(/\n/g, '\r\n') : out });
  } catch (e) {
    errors.push(`${file}: ${e.message}`);
  }
}

// 1. bootstrap/app.php -> statefulApi()
patch('bootstrap/app.php', (s) => {
  if (s.includes('statefulApi')) return null;
  const re = /(->withMiddleware\(function \(Middleware \$middleware\)\s*\{\n)([ \t]*)/;
  if (!re.test(s)) throw new Error('anchor withMiddleware(...) gak ketemu');
  return s.replace(re, (_m, head, ind) => `${head}${ind || '        '}$middleware->statefulApi();\n${ind}`);
});

// 2. AuthController -> session cookie di login & verifyOtp, logout aman
patch('app/Http/Controllers/Auth/AuthController.php', (s) => {
  if (s.includes('startWebSession')) return null;

  if (!s.includes('use Illuminate\\Support\\Facades\\Auth;')) {
    const a = 'use Illuminate\\Http\\Request;\n';
    if (!s.includes(a)) throw new Error('anchor "use Illuminate\\Http\\Request;" gak ketemu');
    s = s.replace(a, a + 'use Illuminate\\Support\\Facades\\Auth;\n');
  }

  const tokenLine = "$token = $user->createToken('auth-token')->plainTextToken;\n";
  const n = s.split(tokenLine).length - 1;
  if (n < 1) throw new Error('anchor createToken(...) gak ketemu');
  s = s.split(tokenLine).join(tokenLine + '\n        $this->startWebSession($request, $user);\n');

  const del = '$user->currentAccessToken()->delete();';
  if (!s.includes(del)) throw new Error('anchor currentAccessToken()->delete() gak ketemu');
  s = s.replace(
    del,
    `// Kalau request-nya autentikasi lewat cookie sesi, currentAccessToken()
        // itu TransientToken (gak punya delete()), makanya dicek dulu.
        $currentToken = $user->currentAccessToken();
        if ($currentToken && method_exists($currentToken, 'delete')) {
            $currentToken->delete();
        }

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }`,
  );

  const end = s.lastIndexOf('}');
  if (end === -1) throw new Error('penutup class gak ketemu');
  const helper = `
    /**
     * Bikin sesi cookie (guard web) di samping token Sanctum, supaya halaman
     * Inertia (route web + middleware 'auth') ikut kenal user yang login.
     * Token tetap dikirim buat SPA lama. Cuma jalan kalau request stateful
     * (same-origin, domain ada di SANCTUM_STATEFUL_DOMAINS).
     */
    private function startWebSession(Request $request, User $user): void
    {
        if (!$request->hasSession()) {
            return;
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
    }
`;
  return s.slice(0, end).replace(/\s*$/, '\n') + helper + '}\n';
});

// 3. HandleInertiaRequests -> share auth.user
patch('app/Http/Middleware/HandleInertiaRequests.php', (s) => {
  if (s.includes("'auth' =>")) return null;
  const re = /(\.\.\.parent::share\(\$request\),\n)(\s*)\/\/\n/;
  if (!re.test(s)) throw new Error('anchor share() gak ketemu (mungkin sudah diubah manual)');
  return s.replace(
    re,
    `$1$2'auth' => [
$2    'user' => fn () => $request->user()?->only('id', 'name', 'email'),
$2],
`,
  );
});

// 4. routes/web.php -> route login bernama + grup auth
patch('routes/web.php', (s) => {
  if (s.includes("->name('login')")) return null;
  const block = `// Tujuan redirect middleware 'auth' kalau belum login (halaman login tetap SPA lama).
Route::get('/login', fn () => view('spa'))->name('login');

// Halaman Inertia yang sudah dimigrasi didaftarkan di grup ini (HARUS di atas catch-all).
Route::middleware('auth')->group(function () {
    //
});

`;
  const marker = s.indexOf('// ── Sisanya');
  const idx = marker !== -1 ? marker : s.indexOf("Route::get('/{any?}'");
  if (idx === -1) throw new Error('anchor catch-all gak ketemu');
  return s.slice(0, idx) + block + s.slice(idx);
});

// 5. inertia-app.tsx -> ThemeProvider, AuthProvider, Toaster
patch('resources/js/inertia-app.tsx', (s) => {
  if (s.includes("from './context/ThemeContext'")) return null;
  const imp = "import { queryClient } from './lib/queryClient';\n";
  if (!s.includes(imp)) throw new Error('anchor import queryClient gak ketemu');
  s = s.replace(
    imp,
    imp +
      "import { ThemeProvider } from './context/ThemeContext';\n" +
      "import { AuthProvider } from './context/AuthContext';\n" +
      "import { Toaster } from 'react-hot-toast';\n",
  );
  if (!s.includes('<App {...props} />')) throw new Error('anchor <App {...props} /> gak ketemu');
  s = s.replace(
    '<App {...props} />',
    `<ThemeProvider>
            <AuthProvider>
              <Toaster position="top-center" />
              <App {...props} />
            </AuthProvider>
          </ThemeProvider>`,
  );
  return s.replace(/\s*\/\/ TODO saat menu pertama dimigrasi:[^\n]*\n(\s*\/\/[^\n]*\n)?/, '\n');
});

// ---- eksekusi ----
if (errors.length) {
  console.error('\nGAGAL, tidak ada file yang diubah:\n');
  for (const e of errors) console.error('  - ' + e);
  console.error('\nKirim pesan ini ke Claude.');
  process.exit(1);
}

const backupDir = f('.foundation-backup');
for (const e of edits) {
  if (e.status !== 'dipatch') continue;
  const dest = path.join(backupDir, e.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f(e.file), dest);
  fs.writeFileSync(f(e.file), e.content);
}

console.log('');
for (const e of edits) console.log(`  ${e.status === 'dipatch' ? '✔' : '·'} ${e.file}  (${e.status})`);
console.log('\nSelesai. Backup asli: .foundation-backup/ (hapus kalau sudah yakin).');
console.log('Jangan lupa: SANCTUM_STATEFUL_DOMAINS di Railway = domain app ini.\n');
