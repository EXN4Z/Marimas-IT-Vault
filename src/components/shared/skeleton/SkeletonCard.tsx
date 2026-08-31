import Skeleton from './Skeleton';

// Placeholder buat KPI/stat card di Dashboard (KpiCard di Shared.tsx):
// icon square 44px + label kecil + angka besar, dibungkus card putih
// yang sama persis (bg-white rounded-lg p-4 shadow-...) biar transisi
// skeleton -> data beneran gak keliatan "loncat".

interface SkeletonCardProps {
  className?: string;
}

export default function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`bg-white rounded-lg p-4 shadow-[0_4px_24px_rgba(23,22,51,0.06)] flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 rounded w-2/3" />
          <Skeleton className="h-5 rounded w-1/3" />
        </div>
      </div>
      <Skeleton className="h-1.5 rounded-full w-full" />
    </div>
  );
}

// Beberapa KpiCard sekaligus dalam grid -- dipakai pas dashboard masih
// loading, gantiin baris KpiCard yang beneran.
export function SkeletonCardGrid({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}