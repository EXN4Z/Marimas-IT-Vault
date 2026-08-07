import type { ReactNode } from 'react';

// Pill status seragam (mis. "Tersedia", "Berhasil Diperbaiki", "Level 3")
// dipakai di semua tab Inventaris. colorClass diisi kombinasi warna
// Tailwind punya masing-masing status (mis. 'bg-emerald-50 text-emerald-700'),
// size ngatur ukuran teks/padding-nya biar tetep konsisten walau kepake di
// tempat yang beda (tabel vs baris ringkas vs card detail).

type BadgeSize = 'xs' | 'sm';

const SIZE_CLASS: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-2 py-0.5',
  sm: 'text-xs px-2.5 py-1',
};

interface StatusBadgeProps {
  colorClass: string;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
}

export default function StatusBadge({ colorClass, size = 'sm', className = '', children }: StatusBadgeProps) {
  return (
    <span className={`inline-block rounded-full font-medium whitespace-nowrap ${SIZE_CLASS[size]} ${colorClass} ${className}`}>
      {children}
    </span>
  );
}