import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Images, History } from 'lucide-react';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import TabFotoAset from '../components/inventaris/TabFotoAset';
import TabRiwayatAset from '../components/inventaris/TabRiwayatAset';
import { useAuth } from '../context/AuthContext';

// Child-class tab Inventaris: sekarang cuma nyisa Foto Aset & Riwayat Aset.
// (Penanganan Aset udah punya halaman sendiri, Aset & Kelengkapan Aset udah
// dipindah & dirender langsung di MasterData.tsx -- jangan dobel-render di
// sini lagi.) Pola query "?tab=" tetap sama kayak sebelumnya.
type TabKey = 'foto_aset' | 'riwayat_aset';

const TAB_KEYS: TabKey[] = ['foto_aset', 'riwayat_aset'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

export default function Inventaris() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    return isTabKey(fromUrl) ? fromUrl : 'foto_aset';
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const tabs: { key: TabKey; label: string; icon: typeof Images; adminOnly?: boolean }[] = [
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
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
      />

      {activeTab === 'foto_aset' ? <TabFotoAset /> : <TabRiwayatAset />}
    </>
  );
}