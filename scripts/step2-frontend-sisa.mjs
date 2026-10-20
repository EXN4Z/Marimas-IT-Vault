#!/usr/bin/env node
// Langkah 2 refactor (frontend): pages/, layouts, laporan/, types/, utils/ -> lib/export/.
// Jalankan dari root project:  node scripts/step2-frontend-sisa.mjs
// Pakai `git mv` kalau project-nya repo git (history terjaga), kalau tidak pakai rename biasa.
// Semua import relatif di seluruh resources/js ikut diperbarui otomatis. Aman dijalankan ulang.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const JS = 'resources/js';
if (!fs.existsSync(JS)) { console.error('Jalankan dari root project (resources/js tidak ketemu).'); process.exit(1); }
const P = (rel) => path.join(JS, rel);
const posix = (p) => p.split(path.sep).join('/');
const log = [];

// ---------------------------------------------------------------- helper git / fs
let inGit = false;
try { execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); inGit = true; } catch {}
function mv(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (inGit) {
    try { execFileSync('git', ['mv', from, to], { stdio: 'ignore' }); return; } catch {}
  }
  fs.renameSync(from, to);
}
function rm(file) {
  if (inGit) { try { execFileSync('git', ['rm', '-f', '-q', file], { stdio: 'ignore' }); return; } catch {} }
  fs.unlinkSync(file);
}
const walk = (d) => !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []);

// ---------------------------------------------------------------- 1) layouts: lebur AppLayoutShell ke AppLayout
const APP_LAYOUT = `import { useState, useRef, type ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import { useAppNavigate } from '../hooks/useAppNavigate';
import { navItems, interleaveByChildren, matchesPrefix, INVENTORY_ROLES } from './navigation';
import type { NavItem, NavChild } from './navigation';
import Sidebar from './sidebar/Sidebar';
import Header from './header/Header';
import AuthSync from './AuthSync';
import FlashToaster from './FlashToaster';
import { NotificationsProvider } from '../features/notifications/NotificationsContext';

// Layout utama aplikasi (sidebar + header + konten). Dipasang sebagai persistent layout di
// app.tsx, jadi sidebar/header TIDAK di-remount (scroll & state-nya awet) saat pindah antar halaman Inertia.
// (Dulu terpecah: InertiaAppLayout = adapter Inertia, AppLayoutShell = tampilan. Sekarang satu file;
// Sidebar & Header sudah dipecah ke layouts/sidebar dan layouts/header.)
export default function AppLayout({ children }: { children: ReactNode }) {
  const { url } = usePage();
  const { user, logout } = useAuth();
  const navigate = useAppNavigate();

  // usePage().url = path + query (mis. '/master-data?tab=kategori'), kadang ada hash.
  const clean = url.split('#')[0];
  const q = clean.indexOf('?');
  const pathname = q === -1 ? clean : clean.slice(0, q);
  const search = q === -1 ? '' : clean.slice(q);

  const onNavigate = (to: string, opts?: { replace?: boolean }) => {
    navigate(to, opts?.replace ? { replace: true } : undefined);
  };

  const onLogout = async () => {
    // logout() (AuthContext): unsubscribe push -> POST /logout (route web) -> bersihin state.
    // Redirect sengaja di sini, bukan di AuthContext.
    await logout();
    window.location.href = '/login';
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOverrides, setDropdownOverrides] = useState<Record<string, boolean>>({});
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = interleaveByChildren(
    navItems.filter((item) => {
      if (item.hidden) return false;
      if (!item.restricted) return true;
      if (item.label === 'Master Data') {
        return INVENTORY_ROLES.includes(user?.role ?? '');
      }
      return user?.role === 'admin';
    })
  );

  const isParentActive = (item: NavItem): boolean => {
    if (!item.children) return false;
    if (matchesPrefix(pathname, item.matchPrefix)) return true;
    return item.children.some((child) => pathname === child.path);
  };

  const isDropdownOpen = (item: NavItem): boolean => {
    const override = dropdownOverrides[item.label];
    if (override !== undefined) return override;
    return isParentActive(item);
  };

  const isChildActive = (child: NavChild, isFirst: boolean): boolean => {
    const childNoQuery = child.path.split('?')[0];
    const hasChildQuery = child.path.includes('?');
    const currentNoQuery = pathname;
    const currentSearch = search;

    if (!hasChildQuery && !currentSearch) {
      return childNoQuery === currentNoQuery;
    }

    if (childNoQuery !== currentNoQuery) return false;

    if (!hasChildQuery) return false;

    const childParams = new URLSearchParams(child.path.split('?')[1]);
    const childTab = childParams.get('tab');
    if (!childTab) return childNoQuery === currentNoQuery;

    const currentParams = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch);
    const currentTab = currentParams.get('tab');

    if (!currentTab) {
      return isFirst;
    }

    return currentTab === childTab;
  };

  const handleNavClick = (item: NavItem) => {
    if (!item.path) {
      if (item.children) {
        setDropdownOverrides((prev) => ({
          ...prev,
          [item.label]: !isDropdownOpen(item),
        }));
      }
      return;
    }
    onNavigate(item.path);
    setSidebarOpen(false);
  };

  const handleChildClick = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await onLogout();
  };

  const handleSearchResultClick = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  const handleContentScroll = () => {};

  return (
    <NotificationsProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-zinc-950">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          />
        )}

        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          visibleNavItems={visibleNavItems}
          pathname={pathname}
          search={search}
          isParentActive={isParentActive}
          isDropdownOpen={isDropdownOpen}
          isChildActive={isChildActive}
          handleNavClick={handleNavClick}
          handleChildClick={handleChildClick}
          handleLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onMenuClick={() => setSidebarOpen(true)}
            navItems={navItems}
            onSearchResultClick={handleSearchResultClick}
          />

          <main
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <AuthSync />
            <FlashToaster />
            {children}
          </main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
`;
const shell = P('layouts/AppLayoutShell.tsx');
if (fs.existsSync(shell)) {
  fs.writeFileSync(P('layouts/AppLayout.tsx'), APP_LAYOUT);
  rm(shell);
  log.push('layout  AppLayoutShell.tsx dilebur ke AppLayout.tsx (dihapus)');
}

