import { X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavItem, NavChild } from '../navigation';
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

// [DASHBOARD-V2] Sidebar netral (putih terang / graphite gelap). Logo gambar (/logo.png), tanda logo, dan blok profil dihapus; merek teks saja.
// Semua gaya lewat kelas .sb-* di index.css (tidak ikut override `html.dark .bg-white` dst).
export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  visibleNavItems,
  pathname,
  search: _search,
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
      className={`sb fixed lg:sticky top-0 left-0 h-screen w-64 flex flex-col z-50 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      <div className="sb-brand">
        <span>Marimas IT Vault</span>
        <button type="button" onClick={() => setSidebarOpen(false)} className="sb-x lg:hidden" aria-label="Tutup menu">
          <X size={20} />
        </button>
      </div>

      <nav className="sb-nav">
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

      <div className="sb-foot">
        <button type="button" onClick={handleLogout} className="sb-logout">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
