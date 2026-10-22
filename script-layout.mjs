#!/usr/bin/env node
// script-layout.mjs -- kembalikan sidebar + top bar ke tampilan & perilaku frontend LAMA.
//
//   node script-layout.mjs --dry     # lihat dulu apa yang akan diubah
//   node script-layout.mjs           # terapkan (backup ke .layout-backup/)
//   node script-layout.mjs --path D:\\Marimas-IT-Vault-main
//
// Aman dijalankan berulang. Anchor tidak ketemu -> bagian itu dilewati & dilaporkan.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const pi = args.indexOf('--path');
const ROOT = path.resolve(pi >= 0 ? args[pi + 1] : process.cwd());
const L = path.join(ROOT, 'resources', 'js', 'layouts');
const BACKUP = path.join(ROOT, '.layout-backup');

if (!fs.existsSync(path.join(ROOT, 'package.json')) || !fs.existsSync(path.join(L, 'AppLayout.tsx'))) {
  console.error(`x Bukan root project Marimas IT Vault: ${ROOT}\n  Jalankan dari folder yang ada package.json, atau pakai --path <folder>.`);
  process.exit(1);
}

const report = [];
const log = (file, status, note = '') => report.push({ file, status, note });
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
  fs.writeFileSync(p, crlf ? text.replace(/\n/g, '\r\n') : text);
}
function replaceOnce(src, from, to) {
  const i = src.indexOf(from);
  if (i < 0 || src.indexOf(from, i + 1) >= 0) return null; // harus unik
  return src.slice(0, i) + to + src.slice(i + from.length);
}
function patch(relPath, steps) {
  const p = path.join(L, relPath);
  if (!fs.existsSync(p)) return log(rel(p), 'SKIP', 'file tidak ditemukan');
  const { text, crlf } = readFile(p);
  let src = text;
  let changed = false;
  let failed = false;
  const notes = [];
  for (const s of steps) {
    if (s.done(src)) {
      notes.push(`${s.name}: sudah ada`);
      continue;
    }
    const out = s.apply(src);
    if (out == null || out === src) {
      notes.push(`${s.name}: ANCHOR TIDAK KETEMU`);
      failed = true;
      continue;
    }
    src = out;
    changed = true;
    notes.push(`${s.name}: ok`);
  }
  if (changed) writeFile(p, src, crlf);
  log(rel(p), failed ? (changed ? 'PARTIAL' : 'GAGAL') : changed ? 'PATCHED' : 'SUDAH', notes.join('; '));
}
// Tulis ulang seluruh file (kalau belum bertanda MARKER).
function rewrite(relPath, content, marker) {
  const p = path.join(L, relPath);
  const exists = fs.existsSync(p);
  const crlf = exists ? readFile(p).crlf : false;
  if (exists && readFile(p).text.includes(marker)) return log(rel(p), 'SUDAH');
  writeFile(p, content, crlf);
  log(rel(p), exists ? 'PATCHED' : 'DIBUAT', 'ditulis ulang sesuai tampilan lama');
}

const MARK = '[LAYOUT-LAMA]';

// =====================================================================
// 1. TOP BAR: header/Header.tsx
// =====================================================================
const HEADER = `import { Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationDropdown from '../../features/notifications/NotificationDropDown';
import GlobalSearch from './GlobalSearch';
import { initials } from '../navigation';
import type { NavItem } from '../navigation';

// ${MARK} Top bar dikembalikan persis seperti frontend lama: tanpa garis bawah (menyatu dengan sidebar),
// judul halaman besar, search di tengah, lalu toggle tema, notifikasi, avatar + nama.
interface HeaderProps {
  title?: string;
  onMenuClick: () => void;
  navItems: NavItem[];
  onSearchResultClick: (path: string) => void;
}

export default function Header({ title, onMenuClick, navItems, onSearchResultClick }: HeaderProps) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="h-18 min-h-18 shrink-0 bg-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-slate-600">
          <Menu size={22} />
        </button>
        <h1 className="text-xl font-bold text-slate-900 hidden sm:block">{title}</h1>
      </div>

      <GlobalSearch navItems={navItems} onResultClick={onSearchResultClick} />

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tombol Toggle Mode Gelap / Terang */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label="Toggle Mode Gelap"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
        >
          {isDark ? (
            <Sun size={20} className="text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon size={20} className="text-slate-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

        <NotificationDropdown />
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
            {initials(user?.name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-tight">{user?.name}</p>
            <p className="text-xs text-slate-400 leading-tight">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
`;
rewrite('header/Header.tsx', HEADER, MARK);

