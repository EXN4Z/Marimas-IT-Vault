import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Activity, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from '../../../components/shared/Select';
import type { AktivitasInventoryTerbaru } from '../useDashboardData';
import { cardClass, BADGE_TONE } from './theme';
import { CardIcon } from './primitives';
import { AKTIVITAS_ASET_STYLE, AKTIVITAS_STATUS_LABEL } from './aktivitas';

// ==== Riwayat Aktivitas Table (DEGO "Information by stores" pattern) ====
// Reuses the same aktivitas data already fetched for the calendar widget —
// no new API call, just a denser table presentation with sort/search/pagination.
type SortDir = 'terbaru' | 'terlama';

const TABLE_PAGE_SIZE = 8;

export function RiwayatAktivitasTableCard({
  aktivitas = [],
  className = '',
}: {
  aktivitas?: AktivitasInventoryTerbaru[];
  className?: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('terbaru');
  const [page, setPage] = useState(1);

  const safeAktivitas = Array.isArray(aktivitas) ? aktivitas : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = safeAktivitas;
    if (q) {
      list = list.filter((ev) => {
        const kode = ev.inventory?.kode_inventory?.toLowerCase() ?? '';
        const nama = ev.inventory?.nama?.toLowerCase() ?? '';
        const pelaku = ev.nama?.toLowerCase() ?? '';
        return kode.includes(q) || nama.includes(q) || pelaku.includes(q);
      });
    }
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.waktu).getTime();
      const tb = new Date(b.waktu).getTime();
      return sortDir === 'terbaru' ? tb - ta : ta - tb;
    });
    return sorted;
  }, [safeAktivitas, search, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const startIdx = (clampedPage - 1) * TABLE_PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + TABLE_PAGE_SIZE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleSort = (v: SortDir) => {
    setSortDir(v);
    setPage(1);
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Activity} tone="emerald" />
          <div>
            <h3 className="text-sm font-bold text-[#171633] leading-tight">Riwayat Aktivitas Inventory</h3>
            <p className="text-xs text-[#A9A9C6] mt-0.5">Log mutasi & transaksi ({aktivitas.length})</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A9A9C6]" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari kode / nama..."
              className="text-xs bg-[#F7F8FC] rounded-lg pl-7 pr-3 py-2 w-40 sm:w-48 focus:outline-none focus:ring-2 focus:ring-[#EFEAFF] placeholder:text-[#A9A9C6]"
            />
          </div>
          <div className="w-28">
            <Select
              size="compact"
              value={sortDir}
              onChange={(v) => handleSort(v as SortDir)}
              options={[
                { value: 'terbaru', label: 'Terbaru' },
                { value: 'terlama', label: 'Terlama' },
              ]}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[#A9A9C6] py-10 text-center">Tidak ada aktivitas yang cocok.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] uppercase font-bold text-[#A9A9C6] tracking-wider">
                <th className="px-3 py-2">Kode Inventory</th>
                <th className="px-3 py-2">Barang</th>
                <th className="px-3 py-2">Pelaku</th>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((ev, idx) => {
                const s = AKTIVITAS_ASET_STYLE[ev.type] || { tone: 'slate' as const };
                const badgeClass = BADGE_TONE[s.tone] ?? BADGE_TONE.slate;
                const kode = ev.inventory?.kode_inventory || '-';
                const nama = ev.inventory?.nama || '-';
                const pelaku = ev.nama ?? '-';
                return (
                  <tr
                    key={`${ev.type}-${startIdx + idx}`}
                    onClick={() => navigate('/laporan?tab=riwayat_inventory')}
                    className="cursor-pointer hover:bg-[#F7F8FC] transition-colors border-t border-[#F0F1F7]"
                  >
                    <td className="px-3 py-2.5 font-bold text-[#5A32FA] whitespace-nowrap">{kode}</td>
                    <td className="px-3 py-2.5 text-[#171633] font-medium truncate max-w-[160px]" title={nama}>{nama}</td>
                    <td className="px-3 py-2.5 text-[#666687]">{pelaku}</td>
                    <td className="px-3 py-2.5 text-[#A9A9C6] whitespace-nowrap">
                      {new Date(ev.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap ${badgeClass}`}>
                        {AKTIVITAS_STATUS_LABEL[ev.type] ?? 'Update'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-3 mt-2 border-t border-[#F0F1F7] flex items-center justify-between text-[11px] text-[#A9A9C6]">
        <span>
          Menampilkan {filtered.length === 0 ? 0 : startIdx + 1}-{Math.min(startIdx + TABLE_PAGE_SIZE, filtered.length)} dari {filtered.length}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage <= 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666687] bg-[#F7F8FC] hover:bg-[#F0F1F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="font-semibold text-[#171633] px-1">{clampedPage} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage >= totalPages}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666687] bg-[#F7F8FC] hover:bg-[#F0F1F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
