import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Users, Loader2, Download, FileSpreadsheet, Images, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAset, type Aset } from '../api/aset';
import { karyawanApi, type Karyawan } from '../api/karyawan';
import AsetExportModal from '../components/inventaris/AsetExportModal';
import KaryawanExportModal from '../components/laporan/KaryawanExportModal';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import TabFotoAset from '../components/inventaris/TabFotoAset';
import TabRiwayatAset from '../components/inventaris/TabRiwayatAset';

const STAFF_ROLES = ['admin', 'hr', 'manajer', 'manager', 'cabang'];

// dulu halaman ini cuma 2 kartu export (Aset & Karyawan) -- sekarang jadi
// tab-based karena Foto Aset & Riwayat Aset (pindahan dari Inventaris.tsx,
// yang bakal dihapus) ikut digabung ke sini. Tab "export" (kartu-kartu di
// bawah) sengaja gak dikasih query "?tab=" biar cocok sama child "Export
// Data" di dropdown sidebar Laporan (AppLayout.tsx) yang path-nya polos
// "/laporan" tanpa query.
type TabKey = 'export' | 'foto_aset' | 'riwayat_aset';

const TAB_KEYS: TabKey[] = ['export', 'foto_aset', 'riwayat_aset'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

export default function Laporan() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const isAdmin = user?.role === 'admin';

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    return isTabKey(fromUrl) ? fromUrl : 'export';
  });

  // ganti tab sekaligus sinkronin ke query param "?tab=" -- kecuali tab
  // "export" yang sengaja gak pakai query sama sekali (lihat komentar di atas).
  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    if (tab === 'export') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  // kalau user klik link dropdown sidebar yang query-nya beda tapi pathname
  // sama (gak remount komponen), effect ini yang nangkep perubahan query dan
  // update activeTab-nya -- sama pola kayak MasterData.tsx / Inventaris.tsx.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl) && fromUrl !== activeTab) {
      setActiveTabState(fromUrl);
    } else if (!fromUrl && activeTab !== 'export') {
      setActiveTabState('export');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [asetLoading, setAsetLoading] = useState(true);
  const [exportAsetOpen, setExportAsetOpen] = useState(false);

  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [karyawanLoading, setKaryawanLoading] = useState(true);
  const [exportKaryawanOpen, setExportKaryawanOpen] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    getAset()
      .then(setAsetList)
      .catch(console.error)
      .finally(() => setAsetLoading(false));

    karyawanApi
      .getAll()
      .then((res) => setKaryawanList(res.data))
      .catch(console.error)
      .finally(() => setKaryawanLoading(false));
  }, [isStaff]);

  if (!isStaff) {
    return (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: typeof FileSpreadsheet; adminOnly?: boolean }[] = [
    { key: 'export', label: 'Export Data', icon: FileSpreadsheet },
    // pindahan dari Inventaris.tsx
    { key: 'foto_aset', label: 'Foto Aset', icon: Images, adminOnly: true },
    { key: 'riwayat_aset', label: 'Riwayat Aset', icon: History },
  ];

  return (
    <>
      <ScrollableTabBar
        className="mb-6"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
      />

      {activeTab === 'export' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Boxes size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Aset</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data aset IT (kode, jenis, status, kelengkapan, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
            </p>

            <div className="mt-4">
              <button
                onClick={() => setExportAsetOpen(true)}
                disabled={asetLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
              >
                {asetLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {asetLoading ? 'Memuat data...' : 'Export'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Users size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Karyawan</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export data karyawan (NIK, nama, departemen, tanggal masuk, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
            </p>

            <div className="mt-4">
              <button
                onClick={() => setExportKaryawanOpen(true)}
                disabled={karyawanLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
              >
                {karyawanLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {karyawanLoading ? 'Memuat data...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'foto_aset' ? (
        <TabFotoAset />
      ) : (
        <TabRiwayatAset />
      )}

      <AsetExportModal open={exportAsetOpen} onClose={() => setExportAsetOpen(false)} data={asetList} />
      <KaryawanExportModal open={exportKaryawanOpen} onClose={() => setExportKaryawanOpen(false)} data={karyawanList} />
    </>
  );
}