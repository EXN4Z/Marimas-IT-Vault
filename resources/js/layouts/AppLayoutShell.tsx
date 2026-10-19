import { useState, useRef, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { navItems, interleaveByChildren, matchesPrefix, INVENTORY_ROLES } from './navigation';
import type { NavItem, NavChild } from './navigation';
import Sidebar from './sidebar/Sidebar';
import Header from './header/Header';

export interface ShellNavigateOptions {
  replace?: boolean;
}

interface AppLayoutShellProps {
  pathname: string;
  search: string;
  onNavigate: (to: string, opts?: ShellNavigateOptions) => void;
  onLogout: () => Promise<void>;
  title?: string;
  children?: ReactNode;
}

export default function AppLayoutShell({
  pathname,
  search,
  onNavigate,
  onLogout,
  title,
  children,
}: AppLayoutShellProps) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOverrides, setDropdownOverrides] = useState<Record<string, boolean>>({});
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = interleaveByChildren(
    navItems.filter((item) => {
      if (item.hidden) return false;
      if (!item.restricted) return true;
      if (item.label === 'Master Data') {
        return INVENTORY_ROLES.includes(user?.role ?? '');
      }
      return user?.role === 'admin';
    })
  );

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

  const handleContentScroll = () => {};

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-zinc-950">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
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

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          navItems={navItems}
          onSearchResultClick={handleSearchResultClick}
        />

        <main
          ref={contentScrollRef}
          onScroll={handleContentScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
