#!/usr/bin/env node
// P12b -- Karyawan (create / detail / edit) jadi halaman Inertia beneran (opsi B).
//
// Jalankan dari ROOT project (folder yang ada artisan + package.json), PowerShell:
//   git status                                  # pastikan bersih / sudah commit P11
//   node .\p12b-karyawan-inertia.mjs --dry-run  # cuma tampilkan rencana, tidak menulis apa pun
//   node .\p12b-karyawan-inertia.mjs            # terapkan
//
// Script ini all-or-nothing: semua anchor dicek dulu di memori. Kalau ada satu saja yang tidak
// ketemu (file sudah beda dari yang diharapkan), script berhenti SEBELUM menulis apa pun.

import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const root = process.cwd();

// ───────────────────────── helpers ─────────────────────────
const abs = (rel) => path.join(root, ...rel.split('/'));
const exists = (rel) => fs.existsSync(abs(rel));

function fail(msg) {
  console.error('\nX GAGAL: ' + msg);
  console.error('  Tidak ada file yang diubah.');
  process.exit(1);
}

// baca file -> teks dengan \n; ingat EOL & BOM aslinya supaya bisa ditulis balik persis
function read(rel) {
  if (!exists(rel)) fail('File tidak ditemukan: ' + rel + ' (jalankan dari root project?)');
  let raw = fs.readFileSync(abs(rel), 'utf8');
  const bom = raw.startsWith('\uFEFF');
  if (bom) raw = raw.slice(1);
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { text: raw.replace(/\r\n/g, '\n'), eol, bom };
}

// sub(text, pola, pengganti, label, jumlahYangDiharapkan)
function sub(text, pattern, replacement, label, expected = 1) {
  let count;
  if (typeof pattern === 'string') {
    count = text.split(pattern).length - 1;
  } else {
    const g = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    count = (text.match(g) || []).length;
    pattern = g;
  }
  if (count !== expected) fail(`${label}: ketemu ${count}x, seharusnya ${expected}x`);
  if (typeof pattern === 'string') {
    return text.split(pattern).join(typeof replacement === 'function' ? replacement(pattern) : replacement);
  }
  return text.replace(pattern, replacement);
}

const ops = []; // { kind: 'write' | 'delete', rel, text?, eol?, bom? }
const planned = new Map(); // rel -> text terbaru (kalau satu file diedit beberapa kali)

function edit(rel, fn) {
  const cur = planned.get(rel) ?? read(rel);
  const next = { ...cur, text: fn(cur.text) };
  planned.set(rel, next);
}
function create(rel, text) {
  if (exists(rel)) fail('File sudah ada (migrasi sudah pernah dijalankan?): ' + rel);
  planned.set(rel, { text, eol: '\n', bom: false, isNew: true });
}
const del = (rel) => ops.push({ kind: 'delete', rel });

// ───────────────────────── preflight ─────────────────────────
if (!exists('artisan') || !exists('package.json')) fail('Jalankan dari root project (harus ada artisan & package.json).');
if (exists('app/Http/Controllers/MasterData/KaryawanPageController.php') || exists('resources/js/inertia/pages/Karyawan/Create.tsx')) {
  fail('Tampaknya P12b sudah pernah diterapkan (KaryawanPageController / inertia/pages/Karyawan sudah ada).');
}

// ───────────────────────── 1. RouteModal: lepas dari react-router ─────────────────────────
// Sekarang cuma dipakai TabCabang & TabPerusahaan (modal state lokal, selalu kirim onClose).
// useNavigate() di sini bakal melempar error di halaman Inertia karena tidak ada <Router>.
edit('resources/js/components/shared/RouteModal.tsx', (t) => {
  t = sub(t, "import { useNavigate } from 'react-router-dom';\n", '', 'RouteModal: import useNavigate');
  t = sub(
    t,
    /  \/\*\* Custom close handler[^\n]*\n  onClose\?: \(\) => void;\n  \/\*\* Fallback path[^\n]*\n  fallbackPath\?: string;\n/,
    '  /** Dipanggil waktu modal ditutup (tombol X, klik backdrop, atau Esc). */\n  onClose: () => void;\n',
    'RouteModal: props onClose/fallbackPath',
  );
  t = sub(t, "  fallbackPath = '/',\n", '', 'RouteModal: destructuring fallbackPath');
  t = sub(t, '  const navigate = useNavigate();\n', '', 'RouteModal: const navigate');
  t = sub(
    t,
    /  function handleClose\(\) \{[\s\S]*?\n  \}\n/,
    '  function handleClose() {\n    onClose();\n  }\n',
    'RouteModal: handleClose',
  );
  t = sub(
    t,
    /\/\*\*\n \* Overlay untuk route[\s\S]*?\*\/\n/,
    '/**\n * Modal overlay biasa (state dikontrol parent lewat onClose). Dipakai tab Cabang & Perusahaan.\n * Tidak bergantung ke react-router, jadi aman dirender di halaman Inertia.\n * Create/Detail/Edit Karyawan sekarang halaman Inertia sendiri (lihat PageCard.tsx).\n */\n',
    'RouteModal: doc comment',
  );
  return t;
});

