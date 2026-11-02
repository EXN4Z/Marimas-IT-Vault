import { LogOut, Vault } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { initials, matchesPrefix } from '../navigation';
import type { NavItem, NavChild } from '../navigation';
import SidebarItem from './SidebarItem';

interface SidebarProps {
  mobileOpen: boolean;
  closeMobile: () => void;
  visibleNavItems: NavItem[];
  pathname: string;
  isParentActive: (item: NavItem) => boolean;
  isDropdownOpen: (item: NavItem) => boolean;
  isChildActive: (child: NavChild, isFirst: boolean) => boolean;
  handleNavClick: (item: NavItem) => void;
  handleChildClick: (path: string) => void;
  onRailGroupClick: (item: NavItem) => void;
  handleLogout: () => void;
}

// Sidebar gabungan: rail ikon (48px, selalu tampil) + panel menu (248px, bisa ditutup) + scrim (mobile).
// Semua gaya lewat kelas .side/.rail/.panel/... di index.css (blok "MV SHELL"); tanpa utilitas Tailwind.
export default function Sidebar({
  mobileOpen,
  closeMobile,
  visibleNavItems,
  pathname,
  isParentActive,
  isDropdownOpen,
  isChildActive,
  handleNavClick,
  handleChildClick,
  onRailGroupClick,
  handleLogout,
}: SidebarProps) {
  const { user } = useAuth();

  const main = visibleNavItems.filter((i) => i.label !== 'Audit Log' && i.label !== 'Settings');
  const sys = visibleNavItems.filter((i) => i.label === 'Audit Log' || i.label === 'Settings');

  const renderRail = (item: NavItem) => {
    const Icon = item.icon;

    if (item.children) {
      return (
        <button
          type="button"
          key={item.label}
          className={`rb${isParentActive(item) ? ' on' : ''}`}
          data-tip={item.label}
          aria-label={item.label}
          onClick={() => onRailGroupClick(item)}
        >
          <Icon />
        </button>
      );
    }

    const active = matchesPrefix(pathname, item.matchPrefix) || item.path === pathname;
    return (
      <button
        type="button"
        key={item.label}
        className={`rb${active ? ' on' : ''}`}
        data-tip={item.label}
        aria-label={item.label}
        onClick={() => handleNavClick(item)}
      >
        <Icon />
      </button>
    );
  };

  const renderRow = (item: NavItem) => {
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
      />
    );
  };

  return (
    <>
      <aside className={`side${mobileOpen ? ' open' : ''}`}>
        <nav className="rail" aria-label="Menu cepat">
          <div className="logo"><Vault /></div>
          {main.map(renderRail)}
          <div className="grow" />
          {sys.map(renderRail)}
          <button type="button" className="rb out" data-tip="Sign Out" aria-label="Sign Out" onClick={handleLogout}>
            <LogOut />
          </button>
        </nav>

        <div className="panel">
          <div className="pin">
            <div className="brand">
              <b>Marimas IT Vault</b>
              <span>Manajemen Inventory IT</span>
            </div>
            <nav className="nav" aria-label="Menu utama">
              <div className="lbl">Menu</div>
              {main.map(renderRow)}
              <div className="lbl">Sistem</div>
              {sys.map(renderRow)}
            </nav>
            <div className="foot">
              <div className="user">
                <div className="av">{initials(user?.name)}</div>
                <p>
                  <b>{user?.name}</b>
                  <span>{user?.role}</span>
                </p>
              </div>
              <button type="button" className="so" onClick={handleLogout}>
                <LogOut />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className={`scrim${mobileOpen ? ' show' : ''}`} onClick={closeMobile} />
    </>
  );
}
