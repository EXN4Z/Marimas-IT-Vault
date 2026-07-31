import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, HandCoins, Undo2, Search, AlertTriangle, ClipboardList, Wrench, PlayCircle, Banknote, ChevronLeft, ChevronRight, X, Images } from 'lucide-react';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import Pagination from '../components/shared/Pagination';
import TabAset from '../components/inventaris/TabAset';
import TabKelengkapanAset from '../components/inventaris/TabKelengkapanAset';
import TabPenangananAset from '../components/inventaris/TabPenangananAset';
import TabFotoAset from '../components/inventaris/TabFotoAset';
import { useAuth } from '../context/AuthContext';
import { getRiwayatAset, getAset, type RiwayatAsetEvent, type AsetPenanganan } from '../api/aset';
import api from '../api/axios';

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

type TabKey = 'aset' | 'kelengkapan_aset' | 'penanganan_aset' | 'foto_aset';
type RiwayatFilter = 'semua' | RiwayatAsetEvent['type'];

const RIWAYAT_FILTER_LABEL: Record<RiwayatAsetEvent['type'], string> = {
  pinjam: 'Menerima',
  kembali: 'Mengembalikan',
  lapor_rusak: 'Lapor Kerusakan',
  mulai_perbaikan: 'Mulai Diperbaiki',
  selesai_perbaikan: 'Selesai Diperbaiki',
  dijual: 'Dijual',
};

