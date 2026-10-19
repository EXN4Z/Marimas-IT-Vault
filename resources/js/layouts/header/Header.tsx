import { Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationDropdown from '../../features/notifications/NotificationDropDown';
import GlobalSearch from './GlobalSearch';
import { initials } from '../navigation';
import type { NavItem } from '../navigation';

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
    <header className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
      >
        <Menu size={20} />
      </button>

      {title && (
        <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white hidden sm:block">
          {title}
        </h1>
      )}

      <GlobalSearch navItems={navItems} onResultClick={onSearchResultClick} />

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label="Toggle Mode Gelap"
          className="p-2 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationDropdown />

        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 dark:border-zinc-700">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 capitalize">{user?.role || 'guest'}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-zinc-300">
            {initials(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
