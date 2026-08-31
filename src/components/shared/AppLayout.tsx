import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Menu,
  X,
  Package,
  FileSpreadsheet,
  Database,
  ChevronDown,
  Building2,
  Truck,
  Wrench,
  Images,
  History,
  Tags,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationDropdown from './NotificationDropDown';

interface NavChild {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles?: string[]; // kalau diisi, child ini cuma muncul buat role yang disebut (mis. aksi create yang dibatasi backend)
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string | null; // null = belum ada halamannya (atau dropdown-only parent), tampil tapi non-aktif/non-navigable
  children?: NavChild[]; // kalau ada, item ini jadi dropdown di sidebar
  // dipakai buat nentuin dropdown auto-expand + highlight, termasuk buat route
  // dinamis yang gak punya tombol nav sendiri (mis. /karyawan/5/edit). Bisa
  // array kalau satu nav item perlu nyocokin lebih dari satu prefix path --
  // dipakai Master Data buat ikut aktif pas di halaman create/edit User
  // (/karyawan/create, /karyawan/:id/edit), yang tetap halaman tersendiri
  // (bukan tab) meski "Data User"-nya sendiri sekarang jadi tab di dalamnya.
  matchPrefix?: string | string[];
  restricted?: boolean; // true = halaman khusus admin/staff, bukan buat karyawan biasa (dipakai buat naro garis pemisah di sidebar)
  hidden?: boolean; // true = fitur belum lengkap, disembunyikan dari sidebar sementara. Route & filenya TETAP ada, cuma gak ditampilkan di menu.
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    // dulu "Inventaris" -- sekarang cuma nyisa Penanganan Aset di sini,
    // karena Aset & Kelengkapan Aset pindah ke Master Data, sementara
    // Foto Aset & Riwayat Aset pindah ke Laporan. Penanganan Aset sendiri
    // udah bukan tab di dalam /inventaris lagi (component TabPenangananAset
    // di components/inventaris/TabPenangananAset sekarang dipakai di
    // halaman sendiri) -- makanya path & matchPrefix-nya diganti ke
    // '/penanganan-aset', bukan lagi query "?tab=" di /inventaris.
    label: 'Transaksi',
    icon: Package,
    path: null,
    matchPrefix: '/penanganan-inventory',
    children: [
      // BARU: dibuka buat karyawan/manajer/hr juga (dulu admin-only) --
      // sinkron sama role yang diizinin backend (routes/api.php,
      // GET /inventory-penanganan sekarang role:karyawan,manajer,hr,admin).
      // Data yang tampil sudah discoping ke laporan milik sendiri buat
      // non-admin/hr di InventoryPenangananController::index().
      { label: 'Penanganan Inventory', icon: Wrench, path: '/penanganan-inventory', roles: ['karyawan', 'cabang', 'manajer', 'hr', 'admin'] },
    ],
  },
  {
    // dulu link tunggal ke /laporan -- sekarang jadi dropdown. Halaman lamanya
    // sendiri tetap ada di sini, cuma dilabel ulang jadi "Export Data".
    // Foto Aset & Riwayat Aset (pindahan dari Inventaris.tsx, yang udah
    // dihapus) sekarang juga dirender langsung di Laporan.tsx, jadi path-nya
    // ikut pindah ke /laporan?tab=... (bukan /inventaris?tab=... lagi).
    label: 'Laporan',
    icon: FileSpreadsheet,
    path: null,
    matchPrefix: '/laporan',
    restricted: true,
    children: [
      { label: 'Export Data', icon: FileSpreadsheet, path: '/laporan' },
      { label: 'Foto Inventory', icon: Images, path: '/laporan?tab=foto_inventory', roles: ['admin'] },
      { label: 'Riwayat Inventory', icon: History, path: '/laporan?tab=riwayat_inventory' },
    ],
  },
  {
    label: 'Master Data',
    icon: Database,
    path: null,
    // BARU: ikut nyocokin /karyawan & /cabang juga -- Data User & Cabang
    // sekarang jadi tab di dalam Master Data (bukan halaman sendiri lagi),
    // tapi halaman create/edit User (/karyawan/create, /karyawan/:id/edit)
    // tetap route tersendiri, jadi Master Data perlu tetap "aktif" pas
    // lagi di sana. Alias redirect /karyawan & /cabang lama juga tetap
    // ngarah ke /master-data (lihat App.tsx).
    matchPrefix: ['/master-data', '/karyawan', '/cabang'],
    restricted: true,
    children: [
      // Aset & Kelengkapan Aset kontennya sekarang dirender langsung di
      // MasterData.tsx (bukan lagi di Inventaris.tsx), jadi path-nya juga
      // udah /master-data?tab=..., bukan /inventaris?tab=... lagi.
      // Tab "Kelengkapan Inventory" sudah digabung ke tab "Inventory" (1
      // tabel gabungan dengan kolom Kategori), jadi entri dropdown-nya
      // dihapus dari sini -- lihat TabInventory.tsx.
      // BARU: "Inventory" sengaja gak dikasih `roles` -- kebuka buat
      // karyawan/manajer juga (bukan cuma staff), sinkron sama backend
      // (GET /inventory sudah role:karyawan,manajer,hr,admin) dan sama
      // "Master Data" parent yang sekarang gak diblokir total lagi buat
      // non-staff (lihat roleFilter di bawah). Kategori/Departemen/Supplier
      // TETAP staff-only, murni data referensi yang gak relevan buat
      // karyawan biasa.
      { label: 'Inventory', icon: Package, path: '/master-data?tab=inventory' },
      { label: 'Kategori', icon: Tags, path: '/master-data?tab=kategori', roles: ['admin', 'hr'] },
      // BARU: Data User & Cabang pindahan dari halaman /karyawan & /cabang
      // (dulu 2 item sidebar terpisah, admin-only) -- sekarang jadi tab di
      // sini juga, tetap admin-only lewat `roles`.
      { label: 'Data User', icon: Users, path: '/master-data?tab=karyawan', roles: ['admin'] },
      { label: 'Cabang', icon: Building2, path: '/master-data?tab=cabang', roles: ['admin'] },
      { label: 'Departemen', icon: Building2, path: '/master-data?tab=departemen', roles: ['admin', 'hr'] },
      { label: 'Supplier', icon: Truck, path: '/master-data?tab=supplier', roles: ['admin', 'hr'] },
    ],
  },
  { label: 'Audit Log', icon: ScrollText, path: '/audit-log', restricted: true },
  { label: 'Settings', icon: SettingsIcon, path: '/settings' },
];