// =====================================================================
// 2. TOP BAR: header/GlobalSearch.tsx (tampilan lama + hanya halaman yang boleh diakses role-nya)
// =====================================================================
const SEARCH = `import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavItem } from '../navigation';

// ${MARK} Kotak search seperti frontend lama. navItems = menu yang sudah difilter role (visibleNavItems),
// dan child dropdown ikut difilter per-role, jadi user tidak melihat halaman yang tidak bisa dia buka.
interface SearchEntry {
  label: string;
  parentLabel?: string;
  path: string;
  icon: NavItem['icon'];
  key: string;
}

interface GlobalSearchProps {
  navItems: NavItem[];
  onResultClick: (path: string) => void;
}

export default function GlobalSearch({ navItems, onResultClick }: GlobalSearchProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const searchEntries: SearchEntry[] = navItems.flatMap((item) => {
    if (item.children) {
      return item.children
        .filter((child) => !child.roles || child.roles.includes(user?.role ?? ''))
        .map((child) => ({
          key: \`\${item.label}-\${child.label}\`,
          label: child.label,
          parentLabel: item.label,
          icon: child.icon,
          path: child.path,
        }));
    }
    if (!item.path) return [];
    return [{ key: item.label, label: item.label, icon: item.icon, path: item.path }];
  });

  const filteredSearchEntries =
    searchQuery.trim() === ''
      ? searchEntries
      : searchEntries.filter((entry) => {
          const q = searchQuery.toLowerCase();
          return (
            entry.label.toLowerCase().includes(q) ||
            (entry.parentLabel ? entry.parentLabel.toLowerCase().includes(q) : false)
          );
        });

  // klik di luar kotak search (input + dropdown) menutup dropdown-nya
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (path: string) => {
    onResultClick(path);
    setSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={searchBoxRef} className="flex items-center flex-1 max-w-md mx-6 relative">
      <Search className="absolute left-3 w-4 h-4 text-slate-400" />
      <input
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setSearchOpen(true);
        }}
        onClick={() => setSearchOpen(true)}
        onFocus={() => setSearchOpen(true)}
        placeholder="Cari sesuatu..."
        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#202024] border border-slate-200 dark:border-[#383842] rounded-lg text-sm transition focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-zinc-600 dark:focus:border-[#5c5c68]"
      />

      {searchOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-40">
          {filteredSearchEntries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Halaman tidak ditemukan.</p>
          ) : (
            filteredSearchEntries.map((entry) => {
              const EntryIcon = entry.icon;
              return (
                <button
                  key={entry.key}
                  onClick={() => handleResultClick(entry.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100 transition"
                >
                  <EntryIcon size={16} className="text-slate-400 shrink-0" />
                  <span className="flex-1 truncate">
                    {entry.parentLabel && <span className="text-slate-400">{entry.parentLabel} / </span>}
                    {entry.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
`;
rewrite('header/GlobalSearch.tsx', SEARCH, MARK);

// =====================================================================
// 3. SIDEBAR: highlight menu pakai matchesPrefix (array prefix juga jalan, seperti versi lama)
// =====================================================================
patch('sidebar/SidebarItem.tsx', [
  {
    name: 'import matchesPrefix',
    done: (s) => s.includes('matchesPrefix'),
    apply: (s) => replaceOnce(s, `import type { NavItem, NavChild } from '../navigation';`, `import type { NavItem, NavChild } from '../navigation';\nimport { matchesPrefix } from '../navigation';`),
  },
  {
    name: 'pakai matchesPrefix',
    done: (s) => s.includes('matchesPrefix(pathname, item.matchPrefix)'),
    apply: (s) => replaceOnce(s, `? pathname.startsWith(item.matchPrefix as string)`, `? matchesPrefix(pathname, item.matchPrefix)`),
  },
]);

// =====================================================================
// 4. AppLayout.tsx: urutan menu, judul halaman, panel konten melayang, warna dasar
// =====================================================================
const OLD_VISIBLE = `  const visibleNavItems = interleaveByChildren(
    navItems.filter((item) => {
      if (item.hidden) return false;
      if (!item.restricted) return true;
      if (item.label === 'Master Data') {
        return INVENTORY_ROLES.includes(user?.role ?? '');
      }
      return user?.role === 'admin';
    })
  );
`;

const NEW_VISIBLE = `  // ${MARK} Urutan sidebar sama seperti versi lama: menu utama di-interleave
  // (Dashboard, Transaksi, Laporan, Master Data), lalu Audit Log (admin) dan Settings SELALU paling bawah.
  // (Sebelumnya semua item ikut di-interleave sehingga Audit Log & Settings terselip di tengah.)
  const canSee = (item: NavItem): boolean => {
    if (item.hidden) return false;
    if (!item.restricted) return true;
    if (item.label === 'Master Data') {
      return INVENTORY_ROLES.includes(user?.role ?? '');
    }
    return user?.role === 'admin';
  };
  // Dropdown yang semua child-nya terfilter role tidak ditampilkan (biar tidak ada menu kosong).
  const hasVisibleContent = (item: NavItem): boolean =>
    !item.children || item.children.some((child) => !child.roles || child.roles.includes(user?.role ?? ''));

  const auditLogItem = navItems.find((i) => i.label === 'Audit Log');
  const settingsItem = navItems.find((i) => i.label === 'Settings');
  const mainNavItems = navItems.filter((i) => i.label !== 'Audit Log' && i.label !== 'Settings');

  const visibleNavItems: NavItem[] = [
    ...interleaveByChildren(mainNavItems).filter(canSee).filter(hasVisibleContent),
    ...(auditLogItem && canSee(auditLogItem) ? [auditLogItem] : []),
    ...(settingsItem && canSee(settingsItem) ? [settingsItem] : []),
  ];
`;

