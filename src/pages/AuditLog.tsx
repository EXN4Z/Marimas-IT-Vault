import { useEffect, useState } from 'react';
import { ScrollText, Trash2, ArrowDownCircle, ArrowUpCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '../components/AppLayout';
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

// Menghasilkan array nomor halaman + elipsis, misal: [1, '...', 4, 5, 6, '...', 20]
function buatRangeHalaman(current: number, last: number): (number | 'ellipsis')[] {
  const delta = 1; // jumlah halaman yang ditampilkan di kiri-kanan halaman aktif
  const range: (number | 'ellipsis')[] = [];

  const start = Math.max(2, current - delta);
  const end = Math.min(last - 1, current + delta);

  range.push(1);

  if (start > 2) range.push('ellipsis');

  for (let i = start; i <= end; i++) {
    range.push(i);
  }

  if (end < last - 1) range.push('ellipsis');

  if (last > 1) range.push(last);

  return range;
}

export default function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('aktif');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadData = async (tab: TabKey, targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const data = tab === 'aktif'
        ? await getAuditLog(targetPage)
        : await getAuditLogTrash(targetPage);

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

  useEffect(() => {
    loadData(activeTab, 1);
  }, [activeTab]);

  function gantiTab(tab: TabKey) {
    setActiveTab(tab);
  }

  function gantiHalaman(target: number) {
    if (target < 1 || target > lastPage || target === page) return;
    loadData(activeTab, target);
  }

  return (
    <AppLayout title="Audit Log">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">
          Riwayat aktivitas pengguna sistem. Log otomatis pindah ke trash setelah 24 jam, dan
          terhapus permanen setelah 7 hari di trash.
        </p>
        <button
          onClick={() => loadData(activeTab, page)}
          className="flex items-center gap-2 bg-slate-100 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-200 transition"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <nav className="mb-6 mt-4">
        <ul className="flex items-center gap-6 border-b border-slate-200">
          <li>
            <button
              onClick={() => gantiTab('aktif')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'aktif'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <ScrollText size={16} />
              Log Aktif
            </button>
          </li>
          <li>
            <button
              onClick={() => gantiTab('trash')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'trash'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Trash2 size={16} />
              Trash
            </button>
          </li>
        </ul>
      </nav>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && logs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            {activeTab === 'aktif' ? 'Belum ada aktivitas.' : 'Trash kosong.'}
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
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Halaman {page} dari {lastPage} · {total} total log
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => gantiHalaman(page - 1)}
                disabled={page <= 1}
                aria-label="Halaman sebelumnya"
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={14} />
              </button>

              {buatRangeHalaman(page, lastPage).map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-300">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => gantiHalaman(item)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-medium rounded-lg border transition ${
                      item === page
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                onClick={() => gantiHalaman(page + 1)}
                disabled={page >= lastPage}
                aria-label="Halaman selanjutnya"
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}