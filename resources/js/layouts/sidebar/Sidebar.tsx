import { X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavItem, NavChild } from '../navigation';
import { matchesPrefix } from '../navigation';
import SidebarItem from './SidebarItem';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  visibleNavItems: NavItem[];
  pathname: string;
  search: string;
  isParentActive: (item: NavItem) => boolean;
  isDropdownOpen: (item: NavItem) => boolean;
  isChildActive: (child: NavChild, isFirst: boolean) => boolean;
  handleNavClick: (item: NavItem) => void;
  handleChildClick: (path: string) => void;
  handleLogout: () => void;
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  visibleNavItems,
  pathname,
  search,
  isParentActive,
  isDropdownOpen,
  isChildActive,
  handleNavClick,
  handleChildClick,
  handleLogout,
}: SidebarProps) {
  const { user } = useAuth();

  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white flex flex-col z-50 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      <div className="flex items-center justify-between px-6 h-18 shrink-0">
        <div className="flex p-1 items-center mx-auto gap-2">
          <img src={`/logo.png`} alt="Marimas IT Vault" className="h-18 w-auto p-1 relative top-2" />
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const showDivider = item.label === 'Audit Log';
          const visibleChildren = item.children
            ? item.children.filter((child) => !child.roles || child.roles.includes(user?.role ?? ''))
            : [];

          return (
            <SidebarItem
              key={item.label}
              item={item}
              pathname={pathname}
              isParentActive={isParentActive(item)}
              isDropdownOpen={isDropdownOpen(item)}
              visibleChildren={visibleChildren}
              isChildActive={isChildActive}
              onItemClick={() => handleNavClick(item)}
              onChildClick={handleChildClick}
              showDivider={showDivider}
            />
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-zinc-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-300 transition"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
