import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  QrCode,
  Ticket,
  BarChart3,
  Bot,
  ScrollText,
  Settings as SettingsIcon,
  FileText,
  LogOut,
  Search,
  Menu,
  X,
  Package,
  CalendarDays,
  Wallet,
  FileSpreadsheet,
  Database,
  ChevronDown,
  UserPlus,
  List,
  FilePlus,
  Building2,
  BriefcaseBusiness,
  Tags,
  History,
  ScanLine,
  TicketPlus,
  PackagePlus,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import api from '../api/axios';
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
  matchPrefix?: string; // dipakai buat nentuin dropdown auto-expand + highlight, termasuk buat route dinamis (mis. /karyawan/5/edit)
  restricted?: boolean; // true = halaman khusus admin/staff, bukan buat karyawan biasa (dipakai buat naro garis pemisah di sidebar)
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Data Karyawan',
    icon: Users,
    path: null,
    matchPrefix: '/karyawan',
    children: [
      { label: 'Semua Karyawan', icon: List, path: '/karyawan' },
      { label: 'Tambah Karyawan', icon: UserPlus, path: '/karyawan/create' },
    ],
  },
  {
    label: 'Absensi QR',
    icon: QrCode,
    path: null,
    matchPrefix: '/absensi',
    children: [
      { label: 'Riwayat Absensi', icon: History, path: '/absensi' },
      { label: 'Scan Absensi', icon: ScanLine, path: '/absensi?action=scan' },
    ],
  },
  {
    label: 'Pengajuan Izin',
    icon: FileText,
    path: null,
    matchPrefix: '/izin',
    children: [
      { label: 'Daftar Izin', icon: List, path: '/izin' },
      { label: 'Ajukan Izin', icon: FilePlus, path: '/izin/create' },
    ],
  },
  {
    label: 'Ticketing',
    icon: Ticket,
    path: null,
    matchPrefix: '/ticketing',
    children: [
      { label: 'Semua Tiket', icon: List, path: '/ticketing' },
      { label: 'Buat Tiket', icon: TicketPlus, path: '/ticketing?action=create' },
    ],
  },
  {
    label: 'Inventaris',
    icon: Package,
    path: null,
    matchPrefix: '/inventaris',
    children: [
      { label: 'Semua Barang', icon: List, path: '/inventaris' },
      { label: 'Tambah Barang', icon: PackagePlus, path: '/inventaris?action=create', roles: ['admin'] },
    ],
  },
  {
    label: 'Agenda',
    icon: CalendarDays,
    path: null,
    matchPrefix: '/agenda',
    children: [
      { label: 'Semua Agenda', icon: List, path: '/agenda' },
      { label: 'Tambah Agenda', icon: CalendarPlus, path: '/agenda?action=create', roles: ['admin', 'hr'] },
    ],
  },
  { label: 'Expense - Inventory', icon: BarChart3, path: '/dashboard-analytics', restricted: true },
  { label: 'Laporan', icon: FileSpreadsheet, path: '/laporan', restricted: true },
  { label: 'Payroll', icon: Wallet, path: '/payroll', restricted: true },
  {
    label: 'Master Data',
    icon: Database,
    path: null,
    matchPrefix: '/master-data',
    restricted: true,
    children: [
      { label: 'Departemen', icon: Building2, path: '/master-data?tab=departemen' },
      { label: 'Jabatan', icon: BriefcaseBusiness, path: '/master-data?tab=jabatan' },
      { label: 'Kategori Barang', icon: Tags, path: '/master-data?tab=kategori' },
    ],
  },
  { label: 'AI Assistant', icon: Bot, path: '/ai-assistant' },
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
  title: string;
  children: ReactNode;
}

export default function AppLayout({ title, children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { resetChat } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const STAFF_ROLES = ['admin', 'hr'];
  const REVIEWER_ROLES = ['admin', 'hr', 'manajer', 'manager'];

  const roleFilter = (item: NavItem) => {
    if (item.label === 'Expense - Inventory Dashboard' && user?.role === 'karyawan') {
      return false;
    }
    // Payroll & Master Data hanya untuk admin/hr
    if ((item.label === 'Payroll' || item.label === 'Master Data') && !STAFF_ROLES.includes(user?.role ?? '')) {
      return false;
    }
    // Laporan untuk admin/hr/manajer
    if (item.label === 'Laporan' && !REVIEWER_ROLES.includes(user?.role ?? '')) {
      return false;
    }
    return true;
  };

  const visibleInterleaved = interleavedNavItems.filter(roleFilter);
  const showAuditLog = auditLogNavItem && user?.role === 'admin'; // Audit Log hanya untuk admin

  const visibleNavItems = [
    ...visibleInterleaved,
    ...(showAuditLog ? [auditLogNavItem!] : []),
    ...(settingsNavItem ? [settingsNavItem] : []),
  ];

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

  const handleSearchResultClick = (path: string) => {
    navigate(path);
    setSearchOpen(false);
    setSearchQuery('');
    setSidebarOpen(false);
  };

  // dropdown parent dianggap "aktif" (dan auto-expand) kalau path sekarang cocok
  // salah satu child-nya, atau nempel di matchPrefix (buat nutup route dinamis
  // kayak /karyawan/5/edit yang gak ada tombol nav-nya sendiri)
  const isParentActive = (item: NavItem): boolean => {
    if (!item.children) return false;
    if (item.matchPrefix && location.pathname.startsWith(item.matchPrefix)) return true;
    return item.children.some((child) => location.pathname === child.path);
  };

  const isDropdownOpen = (item: NavItem): boolean => {
    return isParentActive(item) || openDropdowns.has(item.label);
  };

  // support 2 pola child path: polos ("/izin/create") atau pakai query tab
  // ("/master-data?tab=jabatan"). Kalau child gak punya query dan URL sekarang
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
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Logout di server gagal, lanjut clear session lokal.', err);
    } finally {
      resetChat();
      logout();
      navigate('/login', { replace: true });
    }
  };

  const handleNavClick = (item: NavItem) => {
    if (item.children) {
      toggleDropdown(item.label);
      return;
    }
    if (item.path) {
      navigate(item.path);
      setSidebarOpen(false);
    }
  };

  const handleChildClick = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ===== MOBILE OVERLAY ===== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-6 h-20 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight">MARIMAS ONE</span>
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
            const isActive = item.path === location.pathname;
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
      <div className="flex-1 min-w-0">
        {/* TOPBAR */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600">
              <Menu size={22} />
            </button>
            <h1 className="text-xl font-bold text-slate-900 hidden sm:block">{title}</h1>
          </div>

          <div ref={searchBoxRef} className="hidden md:flex items-center flex-1 max-w-sm mx-6 relative">
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

        {/* CONTENT */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
