import { useEffect, useRef, useState, type JSX } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Search, HandCoins, Undo2, AlertTriangle, PlayCircle, Wrench, Banknote, X } from 'lucide-react';
import Pagination from '../../../components/table/Pagination';
import { useAuth } from '../../../context/AuthContext';
import { Skeleton } from '../../../components/skeleton';
import type { RiwayatInventoryEvent } from '../../inventory/types/inventoryPemakai';
import type { LaporanRiwayatProps } from '../types';

function formatWaktu(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

type RiwayatFilter = 'semua' | RiwayatInventoryEvent['type'];

const RIWAYAT_FILTER_LABEL: Record<RiwayatInventoryEvent['type'], string> = {
  pinjam: 'Menerima',
  kembali: 'Mengembalikan',
  lapor_rusak: 'Lapor Kerusakan',
  mulai_perbaikan: 'Mulai Diperbaiki',
  selesai_perbaikan: 'Selesai Diperbaiki',
  dijual: 'Dijual',
};

// dipisah jadi halaman/tab sendiri (dulu nempel di bawah tabel tab "Inventory") biar
// sejajar sama child-class lain di Inventaris (Inventory, Penanganan Inventory, Foto Inventory,
// Kelengkapan Inventory) -- pola yang sama kayak tab di MasterData.tsx.
export default function RiwayatInventoryTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // [F7-INERTIA] Data dari props `riwayat` (LaporanPageController -> RiwayatInventoryQuery), dipaginasi & difilter server.
  // Filter jenis, pencarian, dan halaman hidup di query string (?tab=riwayat_inventory&type=&search=&page=); ganti -> router.get.
  // Auto-refresh 5 detik = partial reload async (tanpa spinner), tetap di halaman/filter/kata kunci yang dibuka.
  const riwayat = (usePage().props as unknown as { riwayat?: LaporanRiwayatProps | null }).riwayat ?? null;
  const riwayatInventory: RiwayatInventoryEvent[] = riwayat?.data ?? [];
  const riwayatFilter: RiwayatFilter = riwayat?.filters.type ?? 'semua';
  const riwayatPage = riwayat?.current_page ?? 1;
  const riwayatLastPage = riwayat?.last_page ?? 1;
  const riwayatTotal = riwayat?.total ?? 0;

  const [riwayatSearch, setRiwayatSearchState] = useState(riwayat?.filters.search ?? '');
  const [riwayatInventoryLoading, setRiwayatInventoryLoading] = useState(false);
  const riwayatSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kunjungi = (params: { type: RiwayatFilter; search: string; page?: number }, replace = true) => {
    const data: Record<string, string | number> = { tab: 'riwayat_inventory' };
    if (params.type !== 'semua') data.type = params.type;
    if (params.search) data.search = params.search;
    if (params.page && params.page > 1) data.page = params.page;
    router.get('/laporan', data, {
      preserveState: true,
      preserveScroll: true,
      replace,
      onStart: () => setRiwayatInventoryLoading(true),
      onFinish: () => setRiwayatInventoryLoading(false),
    });
  };

  const gantiRiwayatFilter = (filter: RiwayatFilter) => {
    if (filter === riwayatFilter) return;
    if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);
    kunjungi({ type: filter, search: riwayatSearch });
  };

  const gantiRiwayatHalaman = (target: number) => {
    if (target < 1 || target > riwayatLastPage || target === riwayatPage) return;
    kunjungi({ type: riwayatFilter, search: riwayat?.filters.search ?? '', page: target }, false);
  };

  // Ketik di search -> debounce 400ms baru visit (reset ke halaman 1), biar gak nembak server tiap huruf.
  const setRiwayatSearch = (value: string) => {
    setRiwayatSearchState(value);
    if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);
    riwayatSearchDebounceRef.current = setTimeout(() => kunjungi({ type: riwayatFilter, search: value }), 400);
  };

  useEffect(() => {
    return () => {
      if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);
    };
  }, []);

  // auto-refresh tiap 5 detik biar riwayat langsung update tanpa perlu F5 (diam kalau tab browser disembunyikan)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      router.reload({ only: ['riwayat'], async: true, showProgress: false });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        {isAdmin ? 'Riwayat Inventory' : 'Riwayat Aktivitas Saya'}
      </h3>

      <div className="relative mb-3 mt-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={riwayatSearch}
          onChange={(e) => setRiwayatSearch(e.target.value)}
          placeholder="Cari kode inventory, merek/tipe, atau nama peminjam..."
          className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {riwayatSearch && (
          <button
            onClick={() => setRiwayatSearch('')}
            aria-label="Hapus pencarian"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <ul className="flex items-center gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {([
          { key: 'semua', label: 'Semua' },
          { key: 'pinjam', label: RIWAYAT_FILTER_LABEL.pinjam },
          { key: 'kembali', label: RIWAYAT_FILTER_LABEL.kembali },
          { key: 'lapor_rusak', label: RIWAYAT_FILTER_LABEL.lapor_rusak },
          { key: 'mulai_perbaikan', label: RIWAYAT_FILTER_LABEL.mulai_perbaikan },
          { key: 'selesai_perbaikan', label: RIWAYAT_FILTER_LABEL.selesai_perbaikan },
          ...(isAdmin ? [{ key: 'dijual' as const, label: RIWAYAT_FILTER_LABEL.dijual }] : []),
        ] as { key: RiwayatFilter; label: string }[]).map((t) => (
          <li key={t.key} className="flex-shrink-0">
            <button
              onClick={() => gantiRiwayatFilter(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
                riwayatFilter === t.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500 mb-4">
        Total {riwayatFilter === 'semua' ? 'Semua' : (RIWAYAT_FILTER_LABEL[riwayatFilter] ?? 'Riwayat')}: <span className="font-semibold text-slate-900">{riwayatTotal}</span> riwayat
      </p>

      {riwayatInventoryLoading ? (
        <ul className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/4 rounded" />
              </div>
            </li>
          ))}
        </ul>
      ) : (() => {
        return (
        <ul className="flex flex-col gap-4">
          {riwayatInventory
            .map((ev, idx) => {
            const style: Record<RiwayatInventoryEvent['type'], { bg: string; icon: JSX.Element; label: string }> = {
              pinjam: { bg: 'bg-amber-50 text-amber-600', icon: <HandCoins size={16} />, label: 'menerima' },
              kembali: { bg: 'bg-emerald-50 text-emerald-600', icon: <Undo2 size={16} />, label: 'mengembalikan' },
              lapor_rusak: { bg: 'bg-red-50 text-red-600', icon: <AlertTriangle size={16} />, label: 'melaporkan kerusakan' },
              mulai_perbaikan: { bg: 'bg-orange-50 text-orange-600', icon: <PlayCircle size={16} />, label: 'mulai memperbaiki' },
              selesai_perbaikan: { bg: 'bg-sky-50 text-sky-600', icon: <Wrench size={16} />, label: 'selesai memperbaiki' },
              dijual: { bg: 'bg-purple-50 text-purple-600', icon: <Banknote size={16} />, label: 'menjual' },
            };
            const s = style[ev.type];
            const kode = ev.inventory?.kode_inventory || '-';
            return (
              <li key={`${ev.type}-${idx}`} className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    {ev.nama ? (
                      <span className="font-medium">{ev.nama} </span>
                    ) : (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan') ? (
                      <span className="font-medium">Admin </span>
                    ) : ''}
                    {s.label} <span className="font-medium">{kode}</span>
                  </p>
                  <p className="text-xs text-slate-400">{formatWaktu(ev.waktu)}</p>
                </div>
              </li>
            );
          })}
          {riwayatInventory.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              {riwayatSearch
                ? `Tidak ada hasil untuk "${riwayatSearch}".`
                : riwayatFilter !== 'semua'
                ? `Belum ada riwayat "${RIWAYAT_FILTER_LABEL[riwayatFilter]}".`
                : isAdmin ? 'Belum ada aktivitas inventory.' : 'Belum ada aktivitas inventory atas namamu.'}
            </p>
          )}
        </ul>
        );
      })()}

      {/* Pagination — minimal 10 data riwayat per halaman */}
      {!riwayatInventoryLoading && riwayatInventory.length > 0 && riwayatLastPage > 1 && (
        <Pagination
          currentPage={riwayatPage}
          totalPages={riwayatLastPage}
          onPageChange={gantiRiwayatHalaman}
          totalItems={riwayatTotal}
          itemLabel="riwayat"
        />
      )}
    </div>
  );
}