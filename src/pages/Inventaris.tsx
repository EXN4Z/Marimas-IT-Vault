import { useCallback, useEffect, useState, type JSX } from 'react';
import { Package, HandCoins, Undo2, Search, AlertTriangle, ClipboardList, Wrench, PlayCircle, Banknote } from 'lucide-react';
import AppLayout from '../components/shared/AppLayout';
import TabAset from '../components/inventaris/TabAset';
import TabKelengkapanAset from '../components/inventaris/TabKelengkapanAset';
import TabPenangananAset from '../components/inventaris/TabPenangananAset';
import TabPersetujuanAset from '../components/inventaris/TabPersetujuanAset';
import { useAuth } from '../context/AuthContext';
import { getRiwayatAset, getAset, getPendingAsetPemakai, type RiwayatAsetEvent, type AsetPenanganan } from '../api/aset';
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

type TabKey = 'aset' | 'kelengkapan_aset' | 'penanganan_aset' | 'persetujuan_aset';

export default function Inventaris() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabKey>('aset');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Partial<Record<TabKey, number>>>({});

  const refreshRiwayatAset = useCallback(() => {
    // 'cabang' gak termasuk role yang diizinin backend buat /aset-pemakai/riwayat
    // (lihat routes/api.php) — skip biar gak nembak API yang bakal 403 percuma.
    if (user?.role === 'cabang') {
      setRiwayatAsetLoading(false);
      return;
    }
    setRiwayatAsetLoading(true);
    getRiwayatAset(10)
      .then(setRiwayatAset)
      .catch(console.error)
      .finally(() => setRiwayatAsetLoading(false));
  }, [user?.role]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'aset') refreshRiwayatAset();
  };

  const [riwayatAset, setRiwayatAset] = useState<RiwayatAsetEvent[]>([]);
  const [riwayatAsetLoading, setRiwayatAsetLoading] = useState(true);

  useEffect(() => {
    // backend /aset-pemakai/riwayat: admin lihat semua, role lain otomatis
    // difilter cuma riwayat aktivitas milik sendiri (lihat AsetPemakaiController::riwayat)
    refreshRiwayatAset();
  }, [refreshRiwayatAset]);

  // stabil: hindari infinite loop di child (onCount di deps useEffect anak)
  const updateCount = useCallback((key: TabKey, n: number) => {
    setCounts((c) => (c[key] === n ? c : { ...c, [key]: n }));
  }, []);

  const handleCountAset = useCallback((n: number) => updateCount('aset', n), [updateCount]);
  const handleCountPenanganan = useCallback((n: number) => updateCount('penanganan_aset', n), [updateCount]);
  const handleCountPersetujuan = useCallback((n: number) => updateCount('persetujuan_aset', n), [updateCount]);

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
        getPendingAsetPemakai()
          .then((list) => {
            if (!cancelled) updateCount('persetujuan_aset', list.length);
          })
          .catch(console.error);

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
    { key: 'persetujuan_aset', label: 'Persetujuan Aset', icon: HandCoins, adminOnly: true },
    { key: 'penanganan_aset', label: 'Penanganan Aset', icon: Wrench, adminOnly: true },
  ];

  return (
    <AppLayout title="Inventaris">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <p className="text-sm text-slate-500">Kelola aset IT</p>
      </div>

      <nav className="mb-6">
        <ul className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
          {tabs
            .filter((t) => !t.adminOnly || isAdmin)
            .map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => handleTabChange(t.key)}
                  className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    activeTab === t.key
                      ? 'border-slate-900 text-slate-900 font-medium'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                  {counts[t.key] != null && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        t.key === 'penanganan_aset' || t.key === 'persetujuan_aset'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {counts[t.key]}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </nav>

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
              aset; role lain (karyawan/manajer/hr) cuma lihat riwayat
              aktivitas MEREKA SENDIRI — backend yang filter (lihat
              AsetPemakaiController::riwayat), bukan cuma disembunyiin di UI. */}
          {user?.role !== 'cabang' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              {isAdmin ? 'Riwayat Aset' : 'Riwayat Aktivitas Saya'}{' '}
              <span className="text-slate-400 font-normal">({riwayatAset.length})</span>
            </h3>
            {riwayatAsetLoading ? (
              <p className="text-sm text-slate-400 text-center py-6">Memuat riwayat...</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {riwayatAset.map((ev, idx) => {
                  const style: Record<RiwayatAsetEvent['type'], { bg: string; icon: JSX.Element; label: string }> = {
                    pinjam: { bg: 'bg-amber-50 text-amber-600', icon: <HandCoins size={16} />, label: 'menerima' },
                    kembali: { bg: 'bg-emerald-50 text-emerald-600', icon: <Undo2 size={16} />, label: 'mengembalikan' },
                    lapor_rusak: { bg: 'bg-red-50 text-red-600', icon: <AlertTriangle size={16} />, label: 'melaporkan kerusakan' },
                    mulai_perbaikan: { bg: 'bg-orange-50 text-orange-600', icon: <PlayCircle size={16} />, label: 'mulai diperbaiki' },
                    selesai_perbaikan: { bg: 'bg-sky-50 text-sky-600', icon: <Wrench size={16} />, label: 'selesai diperbaiki' },
                    dijual: { bg: 'bg-purple-50 text-purple-600', icon: <Banknote size={16} />, label: 'dijual' },
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
                          {ev.nama ? <span className="font-medium">{ev.nama} </span> : ''}
                          {s.label} <span className="font-medium">{kode}</span>
                        </p>
                        <p className="text-xs text-slate-400">{formatWaktu(ev.waktu)}</p>
                      </div>
                    </li>
                  );
                })}
                {riwayatAset.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    {isAdmin ? 'Belum ada aktivitas aset.' : 'Belum ada aktivitas aset atas namamu.'}
                  </p>
                )}
              </ul>
            )}
          </div>
          )}
        </div>
      ) : activeTab === 'kelengkapan_aset' ? (
        <TabKelengkapanAset />
      ) : activeTab === 'persetujuan_aset' ? (
        <TabPersetujuanAset onCount={handleCountPersetujuan} />
      ) : (
        <TabPenangananAset onCount={handleCountPenanganan} />
      )}
    </AppLayout>
  );
}