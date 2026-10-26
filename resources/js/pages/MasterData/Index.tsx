import { router, usePage } from '@inertiajs/react';
import { Building2, Truck, Package, Tags, Users } from 'lucide-react';
import ScrollableTabBar from '../../components/navigation/ScrollableTabBar';
import InventoryTab from '../../features/inventory/InventoryTab';
import KategoriTab from '../../features/master-data/kategori/KategoriTab';
import CabangTab from '../../features/master-data/cabang/CabangTab';
import PerusahaanTab from '../../features/master-data/perusahaan/PerusahaanTab';
import DepartemenTab from '../../features/master-data/departemen/DepartemenTab';
import SupplierTab from '../../features/master-data/supplier/SupplierTab';
import KaryawanTab from '../../features/karyawan/KaryawanTab';
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
      return <InventoryTab />;
    case 'kategori':
      return <KategoriTab />;
    case 'karyawan':
      return <KaryawanTab />;
    case 'cabang':
      return <CabangTab />;
    case 'perusahaan':
      return <PerusahaanTab />;
    case 'departemen':
      return <DepartemenTab />;
    case 'supplier':
      return <SupplierTab />;
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

  // Tab aktif = prop `tab` dari server (MasterDataPageController: kosong/ngawur/bukan hak role -> 'inventory',
  // sama seperti perilaku lama). Ganti tab = visit ringan ke /master-data: replace (history gak numpuk),
  // preserveState (komponen halaman tidak di-reset).
  const pageProps = usePage().props as unknown as { tab?: string };
  const tabFromServer = pageProps.tab ?? null;
  const activeTab: TabKey = isTabKey(tabFromServer) && canViewTab(tabFromServer) ? tabFromServer : 'inventory';

  const setActiveTab = (tab: TabKey) => {
    if (tab === activeTab) return;
    // Tab inventory selalu bawa status (default 'semua-status'), tab lain cuma ?tab=.
    const data = tab === 'inventory' ? { status: 'semua-status', tab } : { tab };
    router.get('/master-data', data, { replace: true, preserveState: true, preserveScroll: true });
  };

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