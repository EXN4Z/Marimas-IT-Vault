import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, ClipboardList, Wrench, Images, History } from 'lucide-react';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import TabAset from '../components/inventaris/TabAset';
import TabPenangananAset from '../components/inventaris/TabPenangananAset';
import TabFotoAset from '../components/inventaris/TabFotoAset';
import TabKelengkapanAset from '../components/inventaris/TabKelengkapanAset';
import TabRiwayatAset from '../components/inventaris/TabRiwayatAset';
import { useAuth } from '../context/AuthContext';
import { getAset, type AsetPenanganan } from '../api/aset';
import api from '../api/axios';

// Child-class tab Inventaris: Aset, Kelengkapan Aset, Penanganan Aset, Foto
// Aset, Riwayat Aset -- pola sama kayak child-class di MasterData.tsx, dan
// sekarang juga punya dropdown sendiri di sidebar (lihat AppLayout.tsx) yang
// nyambung lewat query "?tab=" persis kayak Master Data.
type TabKey = 'aset' | 'kelengkapan_aset' | 'penanganan_aset' | 'foto_aset' | 'riwayat_aset';

const TAB_KEYS: TabKey[] = ['aset', 'kelengkapan_aset', 'penanganan_aset', 'foto_aset', 'riwayat_aset'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

export default function Inventaris() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl)) return fromUrl;
    // alias lama dari notif kerusakan aset (AsetKerusakanDilaporkan.php masih
    // ngirim /inventaris?tab=penanganan, bukan "penanganan_aset") -- tetep
    // didukung biar link lama/backend gak perlu ikut diubah.
    if (fromUrl === 'penanganan' && isAdmin) return 'penanganan_aset';
    // alias lama: "Kelengkapan Rusak" dulu tab halaman terpisah, sekarang
    // digabung jadi filter status di dalam "kelengkapan_aset" -- bookmark
    // lama tetep diarahkan ke sana (filter "Rusak"-nya tinggal dipilih
    // manual di dalam, gak perlu ikut di-encode ke URL top-level).
    if (fromUrl === 'kelengkapan_rusak') return 'kelengkapan_aset';
    return 'aset';
  });

  // ganti tab sekaligus sinkronin ke query param "?tab=" biar link dropdown
  // sidebar & tombol back/forward browser nyambung ke tab yang bener.
  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // kalau user klik link dropdown sidebar yang query-nya beda tapi pathname
  // sama (gak remount komponen), effect ini yang nangkep perubahan query dan
  // update activeTab-nya -- sama pola kayak MasterData.tsx.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl) && fromUrl !== activeTab) {
      setActiveTabState(fromUrl);
      return;
    }
    if (fromUrl === 'penanganan' && isAdmin && activeTab !== 'penanganan_aset') {
      setActiveTabState('penanganan_aset');
      return;
    }
    if (fromUrl === 'kelengkapan_rusak' && activeTab !== 'kelengkapan_aset') {
      setActiveTabState('kelengkapan_aset');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [counts, setCounts] = useState<Partial<Record<TabKey, number>>>({});

  // stabil: hindari infinite loop di child (onCount di deps useEffect anak)
  const updateCount = useCallback((key: TabKey, n: number) => {
    setCounts((c) => (c[key] === n ? c : { ...c, [key]: n }));
  }, []);

  const handleCountAset = useCallback((n: number) => updateCount('aset', n), [updateCount]);
  const handleCountPenanganan = useCallback((n: number) => updateCount('penanganan_aset', n), [updateCount]);

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

  const tabs: { key: TabKey; label: string; icon: typeof Package; adminOnly?: boolean; hidden?: boolean }[] = [
    { key: 'aset', label: 'Aset', icon: Package },
    // dulu ("Kelengkapan Aset" hidden) isinya laporan level kelengkapan
    // laptop (lihat TabKelengkapanAset.tsx, masih ada di disk tapi gak
    // dirender lagi). Sekarang jadi CRUD master kelengkapan_master
    // (Tambah/Edit/Hapus Tas, Charger, dst) lewat TabKelengkapanMaster.tsx,
    // dipakai buat checklist di form peminjaman aset -- makanya ditaruh di
    // Inventaris, bukan Master Data (yang isinya data referensi umum).
    { key: 'kelengkapan_aset', label: 'Kelengkapan Aset', icon: ClipboardList },
    // Arsip "Kelengkapan Rusak" (alur "Kelengkapan Rusak -> Lepas Otomatis
    // -> Ganti Pengganti") gak lagi jadi tab halaman terpisah -- sekarang
    // digabung jadi filter status "Rusak" di dalam TabKelengkapanAset.tsx
    // (ScrollableTabBar), sama pola kayak filter status di tab Aset.
    { key: 'penanganan_aset', label: 'Penanganan Aset', icon: Wrench, adminOnly: true },
    { key: 'foto_aset', label: 'Foto Aset', icon: Images, adminOnly: true },
    { key: 'riwayat_aset', label: 'Riwayat Aset', icon: History },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <p className="text-sm text-slate-500">Kelola aset IT</p>
      </div>

      <ScrollableTabBar
        className="mb-6"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={tabs
          .filter((t) => !t.hidden && (!t.adminOnly || isAdmin))
          .map((t) => ({
            key: t.key,
            label: t.label,
            icon: t.icon,
            // Badge angka di tab "Aset" & "Penanganan Aset" dihapus atas
            // permintaan -- tab lain (kelengkapan_aset, foto_aset,
            // riwayat_aset) tetap tampilin badge kalau nanti dikasih count.
            badge: t.key === 'aset' || t.key === 'penanganan_aset' ? null : counts[t.key] ?? null,
            badgeClassName: t.key === 'penanganan_aset' ? 'bg-red-50 text-red-600' : undefined,
          }))}
      />

      {activeTab === 'aset' ? (
        <TabAset onCount={handleCountAset} />
      ) : activeTab === 'kelengkapan_aset' ? (
        <TabKelengkapanAset />
      ) : activeTab === 'penanganan_aset' ? (
        <TabPenangananAset onCount={handleCountPenanganan} />
      ) : activeTab === 'foto_aset' ? (
        <TabFotoAset />
      ) : (
        <TabRiwayatAset />
      )}
    </>
  );
}