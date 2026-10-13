// P5 — Layout Inertia persistent.
//
// Jalankan dari ROOT project:
//   node scripts/p5-inertia-layout.mjs --dry       -> cek doang
//   node scripts/p5-inertia-layout.mjs             -> tulis + tsc
//   node scripts/p5-inertia-layout.mjs --no-check  -> tulis, skip tsc
//
// Yang dilakukan:
//  1. components/layout/InertiaAppLayout.tsx  (adapter Inertia untuk AppLayoutShell)
//  2. inertia-app.tsx: halaman tanpa Page.layout otomatis dibungkus InertiaAppLayout
//  3. Halaman tes sementara: Test/Ping (di-rewrite) + Test/Ping2, route /_ping & /_ping2
// Berhenti SEBELUM nulis apa pun kalau ada pola yang gak cocok.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const NO_CHECK = args.has('--no-check');

const js = path.resolve('resources/js');
const files = {
  shell: path.join(js, 'components/layout/AppLayoutShell.tsx'),
  layout: path.join(js, 'components/layout/InertiaAppLayout.tsx'),
  app: path.join(js, 'inertia-app.tsx'),
  ping: path.join(js, 'inertia/pages/Test/Ping.tsx'),
  ping2: path.join(js, 'inertia/pages/Test/Ping2.tsx'),
  web: path.resolve('routes/web.php'),
};

const fail = (msg) => {
  console.error(`\n✗ ${msg}\n  Tidak ada file yang diubah.`);
  process.exit(1);
};

for (const k of ['shell', 'app', 'web']) {
  if (!fs.existsSync(files[k])) fail(`Gak nemu ${files[k]}. Jalankan dari root project (dan P4 harus sudah jalan).`);
}
if (fs.existsSync(files.layout)) fail('InertiaAppLayout.tsx sudah ada — P5 kelihatannya sudah dikerjakan.');