// ───────────────────────── 2. PageCard (pengganti RouteModal untuk halaman Karyawan) ─────────────────────────
create(
  'resources/js/components/shared/PageCard.tsx',
  `import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Dipanggil waktu tombol "Kembali" diklik. */
  onClose: () => void;
  maxWidthClassName?: string;
}

/**
 * Kartu halaman penuh (di dalam layout Inertia) untuk form/detail. Pengganti RouteModal di
 * halaman Karyawan: sekarang create/detail/edit adalah halaman beneran, bukan overlay di atas
 * halaman sebelumnya. Sengaja TIDAK ada tutup-pakai-Esc supaya form yang lagi diisi (atau modal
 * kecil di dalamnya, mis. set password) tidak ikut kebuang.
 */
export default function PageCard({
  title,
  description,
  children,
  onClose,
  maxWidthClassName = 'max-w-xl',
}: PageCardProps) {
  return (
    <div className={'mx-auto w-full ' + maxWidthClassName}>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
`,
);

// ───────────────────────── 3. Pindahkan 3 halaman Karyawan ke inertia/pages/Karyawan ─────────────────────────
// Kedalaman folder sama (3 level dari resources/js), jadi path import relatif tidak perlu diubah.
const KARYAWAN_PAGES = [
  { from: 'KaryawanCreate.tsx', to: 'Create.tsx', useParams: false, successNav: 1 },
  { from: 'KaryawanEdit.tsx', to: 'Edit.tsx', useParams: true, successNav: 2 },
  { from: 'KaryawanDetail.tsx', to: 'Show.tsx', useParams: true, successNav: 0 },
];

for (const p of KARYAWAN_PAGES) {
  const oldRel = 'resources/js/pages/masterData/karyawan/' + p.from;
  const newRel = 'resources/js/inertia/pages/Karyawan/' + p.to;
  let { text: t } = read(oldRel);

  // RouteModal -> PageCard
  t = sub(
    t,
    "import RouteModal from '../../../components/shared/RouteModal';",
    "import PageCard from '../../../components/shared/PageCard';",
    p.from + ': import RouteModal',
  );
  t = t.replace(/<RouteModal\b/g, '<PageCard').replace(/<\/RouteModal>/g, '</PageCard>');
  // prop fallbackPath sudah tidak ada di PageCard (di baris sendiri / inline)
  t = t.replace(/\n[ \t]*fallbackPath="[^"]*"/g, '').replace(/ fallbackPath="[^"]*"/g, '');

  // id dari URL (react-router useParams) -> prop `id` dari controller (Inertia)
  if (p.useParams) {
    t = sub(t, "import { useParams } from 'react-router-dom';\n", "import { usePage } from '@inertiajs/react';\n", p.from + ': import useParams');
    t = sub(
      t,
      'const { id } = useParams<{ id: string }>();',
      'const { id } = usePage().props as unknown as { id: number };',
      p.from + ': useParams',
    );
  }

  // tutup halaman = balik ke list Master Data tab Karyawan (bukan navigate(-1) react-router)
  t = sub(
    t,
    /^([ \t]*)function closeModal\(\) \{[\s\S]*?\n\1\}/m,
    (_m, indent) => {
      const inner = indent + (indent.length >= 4 ? '    ' : '  ');
      return `${indent}function closeModal() {\n${inner}navigate('/master-data?tab=karyawan', { replace: true });\n${indent}}`;
    },
    p.from + ': closeModal',
  );

  // setelah simpan/hapus: replace, supaya tombol Back tidak balik ke form yang sudah tersimpan
  t = sub(
    t,
    "navigate('/master-data?tab=karyawan');",
    "navigate('/master-data?tab=karyawan', { replace: true });",
    p.from + ': navigate setelah simpan/hapus',
    p.successNav,
  );

  const leftovers = t.match(/useParams|history\.state|navigate\(-1\)|RouteModal|fallbackPath|react-router/g);
  if (leftovers) fail(p.from + ': masih ada sisa react-router/RouteModal: ' + [...new Set(leftovers)].join(', '));

  create(newRel, t);
  del(oldRel);
}

