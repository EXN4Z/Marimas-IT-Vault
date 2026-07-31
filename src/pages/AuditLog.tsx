import { useEffect, useRef, useState } from 'react';
<<<<<<< HEAD
import { ScrollText, Trash2, ArrowDownCircle, ArrowUpCircle, RefreshCw, Search, X } from 'lucide-react';
import AppLayout from '../components/shared/AppLayout';
=======
import { ScrollText, Trash2, ArrowDownCircle, ArrowUpCircle, RefreshCw, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
>>>>>>> e3a196c0a764e60d6968de576483ffc5468c8652
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import Pagination from '../components/shared/Pagination';
import { getAuditLog, getAuditLogTrash, type AuditLog } from '../api/auditLog';

type TabKey = 'aktif' | 'trash';

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



export default function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('aktif');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (tab: TabKey, targetPage: number, targetSearch: string) => {
    setLoading(true);
    setError('');
    try {
      const data = tab === 'aktif'
        ? await getAuditLog(targetPage, targetSearch)
        : await getAuditLogTrash(targetPage, targetSearch);

      setLogs(data.data);
      setPage(data.current_page);
      setLastPage(data.last_page);
      setTotal(data.total);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data audit log.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Ganti tab -> reset search & langsung load halaman 1
  useEffect(() => {
    setSearch('');
    loadData(activeTab, 1, '');
  }, [activeTab]);

  // Ketik di search -> debounce 400ms baru fetch, biar gak nembak API tiap huruf
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadData(activeTab, 1, search);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function gantiTab(tab: TabKey) {
    setActiveTab(tab);
  }

  function gantiHalaman(target: number) {
    if (target < 1 || target > lastPage || target === page) return;
    loadData(activeTab, target, search);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <p className="text-sm text-slate-500">
          Riwayat aktivitas pengguna sistem. Log otomatis pindah ke trash setelah 24 jam, dan
          terhapus permanen setelah 7 hari di trash.
        </p>
        <button
          onClick={() => loadData(activeTab, page, search)}
          className="flex items-center gap-2 bg-slate-100 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-200 transition flex-shrink-0"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <ScrollableTabBar
        className="mb-6 mt-4"
        activeTab={activeTab}
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari deskripsi, endpoint, IP, atau nama pengguna..."
          className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Hapus pencarian"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && logs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            {search
              ? `Tidak ada hasil untuk "${search}".`
              : activeTab === 'aktif' ? 'Belum ada aktivitas.' : 'Trash kosong.'}
          </p>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="flex flex-col gap-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                      methodColors[log.method] || 'bg-slate-100 text-slate-600'
                    }`}
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
                  {activeTab === 'aktif' ? (
                    <ArrowDownCircle size={14} className="text-slate-300" />
                  ) : (
                    <ArrowUpCircle size={14} className="text-slate-300" />
                  )}
                  <span className="text-xs text-slate-400">
                    {formatWaktu(activeTab === 'trash' ? log.deleted_at ?? log.created_at : log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && logs.length > 0 && lastPage > 1 && (
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