// selang-seling item tanpa children lalu item dengan children, ngikutin
// urutan asli masing-masing (stable), gak peduli general atau restricted
function interleaveByChildren(items: NavItem[]): NavItem[] {
  const noChild = items.filter((i) => !i.children);
  const withChild = items.filter((i) => i.children);
  const merged: NavItem[] = [];
  const maxLen = Math.max(noChild.length, withChild.length);
  for (let i = 0; i < maxLen; i++) {
    if (noChild[i]) merged.push(noChild[i]);
    if (withChild[i]) merged.push(withChild[i]);
  }
  return merged;
}

// Audit Log & Settings ditarik keluar dari selang-seling -- posisinya dikunci
// di paling bawah (Audit Log tepat di atas Settings, Settings paling akhir)
const auditLogNavItem = navItems.find((i) => i.label === 'Audit Log');
const settingsNavItem = navItems.find((i) => i.label === 'Settings');
const otherNavItems = navItems.filter((i) => i.label !== 'Audit Log' && i.label !== 'Settings');

const interleavedNavItems = interleaveByChildren(otherNavItems);

// dukung matchPrefix yang berupa satu string ATAU array of string (lihat
// komentar di NavChild/NavItem.matchPrefix) -- dipakai di semua tempat yang
// sebelumnya langsung nulis `location.pathname.startsWith(item.matchPrefix)`.
function matchesPrefix(pathname: string, prefix?: string | string[]): boolean {
  if (!prefix) return false;
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  return prefixes.some((p) => pathname.startsWith(p));
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// satu entri hasil pencarian: bisa halaman utama (tanpa parent) atau
// sub-halaman (child dropdown), makanya ada field parentLabel opsional
// buat ditampilin sebagai breadcrumb kecil di hasil search
interface SearchEntry {
  key: string;
  label: string;
  parentLabel?: string;
  icon: typeof LayoutDashboard;
  path: string;
}

interface AppLayoutProps {
  title?: string;
  children?: ReactNode;
}

export default function AppLayout({ title, children }: AppLayoutProps = {}) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const STAFF_ROLES = ['admin', 'hr'];

  // roles yang backend izinin buka GET /inventory (routes/api.php) --
  // dipakai buat nentuin siapa yang masih boleh liat menu "Master Data"
  // sama sekali (isi tab Inventory-nya), meski cuma admin/hr yang boleh
  // liat tab Kategori/Departemen/Supplier di dalamnya (dibatasi lewat
  // `roles` di masing-masing child di atas).
  const INVENTORY_ROLES = ['karyawan', 'cabang', 'manajer', 'hr', 'admin'];

  const roleFilter = (item: NavItem) => {
    // Fitur yang masih belum lengkap -- sembunyikan dari sidebar dulu (lihat flag `hidden` di navItems).
    if (item.hidden) {
      return false;
    }
    // BARU: "Master Data" dulu staff-only total -- sekarang tetap tampil
    // buat karyawan/manajer juga, karena tab Inventory di dalamnya sudah
    // dibuka buat mereka (backend GET /inventory: role:karyawan,manajer,hr,admin).
    // Tab lain di dalamnya (Kategori/Departemen/Supplier) tetap staff-only,
    // dibatasi lewat `roles` per-child, bukan di sini. 'cabang' DIIKUTKAN
    // di INVENTORY_ROLES karena backend (level-based role middleware,
    // lihat User::$roleLevels) & controller (kembalikan/lapor kerusakan
    // discoping by user_id, bukan role) memang udah support cabang sebagai
    // pemakai barang -- lihat tombol "Kembalikan" di TabInventory.tsx.
    if (item.label === 'Master Data' && !INVENTORY_ROLES.includes(user?.role ?? '')) {
      return false;
    }
    // (Data User & Cabang sekarang jadi child dropdown di Master Data,
    // dibatasi admin-only lewat `roles` per-child -- lihat hasVisibleContent
    // & filter visibleChildren di render, bukan lagi di sini.)
    // (dulu Dashboard cuma tampil buat admin -- sekarang semua role
    // sudah punya varian dashboard-nya sendiri: DashboardUser/DashboardCabang/
    // DashboardAdmin, jadi menu ini gak perlu disembunyikan lagi.)
    // Laporan untuk admin/hr/manajer
    if (item.label === 'Laporan' && !STAFF_ROLES.includes(user?.role ?? '')) {
      return false;
    }
    return true;
  };

  // Item dropdown (mis. "Transaksi") tetap lolos roleFilter di atas walau
  // SEMUA child-nya kefilter abis buat role tertentu (mis. 'cabang' gak ada
  // di roles-nya "Penanganan Inventory") -- hasilnya tombol dropdown nongol
  // tapi pas dibuka isinya kosong. Dibuang di sini biar sidebar cabang (atau
  // role lain ke depannya) gak nampilin menu mati kayak gitu.
  const hasVisibleContent = (item: NavItem) => {
    if (!item.children) return true;
    return item.children.some((child) => !child.roles || child.roles.includes(user?.role ?? ''));
  };

  const visibleInterleaved = interleavedNavItems.filter(roleFilter).filter(hasVisibleContent);
  const showAuditLog = auditLogNavItem && user?.role === 'admin'; // Audit Log hanya untuk admin

  const visibleNavItems = [
    ...visibleInterleaved,
    ...(showAuditLog ? [auditLogNavItem!] : []),
    ...(settingsNavItem ? [settingsNavItem] : []),
  ];

  // fallback judul header: dipake kalau AppLayout jadi layout route (lewat
  // <Outlet />, gak ada prop title dikirim). Cari nav item (termasuk child
  // dropdown) yang path/matchPrefix-nya cocok sama URL sekarang.
  const derivedTitle = (() => {
    for (const item of visibleNavItems) {
      if (item.children) {
        const match = item.children.find(
          (child) => location.pathname === child.path.split('?')[0]
        );
        if (match) return match.label;
        // BARU: kalau gak ada child yang path-nya cocok persis, tetap cek
        // matchPrefix milik parent-nya sendiri sebelum lanjut ke item
        // berikutnya -- dipakai Master Data buat halaman create/edit User
        // (/karyawan/create, /karyawan/:id/edit) yang gak punya tombol nav
        // sendiri di dropdown (lihat matchPrefix Master Data di atas).
        if (matchesPrefix(location.pathname, item.matchPrefix)) return item.label;
        continue;
      }
      if (matchesPrefix(location.pathname, item.matchPrefix)) return item.label;
      if (item.path && item.path === location.pathname) return item.label;
    }
    return '';
  })();

  const pageTitle = title ?? derivedTitle;

  // ratain semua halaman sidebar (termasuk sub-menu dropdown) jadi satu daftar
  // flat buat kebutuhan search -- ikut role filter yang sama kayak sidebar,
  // biar user gak liat halaman yang sebenernya gak bisa dia akses
  const searchEntries: SearchEntry[] = visibleNavItems.flatMap((item) => {
    if (item.children) {
      const visibleChildren = item.children.filter(
        (child) => !child.roles || child.roles.includes(user?.role ?? '')
      );
      return visibleChildren.map((child) => ({
        key: `${item.label}-${child.label}`,
        label: child.label,
        parentLabel: item.label,
        icon: child.icon,
        path: child.path,
      }));
    }
    if (!item.path) return [];
    return [
      {
        key: item.label,
        label: item.label,
        icon: item.icon,
        path: item.path,
      },
    ];
  });

  const filteredSearchEntries =
    searchQuery.trim() === ''
      ? searchEntries
      : searchEntries.filter((entry) => {
          const q = searchQuery.toLowerCase();
          return (
            entry.label.toLowerCase().includes(q) ||
            (entry.parentLabel ? entry.parentLabel.toLowerCase().includes(q) : false)
          );
        });

  // klik di luar kotak search (input + dropdown) nutup dropdown-nya
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContentScroll = () => {};

  const handleSearchResultClick = (path: string) => {
    if (OVERLAY_PATHS.includes(path)) {
      navigate(path, { state: { backgroundLocation: location } });
    } else {
      navigate(path);
    }
    setSearchOpen(false);
    setSearchQuery('');
    setSidebarOpen(false);
  };

  // dropdown parent dianggap "aktif" (dan auto-expand) kalau path sekarang cocok
  // salah satu child-nya, atau nempel di matchPrefix (buat nutup route dinamis
  // kayak /karyawan/5/edit yang gak ada tombol nav-nya sendiri)
  const isParentActive = (item: NavItem): boolean => {
    if (!item.children) return false;
    if (matchesPrefix(location.pathname, item.matchPrefix)) return true;
    return item.children.some((child) => location.pathname === child.path);
  };

  const isDropdownOpen = (item: NavItem): boolean => {
    return isParentActive(item) || openDropdowns.has(item.label);
  };

  // support 2 pola child path: polos ("/izin/create") atau pakai query tab
  // ("/master-data?tab=departemen"). Kalau child gak punya query dan URL sekarang
  // juga gak punya query, cocok berdasarkan pathname doang. Kalau child pakai
  // query "tab", cocokin nilai tab-nya; kalau URL sekarang belum punya "tab"
  // sama sekali, anggap child pertama di grup itu sebagai default aktif.
  const isChildActive = (child: NavChild, isFirstChild: boolean): boolean => {
    const [childPath, childQuery] = child.path.split('?');
    if (location.pathname !== childPath) return false;
    if (!childQuery) return location.search === '';

    const currentTab = new URLSearchParams(location.search).get('tab');
    const childTab = new URLSearchParams(childQuery).get('tab');
    if (!currentTab) return isFirstChild;
    return currentTab === childTab;
  };

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

const handleLogout = async () => {
    // NOTE: revoke token ke server, unsubscribe push, & bersih-bersih localStorage
    // semua udah ditangani di dalam logout() (AuthContext), dalam urutan yang benar
    // (unsubscribe push dulu selagi token masih valid, baru revoke). Jangan panggil
    // api.post('/logout') terpisah di sini -- itu bikin push unsubscribe-nya gagal
    // diam-diam (401) karena token keburu mati duluan.
    const res = await logout();
    navigate('/login', {
        replace: true,
        state: res?.password_direset ? { passwordReset: true } : undefined,
    });
};

  // Route yang sekarang dirender sebagai overlay absolute (RouteModal) di App.tsx,
  // bukan halaman penuh lagi — jadi navigasi ke sini WAJIB bawa state.backgroundLocation
  // supaya halaman yang lagi kebuka tetap mounted & kelihatan di belakangnya, gak
  // reload/hilang. Kalau path-nya gak ada di daftar ini, navigasi biasa aja.
  const OVERLAY_PATHS = ['/karyawan/create'];

  const handleNavClick = (item: NavItem) => {
    if (item.children) {
      toggleDropdown(item.label);
      return;
    }
    if (item.path) {
      if (OVERLAY_PATHS.includes(item.path)) {
        navigate(item.path, { state: { backgroundLocation: location } });
      } else {
        navigate(item.path);
      }
      setSidebarOpen(false);
    }
  };

  const handleChildClick = (path: string) => {
    if (OVERLAY_PATHS.includes(path)) {
      navigate(path, { state: { backgroundLocation: location } });
    } else {
      navigate(path);
    }
    setSidebarOpen(false);
  };

  return (
    // Chrome (sidebar + topbar) dan area dashboard sekarang punya 2 warna
    // yang beda secara sengaja: root ini "bg-white" dipakai bareng sama
    // sidebar & topbar biar nyatu tanpa garis, sedangkan panel dashboard
    // di bawah dikasih "bg-slate-50" + rounded biar keliatan sebagai
    // panel/card sendiri yang mengambang di atas chrome putih.
    <div className="h-screen bg-white flex overflow-hidden">
      {/* ===== MOBILE OVERLAY ===== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white flex flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-6 h-18 shrink-0">
          <div className="flex p-1 items-center mx-auto gap-2">
            <img src="/logo.png" alt="Marimas One" className="h-18 w-auto p-1" />
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            // garis pemisah muncul tepat sebelum Audit Log (yang dikunci di
            // atas Settings, paling bawah sidebar)
            const showDivider = item.label === 'Audit Log';
            const divider = showDivider && (
              <div key={`divider-${item.label}`} className="my-3 border-t border-slate-200" />
            );

            // ITEM DENGAN DROPDOWN (children)
            if (item.children) {
              const visibleChildren = item.children.filter(
                (child) => !child.roles || child.roles.includes(user?.role ?? '')
              );
              const parentActive = isParentActive(item);
              const open = isDropdownOpen(item);
              return (
                <div key={item.label}>
                  {divider}
                  <div className="mb-1">
                    <button
                      onClick={() => handleNavClick(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        parentActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {open && (
                      <div className="mt-1 ml-4 pl-3 border-l border-slate-200 flex flex-col gap-1">
                        {visibleChildren.map((child, idx) => {
                          const ChildIcon = child.icon;
                          const active = isChildActive(child, idx === 0);
                          return (
                            <button
                              key={child.path}
                              onClick={() => handleChildClick(child.path)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                                active
                                  ? 'bg-slate-100 text-slate-900 font-medium'
                                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                            >
                              <ChildIcon size={15} />
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ITEM BIASA (tanpa dropdown)
            const isActive = item.matchPrefix
              ? matchesPrefix(location.pathname, item.matchPrefix)
              : item.path === location.pathname;
            const isDisabled = !item.path;
            return (
              <div key={item.label}>
                {divider}
                <button
                  onClick={() => handleNavClick(item)}
                  disabled={isDisabled}
                  title={isDisabled ? 'Segera hadir' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : isDisabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div
        ref={contentScrollRef}
        onScroll={handleContentScroll}
        className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col"
      >
        {/* TOPBAR — bg sama kayak sidebar (bg-white), garis pemisah (border-b)
            sengaja dihilangin biar sidebar & topbar keliatan nyatu jadi satu
            panel chrome tanpa garis */}
        <header
          className="h-18 min-h-18 shrink-0 bg-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-30"
        >
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600">
              <Menu size={22} />
            </button>
            <h1 className="text-xl font-bold text-slate-900 hidden sm:block">{pageTitle}</h1>
          </div>

          <div ref={searchBoxRef} className="flex items-center flex-1 max-w-md mx-6 relative">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onClick={() => setSearchOpen(true)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Cari sesuatu..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />

            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-40">
                {filteredSearchEntries.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">Halaman tidak ditemukan.</p>
                ) : (
                  filteredSearchEntries.map((entry) => {
                    const EntryIcon = entry.icon;
                    return (
                      <button
                        key={entry.key}
                        onClick={() => handleSearchResultClick(entry.path)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100 transition"
                      >
                        <EntryIcon size={16} className="text-slate-400 shrink-0" />
                        <span className="flex-1 truncate">
                          {entry.parentLabel && (
                            <span className="text-slate-400">{entry.parentLabel} / </span>
                          )}
                          {entry.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                {initials(user?.name)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{user?.name}</p>
                <p className="text-xs text-slate-400 leading-tight">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT — panel dashboard sendiri: bg-slate-50 + rounded-3xl,
            dikasih margin (p-3/p-6) biar keliatan "mengambang" terpisah
            dari chrome putih di sidebar & topbar */}
        <main className="flex-1 p-4 md:p-8">
          <div className="bg-zinc-100 rounded-3xl min-h-[calc(100vh-6.5rem)] p-4 md:p-8">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}