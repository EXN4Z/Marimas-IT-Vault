#!/usr/bin/env node
// P14 -- Cleanup: semua menu sudah Inertia, buang sisa SPA lama + auth token.
//
// Taruh di <root>\scripts\p14.mjs, jalankan dari ROOT project (folder yang ada artisan + package.json):
//   git status                      # pastikan P13 sudah di-commit
//   node scripts/p14.mjs            # tambah  --skip-npm  kalau mau uninstall react-router-dom manual
//   npx tsc --noEmit; npm run build; php artisan route:list
//
// Aman dijalankan berulang (idempotent). Kalau ada anchor yang tidak ketemu, TIDAK ADA file yang
// diubah/dihapus. Respek CRLF/LF tiap file. Skrip ini sendiri TIDAK ikut dihapus -- hapus folder
// scripts/ manual setelah commit.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const f = (p) => path.join(root, p);
const SKIP_NPM = process.argv.includes('--skip-npm');

if (!fs.existsSync(f('artisan')) || !fs.existsSync(f('package.json'))) {
  console.error('artisan / package.json tidak ketemu. Jalankan dari ROOT project.');
  process.exit(1);
}

const writes = []; // { file, content (LF), note }
const deletes = []; // path relatif
const errors = [];
const notes = [];

const nl = (s) => s.replace(/\r\n/g, '\n');
const exists = (p) => fs.existsSync(f(p));

// Edit file yang sudah ada. fn(content LF) -> content baru (atau sama kalau tidak ada yang perlu diubah).
function patch(file, fn, { optional = false } = {}) {
  if (!exists(file)) {
    if (!optional) errors.push(`${file}: file tidak ada`);
    return;
  }
  const raw = fs.readFileSync(f(file), 'utf8');
  const crlf = raw.includes('\r\n');
  try {
    const before = nl(raw);
    const after = fn(before);
    if (after === before) return notes.push(`= ${file} (sudah beres, dilewati)`);
    writes.push({ file, content: after, crlf, note: `~ ${file}` });
  } catch (e) {
    errors.push(`${file}: ${e.message}`);
  }
}

// Timpa seluruh isi file (EOL file lama dipertahankan).
function overwrite(file, content) {
  const crlf = exists(file) && fs.readFileSync(f(file), 'utf8').includes('\r\n');
  const before = exists(file) ? nl(fs.readFileSync(f(file), 'utf8')) : null;
  if (before === content) return notes.push(`= ${file} (sudah beres, dilewati)`);
  writes.push({ file, content, crlf, note: `${before === null ? '+' : '~'} ${file}` });
}

function remove(p) {
  if (exists(p)) deletes.push(p);
}

// ---------- helper edit teks ----------
function replaceOnce(s, from, to, label) {
  if (s.includes(to) && !s.includes(from)) return s; // sudah diterapkan
  if (!s.includes(from)) throw new Error(`anchor tidak ketemu: ${label ?? from.slice(0, 60)}`);
  return s.replace(from, to);
}

function removeLine(s, line) {
  const re = new RegExp(`^[ \\t]*${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*\\n`, 'm');
  return s.replace(re, '');
}

// Hapus method PHP (beserta docblock di atasnya) dengan brace matching.
function removeMethod(s, name) {
  const re = new RegExp(
    `\\n(?:    /\\*\\*(?:(?!\\*/)[\\s\\S])*\\*/\\n)?    (?:public|private|protected) function ${name}\\(`,
  );
  const m = re.exec(s);
  if (!m) return s; // sudah tidak ada
  const open = s.indexOf('{', m.index + m[0].length);
  let depth = 0;
  let i = open;
  for (; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) break;
  }
  if (depth !== 0) throw new Error(`kurung kurawal method ${name} tidak seimbang`);
  const rest = s[i + 1] === '\n' ? s.slice(i + 2) : s.slice(i + 1); // ikut buang \n penutup baris `}`
  return s.slice(0, m.index) + rest;
}

function dropUnusedImport(s, fqcn) {
  const short = fqcn.split('\\').pop();
  const line = `use ${fqcn};`;
  if (!s.includes(line)) return s;
  const without = removeLine(s, line);
  return new RegExp(`\\b${short}\\b`).test(without) ? s : without;
}

