// ==== DEGO-style theme ====
export const THEME = {
  violet: '#5A32FA',
  violetDark: '#4C3FE0',
  emerald: '#34A853',
  amber: '#F5A623',
  rose: '#F2453D',
  orange: '#F2994A',
  sky: '#2F80ED',
  purple: '#9B51E0',
  indigo: '#5A32FA',
  teal: '#0D9488',
  slate: '#64748B',
  grid: '#EEF0F7',
  axis: '#A9A9C6',
  bg: '#F7F8FC',
  ink: '#171633',
};

// DEGO card: white, big radius, soft shadow, no border (with dark graphite styling)
export const cardClass =
  'bg-white dark:bg-[#18181b] dark:border dark:border-[#2c2c31] rounded-2xl p-4 sm:p-5 shadow-[0_4px_24px_rgba(23,22,51,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_8px_32px_rgba(23,22,51,0.10)] transition-all flex flex-col justify-between';

// Badge tone -> bg/text classes, shared by KPI delta chips & table status pills
export const BADGE_TONE: Record<string, string> = {
  violet: 'bg-[#EFEAFF] text-[#5A32FA] dark:bg-indigo-950/50 dark:text-indigo-300 dark:border dark:border-indigo-700/30',
  orange: 'bg-[#FEF1E7] text-[#F2994A] dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-700/30',
  emerald: 'bg-[#E7F6EC] text-[#34A853] dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-700/30',
  amber: 'bg-[#FEF5E1] text-[#F5A623] dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-700/30',
  rose: 'bg-[#FDECEB] text-[#F2453D] dark:bg-rose-950/50 dark:text-rose-300 dark:border dark:border-rose-700/30',
  sky: 'bg-[#E8F1FD] text-[#2F80ED] dark:bg-sky-950/50 dark:text-sky-300 dark:border dark:border-sky-700/30',
  indigo: 'bg-[#EFEAFF] text-[#5A32FA] dark:bg-indigo-950/50 dark:text-indigo-300 dark:border dark:border-indigo-700/30',
  slate: 'bg-[#F0F1F7] text-[#666687] dark:bg-zinc-800 dark:text-zinc-300 dark:border dark:border-zinc-700/40',
};
