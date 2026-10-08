import '../../index.css';
import { useEffect, useState } from 'react';
import { useSearchParams } from '../../lib/router';
import { Building2, Truck, Package, Tags, Users } from 'lucide-react';
import ScrollableTabBar from '../../components/shared/ScrollableTabBar';
import TabInventory from '../../components/masterData/inventory/TabInventory';
import TabKategori from '../../components/masterData/TabKategori';
import TabKaryawan from '../../components/masterData/TabKaryawan';
import TabCabang from '../../components/masterData/TabCabang';
import TabPerusahaan from '../../components/masterData/TabPerusahaan';
import TabDepartemen from '../../components/masterData/TabDepartemen';
import TabSupplier from '../../components/masterData/TabSupplier';
import { useAuth } from '../../context/AuthContext';

// Halaman Master Data = shell tipis: baca "?tab=", gambar tab bar, render tab
// yang aktif. Isi tiap tab ada di components/masterData/*:
//   inventory -> inventory/TabInventory     kategori   -> TabKategori
//   karyawan  -> TabKaryawan (Data User)    cabang     -> TabCabang
//   perusahaan-> TabPerusahaan              departemen -> TabDepartemen
//   supplier  -> TabSupplier
// (Departemen & Supplier sama-sama lewat GenericMasterTab.)
type TabKey = 'inventory' | 'kategori' | 'karyawan' | 'cabang' | 'perusahaan' | 'departemen' | 'supplier';

// `roles` opsional -- kalau diisi, tab ini cuma muncul (& cuma bisa dibuka lewat
// URL) buat role yang disebut. Semua tab selain Inventory admin-only, sinkron
// sama backend (routes/api.php: ada di dalam grup 'role:admin'). Role lain
// (hr termasuk) disamakan persis seperti karyawan -- gak punya akses.
//
// Urutan di sini nentuin urutan tab & jadi acuan "child pertama" buat
// AppLayout nentuin dropdown Master Data mana yang default aktif kalau URL
// belum punya "?tab=" -- harus samain urutannya sama children di
// components/layout/AppLayout.tsx.
const ADMIN_ONLY = ['admin'];

const TABS: { key: TabKey; label: string; icon: typeof Package; roles?: string[] }[] = [
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'kategori', label: 'Kategori', icon: Tags, roles: ADMIN_ONLY },
  { key: 'karyawan', label: 'Data User', icon: Users, roles: ADMIN_ONLY },
  { key: 'cabang', label: 'Cabang', icon: Building2, roles: ADMIN_ONLY },
  { key: 'perusahaan', label: 'Perusahaan', icon: Building2, roles: ADMIN_ONLY },
  { key: 'departemen', label: 'Departemen', icon: Building2, roles: ADMIN_ONLY },
  { key: 'supplier', label: 'Supplier', icon: Truck, roles: ADMIN_ONLY },
];

function isTabKey(value: string | null): value is TabKey {
  return !!value && TABS.some((t) => t.key === value);
}

function renderTab(tab: TabKey) {
  switch (tab) {
    case 'inventory':
      return <TabInventory />;
    case 'kategori':
      return <TabKategori />;
    case 'karyawan':
      return <TabKaryawan />;
    case 'cabang':
      return <TabCabang />;
    case 'perusahaan':
      return <TabPerusahaan />;
    case 'departemen':
      return <TabDepartemen />;
    case 'supplier':
      return <TabSupplier />;
  }
}

export default function MasterData() {
  const { user } = useAuth();
  const isAdmin = !!user && user.role === 'admin';

  // siapa boleh liat tab apa (dipakai buat tab bar & validasi "?tab=" di URL)
  const canViewTab = (tab: TabKey): boolean => {
    const roles = TABS.find((t) => t.key === tab)?.roles;
    return !roles || roles.includes(user?.role ?? '');
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    // kalau URL nunjuk ke tab yang gak boleh diakses role ini, paksa balik
    // ke 'inventory' daripada nolak seluruh halaman.
    if (isTabKey(fromUrl) && canViewTab(fromUrl)) return fromUrl;
    return 'inventory';
  });

  // ganti tab sekaligus sinkronin ke query param "?tab=" biar link dari sidebar
  // (dan tombol back/forward browser) nyambung ke tab yang bener.
  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // kalau user klik link dropdown sidebar yang query-nya beda (mis. lagi di tab
  // "departemen" terus klik "Supplier"), pathname sama jadi gak remount komponen —
  // effect ini yang nangkep perubahan query dan update activeTab-nya.
  //
  // FIX: effect ini juga harus jalan ulang begitu `user` kelar dimuat (bukan
  // cuma pas `searchParams` berubah). Kalau di-refresh browser di halaman
  // kayak "?tab=kategori", pas mount pertama `user` masih null (AuthContext
  // masih nunggu GET /user), jadi canViewTab('kategori') sempet false dan
  // state awal activeTab kepaksa jatuh ke 'inventory'. Tanpa `user` di
  // dependency array, activeTab nyangkut di 'inventory' selamanya walau URL
  // (dan sidebar) tetep nunjuk ke 'kategori'.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl) && fromUrl !== activeTab && canViewTab(fromUrl)) {
      setActiveTabState(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-slate-500">
          {isAdmin
            ? 'Kelola data inventory, kategori, departemen, supplier, data user, cabang, dan perusahaan yang dipakai di seluruh sistem.'
            : 'Lihat inventory yang tersedia atau lagi kamu pinjam.'}
        </p>
      </div>

      <ScrollableTabBar
        className="mb-6"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={TABS.filter((t) => canViewTab(t.key)).map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
      />

      {renderTab(activeTab)}
    </>
  );
}
