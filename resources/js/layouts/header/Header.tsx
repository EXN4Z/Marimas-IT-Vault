import { PanelLeft, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationDropdown from '../../features/notifications/NotificationDropDown';
import GlobalSearch from './GlobalSearch';
import { initials } from '../navigation';
import type { NavItem } from '../navigation';

// Top bar (.top): toggle panel, breadcrumb, pencarian menu, tema, notifikasi, avatar + nama + role.
// Gaya lewat kelas di index.css (blok "MV SHELL").
interface HeaderProps {
  group: string;
  current: string;
  onTogglePanel: () => void;
  navItems: NavItem[];
  onSearchResultClick: (path: string) => void;
}

export default function Header({ group, current, onTogglePanel, navItems, onSearchResultClick }: HeaderProps) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="top">
      <button type="button" className="tg" aria-label="Buka/tutup sidebar" onClick={onTogglePanel}>
        <PanelLeft />
      </button>
      <span className="sep" />
      <div className="crumb">
        {current ? (
          <>
            {group ? (
              <>
                <span>{group}</span>
                <span>›</span>
              </>
            ) : (
              <>
                <span>Marimas IT Vault</span>
                <span>›</span>
              </>
            )}
            <b>{current}</b>
          </>
        ) : (
          <b>Marimas IT Vault</b>
        )}
      </div>
      <GlobalSearch navItems={navItems} onResultClick={onSearchResultClick} />
      <div className="acts">
        <button
          type="button"
          className="tg"
          aria-label="Ganti tema"
          onClick={(e) => toggleTheme(e.currentTarget)}
        >
          {isDark ? <Sun /> : <Moon />}
        </button>
        <NotificationDropdown />
        <div className="me">
          <div className="av">{initials(user?.name)}</div>
          <p>
            <b>{user?.name}</b>
            <span>{user?.role}</span>
          </p>
        </div>
      </div>
    </header>
  );
}