export default function Inventaris() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabKey>('aset');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Partial<Record<TabKey, number>>>({});

  // Klik notif kerusakan aset ngarahin ke /inventaris?tab=penanganan (lihat
  // AsetKerusakanDilaporkan.php) -- buka langsung tab Penanganan Aset-nya,
  // gak cuma landing di tab default "Aset".
  useEffect(() => {
    if (searchParams.get('tab') === 'penanganan' && isAdmin) {
      setActiveTab('penanganan_aset');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [riwayatAset, setRiwayatAset] = useState<RiwayatAsetEvent[]>([]);
  const [riwayatAsetLoading, setRiwayatAsetLoading] = useState(true);
  const [riwayatFilter, setRiwayatFilter] = useState<RiwayatFilter>('semua');
  const [riwayatSearch, setRiwayatSearch] = useState('');
  const [riwayatPage, setRiwayatPage] = useState(1);
  const [riwayatLastPage, setRiwayatLastPage] = useState(1);
  const [riwayatTotal, setRiwayatTotal] = useState(0);
  const RIWAYAT_PER_PAGE = 10; // minimal 10 data per halaman (dipaksa juga di backend)
  const riwayatSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRiwayatAset = useCallback((targetPage = 1, targetFilter: RiwayatFilter = 'semua', targetSearch = '') => {
    // CATATAN: dulu di sini ada pengecualian khusus role 'cabang' (skip fetch,
    // dianggap bakal 403). Itu KELIRU — route /aset-pemakai/riwayat pakai
    // middleware 'role:karyawan,manajer,hr,admin' yang jalan berdasarkan LEVEL
    // (lihat User::$roleLevels & hasRoleAtLeast di backend), dan level 'cabang'
    // (2) lebih tinggi dari 'karyawan' (1) — jadi cabang tetap lolos middleware,
    // dan controller riwayat() sudah otomatis batasin datanya ke milik akun
    // cabang itu sendiri (lewat user_id). Jadi cabang HARUS bisa lihat riwayat
    // aktivitasnya sendiri juga, sama kayak karyawan.
    setRiwayatAsetLoading(true);
    getRiwayatAset(targetPage, RIWAYAT_PER_PAGE, targetFilter === 'semua' ? undefined : targetFilter, targetSearch || undefined)
      .then((res) => {
        setRiwayatAset(res.data);
        setRiwayatPage(res.current_page);
        setRiwayatLastPage(res.last_page);
        setRiwayatTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setRiwayatAsetLoading(false));
  }, [user?.role]);

  // versi diam-diam buat polling -- gak nyalain loading spinner tiap 5 detik,
  // biar panel gak kedip-kedip pas auto-refresh (sama pola kayak TabPenangananAset).
  // Tetap di halaman, filter, & kata kunci search yang lagi dibuka user, bukan
  // balik ke halaman 1 / kosongin search.
  const refreshRiwayatAsetSilent = useCallback(() => {
    getRiwayatAset(riwayatPage, RIWAYAT_PER_PAGE, riwayatFilter === 'semua' ? undefined : riwayatFilter, riwayatSearch || undefined)
      .then((res) => {
        setRiwayatAset(res.data);
        setRiwayatPage(res.current_page);
        setRiwayatLastPage(res.last_page);
        setRiwayatTotal(res.total);
      })
      .catch(console.error);
  }, [user?.role, riwayatPage, riwayatFilter, riwayatSearch]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'aset') refreshRiwayatAset(riwayatPage, riwayatFilter, riwayatSearch);
  };

  const gantiRiwayatFilter = (filter: RiwayatFilter) => {
    setRiwayatFilter(filter);
    refreshRiwayatAset(1, filter, riwayatSearch);
  };

  const gantiRiwayatHalaman = (target: number) => {
    if (target < 1 || target > riwayatLastPage || target === riwayatPage) return;
    refreshRiwayatAset(target, riwayatFilter, riwayatSearch);
  };

  useEffect(() => {
    // backend /aset-pemakai/riwayat: admin lihat semua, role lain otomatis
    // difilter cuma riwayat aktivitas milik sendiri (lihat AsetPemakaiController::riwayat)
    refreshRiwayatAset(1, 'semua', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // Ketik di search riwayat -> debounce 400ms baru fetch (sama pola kayak
  // search di AuditLog.tsx), reset ke halaman 1 tiap kali kata kuncinya ganti.
  useEffect(() => {
    if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);
    riwayatSearchDebounceRef.current = setTimeout(() => {
      refreshRiwayatAset(1, riwayatFilter, riwayatSearch);
    }, 400);
    return () => {
      if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riwayatSearch]);

  // auto-refresh tiap 5 detik biar riwayat langsung update tanpa perlu F5
  // (sama pola kayak polling di TabPenangananAset).
  useEffect(() => {
    const interval = setInterval(refreshRiwayatAsetSilent, 5000);
    return () => clearInterval(interval);
  }, [refreshRiwayatAsetSilent]);

  // stabil: hindari infinite loop di child (onCount di deps useEffect anak)
  const updateCount = useCallback((key: TabKey, n: number) => {
    setCounts((c) => (c[key] === n ? c : { ...c, [key]: n }));
  }, []);

  const handleCountAset = useCallback((n: number) => updateCount('aset', n), [updateCount]);
  const handleCountPenanganan = useCallback((n: number) => updateCount('penanganan_aset', n), [updateCount]);
  const handleCountFoto = useCallback((n: number) => updateCount('foto_aset', n), [updateCount]);

  // Fetch badge count semua tab di sini (bukan nunggu tab-nya dibuka), biar
  // angka di nav udah kebaca dari awal buka halaman & tetep update walau
  // user ga pernah klik tab itu. Tab yang lagi aktif tetep lapor count
  // sendiri lewat onCount (di atas) begitu ada perubahan data real-time.
  useEffect(() => {
    let cancelled = false;

    const loadCounts = () => {
      getAset()
        .then((list) => {
          if (!cancelled) updateCount('aset', list.length);
        })
        .catch(console.error);

      if (isAdmin) {
        api
          .get<AsetPenanganan[]>('/aset-penanganan')
          .then((res) => {
            if (!cancelled) {
              const belumDitangani = res.data.filter((p) => !p.tanggal_selesai).length;
              updateCount('penanganan_aset', belumDitangani);
            }
          })
          .catch(console.error);
      }
    };

    loadCounts();
    const interval = setInterval(loadCounts, 30000); // refresh tiap 30 detik
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin, updateCount]);

  const tabs: { key: TabKey; label: string; icon: typeof Package; adminOnly?: boolean }[] = [
    { key: 'aset', label: 'Aset', icon: Package },
    { key: 'kelengkapan_aset', label: 'Kelengkapan Aset', icon: ClipboardList },
    { key: 'penanganan_aset', label: 'Penanganan Aset', icon: Wrench, adminOnly: true },
    { key: 'foto_aset', label: 'Foto Aset', icon: Images, adminOnly: true },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <p className="text-sm text-slate-500">Kelola aset IT</p>
      </div>

      <ScrollableTabBar
        className="mb-6"
        activeTab={activeTab}
        onChange={handleTabChange}
        tabs={tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => ({
            key: t.key,
            label: t.label,
            icon: t.icon,
            badge: counts[t.key] ?? null,
            badgeClassName: t.key === 'penanganan_aset' ? 'bg-red-50 text-red-600' : undefined,
          }))}
      />

      {activeTab === 'aset' ? (
        <div className="flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode, atau jenis aset..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none"
            />
          </div>

          <TabAset search={search} onCount={handleCountAset} />

          {/* RIWAYAT ASET — sementara ditaruh di bawah tabel (bukan di samping)
              soalnya tabel aset kolomnya banyak, kalau dipepetin sidebar jadi
              kesempitan/ke-scroll horizontal terus. Admin lihat riwayat SEMUA
              aset; role lain (karyawan/cabang/manajer/hr) cuma lihat riwayat
              aktivitas MEREKA SENDIRI — backend yang filter (lihat
              AsetPemakaiController::riwayat), bukan cuma disembunyiin di UI. */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {isAdmin ? 'Riwayat Aset' : 'Riwayat Aktivitas Saya'}
            </h3>

            <div className="relative mb-3 mt-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={riwayatSearch}
                onChange={(e) => setRiwayatSearch(e.target.value)}
                placeholder="Cari kode aset, merek/tipe, atau nama peminjam..."
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

            {riwayatAsetLoading ? (
              <p className="text-sm text-slate-400 text-center py-6">Memuat riwayat...</p>
            ) : (() => {
              return (
              <ul className="flex flex-col gap-4">
                {riwayatAset
                  .map((ev, idx) => {
                  const style: Record<RiwayatAsetEvent['type'], { bg: string; icon: JSX.Element; label: string }> = {
                    pinjam: { bg: 'bg-amber-50 text-amber-600', icon: <HandCoins size={16} />, label: 'menerima' },
                    kembali: { bg: 'bg-emerald-50 text-emerald-600', icon: <Undo2 size={16} />, label: 'mengembalikan' },
                    lapor_rusak: { bg: 'bg-red-50 text-red-600', icon: <AlertTriangle size={16} />, label: 'melaporkan kerusakan' },
                    mulai_perbaikan: { bg: 'bg-orange-50 text-orange-600', icon: <PlayCircle size={16} />, label: 'mulai memperbaiki' },
                    selesai_perbaikan: { bg: 'bg-sky-50 text-sky-600', icon: <Wrench size={16} />, label: 'selesai memperbaiki' },
                    dijual: { bg: 'bg-purple-50 text-purple-600', icon: <Banknote size={16} />, label: 'menjual' },
                  };
                  const s = style[ev.type];
                  const kode = ev.aset?.kode_aset || '-';
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
                {riwayatAset.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    {riwayatSearch
                      ? `Tidak ada hasil untuk "${riwayatSearch}".`
                      : riwayatFilter !== 'semua'
                      ? `Belum ada riwayat "${RIWAYAT_FILTER_LABEL[riwayatFilter]}".`
                      : isAdmin ? 'Belum ada aktivitas aset.' : 'Belum ada aktivitas aset atas namamu.'}
                  </p>
                )}
              </ul>
              );
            })()}

            {/* Pagination — minimal 10 data riwayat per halaman */}
            {!riwayatAsetLoading && riwayatAset.length > 0 && riwayatLastPage > 1 && (
              <Pagination
                currentPage={riwayatPage}
                totalPages={riwayatLastPage}
                onPageChange={gantiRiwayatHalaman}
                totalItems={riwayatTotal}
                itemLabel="riwayat"
              />
            )}
          </div>
        </div>
      ) : activeTab === 'kelengkapan_aset' ? (
        <TabKelengkapanAset />
      ) : activeTab === 'penanganan_aset' ? (
        <TabPenangananAset onCount={handleCountPenanganan} />
      ) : (
        <TabFotoAset onCount={handleCountFoto} />
      )}
    </>
  );
}