const DERIVED_TITLE = `  // ${MARK} Judul halaman di top bar (diturunkan dari menu yang cocok dengan URL sekarang).
  const derivedTitle = (() => {
    for (const item of visibleNavItems) {
      if (item.children) {
        const kids = item.children.filter((c) => !c.roles || c.roles.includes(user?.role ?? ''));
        const match = kids.find((c, idx) => isChildActive(c, idx === 0));
        if (match) return match.label;
        if (matchesPrefix(pathname, item.matchPrefix)) return item.label;
        continue;
      }
      if (matchesPrefix(pathname, item.matchPrefix)) return item.label;
      if (item.path && item.path === pathname) return item.label;
    }
    return '';
  })();

  const handleContentScroll = () => {};`;

const OLD_BODY = `        <div className="flex-1 flex flex-col min-w-0">
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
        </div>`;

const NEW_BODY = `        {/* ${MARK} Kolom kanan: top bar sticky + panel konten melayang (bg-zinc-100 rounded-3xl) seperti versi lama */}
        <div
          ref={contentScrollRef}
          onScroll={handleContentScroll}
          className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col"
        >
          <Header
            title={derivedTitle}
            onMenuClick={() => setSidebarOpen(true)}
            navItems={visibleNavItems}
            onSearchResultClick={handleSearchResultClick}
          />

          <main className="flex-1 p-4 md:p-8">
            <div className="bg-zinc-100 rounded-3xl min-h-[calc(100vh-6.5rem)] p-4 md:p-8">
              <AuthSync />
              <FlashToaster />
              {children}
            </div>
          </main>
        </div>`;

patch('AppLayout.tsx', [
  {
    name: 'urutan menu',
    done: (s) => s.includes('mainNavItems'),
    apply: (s) => replaceOnce(s, OLD_VISIBLE, NEW_VISIBLE),
  },
  {
    name: 'judul halaman',
    done: (s) => s.includes('derivedTitle ='),
    apply: (s) => replaceOnce(s, `  const handleContentScroll = () => {};`, DERIVED_TITLE),
  },
  {
    name: 'warna dasar',
    done: (s) => s.includes('<div className="h-screen bg-white flex overflow-hidden">'),
    apply: (s) =>
      replaceOnce(s, `<div className="flex h-screen bg-slate-50 dark:bg-zinc-950">`, `<div className="h-screen bg-white flex overflow-hidden">`),
  },
  {
    name: 'overlay mobile',
    done: (s) => s.includes('fixed inset-0 bg-black/40 z-40 lg:hidden'),
    apply: (s) => replaceOnce(s, `fixed inset-0 bg-black/30 z-40 lg:hidden`, `fixed inset-0 bg-black/40 z-40 lg:hidden`),
  },
  {
    name: 'panel konten',
    done: (s) => s.includes('bg-zinc-100 rounded-3xl'),
    apply: (s) => replaceOnce(s, OLD_BODY, NEW_BODY),
  },
]);

// ---------- laporan ----------
const icon = { DIBUAT: '+', PATCHED: '~', PARTIAL: '!', GAGAL: 'x', SKIP: '-', SUDAH: '=' };
console.log(`\nMarimas IT Vault - layout sidebar & top bar ${DRY ? '(DRY RUN, tidak menulis apa pun)' : ''}\n`);
for (const r of report) {
  console.log(` ${icon[r.status] ?? '?'} ${r.status.padEnd(8)} ${r.file}${r.note ? `\n             ${r.note}` : ''}`);
}
const bad = report.filter((r) => r.status === 'GAGAL' || r.status === 'PARTIAL');
console.log(
  `\n${report.filter((r) => ['DIBUAT', 'PATCHED'].includes(r.status)).length} file diubah, ` +
    `${report.filter((r) => r.status === 'SUDAH').length} sudah beres, ${bad.length} perlu dicek manual.`,
);
if (!DRY && fs.existsSync(BACKUP)) console.log(`Backup file asli: ${rel(BACKUP)}/ (hapus kalau sudah yakin)`);
if (bad.length) {
  console.log('\nAda anchor yang tidak ketemu (file sudah berubah dari versi yang di-scan). Kirim output ini ke chat.');
  process.exit(2);
}
