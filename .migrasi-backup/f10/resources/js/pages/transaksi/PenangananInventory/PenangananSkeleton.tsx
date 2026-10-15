import { Skeleton, SkeletonListCard } from '../../../components/shared/skeleton';

export default function PenangananSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <Skeleton className="h-3 w-28 rounded mb-3" />
            <Skeleton className="h-8 w-16 rounded mb-2" />
            <Skeleton className="h-3 w-36 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <SkeletonListCard rows={5} />
        </div>
      </div>
    </div>
  );
}
