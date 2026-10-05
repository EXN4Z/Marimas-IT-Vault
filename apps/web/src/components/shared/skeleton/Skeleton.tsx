import type { CSSProperties } from 'react';

// Building block skeleton loading yang dipakai di seluruh halaman.
// Semua turunan (SkeletonTableRow, SkeletonCard, SkeletonChart, dst) compose
// dari <Skeleton /> ini, jadi kalau mau ganti warna/animasi cukup di sini.

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

// Block dasar: kotak abu-abu yang "napas" (animate-pulse). Ukuran & bentuk
// (lebar, tinggi, rounded-full buat avatar, dst) diatur lewat className
// dari pemanggilnya, contoh: <Skeleton className="h-4 w-32 rounded" />
export default function Skeleton({ className = '', style }: SkeletonProps) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} style={style} />;
}
