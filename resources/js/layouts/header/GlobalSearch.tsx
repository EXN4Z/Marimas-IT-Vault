import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavItem } from '../navigation';

// Kotak pencarian menu di top bar (.search / .res di index.css, blok "MV SHELL"). navItems = menu yang sudah difilter role (visibleNavItems),
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

  // Pencocokan berdasarkan label menu (case-insensitive, includes); dropdown hanya tampil bila query tidak kosong.
  const q = searchQuery.trim().toLowerCase();
  const results = q === '' ? [] : searchEntries.filter((entry) => entry.label.toLowerCase().includes(q));

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
    <div className="search" ref={searchBoxRef}>
      <Search />
      <input
        placeholder="Cari menu…"
        autoComplete="off"
        aria-label="Cari menu"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setSearchOpen(true);
        }}
        onClick={() => setSearchOpen(true)}
        onFocus={() => setSearchOpen(true)}
      />
      <div className={`res${searchOpen && searchQuery.trim() ? ' show' : ''}`}>
        {results.length ? (
          results.map((r) => {
            const EntryIcon = r.icon;
            return (
              <button type="button" key={r.key} onClick={() => handleResultClick(r.path)}>
                <EntryIcon />
                {r.label}
                <small>{r.parentLabel ?? ''}</small>
              </button>
            );
          })
        ) : (
          <p>Menu tidak ditemukan</p>
        )}
      </div>
    </div>
  );
}
