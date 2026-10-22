import { useState, useRef, type ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import { useAppNavigate } from '../hooks/useAppNavigate';
import { navItems, interleaveByChildren, matchesPrefix, INVENTORY_ROLES } from './navigation';
import type { NavItem, NavChild } from './navigation';
import Sidebar from './sidebar/Sidebar';
import Header from './header/Header';
import AuthSync from './AuthSync';
import FlashToaster from './FlashToaster';
import { NotificationsProvider } from '../features/notifications/NotificationsContext';

// Layout utama aplikasi (sidebar + header + konten). Dipasang sebagai persistent layout di
// app.tsx, jadi sidebar/header TIDAK di-remount (scroll & state-nya awet) saat pindah antar halaman Inertia.
// (Dulu terpecah: InertiaAppLayout = adapter Inertia, AppLayoutShell = tampilan. Sekarang satu file;
// Sidebar & Header sudah dipecah ke layouts/sidebar dan layouts/header.)
export default function AppLayout({ children }: { children: ReactNode }) {
  const { url } = usePage();
  const { user, logout } = useAuth();
  const navigate = useAppNavigate();

  // usePage().url = path + query (mis. '/master-data?tab=kategori'), kadang ada hash.
  const clean = url.split('#')[0];
  const q = clean.indexOf('?');
  const pathname = q === -1 ? clean : clean.slice(0, q);
  const search = q === -1 ? '' : clean.slice(q);

  const onNavigate = (to: string, opts?: { replace?: boolean }) => {
    navigate(to, opts?.replace ? { replace: true } : undefined);
  };

  const onLogout = async () => {
    // logout() (AuthContext): unsubscribe push -> POST /logout (route web) -> bersihin state.
    // Redirect sengaja di sini, bukan di AuthContext.
    await logout();
    window.location.href = '/login';
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOverrides, setDropdownOverrides] = useState<Record<string, boolean>>({});
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // [LAYOUT-LAMA] Urutan sidebar sama seperti versi lama: menu utama di-interleave
  // (Dashboard, Transaksi, Laporan, Master Data), lalu Audit Log (admin) dan Settings SELALU paling bawah.
  // (Sebelumnya semua item ikut di-interleave sehingga Audit Log & Settings terselip di tengah.)
  const canSee = (item: NavItem): boolean => {
    if (item.hidden) return false;
    if (!item.restricted) return true;
    if (item.label === 'Master Data') {
      return INVENTORY_ROLES.includes(user?.role ?? '');
    }
    return user?.role === 'admin';
  };
  // Dropdown yang semua child-nya terfilter role tidak ditampilkan (biar tidak ada menu kosong).
  const hasVisibleContent = (item: NavItem): boolean =>
    !item.children || item.children.some((child) => !child.roles || child.roles.includes(user?.role ?? ''));

  const auditLogItem = navItems.find((i) => i.label === 'Audit Log');
  const settingsItem = navItems.find((i) => i.label === 'Settings');
  const mainNavItems = navItems.filter((i) => i.label !== 'Audit Log' && i.label !== 'Settings');

  const visibleNavItems: NavItem[] = [
    ...interleaveByChildren(mainNavItems).filter(canSee).filter(hasVisibleContent),
    ...(auditLogItem && canSee(auditLogItem) ? [auditLogItem] : []),
    ...(settingsItem && canSee(settingsItem) ? [settingsItem] : []),
  ];

  const isParentActive = (item: NavItem): boolean => {
    if (!item.children) return false;
    if (matchesPrefix(pathname, item.matchPrefix)) return true;
    return item.children.some((child) => pathname === child.path);
  };

  const isDropdownOpen = (item: NavItem): boolean => {
    const override = dropdownOverrides[item.label];
    if (override !== undefined) return override;
    return isParentActive(item);
  };

  const isChildActive = (child: NavChild, isFirst: boolean): boolean => {
    const childNoQuery = child.path.split('?')[0];
    const hasChildQuery = child.path.includes('?');
    const currentNoQuery = pathname;
    const currentSearch = search;

    if (!hasChildQuery && !currentSearch) {
      return childNoQuery === currentNoQuery;
    }

    if (childNoQuery !== currentNoQuery) return false;

    if (!hasChildQuery) return false;

    const childParams = new URLSearchParams(child.path.split('?')[1]);
    const childTab = childParams.get('tab');
    if (!childTab) return childNoQuery === currentNoQuery;

    const currentParams = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch);
    const currentTab = currentParams.get('tab');

    if (!currentTab) {
      return isFirst;
    }

    return currentTab === childTab;
  };

  const handleNavClick = (item: NavItem) => {
    if (!item.path) {
      if (item.children) {
        setDropdownOverrides((prev) => ({
          ...prev,
          [item.label]: !isDropdownOpen(item),
        }));
      }
      return;
    }
    onNavigate(item.path);
    setSidebarOpen(false);
  };

  const handleChildClick = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await onLogout();
  };

  const handleSearchResultClick = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  // [LAYOUT-LAMA] Judul halaman di top bar (diturunkan dari menu yang cocok dengan URL sekarang).
  const derivedTitle = (() => {
    for (const item of visibleNavItems) {
      if (item.children) {
        const kids = item.children.filter((c) => !c.roles || c.roles.includes(user?.role ?? ''));
        const match = kids.find((c, idx) => isChildActive(c, idx === 0));
        if (match) return match.label;
        if (matchesPrefix(pathname, item.matchPrefix)) return item.label;
        continue;
      }
      if (matchesPrefix(pathname, item.matchPrefix)) return item.label;
      if (item.path && item.path === pathname) return item.label;
    }
    return '';
  })();

  const handleContentScroll = () => {};

  return (
    <NotificationsProvider>
      <div className="h-screen bg-white flex overflow-hidden">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          />
        )}

        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          visibleNavItems={visibleNavItems}
          pathname={pathname}
          search={search}
          isParentActive={isParentActive}
          isDropdownOpen={isDropdownOpen}
          isChildActive={isChildActive}
          handleNavClick={handleNavClick}
          handleChildClick={handleChildClick}
          handleLogout={handleLogout}
        />

        {/* [LAYOUT-LAMA] Kolom kanan: top bar sticky + panel konten melayang (bg-zinc-100 rounded-3xl) seperti versi lama */}
        <div
          ref={contentScrollRef}
          onScroll={handleContentScroll}
          className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col"
        >
          <Header
            title={derivedTitle}
            onMenuClick={() => setSidebarOpen(true)}
            navItems={visibleNavItems}
            onSearchResultClick={handleSearchResultClick}
          />

          <main className="flex-1 p-4 md:p-8">
            <div className="bg-zinc-100 rounded-3xl min-h-[calc(100vh-6.5rem)] p-4 md:p-8">
              <AuthSync />
              <FlashToaster />
              {children}
            </div>
          </main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
