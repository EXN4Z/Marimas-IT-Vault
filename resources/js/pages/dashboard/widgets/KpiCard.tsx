import { ArrowRight, type LucideIcon } from 'lucide-react';

// ==== DEGO KPI card: icon left, small uppercase label, BIG value, trend badge, footer link ====
const KPI_CONFIG = {
  default: {
    accent: '#5A32FA',
    bg: 'bg-[#EFEAFF] dark:bg-indigo-950/40 dark:border dark:border-indigo-700/30',
    text: 'text-[#5A32FA] dark:text-indigo-300',
    badge: 'dark:bg-indigo-400/20 dark:text-indigo-200 dark:border dark:border-indigo-400/30',
  },
  emerald: {
    accent: '#34A853',
    bg: 'bg-[#E7F6EC] dark:bg-emerald-950/40 dark:border dark:border-emerald-700/30',
    text: 'text-[#34A853] dark:text-emerald-300',
    badge: 'dark:bg-emerald-400/20 dark:text-emerald-200 dark:border dark:border-emerald-400/30',
  },
  amber: {
    accent: '#F5A623',
    bg: 'bg-[#FEF5E1] dark:bg-amber-950/40 dark:border dark:border-amber-700/30',
    text: 'text-[#F5A623] dark:text-amber-300',
    badge: 'dark:bg-amber-400/20 dark:text-amber-200 dark:border dark:border-amber-400/30',
  },
  rose: {
    accent: '#F2453D',
    bg: 'bg-[#FDECEB] dark:bg-rose-950/40 dark:border dark:border-rose-700/30',
    text: 'text-[#F2453D] dark:text-rose-300',
    badge: 'dark:bg-rose-400/20 dark:text-rose-200 dark:border dark:border-rose-400/30',
  },
  sky: {
    accent: '#2F80ED',
    bg: 'bg-[#E8F1FD] dark:bg-sky-950/40 dark:border dark:border-sky-700/30',
    text: 'text-[#2F80ED] dark:text-sky-300',
    badge: 'dark:bg-sky-400/20 dark:text-sky-200 dark:border dark:border-sky-400/30',
  },
  orange: {
    accent: '#F2994A',
    bg: 'bg-[#FEF1E7] dark:bg-amber-950/40 dark:border dark:border-amber-700/30',
    text: 'text-[#F2994A] dark:text-amber-300',
    badge: 'dark:bg-amber-400/20 dark:text-amber-200 dark:border dark:border-amber-400/30',
  },
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
  hint,
  badge,
  progress,
  onClick,
  detailLabel,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone?: keyof typeof KPI_CONFIG;
  hint?: string;
  badge?: string;
  progress?: number;
  onClick?: () => void;
  detailLabel?: string;
  className?: string;
}) {
  const cfg = KPI_CONFIG[tone] || KPI_CONFIG.default;
  return (
    <div
      className={`bg-white dark:bg-[#18181b] dark:border dark:border-[#2c2c31] rounded-2xl p-4 shadow-[0_4px_24px_rgba(23,22,51,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_8px_32px_rgba(23,22,51,0.10)] transition-all flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* DEGO-style icon square */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#A9A9C6] dark:text-zinc-400 uppercase tracking-wider truncate" title={label}>
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-extrabold text-[#171633] dark:text-white tracking-tight leading-none">{value}</span>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text} ${cfg.badge} leading-none`}>
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DEGO-style slim progress */}
      {progress !== undefined && (
        <div className="w-full bg-[#F0F1F7] dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: cfg.accent }}
          />
        </div>
      )}

      {/* Footer: clickable "Lihat detail" link when onClick given, otherwise a plain hint line */}
      {onClick ? (
        <button
          onClick={onClick}
          className={`flex items-center gap-1 text-[11px] font-bold ${cfg.text} hover:underline w-fit`}
        >
          {detailLabel ?? hint ?? 'Lihat detail'}
          <ArrowRight size={11} />
        </button>
      ) : (
        progress === undefined && hint && (
          <p className="text-[11px] text-[#A9A9C6] dark:text-zinc-400 font-medium truncate">{hint}</p>
        )
      )}
    </div>
  );
}