const readNorm = (p) => {
  const raw = fs.readFileSync(p, 'utf8');
  return { eol: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
};

function replaceOnce(text, label, oldStr, newStr) {
  const count = text.split(oldStr).length - 1;
  if (count !== 1) fail(`[${label}] ketemu ${count}x, seharusnya 1x. File sumber beda dari yang diasumsikan.`);
  return text.replace(oldStr, () => newStr);
}

// ── 1. inertia-app.tsx ─────────────────────────────────────────────────────
const app = readNorm(files.app);
if (app.text.includes('InertiaAppLayout')) fail('inertia-app.tsx sudah memakai InertiaAppLayout.');

let appText = app.text;
appText = replaceOnce(appText, 'import react', "import { StrictMode } from 'react';", "import { StrictMode, type ReactNode } from 'react';");
appText = replaceOnce(
  appText,
  'import layout',
  "import { Toaster } from 'react-hot-toast';\n",
  "import { Toaster } from 'react-hot-toast';\nimport InertiaAppLayout from './components/layout/InertiaAppLayout';\n"
);
appText = replaceOnce(
  appText,
  'resolve',
  "  resolve: (name) => {\n" +
    "    const page = pages[`./inertia/pages/${name}.tsx`];\n" +
    "    if (!page) throw new Error(`Halaman Inertia tidak ditemukan: ${name}`);\n" +
    "    return page();\n" +
    "  },\n",
  "  resolve: async (name) => {\n" +
    "    const loader = pages[`./inertia/pages/${name}.tsx`];\n" +
    "    if (!loader) throw new Error(`Halaman Inertia tidak ditemukan: ${name}`);\n" +
    "    const page = await loader();\n" +
    "    // Persistent layout: halaman yang TIDAK mendefinisikan Page.layout otomatis dibungkus\n" +
    "    // InertiaAppLayout. Halaman tanpa sidebar/header (Login, VerifyOtp di P13) cukup set\n" +
    "    // `Page.layout = null` (atau fungsi yang return page apa adanya).\n" +
    "    if (page.default.layout === undefined) {\n" +
    "      page.default.layout = (node: ReactNode) => <InertiaAppLayout>{node}</InertiaAppLayout>;\n" +
    "    }\n" +
    "    return page;\n" +
    "  },\n"
);

// ── 2. routes/web.php ──────────────────────────────────────────────────────
const web = readNorm(files.web);
if (web.text.includes('/_ping2')) fail('/_ping2 sudah ada di web.php.');
const webText = replaceOnce(
  web.text,
  'route ping',
  "    Route::get('/_ping', fn () => Inertia::render('Test/Ping'));\n",
  "    Route::get('/_ping', fn () => Inertia::render('Test/Ping'));\n" +
    "    Route::get('/_ping2', fn () => Inertia::render('Test/Ping2')); // TES SEMENTARA (P5)\n"
);

// ── 3. file baru ───────────────────────────────────────────────────────────
const layoutSrc = `import type { ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { useAuth } from '../../context/AuthContext';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import AppLayoutShell, { type ShellNavigateOptions } from './AppLayoutShell';
import InertiaAuthSync from './InertiaAuthSync';

// Adapter Inertia untuk AppLayoutShell. Dipasang sebagai persistent layout di
// inertia-app.tsx, jadi sidebar/header TIDAK di-remount (scroll & state-nya awet)
// saat pindah antar halaman Inertia.
export default function InertiaAppLayout({ children }: { children: ReactNode }) {
  const { url } = usePage();
  const { logout } = useAuth();
  const navigate = useAppNavigate();

  // usePage().url = path + query (mis. '/master-data?tab=kategori'), kadang ada hash.
  const clean = url.split('#')[0];
  const q = clean.indexOf('?');
  const pathname = q === -1 ? clean : clean.slice(0, q);
  const search = q === -1 ? '' : clean.slice(q);

  // opts.overlay (RouteModal) khusus SPA -- di mode Inertia diabaikan.
  const onNavigate = (to: string, opts?: ShellNavigateOptions) => {
    navigate(to, opts?.replace ? { replace: true } : undefined);
  };

  const onLogout = async () => {
    // logout() (AuthContext, mode Inertia): unsubscribe push -> POST /api/logout -> bersihin state.
    // Redirect sengaja di sini, bukan di AuthContext.
    await logout();
    window.location.href = '/login';
  };

  return (
    <AppLayoutShell pathname={pathname} search={search} onNavigate={onNavigate} onLogout={onLogout}>
      <InertiaAuthSync />
      {children}
    </AppLayoutShell>
  );
}
`;

const pingSrc = `import { Link } from '@inertiajs/react';
import { useAuth } from '../../../context/AuthContext';
import { useSharedProps } from '../../../hooks/useSharedProps';

// HALAMAN TES SEMENTARA (P1/P5) -- hapus setelah P5 lolos.
export default function Ping() {
  const { auth } = useSharedProps();
  const { user, isLoading } = useAuth();

  return (
    <div>
      <h1 className="text-xl font-bold">Inertia OK — Ping 1</h1>
      <p>Shared props: {auth.user ? \`\${auth.user.name} (role: \${auth.user.role})\` : '(tidak ada user)'}</p>
      <p>AuthContext: {isLoading ? 'loading...' : user ? \`\${user.name} (role: \${user.role})\` : '(null)'}</p>
      <p className="mt-4">
        <Link href="/_ping2" className="text-blue-600 underline">Ke Ping 2 (client-side)</Link>
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Tes: scroll sidebar ke bawah dulu, lalu klik link di atas. Posisi scroll sidebar tidak boleh reset.
      </p>
      <div style={{ height: 1200 }} />
    </div>
  );
}
`;

const ping2Src = `import { Link } from '@inertiajs/react';

// HALAMAN TES SEMENTARA (P5) -- hapus setelah P5 lolos.
export default function Ping2() {
  return (
    <div>
      <h1 className="text-xl font-bold">Ping 2</h1>
      <p className="mt-4">
        <Link href="/_ping" className="text-blue-600 underline">Balik ke Ping 1</Link>
      </p>
    </div>
  );
}
`;

console.log('Rencana:');
console.log('  + components/layout/InertiaAppLayout.tsx');
console.log('  ~ inertia-app.tsx (persistent layout di resolve)');
console.log('  ~ inertia/pages/Test/Ping.tsx (rewrite) + Test/Ping2.tsx (baru)');
console.log("  ~ routes/web.php (+ /_ping2)");

if (DRY) {
  console.log('\n(--dry) tidak ada file yang ditulis.');
  process.exit(0);
}

const out = (t, eol) => t.replace(/\n/g, eol);
const eol = app.eol;

fs.writeFileSync(files.layout, out(layoutSrc, eol), 'utf8');
fs.writeFileSync(files.app, out(appText, app.eol), 'utf8');
fs.mkdirSync(path.dirname(files.ping), { recursive: true });
fs.writeFileSync(files.ping, out(pingSrc, eol), 'utf8');
fs.writeFileSync(files.ping2, out(ping2Src, eol), 'utf8');
fs.writeFileSync(files.web, out(webText, web.eol), 'utf8');
console.log('\n✓ File ditulis.');

if (NO_CHECK) process.exit(0);

if (!fs.existsSync('tsconfig.json')) {
  console.log('\n! tsconfig.json tidak ada, tsc dilewati.');
  process.exit(0);
}

console.log('\n→ npx tsc --noEmit');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('\n✓ tsc bersih. Lanjut: npm run build, tes manual, lalu hapus halaman tes + commit.');
} catch {
  console.error(
    '\n✗ tsc gagal. Rollback:\n' +
      '  git checkout resources/js/inertia-app.tsx resources/js/inertia/pages/Test/Ping.tsx routes/web.php\n' +
      '  del resources\\js\\components\\layout\\InertiaAppLayout.tsx, resources\\js\\inertia\\pages\\Test\\Ping2.tsx'
  );
  process.exit(1);
}