// ───────────────────────── 4. TabKaryawan: ingat state list antar halaman ─────────────────────────
edit('resources/js/components/masterData/TabKaryawan.tsx', (t) => {
  t = sub(
    t,
    /    \/\/ SEMENTARA \(P10\)[^\n]*\n    \/\/ Overlay-nya dikerjakan di P12\.\n/,
    '',
    'TabKaryawan: komentar SEMENTARA',
  );

  t = sub(
    t,
    '// Dipindah dari halaman /karyawan (Karyawan.tsx)',
    `// Create/Detail/Edit sekarang halaman Inertia sendiri, jadi tab ini ke-unmount waktu user
// membukanya. Tanpa ini, waktu balik: pencarian/filter/halaman ke-reset dan list muncul skeleton
// lagi. Disimpan di level modul (hidup selama sesi SPA; hilang saat hard refresh / logout).
const listMemo: { users: User[] | null; search: string; activeTab: TabKey; currentPage: number } = {
    users: null,
    search: '',
    activeTab: 'semua',
    currentPage: 1,
};

// Dipindah dari halaman /karyawan (Karyawan.tsx)`,
    'TabKaryawan: sisip listMemo',
  );

  t = sub(t, 'const [users, setUsers] = useState<User[]>([]);', 'const [users, setUsers] = useState<User[]>(listMemo.users ?? []);', 'TabKaryawan: state users');
  t = sub(t, 'const [loading, setLoading] = useState<boolean>(true);', 'const [loading, setLoading] = useState<boolean>(listMemo.users === null);', 'TabKaryawan: state loading');
  t = sub(t, "const [search, setSearch] = useState<string>('');", 'const [search, setSearch] = useState<string>(listMemo.search);', 'TabKaryawan: state search');
  t = sub(t, "const [activeTab, setActiveTab] = useState<TabKey>('semua');", 'const [activeTab, setActiveTab] = useState<TabKey>(listMemo.activeTab);', 'TabKaryawan: state activeTab');
  t = sub(t, 'const [currentPage, setCurrentPage] = useState<number>(1);', 'const [currentPage, setCurrentPage] = useState<number>(listMemo.currentPage);', 'TabKaryawan: state currentPage');

  // refresh diam-diam kalau sudah ada data lama (tanpa skeleton)
  t = sub(t, '    function loadUsers() {\n        setLoading(true);', '    function loadUsers(silent = false) {\n        if (!silent) setLoading(true);', 'TabKaryawan: loadUsers');
  t = sub(t, /        loadUsers\(\);\n    \}, \[\]\);/, '        loadUsers(listMemo.users !== null);\n    }, []);', 'TabKaryawan: loadUsers di mount');

  // reset ke halaman 1 HANYA kalau search/tab benar-benar berubah (bukan saat mount memulihkan state)
  t = sub(
    t,
    '    useEffect(() => {\n        setCurrentPage(1);\n    }, [search, activeTab]);',
    `    const prevFilter = useRef({ search, activeTab });
    useEffect(() => {
        if (prevFilter.current.search === search && prevFilter.current.activeTab === activeTab) return;
        prevFilter.current = { search, activeTab };
        setCurrentPage(1);
    }, [search, activeTab]);

    // simpan state list buat dipulihkan waktu tab ini di-mount lagi
    useEffect(() => {
        listMemo.search = search;
        listMemo.activeTab = activeTab;
        listMemo.currentPage = currentPage;
    }, [search, activeTab, currentPage]);

    useEffect(() => {
        if (!loading && !errorMsg) listMemo.users = users;
    }, [users, loading, errorMsg]);`,
    'TabKaryawan: efek reset halaman',
  );
  return t;
});

