import {
  Skeleton,
  SkeletonCardGrid,
  SkeletonChart,
  SkeletonDonutChart,
  SkeletonTable,
} from '../../../components/shared/skeleton';
import { cardClass } from './theme';

// ==== Skeleton loading buat Dashboard, niru layout asli tiap varian biar
// gak "loncat" pas data beneran datang. Dipakai selagi useDashboardCore()/
// useDashboardAnalytics() masih loading. ====
// - 'simple' = DashboardUser (dipakai semua role non-reviewer, termasuk
//   cabang): header + 4 KPI + 2 card + calendar
// - 'full'   = DashboardAdmin: 'simple' + row chart (hero+donut) + tabel aktivitas + 3 card operasional
export function DashboardSkeleton({ variant = 'simple' }: { variant?: 'simple' | 'full' }) {
  return (
    <div className="space-y-3">
      {/* Header: niru WelcomeHeader (nama+tanggal, badge role/departemen/online) */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <SkeletonCardGrid count={4} />

      {variant === 'full' && (
        <>
          {/* Chart row: hero tren + donut status */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-3 items-stretch">
            <div className="xl:col-span-7">
              <SkeletonChart height={220} />
            </div>
            <div className="xl:col-span-5">
              <SkeletonDonutChart />
            </div>
          </div>

          {/* Tabel riwayat aktivitas full-width */}
          <div className={cardClass}>
            <Skeleton className="h-4 w-40 rounded mb-4" />
            <table className="w-full text-sm">
              <tbody>
                <SkeletonTable columns={4} rows={5} />
              </tbody>
            </table>
          </div>

          {/* 3-col operasional card */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cardClass}>
                <Skeleton className="h-4 w-32 rounded mb-4" />
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 2-col: Departemen + Notifikasi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={cardClass}>
            <Skeleton className="h-4 w-32 rounded mb-4" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-full rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className={cardClass}>
        <Skeleton className="h-4 w-36 rounded mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
