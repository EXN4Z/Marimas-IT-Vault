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

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

// Beberapa baris teks placeholder, baris terakhir dibikin lebih pendek
// (lastLineWidth) biar keliatan natural, mirip paragraf beneran.
export function SkeletonText({ lines = 1, className = '', lastLineWidth = '60%' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded"
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

// Placeholder bulat, dipakai buat avatar/icon (mis. foto karyawan, ikon kategori).
export function SkeletonCircle({ size = 40, className = '' }: SkeletonCircleProps) {
  return (
    <Skeleton
      className={`rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}