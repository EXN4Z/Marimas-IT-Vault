// P6 — Migrasi menu Audit Log (/audit-log, admin-only) dari SPA ke Inertia.
//
// Jalankan dari ROOT project:
//   node scripts/p6-audit-log.mjs --dry        -> cek doang
//   node scripts/p6-audit-log.mjs              -> tulis + cek (tsc, route:list)
//   node scripts/p6-audit-log.mjs --no-check   -> tulis, skip tsc/route:list
//   node scripts/p6-audit-log.mjs --keep-ping  -> jangan hapus halaman tes /_ping (P5)
//
// Yang dilakukan:
//  Backend
//   + app/Queries/AuditLogQuery.php                   (logika query dipakai bareng API & web)
//   ~ AuditLog/AuditLogController.php                  (API: pakai AuditLogQuery, respons sama)
//   + AuditLog/AuditLogPageController.php              (web: Inertia::render('AuditLog/Index'))
//   ~ Middleware/EnsureUserIsMember.php                (web/Inertia: redirect /dashboard; JSON tetap 403)
//   ~ routes/web.php                                   (GET /audit-log, auth + role:admin)
//  Frontend
//   + inertia/pages/AuditLog/Index.tsx                 (tab/page/search = query string, data = props)
//   ~ lib/inertiaRoutes.ts                             (+ '/audit-log')
//   ~ api/auditLog.ts                                  (export PaginatedAuditLog)
//   ~ App.tsx                                          (hapus import + route audit-log)
//   - pages/auditLog/AuditLog.tsx                      (file lama)
//  Cleanup P5: hapus Test/Ping*.tsx + route /_ping* (kecuali --keep-ping)
//
// Berhenti SEBELUM nulis apa pun kalau ada pola yang gak cocok.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const NO_CHECK = args.has('--no-check');
const KEEP_PING = args.has('--keep-ping');

const R = (...p) => path.resolve(...p);
const F = {
  query: R('app/Queries/AuditLogQuery.php'),
  apiCtrl: R('app/Http/Controllers/AuditLog/AuditLogController.php'),
  pageCtrl: R('app/Http/Controllers/AuditLog/AuditLogPageController.php'),
  mw: R('app/Http/Middleware/EnsureUserIsMember.php'),
  web: R('routes/web.php'),
  page: R('resources/js/inertia/pages/AuditLog/Index.tsx'),
  routesTs: R('resources/js/lib/inertiaRoutes.ts'),
  apiTs: R('resources/js/api/auditLog.ts'),
  appTsx: R('resources/js/App.tsx'),
  oldPage: R('resources/js/pages/auditLog/AuditLog.tsx'),
  ping: R('resources/js/inertia/pages/Test/Ping.tsx'),
  ping2: R('resources/js/inertia/pages/Test/Ping2.tsx'),
};

const fail = (msg) => {
  console.error(`\n✗ ${msg}\n  Tidak ada file yang diubah.`);
  process.exit(1);
};