// ───────────────────────── 5. Backend: controller + route ─────────────────────────
create(
  'app/Http/Controllers/MasterData/KaryawanPageController.php',
  String.raw`<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Models\User;
use Inertia\Inertia;

class KaryawanPageController extends Controller
{
    // Halaman web (Inertia) untuk create / detail / edit Karyawan. Admin-only: dijaga middleware
    // role:admin di routes/web.php (web/Inertia -> redirect /dashboard, API/JSON tetap 403).
    // Datanya masih diambil halaman lewat /api/karyawan (axios); pindah jadi props di F11.
    // {user} di-resolve route model binding, jadi id yang tidak ada -> 404.

    // GET /karyawan/create
    public function create()
    {
        return Inertia::render('Karyawan/Create');
    }

    // GET /karyawan/{user}
    public function show(User $user)
    {
        return Inertia::render('Karyawan/Show', ['id' => $user->id]);
    }

    // GET /karyawan/{user}/edit
    public function edit(User $user)
    {
        return Inertia::render('Karyawan/Edit', ['id' => $user->id]);
    }
}
`,
);

edit('routes/web.php', (t) => {
  t = sub(
    t,
    String.raw`use App\Http\Controllers\MasterData\MasterDataPageController;` + '\n',
    String.raw`use App\Http\Controllers\MasterData\KaryawanPageController;` + '\n' +
      String.raw`use App\Http\Controllers\MasterData\MasterDataPageController;` + '\n',
    'web.php: use KaryawanPageController',
  );
  t = sub(
    t,
    "// cuma persis /karyawan; /karyawan/create|:id tetap SPA (P12)",
    '// cuma persis /karyawan; create/detail/edit ada di grup auth di bawah',
    'web.php: komentar redirect /karyawan',
  );
  t = sub(
    t,
    "    Route::get('/master-data', MasterDataPageController::class);\n",
    `    Route::get('/master-data', MasterDataPageController::class);

    // Karyawan: create / detail / edit (admin-only; non-admin web/Inertia -> redirect /dashboard, API/JSON tetap 403).
    // '/create' HARUS di atas '/{user}'. Data form/detail masih lewat /api (axios); ke props di F11.
    Route::middleware('role:admin')->prefix('karyawan')->group(function () {
        Route::get('/create', [KaryawanPageController::class, 'create']);
        Route::get('/{user}', [KaryawanPageController::class, 'show'])->whereNumber('user');
        Route::get('/{user}/edit', [KaryawanPageController::class, 'edit'])->whereNumber('user');
    });
`,
    'web.php: route karyawan',
  );
  return t;
});

// ───────────────────────── 6. inertiaRoutes + layout shell ─────────────────────────
edit('resources/js/lib/inertiaRoutes.ts', (t) =>
  sub(t, "  '/master-data',\n", "  '/master-data',\n  '/karyawan',\n", 'inertiaRoutes: tambah /karyawan'),
);

// Overlay (RouteModal + backgroundLocation) sudah tidak dipakai siapa pun -> buang jalurnya dari shell.
edit('resources/js/components/layout/AppLayoutShell.tsx', (t) => {
  t = sub(t, /  \/\/ true = buka sebagai overlay[\s\S]*?overlay\?: boolean;\n/, '', 'Shell: opsi overlay');
  t = sub(
    t,
    /if \(OVERLAY_PATHS\.includes\(([\w.]+)\)\) \{\s*onNavigate\(\1, \{ overlay: true \}\);\s*\} else \{\s*onNavigate\(\1\);\s*\}/g,
    (_m, v) => `onNavigate(${v});`,
    'Shell: percabangan OVERLAY_PATHS',
    3,
  );
  t = sub(
    t,
    /  \/\/ Route yang sekarang dirender sebagai overlay[\s\S]*?const OVERLAY_PATHS = \['\/karyawan\/create'\];\n\n/,
    '',
    'Shell: deklarasi OVERLAY_PATHS',
  );
  t = sub(t, '(AppLayout.tsx untuk SPA, InertiaAppLayout.tsx untuk Inertia)', '(InertiaAppLayout.tsx)', 'Shell: komentar adapter');
  if (t.includes('OVERLAY_PATHS') || /overlay: true/.test(t)) fail('Shell: masih ada sisa OVERLAY_PATHS/overlay');
  return t;
});

edit('resources/js/components/layout/InertiaAppLayout.tsx', (t) =>
  sub(t, '  // opts.overlay (RouteModal) khusus SPA -- di mode Inertia diabaikan.\n', '', 'InertiaAppLayout: komentar overlay'),
);

