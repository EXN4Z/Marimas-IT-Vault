import Skeleton from './Skeleton';

// Placeholder buat card chart di Dashboard (AreaChart/PieChart di
// RingkasanInventoryCard, StatusInventoryDonutCard, dst). Bentuknya
// dibikin generik -- card putih + judul palsu + area chart placeholder --
// karena tiap chart card punya isi beda tapi bungkusnya mirip semua.

interface SkeletonChartProps {
  className?: string;
  height?: number;
}

export default function SkeletonChart({ className = '', height = 220 }: SkeletonChartProps) {
  return (
    <div
      className={`bg-white rounded-lg p-4 shadow-[0_4px_24px_rgba(23,22,51,0.06)] flex flex-col gap-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 rounded w-1/3" />
        <Skeleton className="h-6 rounded-md w-20" />
      </div>
      <Skeleton className="rounded-lg w-full" style={{ height }} />
    </div>
  );
}

// Variasi bulat, buat donut/pie chart card (mis. StatusInventoryDonutCard)
// yang layoutnya lingkaran di tengah + legend di samping/bawah.
export function SkeletonDonutChart({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-white rounded-lg p-4 shadow-[0_4px_24px_rgba(23,22,51,0.06)] flex flex-col gap-4 ${className}`}
    >
      <Skeleton className="h-3.5 rounded w-1/3" />
      <div className="flex items-center gap-6">
        <Skeleton className="w-32 h-32 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
              <Skeleton className="h-3 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}