// ---------------------------------------------------------------- 2) daftar pindah file
const moves = new Map(); // relatif ke resources/js, format posix
for (const f of walk(P('inertia/pages'))) {
  const rel = posix(path.relative(JS, f));
  moves.set(rel, rel.replace(/^inertia\/pages\//, 'pages/'));
}
const L = 'features/laporan/';
const lap = {
  'TabFotoInventory.tsx': 'foto/FotoInventoryTab.tsx',
  'TabRiwayatInventory.tsx': 'riwayat/RiwayatInventoryTab.tsx',
  'SimpleExportModal.tsx': 'export/SimpleExportModal.tsx',
  'InventoryExportModal.tsx': 'export/InventoryExportModal.tsx',
  'InventoryPemakaiExportModal.tsx': 'export/InventoryPemakaiExportModal.tsx',
  'KaryawanExportModal.tsx': 'export/KaryawanExportModal.tsx',
  'DepartemenExportModal.tsx': 'export/DepartemenExportModal.tsx',
  'KategoriExportModal.tsx': 'export/KategoriExportModal.tsx',
};
for (const [a, b] of Object.entries(lap)) if (fs.existsSync(P(L + a))) moves.set(L + a, L + b);
if (fs.existsSync(P('types/laporan.ts'))) moves.set('types/laporan.ts', L + 'types.ts');
for (const n of ['excelReport.ts', 'printCsvReport.ts']) if (fs.existsSync(P('utils/' + n))) moves.set('utils/' + n, 'lib/export/' + n);

// ---------------------------------------------------------------- 3) hitung ulang semua import relatif
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
const files = new Set(walk(JS).map((f) => posix(path.relative(JS, f))));
const resolveRel = (fromRel, spec) => {
  const base = posix(path.normalize(path.join(path.dirname(fromRel), spec)));
  for (const e of EXTS) if (files.has(base + e)) return { file: base + e, ext: e };
  return null;
};
const re = /((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;
const newContent = new Map(); // newRel -> isi
for (const rel of files) {
  const src = fs.readFileSync(P(rel), 'utf8');
  const newRel = moves.get(rel) ?? rel;
  const out = src.replace(re, (m, pre, q, spec) => {
    const r = resolveRel(rel, spec);
    if (!r) return m;
    const target = moves.get(r.file) ?? r.file;
    if (newRel === rel && target === r.file) return m; // tidak ada yang bergeser
    let t = target;
    if (r.ext === '/index.ts' || r.ext === '/index.tsx') t = t.replace(/\/index\.tsx?$/, '');
    else if (r.ext === '.ts' || r.ext === '.tsx') t = t.replace(/\.tsx?$/, '');
    let rp = posix(path.relative(path.dirname(newRel), t));
    if (!rp.startsWith('.')) rp = './' + rp;
    return pre + q + rp + q;
  });
  if (out !== src || moves.has(rel)) newContent.set(newRel, out);
}

// ---------------------------------------------------------------- 4) eksekusi pindah + tulis isi baru
for (const [from, to] of moves) { mv(P(from), P(to)); log.push(`pindah  ${from}  ->  ${to}`); }
for (const [rel, content] of newContent) {
  if (!fs.existsSync(P(rel))) continue;
  if (fs.readFileSync(P(rel), 'utf8') !== content) { fs.writeFileSync(P(rel), content); if (![...moves.values()].includes(rel)) log.push('import  ' + rel); }
}

// ---------------------------------------------------------------- 5) rename identifier + teks yang menyebut path lama
const textFix = (rel, fn) => {
  if (!fs.existsSync(P(rel))) return;
  const s = fs.readFileSync(P(rel), 'utf8'), o = fn(s);
  if (o !== s) { fs.writeFileSync(P(rel), o); log.push('teks    ' + rel); }
};
for (const f of walk(JS)) {
  const rel = posix(path.relative(JS, f));
  textFix(rel, (s) => s
    .replace(/\bTabFotoInventory\b/g, 'FotoInventoryTab')
    .replace(/\bTabRiwayatInventory\b/g, 'RiwayatInventoryTab')
    .replace(/inertia-app\.tsx/g, 'app.tsx'));
}
textFix('app.tsx', (s) => s
  .replace("resources/js/inertia/pages/<Menu>/<Halaman>.tsx", "resources/js/pages/<Menu>/<Halaman>.tsx")
  .replace("import.meta.glob<any>('./inertia/pages/**/*.tsx')", "import.meta.glob<any>('./pages/**/*.tsx')")
  .replace("pages[`./inertia/pages/${name}.tsx`]", "pages[`./pages/${name}.tsx`]"));

// ---------------------------------------------------------------- 6) bersihkan folder kosong (sisa pindahan lama, mis. pages/dashboard, inertia/, utils/)
const pruneEmpty = (dir) => {
  for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) pruneEmpty(p); }
  if (dir !== JS && !fs.readdirSync(dir).length) { fs.rmdirSync(dir); log.push('rmdir   ' + posix(path.relative(JS, dir))); }
};
pruneEmpty(JS);

console.log(log.join('\n') || 'Tidak ada yang perlu diubah.');
console.log(`\nSelesai: ${log.length} perubahan. Lanjut: npx tsc --noEmit && npm run build`);