// ───────────────────────── 7. SPA lama: tinggal Login & VerifyOtp ─────────────────────────
edit('resources/js/App.tsx', () => `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import Login from './pages/auth/Login';
import VerifyOtp from './pages/auth/VerifyOtp';

// Semua menu sudah halaman Inertia. SPA react-router ini tinggal melayani Login & VerifyOtp
// (dimigrasi di P13, lalu file ini dihapus di P14).
function AppRoutes() {
  return (
    <>
      <Toaster position='top-center' />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
`);

// AppLayout (adapter react-router) & AdminRoute: cuma dipakai App.tsx versi lama -> hapus kalau memang tidak ada importer lain.
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const toDelete = ['resources/js/components/layout/AppLayout.tsx', 'resources/js/components/layout/AdminRoute.tsx'];
for (const rel of toDelete) {
  if (!exists(rel)) continue;
  const base = path.basename(rel, '.tsx');
  const re = new RegExp(`from\\s+['"][^'"]*/${base}['"]`);
  const importers = walk(abs('resources/js'))
    .map((f) => path.relative(root, f).split(path.sep).join('/'))
    .filter((f) => f !== rel && f !== 'resources/js/App.tsx')
    .filter((f) => re.test((planned.get(f) ?? read(f)).text));
  if (importers.length) {
    console.warn(`! ${rel} TIDAK dihapus, masih di-import oleh: ${importers.join(', ')}`);
  } else {
    del(rel);
  }
}

// Pastikan tidak ada yang masih mengimpor halaman Karyawan lama
for (const f of walk(abs('resources/js'))) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  if (rel.startsWith('resources/js/pages/masterData/karyawan/')) continue;
  const txt = (planned.get(rel) ?? read(rel)).text;
  if (/pages\/masterData\/karyawan\/Karyawan(Create|Edit|Detail)/.test(txt)) {
    fail('Masih ada import ke halaman Karyawan lama di: ' + rel);
  }
}

// ───────────────────────── terapkan ─────────────────────────
console.log(DRY ? '\n[DRY RUN] Rencana perubahan (tidak ada yang ditulis):\n' : '\nMenerapkan perubahan:\n');
for (const [rel, f] of planned) console.log(`  ${f.isNew ? '+ baru  ' : '~ ubah  '} ${rel}`);
for (const o of ops) console.log(`  - hapus  ${o.rel}`);

if (DRY) process.exit(0);

for (const [rel, f] of planned) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  const body = f.eol === '\r\n' ? f.text.replace(/\n/g, '\r\n') : f.text;
  fs.writeFileSync(abs(rel), (f.bom ? '\uFEFF' : '') + body, 'utf8');
}
for (const o of ops) fs.rmSync(abs(o.rel), { force: true });
for (const dir of ['resources/js/pages/masterData/karyawan', 'resources/js/pages/masterData']) {
  try {
    if (fs.existsSync(abs(dir)) && fs.readdirSync(abs(dir)).length === 0) fs.rmdirSync(abs(dir));
  } catch {}
}

console.log(`
Selesai. Langkah berikutnya (PowerShell):

  npx tsc --noEmit
  npm run build
  php artisan route:list --path=karyawan
  git status

Tes manual:
  1. Login admin -> Master Data > Data User: klik Tambah User, Detail (ikon mata), Edit. Semua harus
     pindah client-side (tanpa full reload) dan sidebar tidak reset.
  2. Hard refresh (Ctrl+F5) di /karyawan/create, /karyawan/<id>, /karyawan/<id>/edit.
  3. Simpan / Hapus / Set password di Edit -> balik ke Data User; Back browser TIDAK balik ke form.
  4. Di Data User: ketik pencarian, pindah tab Admin/User, ke halaman 2, buka Detail lalu Kembali ->
     pencarian/tab/halaman harus sama dan list tidak muncul skeleton.
  5. Login non-admin lalu buka /karyawan/create langsung -> harus redirect ke /dashboard.
  6. /karyawan/99999 (id tidak ada) -> 404.
  7. Tab Cabang & Perusahaan: Tambah/Edit modal harus kebuka tanpa error (sebelumnya crash di Inertia
     karena RouteModal memakai useNavigate).
  8. Dark mode: cek tampilan kartu di tiga halaman Karyawan.
`);
