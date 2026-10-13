// P4 — Pisahkan AppLayout jadi AppLayoutShell (presentational) + AppLayout (adapter react-router).
//
// Jalankan dari ROOT project (folder yang ada package.json):
//   node scripts/p4-split-applayout.mjs            -> tulis file + jalankan tsc
//   node scripts/p4-split-applayout.mjs --dry      -> cuma cek, gak nulis apa-apa
//   node scripts/p4-split-applayout.mjs --no-check -> tulis file, skip tsc
//
// Aman: kalau ada pola yang gak ketemu / jumlahnya beda dari yang diharapkan,
// script berhenti SEBELUM nulis file apa pun.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const NO_CHECK = args.has('--no-check');

const dir = path.resolve('resources/js/components/layout');
const srcPath = path.join(dir, 'AppLayout.tsx');
const shellPath = path.join(dir, 'AppLayoutShell.tsx');

const fail = (msg) => {
  console.error(`\n✗ ${msg}\n  Tidak ada file yang diubah.`);
  process.exit(1);
};

if (!fs.existsSync(srcPath)) fail(`Gak nemu ${srcPath}. Jalankan dari root project.`);
if (fs.existsSync(shellPath)) fail('AppLayoutShell.tsx sudah ada — P4 kelihatannya sudah dikerjakan.');

const raw = fs.readFileSync(srcPath, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
let s = raw.replace(/\r\n/g, '\n');

if (!s.includes("from 'react-router-dom'")) fail('AppLayout.tsx sudah bukan versi react-router asli.');

// ── helper: replace dengan jumlah kecocokan yang diharapkan ─────────────────
function sub(label, pattern, replacement, expected = 1) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const found = (s.match(re) || []).length;
  if (found !== expected) fail(`[${label}] ketemu ${found}x, seharusnya ${expected}x. File sumber beda dari yang diasumsikan.`);
  s = s.replace(re, replacement);
}

// 1. import react-router dibuang
sub('import react-router', "import { useNavigate, useLocation, Outlet } from 'react-router-dom';\n", '');

// 2. logout tidak dipakai lagi di shell (diganti prop onLogout)
sub('useAuth', 'const { user, logout } = useAuth();', 'const { user } = useAuth();');

// 3. hook router dibuang
sub('hook router', '  const navigate = useNavigate();\n  const location = useLocation();\n', '');

