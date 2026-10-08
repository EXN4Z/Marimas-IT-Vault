// Barrel export biar pemanggil cukup:
//   import { Skeleton, SkeletonTable, SkeletonCardGrid } from '../shared/skeleton';
// tanpa perlu nunjuk file satu-satu di dalam folder ini.

export { default as Skeleton } from './Skeleton';
export { SkeletonTable, SkeletonListCard } from './SkeletonTableRow';
export { SkeletonCardGrid } from './SkeletonCard';
export { default as SkeletonChart, SkeletonDonutChart } from './SkeletonChart';