// =====================================================================================
// 1. routes/web.php -- buang catch-all SPA
// =====================================================================================
patch('routes/web.php', (s) => {
  // blok contoh/komentar lama
  s = s.replace(
    /\/\/ ── Menu yang sudah dimigrasi ke Inertia didaftarkan DI SINI[^\n]*\n\/\/ Contoh nanti:\n\/\/ Route::get\('\/audit-log'[^\n]*\n\n?/,
    '',
  );
  s = s.replace(
    '// Halaman Inertia yang sudah dimigrasi didaftarkan di grup ini (HARUS di atas catch-all).',
    '// Halaman Inertia (butuh login).',
  );

  // catch-all SPA: dari komentar "Sisanya" sampai akhir file, asal cuma berisi 1 Route
  const idx = s.indexOf('// ── Sisanya: SPA lama');
  if (idx !== -1) {
    const tail = s.slice(idx);
    const routeCount = (tail.match(/\bRoute::/g) || []).length;
    if (routeCount !== 1 || !tail.includes("view('spa')")) {
      throw new Error('catch-all SPA tidak seperti yang diperkirakan (ada route lain di bawahnya), hapus manual');
    }
    s = s.slice(0, idx).replace(/\n+$/, '\n');
  }

  if (!/\bInertia::/.test(s)) s = removeLine(s, 'use Inertia\\Inertia;');
  return s;
});

// =====================================================================================
// 2. routes/api.php -- buang /login, /verify-otp, Broadcast::routes (pindah ke web+auth)
// =====================================================================================
patch('routes/api.php', (s) => {
  s = removeLine(s, "Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);");
  s = removeLine(s, "Route::post('/login', [AuthController::class, 'login']);");
  s = s.replace("Broadcast::routes(['middleware' => ['auth:sanctum']]);\n\n", '');
  s = removeLine(s, "Broadcast::routes(['middleware' => ['auth:sanctum']]);");
  if (!/\bBroadcast::/.test(s)) s = removeLine(s, 'use Illuminate\\Support\\Facades\\Broadcast;');
  return s;
});

// =====================================================================================
// 3. bootstrap/app.php -- /broadcasting/auth + routes/channels.php, auth session
// =====================================================================================
patch('bootstrap/app.php', (s) => {
  if (s.includes('withBroadcasting')) return s;
  const re = /^([ \t]*)->withExceptions\(/m;
  if (!re.test(s)) throw new Error('->withExceptions( tidak ketemu');
  return s.replace(
    re,
    (_, ind) =>
      `${ind}// Endpoint /broadcasting/auth (Pusher/Echo private channel) + definisi channel di routes/channels.php.\n` +
      `${ind}// Auth lewat session (web + auth), bukan lagi Bearer token Sanctum.\n` +
      `${ind}->withBroadcasting(__DIR__.'/../routes/channels.php', ['middleware' => ['web', 'auth']])\n` +
      `${ind}->withExceptions(`,
  );
});

// =====================================================================================
// 4. AuthController -- buang login, verifyOtp, startWebSession, createToken
// =====================================================================================
const NEW_LOGOUT = `    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out']);
    }
`;

patch('app/Http/Controllers/Auth/AuthController.php', (s) => {
  s = removeMethod(s, 'login');
  s = removeMethod(s, 'verifyOtp');
  s = removeMethod(s, 'startWebSession');

  if (s.includes('currentAccessToken') || s.includes('createToken')) {
    s = removeMethod(s, 'logout');
    const end = s.lastIndexOf('}');
    s = s.slice(0, end).replace(/\s+$/, '\n') + '\n' + NEW_LOGOUT + '}\n';
  }

  s = dropUnusedImport(s, 'App\\Actions\\Auth\\ResolveLoginUser');
  s = dropUnusedImport(s, 'App\\Actions\\Auth\\VerifyRegistrationOtp');
  s = dropUnusedImport(s, 'App\\Models\\User');

  if (/createToken|startWebSession/.test(s)) throw new Error('masih ada createToken/startWebSession, cek manual');
  return s;
});

patch(
  'app/Http/Middleware/EnsureUserIsMember.php',
  (s) => s.replace('(SPA lama & axios bergantung pada ini)', '(axios bergantung pada ini)'),
  { optional: true },
);

// =====================================================================================
// 5. vite.config.js -- entry SPA lama dibuang
// =====================================================================================
patch('vite.config.js', (s) => {
  s = s.replace(/[ \t]*\/\/ main\.tsx = SPA lama[^\n]*\n/, '');
  s = s.replace(
    /input:\s*\[\s*'resources\/js\/main\.tsx',\s*'resources\/js\/inertia-app\.tsx'\s*\]/,
    "input: ['resources/js/inertia-app.tsx']",
  );
  if (s.includes('main.tsx')) throw new Error('masih ada main.tsx di vite.config.js, cek manual');
  return s;
});

// =====================================================================================
// 6. JS: axios, navigasi, AuthContext, echo, dashboard hook
// =====================================================================================
overwrite(
  'resources/js/api/axios.ts',
  `import axios from 'axios';
import { router } from '@inertiajs/react';

// Autentikasi 100% session cookie (same-origin): cookie + header X-XSRF-TOKEN dikirim otomatis
// oleh axios. Tidak ada lagi header Bearer / token di localStorage.
// Syarat di server: host yang dipakai harus ada di SANCTUM_STATEFUL_DOMAINS, kalau tidak
// request /api dianggap tidak stateful dan auth:sanctum membalas 401.
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api' : '/api'),
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
  },
});

// Sesi habis / tidak valid (401) di request MANAPUN -> balik ke halaman login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      router.visit('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
`,
);

overwrite(
  'resources/js/hooks/useAppNavigate.ts',
  `import { useCallback } from 'react';
import { router } from '@inertiajs/react';

type AppNavigateOptions = { replace?: boolean };

// Pengganti useNavigate() untuk halaman Inertia: navigate('/path', { replace }) atau navigate(-1).
export function useAppNavigate() {
  return useCallback((to: string | number, opts?: AppNavigateOptions) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    router.visit(to, { replace: opts?.replace });
  }, []);
}
`,
);

overwrite(
  'resources/js/context/AuthContext.tsx',
  `import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { User } from '../types/user';
import api from '../api/axios';
import { queryClient } from '../lib/queryClient';
import { disconnectEcho } from '../lib/echo';
import { unsubscribeThisDevice } from '../api/pushNotifications';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<{ password_direset?: boolean } | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// initialUser = auth.user dari shared props Inertia halaman pertama (session cookie). Setelah itu
// InertiaAuthSync (di dalam layout) menyamakannya tiap navigasi, jadi sumber kebenaran = server.
// Tidak ada lagi token / user di localStorage dan tidak ada GET /user.
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const lastUserId = useRef<number | string | null>(initialUser?.id ?? null);

  const handleSetUser = (u: User | null) => {
    // ganti user (login akun lain) atau logout -> buang semua cache react-query, supaya data
    // user sebelumnya tidak sempat kelihatan.
    if (lastUserId.current !== null && (u?.id ?? null) !== lastUserId.current) {
      queryClient.clear();
    }
    lastUserId.current = u?.id ?? null;
    setUser(u);
  };

  // Urutan: unsubscribe push DULU (DELETE /push-subscriptions butuh sesi yang masih valid),
  // baru POST /api/logout (mengakhiri sesi). Redirect ke /login = tugas pemanggil (layout).
  const logout = async (): Promise<{ password_direset?: boolean } | undefined> => {
    let response: { password_direset?: boolean } | undefined;

    await unsubscribeThisDevice();

    try {
      const res = await api.post('/logout');
      response = res.data;
    } catch {
      // best-effort, tetap lanjut bersihin state lokal
    }

    disconnectEcho();
    queryClient.clear();
    lastUserId.current = null;
    setUser(null);

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
`,
);

patch('resources/js/pages/dashboard/useDashboardData.ts', (s) => {
  s = replaceOnce(
    s,
    'const { user: cachedUser, isLoading: authLoading, setUser } = useAuth();',
    'const { user: cachedUser, setUser } = useAuth();',
  );
  s = replaceOnce(s, 'const sessionReady = !authLoading && !!cachedUser;', 'const sessionReady = !!cachedUser;');
  s = replaceOnce(s, 'if (!authLoading && !cachedUser) {', 'if (!cachedUser) {');
  s = replaceOnce(s, '}, [authLoading, cachedUser, navigate]);', '}, [cachedUser, navigate]);');
  if (s.includes('authLoading')) throw new Error('masih ada authLoading di useDashboardData.ts, cek manual');
  return s;
});

patch('resources/js/lib/echo.ts', (s) => {
  s = replaceOnce(
    s,
    "// Autentikasi channel private lewat session cookie: request ke /api/broadcasting/auth dikirim pakai\n// instance axios aplikasi (same-origin, cookie + XSRF otomatis), BUKAN header Bearer token.",
    "// Autentikasi channel private lewat session cookie: POST /broadcasting/auth (route web, middleware\n// web+auth, lihat withBroadcasting di bootstrap/app.php) dikirim pakai instance axios aplikasi\n// (same-origin, cookie + XSRF otomatis). baseURL di-override ke '/' karena instance ini default-nya /api.",
  );
  s = replaceOnce(
    s,
    ".post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })",
    ".post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name }, { baseURL: '/' })",
  );
  return s;
});

// komentar usang (kosmetik, dilewati diam-diam kalau sudah beda)
patch(
  'resources/js/components/layout/AppLayoutShell.tsx',
  (s) =>
    s
      .replace('react-router maupun @inertiajs', '@inertiajs')
      .replace('(unsubscribe push -> revoke token -> bersih-bersih)', '(unsubscribe push -> logout server -> bersih-bersih)'),
  { optional: true },
);
patch(
  'resources/js/lib/queryClient.ts',
  (s) => s.replace('singleton dipisah dari main.tsx biar', 'singleton dipisah dari inertia-app.tsx biar'),
  { optional: true },
);

// =====================================================================================
// 7. Hapus file SPA + file bantu migrasi
// =====================================================================================
for (const p of [
  'resources/js/main.tsx',
  'resources/js/App.tsx',
  'resources/js/lib/inertiaRoutes.ts',
  'resources/views/spa.blade.php',
  'fix-after-merge.mjs',
  'CLAUDE.md',
  'AGENTS.md',
  'foundation',
  '.foundation-backup',
]) remove(p);

if (exists('scripts')) {
  for (const e of fs.readdirSync(f('scripts'))) {
    // skrip migrasi P4..P13 saja; p14.mjs (skrip ini) dibiarkan
    if (/^p\d+[a-z]?(-.*)?\.mjs$/i.test(e) && !/^p14(\b|[-.])/i.test(e)) remove(`scripts/${e}`);
  }
}

// AdminRoute sudah tidak ada di project ini, tapi kalau muncul lagi, kasih tahu.
for (const p of ['resources/js/components/AdminRoute.tsx', 'resources/js/components/shared/AdminRoute.tsx']) remove(p);

// Guard: pastikan tidak ada yang masih import file yang mau dihapus.
function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const willDelete = new Set(deletes.map((p) => p.replace(/\\/g, '/')));
const rewritten = new Set(writes.map((w) => w.file));
for (const file of walk(f('resources/js'))) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (willDelete.has(rel) || rewritten.has(rel)) continue;
  const src = nl(fs.readFileSync(file, 'utf8'));
  if (/from\s+['"][^'"]*(lib\/inertiaRoutes|\/App(\.tsx)?|\/main(\.tsx)?|AdminRoute)['"]/.test(src)) {
    errors.push(`${rel}: masih meng-import file yang akan dihapus (inertiaRoutes/App/main/AdminRoute)`);
  }
  if (/from\s+['"]react-router(-dom)?['"]/.test(src)) {
    errors.push(`${rel}: masih meng-import react-router`);
  }
}

// =====================================================================================
// Terapkan (atau batal total kalau ada error)
// =====================================================================================
if (errors.length) {
  console.error('\nBATAL, tidak ada file yang diubah:\n');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

for (const w of writes) {
  fs.mkdirSync(path.dirname(f(w.file)), { recursive: true });
  fs.writeFileSync(f(w.file), w.crlf ? w.content.replace(/\n/g, '\r\n') : w.content);
  console.log(w.note);
}
for (const p of deletes) {
  fs.rmSync(f(p), { recursive: true, force: true });
  console.log(`- ${p}`);
}
for (const n of notes) console.log(n);

// react-router-dom (package.json + package-lock.json)
const pkg = JSON.parse(fs.readFileSync(f('package.json'), 'utf8'));
const hasRR = !!(pkg.dependencies?.['react-router-dom'] || pkg.devDependencies?.['react-router-dom']);
if (hasRR) {
  if (SKIP_NPM) {
    console.log('\n! react-router-dom masih ada. Jalankan manual:  npm uninstall react-router-dom');
  } else {
    console.log('\n> npm uninstall react-router-dom');
    try {
      execSync('npm uninstall react-router-dom', { cwd: root, stdio: 'inherit' });
    } catch {
      console.log('! npm uninstall gagal. Jalankan manual:  npm uninstall react-router-dom');
    }
  }
}

console.log(`
Selesai: ${writes.length} file diubah, ${deletes.length} dihapus.
Langkah berikutnya:
  npx tsc --noEmit
  npm run build
  php artisan route:list      # pastikan POST/GET /broadcasting/auth ada, /login & /verify-otp API hilang
Lalu cek env (SANCTUM_STATEFUL_DOMAINS, dll), tes manual, dan commit. Hapus folder scripts/ setelah commit.
`);