// 4. props + signature
sub(
  'signature',
  /interface AppLayoutProps \{\n  title\?: string;\n  children\?: ReactNode;\n\}\n\nexport default function AppLayout\(\{ title, children \}: AppLayoutProps = \{\}\) \{/g,
  `export interface ShellNavigateOptions {
  replace?: boolean;
  // true = buka sebagai overlay (RouteModal): adapter SPA yang menerjemahkan jadi
  // state.backgroundLocation. Di mode Inertia diabaikan.
  overlay?: boolean;
}

export interface AppLayoutShellProps {
  pathname: string;
  search: string; // termasuk '?' di depan, mis. '?tab=kategori' (atau '' kalau kosong)
  onNavigate: (path: string, opts?: ShellNavigateOptions) => void;
  onLogout: () => void | Promise<void>;
  title?: string;
  children?: ReactNode;
}

// Shell PRESENTATIONAL: sidebar, header, dropdown, mobile menu. Tidak boleh import
// react-router maupun @inertiajs. Router-nya disuntik lewat props oleh adapter
// (AppLayout.tsx untuk SPA, InertiaAppLayout.tsx untuk Inertia).
export default function AppLayoutShell({
  pathname,
  search,
  onNavigate,
  onLogout,
  title,
  children,
}: AppLayoutShellProps) {`
);

// 5. navigate overlay -> onNavigate(..., { overlay: true })   (3 tempat)
sub('navigate overlay', /navigate\(([\w.]+), \{ state: \{ backgroundLocation: location \} \}\)/g, 'onNavigate($1, { overlay: true })', 3);

// 6. navigate biasa -> onNavigate   (3 tempat)
sub('navigate biasa', /\bnavigate\((path|item\.path)\);/g, 'onNavigate($1);', 3);

// 7. handleLogout
sub(
  'handleLogout',
  /const handleLogout = async \(\) => \{[\s\S]*?\n\};\n/g,
  `const handleLogout = async () => {
    // Urutan logout (unsubscribe push -> revoke token -> bersih-bersih) + redirect
    // ke /login ditangani adapter lewat onLogout.
    await onLogout();
  };
`
);

// 8. location.pathname / location.search -> props
const nPath = (s.match(/\blocation\.pathname\b/g) || []).length;
const nSearch = (s.match(/\blocation\.search\b/g) || []).length;
if (nPath === 0) fail('location.pathname tidak ketemu sama sekali — aneh.');
s = s.replace(/\blocation\.pathname\b/g, 'pathname').replace(/\blocation\.search\b/g, 'search');

// 9. Outlet -> children
sub('Outlet', '{children ?? <Outlet />}', '{children}');

// ── verifikasi: tidak boleh ada sisa router di kode (komentar diabaikan) ───
const codeOnly = s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');
const leftovers = [
  /react-router/,
  /\buseNavigate\b/,
  /\buseLocation\b/,
  /<Outlet/,
  /\bnavigate\(/,
  /\blocation\b/,
  /\blogout\b/,
].filter((re) => re.test(codeOnly));
if (leftovers.length) fail(`Masih ada sisa router/logout di shell: ${leftovers.map(String).join(', ')}`);

const shell = s;

// ── adapter react-router ────────────────────────────────────────────────────
const adapter = `import type { ReactNode } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import AppLayoutShell, { type ShellNavigateOptions } from './AppLayoutShell';

interface AppLayoutProps {
  title?: string;
  children?: ReactNode;
}

// Adapter react-router untuk SPA lama. Semua UI ada di AppLayoutShell.
export default function AppLayout({ title, children }: AppLayoutProps = {}) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useAppNavigate();

  const onNavigate = (to: string, opts?: ShellNavigateOptions) => {
    if (opts?.overlay) {
      // Route overlay (RouteModal) wajib bawa backgroundLocation supaya halaman di belakangnya tetap mounted.
      navigate(to, { replace: opts.replace, state: { backgroundLocation: location } });
    } else if (opts?.replace) {
      navigate(to, { replace: true });
    } else {
      navigate(to);
    }
  };

  const onLogout = async () => {
    // NOTE: revoke token, unsubscribe push, & bersih-bersih localStorage semua ada di logout()
    // (AuthContext), urutannya sudah benar. Jangan panggil api.post('/logout') terpisah.
    const res = await logout();
    navigate('/login', {
      replace: true,
      state: res?.password_direset ? { passwordReset: true } : undefined,
    });
  };

  return (
    <AppLayoutShell
      pathname={location.pathname}
      search={location.search}
      onNavigate={onNavigate}
      onLogout={onLogout}
      title={title}
    >
      {children ?? <Outlet />}
    </AppLayoutShell>
  );
}
`;

const out = (t) => t.replace(/\n/g, EOL);

console.log('Hasil transformasi:');
console.log(`  • AppLayoutShell.tsx : ${shell.split('\n').length} baris`);
console.log(`  • AppLayout.tsx      : ${adapter.split('\n').length} baris (adapter)`);
console.log(`  • location.pathname -> pathname: ${nPath}x, location.search -> search: ${nSearch}x`);
console.log(`  • EOL dipertahankan  : ${EOL === '\r\n' ? 'CRLF' : 'LF'}`);

if (DRY) {
  console.log('\n(--dry) tidak ada file yang ditulis.');
  process.exit(0);
}

fs.writeFileSync(shellPath, out(shell), 'utf8');
fs.writeFileSync(srcPath, out(adapter), 'utf8');
console.log('\n✓ File ditulis.');

if (NO_CHECK) process.exit(0);

console.log('\n→ npx tsc --noEmit');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('\n✓ tsc bersih. Lanjut: npm run build, tes SPA manual, lalu commit.');
} catch {
  console.error(
    '\n✗ tsc gagal. Rollback:\n  git checkout resources/js/components/layout/AppLayout.tsx\n  del resources\\js\\components\\layout\\AppLayoutShell.tsx'
  );
  process.exit(1);
}
