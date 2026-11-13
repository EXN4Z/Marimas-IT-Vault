import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { ScrollText, Trash2, ArrowDownCircle, ArrowUpCircle, RefreshCw, Search, X, RotateCcw } from 'lucide-react';
import ScrollableTabBar from '../../components/navigation/ScrollableTabBar';
import Pagination from '../../components/table/Pagination';
import { Skeleton } from '../../components/skeleton';
import type { AuditLog, PaginatedAuditLog } from '../../features/audit-log/types';
import { pnCard, pnEmpty } from '../../components/ui/pn';

type TabKey = 'aktif' | 'trash';

interface Props {
  tab: TabKey;
  filters: { search: string };
  logs: PaginatedAuditLog;
}

type VisitOptions = NonNullable<Parameters<typeof router.get>[2]>;

const methodColors: Record<string, string> = {
  GET: 'bg-surface-100 text-ink-600',
  POST: 'bg-tint-emerald-50 text-emerald-600',
  PUT: 'bg-tint-amber-50 text-tone-amber-600',
  PATCH: 'bg-tint-amber-50 text-tone-amber-600',
  DELETE: 'bg-tint-red-50 text-tone-red-600',
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
  const [memulihkanId, setMemulihkanId] = useState<number | null>(null);
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

  // Pulihkan data yang dihapus (soft delete). Sukses -> toast dari flash server (FlashToaster);
  // gagal -> error bag "pulihkan" (mis. data induknya masih terhapus) -> toast error.
  function pulihkan(log: AuditLog) {
    setMemulihkanId(log.id);
    router.post('/audit-log/' + log.id + '/pulihkan', {}, {
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(String(errors.pulihkan || 'Gagal memulihkan data.')),
      onFinish: () => setMemulihkanId(null),
    });
  }

  function refresh() {
    router.reload({ only: ['logs'], ...loadingHandlers });
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <p className="text-sm text-ink-500">
          Riwayat aktivitas pengguna sistem. Log otomatis pindah ke trash setelah 24 jam, dan
          terhapus permanen setelah 7 hari di trash. Log penghapusan data yang masih bisa dipulihkan
          disimpan lebih lama (180 hari).
        </p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 bg-surface-100 text-ink-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-hover-200 transition flex-shrink-0"
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
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => gantiSearch(e.target.value)}
          placeholder="Cari deskripsi, endpoint, IP, atau nama pengguna..."
          className="w-full text-sm border border-line-200 rounded-lg pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {search && (
          <button
            onClick={() => gantiSearch('')}
            aria-label="Hapus pencarian"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <p className="text-xs text-ink-500 mb-4">
        Total {tab === 'aktif' ? 'Log Aktif' : 'Trash'}: <span className="font-semibold text-ink-900">{total}</span> log
      </p>

      <div className={pnCard}>
        {loading && (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-line-100 last:border-0">
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
          <p className={pnEmpty}>
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
                className="flex items-center justify-between py-2.5 border-b border-line-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={
                      'text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ' +
                      (methodColors[log.method] || 'bg-surface-100 text-ink-600 dark:border dark:border-[#38383e]')
                    }
                  >
                    {log.method}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800 truncate">{log.deskripsi}</p>
                    <p className="text-xs text-ink-400">
                      {log.user?.name ?? 'Guest'} · /{log.endpoint} · {log.ip_address ?? '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {log.subject_type && log.subject_id && (
                    log.dipulihkan_at ? (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-tint-emerald-50 text-emerald-600">
                        Dipulihkan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pulihkan(log)}
                        disabled={memulihkanId === log.id}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-surface-100 text-ink-600 hover:bg-hover-200 transition disabled:opacity-50"
                      >
                        <RotateCcw size={12} />
                        Pulihkan
                      </button>
                    )
                  )}
                  {tab === 'aktif' ? (
                    <ArrowDownCircle size={14} className="text-ink-300" />
                  ) : (
                    <ArrowUpCircle size={14} className="text-ink-300" />
                  )}
                  <span className="text-xs text-ink-400">
                    {formatWaktu(tab === 'trash' ? log.deleted_at ?? log.created_at : log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && logs.length > 0 && lastPage > 1 && (
          <div className="-mx-[18px] -mb-3 mt-1 px-6 py-3 border-t border-line-100">
            <Pagination
              currentPage={page}
              totalPages={lastPage}
              onPageChange={gantiHalaman}
              totalItems={total}
              itemLabel="log"
              className="pt-0 mt-0 border-t-0"
            />
          </div>
        )}
      </div>
    </>
  );
}
