import type { LucideIcon } from 'lucide-react';

export function LegendDot({ color, label, value, subvalue }: { color: string; label: string; value: number | string; subvalue?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <div className="flex items-center gap-2 text-[#666687] dark:text-zinc-300 truncate min-w-0 pr-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="truncate font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="font-bold text-[#171633] dark:text-white text-xs">{value}</span>
        {subvalue && <span className="text-[10px] text-[#A9A9C6] dark:text-zinc-400">({subvalue})</span>}
      </div>
    </div>
  );
}

// ==== DEGO-style icon: bigger, soft color square, bigger radius ====
export function CardIcon({ icon: Icon, tone = 'violet' }: { icon: LucideIcon; tone?: 'violet' | 'orange' | 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'slate' }) {
  const toneMap: Record<string, string> = {
    orange: 'bg-[#FEF1E7] text-[#F2994A] dark:bg-amber-950/40 dark:text-amber-300 dark:border dark:border-amber-700/30',
    emerald: 'bg-[#E7F6EC] text-[#34A853] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border dark:border-emerald-700/30',
    amber: 'bg-[#FEF5E1] text-[#F5A623] dark:bg-amber-950/40 dark:text-amber-300 dark:border dark:border-amber-700/30',
    rose: 'bg-[#FDECEB] text-[#F2453D] dark:bg-rose-950/40 dark:text-rose-300 dark:border dark:border-rose-700/30',
    sky: 'bg-[#E8F1FD] text-[#2F80ED] dark:bg-sky-950/40 dark:text-sky-300 dark:border dark:border-sky-700/30',
    indigo: 'bg-[#EFEAFF] text-[#5A32FA] dark:bg-indigo-950/40 dark:text-indigo-300 dark:border dark:border-indigo-700/30',
    slate: 'bg-[#F0F1F7] text-[#666687] dark:bg-zinc-800 dark:text-zinc-300 dark:border dark:border-zinc-700/40',
    violet: 'bg-[#EFEAFF] text-[#5A32FA] dark:bg-indigo-950/40 dark:text-indigo-300 dark:border dark:border-indigo-700/30',
  };
  const toneClass = toneMap[tone] || toneMap.violet;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toneClass}`}>
      <Icon size={18} strokeWidth={2} />
    </div>
  );
}

// Reusable DEGO-style card header block
export function SectionHeader({
  icon,
  tone,
  title,
  subtitle,
  right,
}: {
  icon: LucideIcon;
  tone?: 'violet' | 'orange' | 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'slate';
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <CardIcon icon={icon} tone={tone} />
        <div>
          <h3 className="text-sm font-bold text-[#171633] dark:text-white leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-[#A9A9C6] dark:text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ==== Primary CTA button (DEGO-style "+ Add Product" pill) ====
export function PrimaryActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#5A32FA] hover:bg-[#4C3FE0] px-4 py-2.5 rounded-xl shadow-[0_4px_14px_rgba(90,50,250,0.28)] transition-colors whitespace-nowrap"
    >
      {Icon && <Icon size={15} strokeWidth={2.4} />}
      {label}
    </button>
  );
}