// ── helper ─────────────────────────────────────────────────────────────────
const readNorm = (p) => {
  if (!fs.existsSync(p)) fail(`Gak nemu ${p}. Jalankan dari root project.`);
  const raw = fs.readFileSync(p, 'utf8');
  return { eol: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
};
function replaceOnce(text, label, oldStr, newStr) {
  const count = text.split(oldStr).length - 1;
  if (count !== 1) fail(`[${label}] ketemu ${count}x, seharusnya 1x. File sumber beda dari yang diasumsikan.`);
  return text.replace(oldStr, () => newStr);
}

// ── precondition ───────────────────────────────────────────────────────────
for (const k of ['query', 'pageCtrl', 'page']) {
  if (fs.existsSync(F[k])) fail(`${path.relative('.', F[k])} sudah ada — P6 kelihatannya sudah dikerjakan.`);
}
if (!fs.existsSync(R('resources/js/inertia-app.tsx')) || !fs.existsSync(R('resources/js/components/layout/InertiaAppLayout.tsx'))) {
  fail('InertiaAppLayout.tsx belum ada — jalankan P5 dulu.');
}

// ── file yang diedit (dihitung dulu semua, ditulis belakangan) ─────────────
const edits = []; // { path, eol, text }

// 1. API controller -> pakai AuditLogQuery
{
  const f = readNorm(F.apiCtrl);
  if (!f.text.includes('private function applySearch')) fail('AuditLogController.php bukan versi asli (applySearch tidak ketemu).');
  if (f.text.includes('AuditLogQuery')) fail('AuditLogController.php sudah memakai AuditLogQuery.');
  const text = String.raw`<?php

namespace App\Http\Controllers\AuditLog;

use App\Http\Controllers\Controller;
use App\Queries\AuditLogQuery;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    // GET /api/audit-log — log aktif (belum di-trash)
    // Logika query ada di App\Queries\AuditLogQuery (dipakai juga oleh AuditLogPageController).
    public function index(Request $request)
    {
        return response()->json(AuditLogQuery::active($request));
    }

    // GET /api/audit-log/trash — log yang sudah di-trash
    public function trash(Request $request)
    {
        return response()->json(AuditLogQuery::trash($request));
    }
}
`;
  edits.push({ path: F.apiCtrl, eol: f.eol, text });
}

// 2. Middleware role
{
  const f = readNorm(F.mw);
  if (f.text.includes('function deny(')) fail('EnsureUserIsMember.php sudah dimodifikasi.');
  let t = f.text;
  t = replaceOnce(t, 'mw use', 'use Illuminate\\Http\\Request;\n', 'use Illuminate\\Http\\Request;\nuse Inertia\\Inertia;\n');
  t = replaceOnce(
    t,
    'mw !user',
    "        if (!$user) {\n            return response()->json(['message' => 'Akses ditolak'], 403);\n        }",
    "        if (!$user) {\n            return $this->deny($request, '/login');\n        }"
  );
  t = replaceOnce(
    t,
    'mw bukan admin',
    "        if (!$adaRoleNonAdmin && !$user->isAdmin()) {\n            return response()->json(['message' => 'Akses ditolak'], 403);\n        }",
    "        if (!$adaRoleNonAdmin && !$user->isAdmin()) {\n            return $this->deny($request, '/dashboard');\n        }"
  );
  t = replaceOnce(
    t,
    'mw tail',
    '        return $next($request);\n    }\n}',
    `        return $next($request);
    }

    /**
     * Respons penolakan.
     *  - API / JSON  : tetap 403 JSON (SPA lama & axios bergantung pada ini).
     *  - Inertia XHR : Inertia::location() -> full visit ke $redirectTo. Redirect biasa (302) ke
     *                  halaman non-Inertia (SPA) bakal ditampilkan Inertia sebagai modal error.
     *  - Request web : redirect biasa.
     */
    private function deny(Request $request, string $redirectTo): Response
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        if ($request->header('X-Inertia')) {
            return Inertia::location($redirectTo);
        }

        return redirect($redirectTo);
    }
}`
  );
  edits.push({ path: F.mw, eol: f.eol, text: t });
}

// 3. routes/web.php
{
  const f = readNorm(F.web);
  if (f.text.includes("'/audit-log'") && f.text.includes('AuditLogPageController')) fail('web.php sudah punya route audit-log.');
  let t = f.text;
  if (!KEEP_PING) {
    t = t.replace(/^[ \t]*\/\/ TES SEMENTARA \(P1\)[^\n]*\n/m, '');
    t = t.replace(/^[ \t]*Route::get\('\/_ping2?',[^\n]*\n/gm, '');
  }
  t = replaceOnce(t, 'web use', 'use Inertia\\Inertia;\n', 'use App\\Http\\Controllers\\AuditLog\\AuditLogPageController;\nuse Inertia\\Inertia;\n');
  t = replaceOnce(
    t,
    'web group',
    "Route::middleware('auth')->group(function () {\n",
    "Route::middleware('auth')->group(function () {\n" +
      "    // Audit Log (admin-only)\n" +
      "    Route::get('/audit-log', AuditLogPageController::class)->middleware('role:admin');\n"
  );
  edits.push({ path: F.web, eol: f.eol, text: t });
}

// 4. inertiaRoutes.ts
{
  const f = readNorm(F.routesTs);
  if (f.text.includes("'/audit-log'") && !f.text.includes("// contoh nanti: '/audit-log'")) fail("'/audit-log' sudah ada di inertiaRoutes.ts.");
  const t = replaceOnce(
    f.text,
    'inertiaRoutes',
    "  // contoh nanti: '/audit-log', '/settings'\n",
    "  '/audit-log',\n  // contoh nanti: '/settings'\n"
  );
  edits.push({ path: F.routesTs, eol: f.eol, text: t });
}

// 5. api/auditLog.ts -> export PaginatedAuditLog
{
  const f = readNorm(F.apiTs);
  const t = replaceOnce(f.text, 'api type', '\ninterface PaginatedAuditLog {', '\nexport interface PaginatedAuditLog {');
  edits.push({ path: F.apiTs, eol: f.eol, text: t });
}

// 6. App.tsx -> buang import + route
{
  const f = readNorm(F.appTsx);
  let t = f.text;
  t = replaceOnce(t, 'App import', "import AuditLog from './pages/auditLog/AuditLog';\n", '');
  t = replaceOnce(t, 'App route', '          <Route path="/audit-log" element={<AuditLog />} />\n', '');
  edits.push({ path: F.appTsx, eol: f.eol, text: t });
}

// ── file baru ──────────────────────────────────────────────────────────────
const newFiles = [];

newFiles.push({
  path: F.query,
  text: String.raw`<?php

namespace App\Queries;

use App\Models\AuditLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Logika query Audit Log, dipakai bareng oleh:
 *  - API  : App\Http\Controllers\AuditLog\AuditLogController
 *  - Web  : App\Http\Controllers\AuditLog\AuditLogPageController (Inertia)
 * Bentuk hasil (paginator) sama persis dengan respons /api/audit-log yang lama.
 */
class AuditLogQuery
{
    // log aktif (belum di-trash)
    public static function active(Request $request): LengthAwarePaginator
    {
        $query = AuditLog::with('user:id,name')->latest();

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('method')) {
            $query->where('method', $request->method);
        }

        if ($request->filled('search')) {
            self::applySearch($query, $request->search);
        }

        return $query->paginate($request->get('per_page', 20));
    }

    // log yang sudah di-trash
    public static function trash(Request $request): LengthAwarePaginator
    {
        $query = AuditLog::onlyTrashed()
            ->with('user:id,name')
            ->latest('deleted_at');

        if ($request->filled('search')) {
            self::applySearch($query, $request->search);
        }

        return $query->paginate($request->get('per_page', 20));
    }

    // Cari di deskripsi, endpoint, ip_address, dan nama user terkait.
    private static function applySearch(Builder $query, string $search): void
    {
        $query->where(function (Builder $q) use ($search) {
            $q->where('deskripsi', 'like', "%{$search}%")
                ->orWhere('endpoint', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "%{$search}%")
                ->orWhereHas('user', function (Builder $userQuery) use ($search) {
                    $userQuery->where('name', 'like', "%{$search}%");
                });
        });
    }
}
`,
});

newFiles.push({
  path: F.pageCtrl,
  text: String.raw`<?php

namespace App\Http\Controllers\AuditLog;

use App\Http\Controllers\Controller;
use App\Queries\AuditLogQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogPageController extends Controller
{
    // GET /audit-log?tab=aktif|trash&page=&search=   (middleware: auth + role:admin, lihat routes/web.php)
    public function __invoke(Request $request)
    {
        $tab = $request->query('tab') === 'trash' ? 'trash' : 'aktif';

        $logs = $tab === 'trash'
            ? AuditLogQuery::trash($request)
            : AuditLogQuery::active($request);

        return Inertia::render('AuditLog/Index', [
            'tab' => $tab,
            'filters' => ['search' => (string) $request->query('search', '')],
            'logs' => $logs, // bentuk paginator sama dengan JSON /api/audit-log
        ]);
    }
}
`,
});

newFiles.push({
  path: F.page,
  text: String.raw`import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { ScrollText, Trash2, ArrowDownCircle, ArrowUpCircle, RefreshCw, Search, X } from 'lucide-react';
import ScrollableTabBar from '../../../components/shared/ScrollableTabBar';
import Pagination from '../../../components/shared/Pagination';
import { Skeleton } from '../../../components/shared/skeleton';
import type { PaginatedAuditLog } from '../../../api/auditLog';

type TabKey = 'aktif' | 'trash';

interface Props {
  tab: TabKey;
  filters: { search: string };
  logs: PaginatedAuditLog;
}

type VisitOptions = NonNullable<Parameters<typeof router.get>[2]>;

const methodColors: Record<string, string> = {
  GET: 'bg-slate-100 text-slate-600',
  POST: 'bg-emerald-50 text-emerald-600',
  PUT: 'bg-amber-50 text-amber-600',
  PATCH: 'bg-amber-50 text-amber-600',
  DELETE: 'bg-red-50 text-red-600',
};

function formatWaktu(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Tab, halaman, dan search hidup di query string (?tab=&page=&search=); data datang lewat props
// dari AuditLogPageController, bukan axios.
export default function AuditLogIndex({ tab, filters, logs: paginator }: Props) {
  const [search, setSearch] = useState(filters.search);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logs = paginator.data;
  const page = paginator.current_page;
  const lastPage = paginator.last_page;
  const total = paginator.total;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadingHandlers = {
    onStart: () => setLoading(true),
    onFinish: () => setLoading(false),
  };

  function visit(params: { tab: TabKey; search?: string; page?: number }, opts: VisitOptions = {}) {
    const data: Record<string, string | number> = {};
    if (params.tab === 'trash') data.tab = 'trash';
    if (params.search) data.search = params.search;
    if (params.page && params.page > 1) data.page = params.page;
    router.get('/audit-log', data, { preserveState: true, replace: true, ...loadingHandlers, ...opts });
  }

  // Ganti tab -> reset search & halaman 1
  function gantiTab(next: TabKey) {
    if (next === tab) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearch('');
    visit({ tab: next });
  }

  // Ketik di search -> debounce 400ms baru visit, biar gak nembak server tiap huruf
  function gantiSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => visit({ tab, search: value }), 400);
  }

  function gantiHalaman(target: number) {
    if (target < 1 || target > lastPage || target === page) return;
    visit({ tab, search: filters.search, page: target }, { replace: false, preserveScroll: true });
  }

  function refresh() {
    router.reload({ only: ['logs'], ...loadingHandlers });
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <p className="text-sm text-slate-500">
          Riwayat aktivitas pengguna sistem. Log otomatis pindah ke trash setelah 24 jam, dan
          terhapus permanen setelah 7 hari di trash.
        </p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 bg-slate-100 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-200 transition flex-shrink-0"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <ScrollableTabBar
        className="mb-6 mt-4"
        activeTab={tab}
        onChange={gantiTab}
        tabs={[
          { key: 'aktif', label: 'Log Aktif', icon: ScrollText },
          { key: 'trash', label: 'Trash', icon: Trash2 },
        ]}
      />

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => gantiSearch(e.target.value)}
          placeholder="Cari deskripsi, endpoint, IP, atau nama pengguna..."
          className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {search && (
          <button
            onClick={() => gantiSearch('')}
            aria-label="Hapus pencarian"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Total {tab === 'aktif' ? 'Log Aktif' : 'Trash'}: <span className="font-semibold text-slate-900">{total}</span> log
      </p>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        {loading && (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Skeleton className="h-5 w-14 rounded-full shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                </div>
                <Skeleton className="h-3 w-16 rounded shrink-0 ml-3" />
              </div>
            ))}
          </div>
        )}

        {!loading && logs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            {filters.search
              ? <>Tidak ada hasil untuk "{filters.search}".</>
              : tab === 'aktif' ? 'Belum ada aktivitas.' : 'Trash kosong.'}
          </p>
        )}

        {!loading && logs.length > 0 && (
          <div className="flex flex-col gap-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={
                      'text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ' +
                      (methodColors[log.method] || 'bg-slate-100 text-slate-600')
                    }
                  >
                    {log.method}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{log.deskripsi}</p>
                    <p className="text-xs text-slate-400">
                      {log.user?.name ?? 'Guest'} · /{log.endpoint} · {log.ip_address ?? '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {tab === 'aktif' ? (
                    <ArrowDownCircle size={14} className="text-slate-300" />
                  ) : (
                    <ArrowUpCircle size={14} className="text-slate-300" />
                  )}
                  <span className="text-xs text-slate-400">
                    {formatWaktu(tab === 'trash' ? log.deleted_at ?? log.created_at : log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && logs.length > 0 && lastPage > 1 && (
          <Pagination
            currentPage={page}
            totalPages={lastPage}
            onPageChange={gantiHalaman}
            totalItems={total}
            itemLabel="log"
          />
        )}
      </div>
    </>
  );
}
`,
});

// ── ringkasan ──────────────────────────────────────────────────────────────
const rel = (p) => path.relative('.', p).replace(/\\/g, '/');
console.log('Rencana:');
for (const n of newFiles) console.log(`  + ${rel(n.path)}`);
for (const e of edits) console.log(`  ~ ${rel(e.path)}`);
if (fs.existsSync(F.oldPage)) console.log(`  - ${rel(F.oldPage)}`);
if (!KEEP_PING) for (const p of [F.ping, F.ping2]) if (fs.existsSync(p)) console.log(`  - ${rel(p)} (cleanup P5)`);

if (DRY) {
  console.log('\n(--dry) tidak ada file yang ditulis.');
  process.exit(0);
}

// ── tulis ──────────────────────────────────────────────────────────────────
for (const n of newFiles) {
  fs.mkdirSync(path.dirname(n.path), { recursive: true });
  fs.writeFileSync(n.path, n.text, 'utf8');
}
for (const e of edits) fs.writeFileSync(e.path, e.text.replace(/\n/g, e.eol), 'utf8');

if (fs.existsSync(F.oldPage)) {
  fs.rmSync(F.oldPage);
  const d = path.dirname(F.oldPage);
  if (fs.readdirSync(d).length === 0) fs.rmdirSync(d);
}
if (!KEEP_PING) {
  for (const p of [F.ping, F.ping2]) if (fs.existsSync(p)) fs.rmSync(p);
  const d = path.dirname(F.ping);
  if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
}
console.log('\n✓ File ditulis.');

if (NO_CHECK) process.exit(0);

const run = (cmd) => {
  console.log(`\n→ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
};

let ok = true;
if (fs.existsSync('tsconfig.json')) ok = run('npx tsc --noEmit') && ok;
else console.log('\n! tsconfig.json tidak ada, tsc dilewati.');
ok = run('php artisan route:list --path=audit-log') && ok;

console.log(
  ok
    ? '\n✓ Cek lolos. Lanjut: npm run build, tes manual (lihat bawah), lalu commit.'
    : '\n✗ Ada cek yang gagal. Rollback: git checkout . ; git clean -fd app/Queries resources/js/inertia/pages/AuditLog app/Http/Controllers/AuditLog/AuditLogPageController.php'
);
console.log(`
Tes manual:
  1. Login admin -> hard refresh di /audit-log (data harus muncul, tab Log Aktif).
  2. Tab Trash, search (debounce), pagination -> URL berubah (?tab=&search=&page=), tanpa full reload.
  3. Klik Audit Log dari sidebar halaman SPA (mis. /dashboard) -> full load; dari sini ke Dashboard -> full load.
  4. Login non-admin -> buka /audit-log langsung -> redirect ke /dashboard.
  5. GET /api/audit-log tanpa admin -> tetap JSON 403 (cek di tab Network / curl).
`);
process.exit(ok ? 0 : 1);
