// Barrel export biar pemanggil cukup:
//   import { Skeleton, SkeletonTable, SkeletonCardGrid } from '../shared/skeleton';
// tanpa perlu nunjuk file satu-satu di dalam folder ini.

export { default as Skeleton, SkeletonText, SkeletonCircle } from './Skeleton';
export { default as SkeletonTableRow, SkeletonTable, SkeletonListCard } from './SkeletonTableRow';
export { default as SkeletonCard, SkeletonCardGrid } from './SkeletonCard';
export { default as SkeletonChart, SkeletonDonutChart } from './SkeletonChart';