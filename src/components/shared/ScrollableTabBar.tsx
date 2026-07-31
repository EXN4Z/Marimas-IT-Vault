import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Tab bar horizontal yang bisa digeser sendiri di dalam boxnya (bukan
// ndorong seluruh halaman ke samping kayak sebelumnya), lengkap dengan:
// - fade gradient di kiri/kanan sebagai penanda masih ada tab di luar layar
// - tombol panah kecil buat geser (desktop/mouse)
// - scroll-snap biar swipe di HP kerasa "nempel" per tab, mirip toolbar Canva
// - auto-scroll ke tab yang lagi aktif kalau tab itu ada di luar area yang keliatan
//
// Dipakai bareng oleh semua halaman yang punya tab (Absensi, Inventaris,
// Penanganan Aset, Master Data, dst) supaya perilakunya konsisten & gak perlu
// nulis ulang logic scroll-nya tiap kali.

export interface ScrollableTabItem<T extends string> {
  key: T;
  label: string;
  // Bisa dikasih referensi komponen icon (mis. `Users` dari lucide-react, biar
  // ukurannya konsisten diatur di sini), ATAU elemen JSX yang udah jadi
  // (mis. `<Users size={16} />`) buat halaman yang sebelumnya udah render
  // icon-nya sendiri.
  icon?: React.ComponentType<{ size?: number | string; className?: string }> | React.ReactNode;
  badge?: number | null;
  badgeClassName?: string;
}

interface ScrollableTabBarProps<T extends string> {
  tabs: ScrollableTabItem<T>[];
  activeTab: T;
  onChange: (key: T) => void;
  className?: string;
}

export default function ScrollableTabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: ScrollableTabBarProps<T>) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
     
  }, [tabs.length]);

  // Pastikan tab aktif ikut ke-scroll ke area yang keliatan (mis. abis pindah
  // tab lewat cara lain selain klik langsung di bar ini).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    const id = setTimeout(updateScrollState, 300);
    return () => clearTimeout(id);
     
  }, [activeTab]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -140 : 140, behavior: 'smooth' });
  };

  return (
    <nav className={`relative ${className}`}>
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
      )}

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          aria-label="Geser tab ke kiri"
          className="absolute -left-1 top-1/2 -translate-y-1/2 -mt-1.5 z-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          aria-label="Geser tab ke kanan"
          className="absolute -right-1 top-1/2 -translate-y-1/2 -mt-1.5 z-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
        >
          <ChevronRight size={14} />
        </button>
      )}

      <ul
        ref={scrollRef}
        className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto scroll-smooth snap-x snap-proximity touch-pan-x"
      >
        {tabs.map((t) => {
          const isComponent = typeof t.icon === 'function';
          const IconComponent = isComponent
            ? (t.icon as React.ComponentType<{ size?: number | string; className?: string }>)
            : null;
          return (
            <li key={t.key} className="shrink-0 snap-start">
              <button
                type="button"
                data-tab={t.key}
                onClick={() => onChange(t.key)}
                className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === t.key
                    ? 'border-slate-900 text-slate-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {IconComponent ? <IconComponent size={16} /> : (t.icon as React.ReactNode)}
                {t.label}
                {t.badge != null && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      t.badgeClassName ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}