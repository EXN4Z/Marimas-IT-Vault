import { Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationDropdown from '../../features/notifications/NotificationDropDown';
import GlobalSearch from './GlobalSearch';
import { initials } from '../navigation';
import type { NavItem } from '../navigation';

// [LAYOUT-LAMA] Top bar dikembalikan persis seperti frontend lama: tanpa garis bawah (menyatu dengan sidebar),
// judul halaman besar, search di tengah, lalu toggle tema, notifikasi, avatar + nama.
interface HeaderProps {
  title?: string;
  onMenuClick: () => void;
  navItems: NavItem[];
  onSearchResultClick: (path: string) => void;
}

export default function Header({ title, onMenuClick, navItems, onSearchResultClick }: HeaderProps) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="h-18 min-h-18 shrink-0 bg-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-slate-600">
          <Menu size={22} />
        </button>
        <h1 className="text-xl font-bold text-slate-900 hidden sm:block">{title}</h1>
      </div>

      <GlobalSearch navItems={navItems} onResultClick={onSearchResultClick} />

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tombol Toggle Mode Gelap / Terang */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label="Toggle Mode Gelap"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
        >
          {isDark ? (
            <Sun size={20} className="text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon size={20} className="text-slate-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

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
  );
}
