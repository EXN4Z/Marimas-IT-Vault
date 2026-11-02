import type { CSSProperties } from 'react';

// Building block skeleton loading yang dipakai di seluruh halaman.
// Semua turunan (SkeletonTable, SkeletonListCard, dst) compose dari <Skeleton /> ini,
// jadi kalau mau ganti warna/animasi cukup di kelas .sk (index.css).
// Warna ikut token tema (--dv-track), jadi balok skeleton otomatis cocok dengan kartu baru di mode terang & gelap.

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

// Block dasar. Ukuran & bentuk (lebar, tinggi, rounded-full buat avatar, dst) diatur lewat className
// dari pemanggilnya, contoh: <Skeleton className="h-4 w-32 rounded" />
export default function Skeleton({ className = '', style }: SkeletonProps) {
  return <div aria-hidden="true" className={`sk ${className}`} style={style} />;
}
