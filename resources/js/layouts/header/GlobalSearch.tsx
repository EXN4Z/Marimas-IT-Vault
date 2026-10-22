import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavItem } from '../navigation';

// [LAYOUT-LAMA] Kotak search seperti frontend lama. navItems = menu yang sudah difilter role (visibleNavItems),
// dan child dropdown ikut difilter per-role, jadi user tidak melihat halaman yang tidak bisa dia buka.
interface SearchEntry {
  label: string;
  parentLabel?: string;
  path: string;
  icon: NavItem['icon'];
  key: string;
}

interface GlobalSearchProps {
  navItems: NavItem[];
  onResultClick: (path: string) => void;
}

export default function GlobalSearch({ navItems, onResultClick }: GlobalSearchProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const searchEntries: SearchEntry[] = navItems.flatMap((item) => {
    if (item.children) {
      return item.children
        .filter((child) => !child.roles || child.roles.includes(user?.role ?? ''))
        .map((child) => ({
          key: `${item.label}-${child.label}`,
          label: child.label,
          parentLabel: item.label,
          icon: child.icon,
          path: child.path,
        }));
    }
    if (!item.path) return [];
    return [{ key: item.label, label: item.label, icon: item.icon, path: item.path }];
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

  // klik di luar kotak search (input + dropdown) menutup dropdown-nya
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (path: string) => {
    onResultClick(path);
    setSearchOpen(false);
    setSearchQuery('');
  };

  return (
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
        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#202024] border border-slate-200 dark:border-[#383842] rounded-lg text-sm transition focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-zinc-600 dark:focus:border-[#5c5c68]"
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
                  onClick={() => handleResultClick(entry.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100 transition"
                >
                  <EntryIcon size={16} className="text-slate-400 shrink-0" />
                  <span className="flex-1 truncate">
                    {entry.parentLabel && <span className="text-slate-400">{entry.parentLabel} / </span>}
                    {entry.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
