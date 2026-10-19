import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { NavItem, NavChild } from '../navigation';

interface SearchEntry {
  label: string;
  parentLabel?: string;
  path: string;
  icon: any;
  key: string;
}

interface GlobalSearchProps {
  navItems: NavItem[];
  onResultClick: (path: string) => void;
}

export default function GlobalSearch({ navItems, onResultClick }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const searchEntries: SearchEntry[] = navItems.flatMap((parent) => {
    const entries: SearchEntry[] = [];
    if (parent.path) {
      entries.push({
        label: parent.label,
        path: parent.path,
        icon: parent.icon,
        key: parent.label,
      });
    }
    if (parent.children) {
      parent.children.forEach((child) => {
        entries.push({
          label: child.label,
          parentLabel: parent.label,
          path: child.path,
          icon: child.icon,
          key: `${parent.label}-${child.label}`,
        });
      });
    }
    return entries;
  });

  const filteredSearchEntries =
    searchQuery.trim() === ''
      ? searchEntries
      : searchEntries.filter((entry) => {
          const q = searchQuery.toLowerCase();
          return (
            entry.label.toLowerCase().includes(q) ||
            (entry.parentLabel && entry.parentLabel.toLowerCase().includes(q))
          );
        });

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
    <div ref={searchBoxRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Cari halaman..."
          className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-600 transition"
        />
      </div>

      {searchOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-80 overflow-y-auto z-40">
          {filteredSearchEntries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400 dark:text-zinc-500">Halaman tidak ditemukan.</p>
          ) : (
            filteredSearchEntries.map((entry) => {
              const EntryIcon = entry.icon;
              return (
                <button
                  key={entry.key}
                  onClick={() => handleResultClick(entry.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                >
                  <EntryIcon size={16} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                  <span className="flex-1 truncate">
                    {entry.parentLabel && (
                      <span className="text-slate-400 dark:text-zinc-500">{entry.parentLabel} / </span>
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
  );
}
