import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Boxes,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  ArrowRight,
  Bell,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Package,
  Layers,
  Activity,
  Building2,
  CheckCircle2,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from '../../components/shared/Select';
import type { User as UserType } from '../../types/user';
import type {
  NotificationItem,
  RingkasanInventory,
  InventoryPerhatian,
  TrenPembelianInventory,
  StatusInventoryDistribusi,
  AktivitasInventoryTerbaru,
  InventoryPerMerek,
  DepartemenDistribusi,
} from './useDashboardData';
import { Skeleton, SkeletonCardGrid, SkeletonChart, SkeletonDonutChart, SkeletonTable } from '../../components/shared/skeleton';

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

// DEGO card: white, big radius, soft shadow, no border
export const cardClass =
  'bg-white rounded-2xl p-4 sm:p-5 shadow-[0_4px_24px_rgba(23,22,51,0.06)] hover:shadow-[0_8px_32px_rgba(23,22,51,0.10)] transition-shadow flex flex-col justify-between';

export const NOTIF_VISIBLE_COUNT = 3;

export function LegendDot({ color, label, value, subvalue }: { color: string; label: string; value: number | string; subvalue?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <div className="flex items-center gap-2 text-[#666687] truncate min-w-0 pr-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="truncate font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="font-bold text-[#171633] text-xs">{value}</span>
        {subvalue && <span className="text-[10px] text-[#A9A9C6]">({subvalue})</span>}
      </div>
    </div>
  );
}

// ==== DEGO-style icon: bigger, soft color square, bigger radius ====
export function CardIcon({ icon: Icon, tone = 'violet' }: { icon: LucideIcon; tone?: 'violet' | 'orange' | 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'slate' }) {
  const toneMap: Record<string, string> = {
    orange: 'bg-[#FEF1E7] text-[#F2994A]',
    emerald: 'bg-[#E7F6EC] text-[#34A853]',
    amber: 'bg-[#FEF5E1] text-[#F5A623]',
    rose: 'bg-[#FDECEB] text-[#F2453D]',
    sky: 'bg-[#E8F1FD] text-[#2F80ED]',
    indigo: 'bg-[#EFEAFF] text-[#5A32FA]',
    slate: 'bg-[#F0F1F7] text-[#666687]',
    violet: 'bg-[#EFEAFF] text-[#5A32FA]',
  };
  const toneClass = toneMap[tone] || toneMap.violet;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toneClass}`}>
      <Icon size={18} strokeWidth={2} />
    </div>
  );
}

// Badge tone -> bg/text classes, shared by KPI delta chips & table status pills
const BADGE_TONE: Record<string, string> = {
  violet: 'bg-[#EFEAFF] text-[#5A32FA]',
  orange: 'bg-[#FEF1E7] text-[#F2994A]',
  emerald: 'bg-[#E7F6EC] text-[#34A853]',
  amber: 'bg-[#FEF5E1] text-[#F5A623]',
  rose: 'bg-[#FDECEB] text-[#F2453D]',
  sky: 'bg-[#E8F1FD] text-[#2F80ED]',
  indigo: 'bg-[#EFEAFF] text-[#5A32FA]',
  slate: 'bg-[#F0F1F7] text-[#666687]',
};

// Reusable DEGO-style card header block
function SectionHeader({
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
          <h3 className="text-sm font-bold text-[#171633] leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-[#A9A9C6] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

const GREETING_ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  hr: 'HR & Kepegawaian',
  manajer: 'Manajer Operasional',
  karyawan: 'Staff / Karyawan',
  cabang: 'Staff Cabang',
};

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
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

export function WelcomeHeader({ user, action }: { user?: UserType | null; action?: React.ReactNode }) {
  if (!user) return null;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user.name?.split(' ')[0] ?? user.name;

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#171633] leading-tight">
            {greetingWord()}, {firstName}!
          </h2>
          <p className="text-xs text-[#A9A9C6] font-medium capitalize mt-1">{today}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-white bg-[#171633] px-3 py-1.5 rounded-lg whitespace-nowrap">
          {GREETING_ROLE_LABEL[user.role] ?? user.role}
        </span>
        {user.departemen?.nama && (
          <span className="text-[11px] font-medium text-[#666687] bg-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-[0_2px_8px_rgba(23,22,51,0.06)]">
            {user.departemen.nama}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#34A853] bg-[#E7F6EC] px-3 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse" />
          Online
        </span>
      </div>
    </div>
  );
}

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

// ==== DEGO KPI card: icon left, small uppercase label, BIG value, trend badge, footer link ====
const KPI_CONFIG = {
  default: { accent: '#5A32FA', bg: 'bg-[#EFEAFF]', text: 'text-[#5A32FA]' },
  emerald: { accent: '#34A853', bg: 'bg-[#E7F6EC]', text: 'text-[#34A853]' },
  amber: { accent: '#F5A623', bg: 'bg-[#FEF5E1]', text: 'text-[#F5A623]' },
  rose: { accent: '#F2453D', bg: 'bg-[#FDECEB]', text: 'text-[#F2453D]' },
  sky: { accent: '#2F80ED', bg: 'bg-[#E8F1FD]', text: 'text-[#2F80ED]' },
  orange: { accent: '#F2994A', bg: 'bg-[#FEF1E7]', text: 'text-[#F2994A]' },
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
      className={`bg-white rounded-lg p-4 shadow-[0_4px_24px_rgba(23,22,51,0.06)] hover:shadow-[0_8px_32px_rgba(23,22,51,0.10)] transition-all flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* DEGO-style icon square */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#A9A9C6] uppercase tracking-wider truncate" title={label}>
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-extrabold text-[#171633] tracking-tight leading-none">{value}</span>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text} leading-none`}>
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DEGO-style slim progress */}
      {progress !== undefined && (
        <div className="w-full bg-[#F0F1F7] h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: cfg.accent }}
          />
        </div>
      )}

      {/* Footer: clickable "Lihat detail" link (DEGO "View net income >" pattern) when onClick given,
          otherwise a plain hint line. */}
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
          <p className="text-[11px] text-[#A9A9C6] font-medium truncate">{hint}</p>
        )
      )}
    </div>
  );
}

// ==== Ringkasan Status Inventory Card ====
export function RingkasanInventoryCard({
  ringkasanInventory,
  compact,
}: {
  ringkasanInventory?: RingkasanInventory;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const inventoryTotal = ringkasanInventory?.total ?? 0;
  const inventoryTersedia = ringkasanInventory?.tersedia ?? 0;
  const inventoryDipakai = ringkasanInventory?.dipakai ?? 0;
  const inventoryRusakBerat = ringkasanInventory?.rusakBerat ?? 0;
  const inventoryDijual = ringkasanInventory?.dijual ?? 0;
  const tersediaPct = inventoryTotal > 0 ? (inventoryTersedia / inventoryTotal) * 100 : 0;
  const dipakaiPct = inventoryTotal > 0 ? (inventoryDipakai / inventoryTotal) * 100 : 0;
  const rusakBeratPct = inventoryTotal > 0 ? (inventoryRusakBerat / inventoryTotal) * 100 : 0;
  const dijualPct = inventoryTotal > 0 ? (inventoryDijual / inventoryTotal) * 100 : 0;
  const tersediaRatePct = inventoryTotal > 0 ? Math.round((inventoryTersedia / inventoryTotal) * 100) : 0;

  return (
    <div className={`${cardClass} ${compact ? 'lg:max-w-md' : ''}`}>
      <div>
        <SectionHeader
          icon={Boxes}
          tone="violet"
          title="Status Inventory"
          subtitle="Komposisi ketersediaan barang"
          right={
            <button
              onClick={() => navigate('/master-data?tab=inventory')}
              className="text-[11px] font-semibold text-[#5A32FA] hover:text-[#4C3FE0] flex items-center gap-1 bg-[#EFEAFF] px-2.5 py-1 rounded-lg"
            >
              Buka <ArrowRight size={12} />
            </button>
          }
        />

        {/* DEGO-style highlight: big number + green badge */}
        <div className="flex items-center justify-between bg-[#F7F8FC] rounded-xl p-3.5 my-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#A9A9C6] tracking-wider">Total Terdaftar</span>
            <p className="text-3xl font-extrabold text-[#171633] leading-none mt-1">{inventoryTotal}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#34A853] bg-white px-3 py-1.5 rounded-lg shadow-[0_2px_8px_rgba(23,22,51,0.06)]">
            <CheckCircle2 size={13} />
            {tersediaRatePct}%
          </span>
        </div>

        {/* Multi-segment progress */}
        <div className="flex w-full h-2 rounded-full overflow-hidden bg-[#F0F1F7] my-2">
          {inventoryTotal > 0 ? (
            <>
              <div style={{ width: `${tersediaPct}%`, background: THEME.emerald }} title={`Tersedia: ${inventoryTersedia}`} />
              <div style={{ width: `${dipakaiPct}%`, background: THEME.violet }} title={`Dipakai: ${inventoryDipakai}`} />
              <div style={{ width: `${rusakBeratPct}%`, background: THEME.rose }} title={`Rusak Berat: ${inventoryRusakBerat}`} />
              <div style={{ width: `${dijualPct}%`, background: '#A9A9C6' }} title={`Dijual: ${inventoryDijual}`} />
            </>
          ) : (
            <div className="w-full h-full bg-[#F0F1F7]" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-3 border-t border-[#F0F1F7] mt-2">
        <LegendDot color={THEME.emerald} label="Tersedia" value={inventoryTersedia} subvalue={`${Math.round(tersediaPct)}%`} />
        <LegendDot color={THEME.violet} label="Dipakai" value={inventoryDipakai} subvalue={`${Math.round(dipakaiPct)}%`} />
        <LegendDot color={THEME.rose} label="Rusak Berat" value={inventoryRusakBerat} subvalue={`${Math.round(rusakBeratPct)}%`} />
        <LegendDot color="#A9A9C6" label="Dijual" value={inventoryDijual} subvalue={`${Math.round(dijualPct)}%`} />
      </div>
    </div>
  );
}

// ==== Hero Chart: Tren Pembelian Inventory ====
export function HeroTrenPembelianInventoryChart({
  trenPembelianInventory = [],
  className = '',
}: {
  trenPembelianInventory?: TrenPembelianInventory[];
  className?: string;
}) {
  const safeData = Array.isArray(trenPembelianInventory) ? trenPembelianInventory : [];
  const totalTahunIni = safeData.reduce((sum, d) => sum + (d?.jumlah || 0), 0);
  const maxJumlah = safeData.length ? Math.max(...safeData.map((d) => d?.jumlah || 0)) : 0;
  const avgJumlah = safeData.length ? totalTahunIni / safeData.length : 0;
  const peakIndex = maxJumlah > 0 ? safeData.findIndex((d) => d?.jumlah === maxJumlah) : -1;

  const lastIdx = safeData.length - 1;
  const lastVal = lastIdx >= 0 ? (safeData[lastIdx]?.jumlah || 0) : 0;
  const prevVal = lastIdx >= 1 ? (safeData[lastIdx - 1]?.jumlah || 0) : null;
  const delta = prevVal !== null ? lastVal - prevVal : null;

  const renderDot = (props: any) => {
    const { cx, cy, index, value } = props;
    if (value <= 0) return null;
    const isPeak = index === peakIndex && maxJumlah > 0;
    const isLast = index === lastIdx;

    if (isPeak) {
      return (
        <g key={`dot-${index}`}>
          <circle cx={cx} cy={cy} r={9} fill={THEME.violet} fillOpacity={0.15} />
          <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke={THEME.violet} strokeWidth={2.5} />
          <rect x={cx - 19} y={cy - 28} width={38} height={18} rx={5} fill={THEME.violet} />
          <text x={cx} y={cy - 15} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">
            MAX
          </text>
        </g>
      );
    }

    if (isLast) {
      return (
        <g key={`dot-${index}`}>
          <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={THEME.violet} strokeWidth={2.5} />
        </g>
      );
    }

    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4.5} fill="#fff" stroke={THEME.violet} strokeWidth={2.5} />;
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeader
          icon={TrendingUp}
          tone="orange"
          title="Tren Pembelian Barang"
          subtitle="Aktivitas pengadaan 6 bulan terakhir"
        />
      </div>

      <div className="flex items-center justify-between bg-[#F7F8FC] rounded-xl px-3.5 py-2.5 mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-[#171633]">{totalTahunIni}</span>
          <span className="text-xs font-semibold text-[#A9A9C6]">unit total</span>
        </div>
        {delta !== null && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${
              delta > 0 ? 'text-[#34A853] bg-[#E7F6EC]' : 'text-[#F2453D] bg-[#FDECEB]'
            }`}
          >
            {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>

      <div className="h-48 sm:h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trenPembelianInventory} margin={{ top: 25, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trenPembelianGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={THEME.violet} stopOpacity={0.25} />
                <stop offset="100%" stopColor={THEME.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={THEME.grid} />
            <XAxis
              dataKey="bulan"
              tick={{ fontSize: 11, fill: THEME.axis }}
              axisLine={false}
              tickLine={false}
              padding={{ left: 32, right: 16 }}
            />
            <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.35, 4)]} />
            {maxJumlah > 0 && (
              <ReferenceLine y={avgJumlah} stroke={THEME.violet} strokeDasharray="3 3" strokeOpacity={0.35} />
            )}
            <Tooltip
              cursor={{ stroke: THEME.violet, strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(23,22,51,0.12)', fontSize: 11, padding: '8px 12px' }}
            />
            <Area
              type="linear"
              dataKey="jumlah"
              name="Pengadaan Unit"
              stroke={THEME.violet}
              strokeWidth={3}
              fill="url(#trenPembelianGradient)"
              dot={renderDot}
              activeDot={{ r: 7, fill: '#fff', stroke: THEME.violet, strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#A9A9C6] pt-3 border-t border-[#F0F1F7] mt-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: THEME.violet }} />
            Jumlah Unit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t border-dashed" style={{ borderColor: THEME.violet }} />
            Rata-rata: {Math.round(avgJumlah * 10) / 10} / bln
          </span>
        </div>
        <span className="text-[10px]">Periode Berjalan</span>
      </div>
    </div>
  );
}

// ==== Status Inventory Donut Card ====
const STATUS_ASET_COLOR: Record<string, string> = {
  Tersedia: THEME.emerald,
  Dipakai: THEME.violet,
  'Menunggu Perbaikan': THEME.amber,
  Diperbaiki: THEME.sky,
  'Rusak Berat': THEME.rose,
  Dijual: THEME.axis,
};

export function StatusInventoryDonutCard({
  statusInventoryDistribusi = [],
  className = '',
}: {
  statusInventoryDistribusi?: StatusInventoryDistribusi[];
  className?: string;
}) {
  const safeData = Array.isArray(statusInventoryDistribusi) ? statusInventoryDistribusi : [];
  const total = safeData.reduce((sum, d) => sum + (d?.jumlah || 0), 0);

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={Layers}
        tone="sky"
        title="Status"
        subtitle="Detail kondisi seluruh item"
        right={
          <span className="text-xs font-bold text-[#171633] bg-[#F7F8FC] px-3 py-1.5 rounded-lg">
            {total} Total
          </span>
        }
      />

      {total === 0 ? (
        <p className="text-xs text-[#A9A9C6] py-6 text-center">Belum ada data inventory</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 my-auto">
          <div className="sm:col-span-5 h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusInventoryDistribusi}
                  dataKey="jumlah"
                  nameKey="status"
                  innerRadius={42}
                  outerRadius={60}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {statusInventoryDistribusi.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_ASET_COLOR[entry.status] ?? THEME.axis} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(23,22,51,0.12)', fontSize: 11, padding: '8px 12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-[#171633] leading-none">{total}</span>
              <span className="text-[9px] uppercase font-bold text-[#A9A9C6] mt-1">Unit</span>
            </div>
          </div>

          <div className="sm:col-span-7 flex flex-col gap-1 pr-1">
            {statusInventoryDistribusi.map((d) => {
              const pct = total > 0 ? Math.round((d.jumlah / total) * 100) : 0;
              return (
                <LegendDot
                  key={d.status}
                  color={STATUS_ASET_COLOR[d.status] ?? THEME.axis}
                  label={d.status}
                  value={d.jumlah}
                  subvalue={`${pct}%`}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[10px] text-[#A9A9C6]">
        <span>6 kategori status sistem</span>
        <span>Realtime sync</span>
      </div>
    </div>
  );
}

// ==== Inventory Butuh Perhatian Card ====
export function InventoryPerhatianCard({
  inventoryPerhatian,
  className = '',
}: {
  inventoryPerhatian?: InventoryPerhatian;
  className?: string;
}) {
  const navigate = useNavigate();
  const rusak = inventoryPerhatian?.rusak ?? 0;
  const dalamPenanganan = inventoryPerhatian?.dalamPenanganan ?? 0;
  const garansiSegeraHabis = inventoryPerhatian?.garansiSegeraHabis ?? 0;
  const totalPerhatian = rusak + dalamPenanganan + garansiSegeraHabis;

  const rows = [
    { label: 'Rusak Berat', value: rusak, icon: AlertTriangle, tone: 'rose' as const, path: '/master-data?tab=inventory&status=rusak_berat' },
    { label: 'Proses Perbaikan', value: dalamPenanganan, icon: Wrench, tone: 'amber' as const, path: '/penanganan-inventory' },
    { label: 'Garansi < 30 Hari', value: garansiSegeraHabis, icon: ShieldAlert, tone: 'orange' as const, path: '/master-data?tab=inventory' },
  ];

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={ShieldAlert}
        tone={totalPerhatian > 0 ? 'rose' : 'emerald'}
        title="Perhatian Khusus"
        subtitle="Barang kendala & garansi"
        right={
          totalPerhatian > 0 ? (
            <span className="text-[11px] font-bold text-[#F2453D] bg-[#FDECEB] px-3 py-1 rounded-lg">
              {totalPerhatian} Item
            </span>
          ) : (
            <span className="text-[11px] font-bold text-[#34A853] bg-[#E7F6EC] px-3 py-1 rounded-lg">
              Aman
            </span>
          )
        }
      />

      <div className="flex flex-col gap-2 my-auto">
        {rows.map((r) => (
          <div
            key={r.label}
            onClick={() => navigate(r.path)}
            className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8FC] hover:bg-[#F0F1F7] cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CardIcon icon={r.icon} tone={r.tone} />
              <span className="text-xs font-semibold text-[#171633] truncate">{r.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-extrabold ${r.value > 0 ? 'text-[#171633]' : 'text-[#A9A9C6]'}`}>
                {r.value}
              </span>
              <ArrowRight size={13} className="text-[#A9A9C6]" />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[11px]">
        <span className="text-[#A9A9C6] text-[10px]">Tindak lanjuti segera</span>
        <button
          onClick={() => navigate('/penanganan-inventory')}
          className="text-xs font-bold text-[#5A32FA] hover:text-[#4C3FE0]"
        >
          Ke Penanganan &rarr;
        </button>
      </div>
    </div>
  );
}

// ==== Top Inventory Items ====
export function TopInventoryCard({
  inventoryPerMerek = [],
  className = '',
}: {
  inventoryPerMerek?: InventoryPerMerek[];
  className?: string;
}) {
  const navigate = useNavigate();
  const safeData = Array.isArray(inventoryPerMerek) ? inventoryPerMerek : [];
  const topItems = useMemo(() => safeData.slice(0, 5), [safeData]);
  const maxCount = topItems.length > 0 ? Math.max(...topItems.map((i) => i.jumlah), 1) : 1;

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={Package}
        tone="indigo"
        title="Top Item Inventory"
        subtitle="Barang terbanyak terdaftar"
        right={
          <button
            onClick={() => navigate('/master-data?tab=inventory')}
            className="text-[11px] font-semibold text-[#5A32FA] bg-[#EFEAFF] px-2.5 py-1 rounded-lg hover:bg-[#E0D9FF]"
          >
            Lihat Semua
          </button>
        }
      />

      {topItems.length === 0 ? (
        <p className="text-xs text-[#A9A9C6] py-6 text-center">Belum ada item inventory</p>
      ) : (
        <div className="flex flex-col gap-3.5 my-auto">
          {topItems.map((item, idx) => {
            const pct = Math.round((item.jumlah / maxCount) * 100);
            return (
              <div key={item.nama}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate max-w-[80%]">
                    <span className="w-5 h-5 rounded-full bg-[#EFEAFF] text-[10px] font-bold text-[#5A32FA] flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-[#171633] truncate" title={item.nama}>
                      {item.nama}
                    </span>
                  </div>
                  <span className="font-extrabold text-[#171633] text-xs">{item.jumlah} <span className="text-[10px] font-normal text-[#A9A9C6]">unit</span></span>
                </div>
                <div className="w-full bg-[#F0F1F7] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5A32FA] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[10px] text-[#A9A9C6]">
        <span>Berdasarkan nama & model</span>
        <span>{inventoryPerMerek.length} varian total</span>
      </div>
    </div>
  );
}

// ==== Distribusi Departemen Card ====
export function DepartemenDistribusiCard({
  departemen = [],
  className = '',
}: {
  departemen?: DepartemenDistribusi[];
  className?: string;
}) {
  const safeDepartemen = Array.isArray(departemen) ? departemen : [];
  const totalKaryawan = useMemo(() => safeDepartemen.reduce((s, d) => s + (d?.jumlah || 0), 0), [safeDepartemen]);
  const sorted = useMemo(() => [...safeDepartemen].sort((a, b) => (b?.jumlah || 0) - (a?.jumlah || 0)).slice(0, 5), [safeDepartemen]);

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={Building2}
        tone="emerald"
        title="Distribusi Departemen"
        subtitle={`${safeDepartemen.length} Departemen / ${totalKaryawan} Karyawan`}
        right={
          <span className="text-xs font-bold text-[#34A853] bg-[#E7F6EC] px-3 py-1.5 rounded-lg">
            {totalKaryawan} Staff
          </span>
        }
      />

      {sorted.length === 0 ? (
        <p className="text-xs text-[#A9A9C6] py-6 text-center">Belum ada data departemen</p>
      ) : (
        <div className="flex flex-col gap-3.5 my-auto">
          {sorted.map((dept) => {
            const pct = totalKaryawan > 0 ? Math.round((dept.jumlah / totalKaryawan) * 100) : 0;
            return (
              <div key={dept.departemen} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#171633] truncate">{dept.departemen}</span>
                  <span className="font-bold text-[#171633] text-xs">
                    {dept.jumlah} <span className="text-[10px] text-[#A9A9C6]">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-[#F0F1F7] h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-[#34A853] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[10px] text-[#A9A9C6]">
        <span>Struktur Organisasi</span>
        <span>Top 5 departemen</span>
      </div>
    </div>
  );
}

// ==== Notifikasi Card ====
export function NotifikasiCard({
  notifications = [],
  onMarkAsRead,
  className = '',
}: {
  notifications?: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !n?.read_at).length;

  const handleClick = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={Bell}
        tone="violet"
        title="Notifikasi Sistem"
        subtitle="Pemberitahuan & pengingat"
        right={
          unreadCount > 0 ? (
            <span className="text-[10px] font-bold text-white bg-[#F2453D] px-2.5 py-1 rounded-lg">
              {unreadCount} Baru
            </span>
          ) : (
            <span className="text-[10px] font-medium text-[#A9A9C6]">Semua dibaca</span>
          )
        }
      />

      {safeNotifications.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-[#A9A9C6]">Belum ada notifikasi</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto pr-0.5 my-auto max-h-[190px]">
          {safeNotifications.slice(0, 5).map((n) => {
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-colors ${
                  unread ? 'bg-[#EFEAFF]/60 hover:bg-[#EFEAFF]' : 'bg-[#F7F8FC] hover:bg-[#F0F1F7]'
                }`}
                onClick={() => handleClick(n)}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${unread ? 'bg-[#5A32FA]' : 'bg-[#D5D5E8]'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${unread ? 'text-[#171633] font-semibold' : 'text-[#666687]'}`}>{n.data?.message || 'Notifikasi baru'}</p>
                  <p className="text-[10px] text-[#A9A9C6] mt-1">{n.created_at ? new Date(n.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[10px] text-[#A9A9C6]">
        <span>{safeNotifications.length} notifikasi tersimpan</span>
        <span>Auto-sync Pusher</span>
      </div>
    </div>
  );
}

// ==== Timeline Aktivitas ====
const AKTIVITAS_ASET_STYLE: Record<AktivitasInventoryTerbaru['type'], { color: string; label: string; tone: 'amber' | 'emerald' | 'rose' | 'orange' | 'sky' | 'indigo' }> = {
  pinjam: { color: THEME.amber, label: 'menerima', tone: 'amber' },
  kembali: { color: THEME.emerald, label: 'mengembalikan', tone: 'emerald' },
  lapor_rusak: { color: THEME.rose, label: 'melaporkan kerusakan', tone: 'rose' },
  mulai_perbaikan: { color: THEME.orange, label: 'mulai perbaikan', tone: 'orange' },
  selesai_perbaikan: { color: THEME.sky, label: 'selesai perbaikan', tone: 'sky' },
  dijual: { color: THEME.purple, label: 'menjual', tone: 'indigo' },
};

const AKTIVITAS_STATUS_LABEL: Record<AktivitasInventoryTerbaru['type'], string> = {
  pinjam: 'Diterima',
  kembali: 'Dikembalikan',
  lapor_rusak: 'Rusak Dilaporkan',
  mulai_perbaikan: 'Diperbaiki',
  selesai_perbaikan: 'Selesai Perbaikan',
  dijual: 'Terjual',
};

function formatWaktuSingkat(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function AktivitasTimelineList({
  events = [],
  timeFormatter,
}: {
  events?: AktivitasInventoryTerbaru[];
  timeFormatter: (waktu: string) => string;
}) {
  const safeEvents = Array.isArray(events) ? events : [];
  return (
    <ul className="flex flex-col">
      {safeEvents.map((ev, idx) => {
        const s = AKTIVITAS_ASET_STYLE[ev.type] || { color: THEME.slate, label: 'mengubah status', tone: 'slate' as const };
        const kode = ev.inventory?.kode_inventory || '-';
        const pelaku =
          ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
        const isLast = idx === safeEvents.length - 1;
        return (
          <li key={`${ev.type}-${idx}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: s.color }} />
              {!isLast && <span className="w-px flex-1 bg-[#F0F1F7] mt-1" />}
            </div>
            <div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-3'}`}>
              <p className="text-xs text-[#666687] leading-snug">
                {pelaku && <span className="font-bold text-[#171633]">{pelaku} </span>}
                {s.label} <span className="font-semibold text-[#5A32FA]">{kode}</span>
              </p>
              <p className="text-[10px] text-[#A9A9C6] mt-0.5">{timeFormatter(ev.waktu)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AktivitasInventoryCard({
  aktivitasInventoryTerbaru = [],
  className = '',
}: {
  aktivitasInventoryTerbaru?: AktivitasInventoryTerbaru[];
  className?: string;
}) {
  const navigate = useNavigate();
  const safeAktivitas = Array.isArray(aktivitasInventoryTerbaru) ? aktivitasInventoryTerbaru : [];

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={Activity}
        tone="emerald"
        title="Aktivitas Terkini"
        subtitle="Mutasi & transaksi terkini"
        right={
          <button
            onClick={() => navigate('/laporan?tab=riwayat_inventory')}
            className="text-[11px] font-semibold text-[#5A32FA] bg-[#EFEAFF] px-2.5 py-1 rounded-lg hover:bg-[#E0D9FF] flex items-center gap-1"
          >
            Lihat Semua <ArrowRight size={12} />
          </button>
        }
      />

      {safeAktivitas.length === 0 ? (
        <p className="text-xs text-[#A9A9C6] py-6 text-center">Belum ada aktivitas inventory.</p>
      ) : (
        <div className="overflow-y-auto pr-0.5 my-auto max-h-[190px]">
          <AktivitasTimelineList events={safeAktivitas} timeFormatter={formatWaktuSingkat} />
        </div>
      )}

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[10px] text-[#A9A9C6]">
        <span>Log mutasi otomatis</span>
        <span>Terakhir sinkron: Saat ini</span>
      </div>
    </div>
  );
}

// ==== Riwayat Aktivitas Table (DEGO "Information by stores" pattern) ====
// Reuses the same aktivitas data already fetched for the calendar widget —
// no new API call, just a denser table presentation with sort/search/pagination.
type SortDir = 'terbaru' | 'terlama';
const TABLE_PAGE_SIZE = 8;

export function RiwayatAktivitasTableCard({
  aktivitas = [],
  className = '',
}: {
  aktivitas?: AktivitasInventoryTerbaru[];
  className?: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('terbaru');
  const [page, setPage] = useState(1);

  const safeAktivitas = Array.isArray(aktivitas) ? aktivitas : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = safeAktivitas;
    if (q) {
      list = list.filter((ev) => {
        const kode = ev.inventory?.kode_inventory?.toLowerCase() ?? '';
        const nama = ev.inventory?.nama?.toLowerCase() ?? '';
        const pelaku = ev.nama?.toLowerCase() ?? '';
        return kode.includes(q) || nama.includes(q) || pelaku.includes(q);
      });
    }
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.waktu).getTime();
      const tb = new Date(b.waktu).getTime();
      return sortDir === 'terbaru' ? tb - ta : ta - tb;
    });
    return sorted;
  }, [safeAktivitas, search, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const startIdx = (clampedPage - 1) * TABLE_PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + TABLE_PAGE_SIZE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleSort = (v: SortDir) => {
    setSortDir(v);
    setPage(1);
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Activity} tone="emerald" />
          <div>
            <h3 className="text-sm font-bold text-[#171633] leading-tight">Riwayat Aktivitas Inventory</h3>
            <p className="text-xs text-[#A9A9C6] mt-0.5">Log mutasi & transaksi ({aktivitas.length})</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A9A9C6]" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari kode / nama..."
              className="text-xs bg-[#F7F8FC] rounded-lg pl-7 pr-3 py-2 w-40 sm:w-48 focus:outline-none focus:ring-2 focus:ring-[#EFEAFF] placeholder:text-[#A9A9C6]"
            />
          </div>
          <div className="w-28">
            <Select
              size="compact"
              value={sortDir}
              onChange={(v) => handleSort(v as SortDir)}
              options={[
                { value: 'terbaru', label: 'Terbaru' },
                { value: 'terlama', label: 'Terlama' },
              ]}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[#A9A9C6] py-10 text-center">Tidak ada aktivitas yang cocok.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] uppercase font-bold text-[#A9A9C6] tracking-wider">
                <th className="px-3 py-2">Kode Inventory</th>
                <th className="px-3 py-2">Barang</th>
                <th className="px-3 py-2">Pelaku</th>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((ev, idx) => {
                const s = AKTIVITAS_ASET_STYLE[ev.type] || { tone: 'slate' as const };
                const badgeClass = BADGE_TONE[s.tone] ?? BADGE_TONE.slate;
                const kode = ev.inventory?.kode_inventory || '-';
                const nama = ev.inventory?.nama || '-';
                const pelaku = ev.nama ?? '-';
                return (
                  <tr
                    key={`${ev.type}-${startIdx + idx}`}
                    onClick={() => navigate('/laporan?tab=riwayat_inventory')}
                    className="cursor-pointer hover:bg-[#F7F8FC] transition-colors border-t border-[#F0F1F7]"
                  >
                    <td className="px-3 py-2.5 font-bold text-[#5A32FA] whitespace-nowrap">{kode}</td>
                    <td className="px-3 py-2.5 text-[#171633] font-medium truncate max-w-[160px]" title={nama}>{nama}</td>
                    <td className="px-3 py-2.5 text-[#666687]">{pelaku}</td>
                    <td className="px-3 py-2.5 text-[#A9A9C6] whitespace-nowrap">
                      {new Date(ev.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap ${badgeClass}`}>
                        {AKTIVITAS_STATUS_LABEL[ev.type] ?? 'Update'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-3 mt-2 border-t border-[#F0F1F7] flex items-center justify-between text-[11px] text-[#A9A9C6]">
        <span>
          Menampilkan {filtered.length === 0 ? 0 : startIdx + 1}-{Math.min(startIdx + TABLE_PAGE_SIZE, filtered.length)} dari {filtered.length}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage <= 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666687] bg-[#F7F8FC] hover:bg-[#F0F1F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="font-semibold text-[#171633] px-1">{clampedPage} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage >= totalPages}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666687] bg-[#F7F8FC] hover:bg-[#F0F1F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==== Kalender Card ====
const HARI_LABEL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_LABEL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function buildCalendarGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday; i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, nextDay++), inMonth: false });
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarCard({
  aktivitas = [],
  className = '',
}: {
  aktivitas?: AktivitasInventoryTerbaru[];
  className?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(
    () => buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const safeAktivitas = Array.isArray(aktivitas) ? aktivitas : [];

  const aktivitasPerTanggal = useMemo(() => {
    const map = new Map<string, AktivitasInventoryTerbaru[]>();
    for (const ev of safeAktivitas) {
      const d = new Date(ev.waktu);
      if (isNaN(d.getTime())) continue;
      const key = dateKeyLocal(d);
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    return map;
  }, [safeAktivitas]);

  const aktivitasHariIni = useMemo(() => {
    const list = aktivitasPerTanggal.get(dateKeyLocal(selected)) ?? [];
    return [...list].sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
  }, [aktivitasPerTanggal, selected]);

  const goToMonth = (offset: number) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  };
  const goToToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  const isCurrentMonthView = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  return (
    <div className={`${cardClass} ${className}`}>
      <div>
        <SectionHeader
          icon={CalendarDays}
          tone="violet"
          title="Kalender Operasional"
          subtitle="Jadwal & log harian"
          right={
            !isCurrentMonthView ? (
              <button
                onClick={goToToday}
                className="text-[10px] font-bold text-[#5A32FA] bg-[#EFEAFF] px-2.5 py-1 rounded-lg"
              >
                Hari Ini
              </button>
            ) : undefined
          }
        />

        <div className="flex items-center justify-between bg-[#F7F8FC] rounded-xl p-2 mb-3">
          <button
            onClick={() => goToMonth(-1)}
            aria-label="Bulan sebelumnya"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666687] hover:bg-white hover:shadow-sm transition-all"
          >
            <ChevronLeft size={15} />
          </button>
          <p className="text-xs font-bold text-[#171633]">
            {BULAN_LABEL[viewDate.getMonth()]} {viewDate.getFullYear()}
          </p>
          <button
            onClick={() => goToMonth(1)}
            aria-label="Bulan berikutnya"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#666687] hover:bg-white hover:shadow-sm transition-all"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {HARI_LABEL.map((h) => (
            <span key={h} className="text-[10px] font-bold text-[#A9A9C6] pb-1">
              {h}
            </span>
          ))}
          {weeks.flat().map((cell, idx) => {
            const isToday = isSameDay(cell.date, today);
            const isSelected = !isToday && isSameDay(cell.date, selected);
            const hasAktivitas = aktivitasPerTanggal.has(dateKeyLocal(cell.date));
            return (
              <button
                key={idx}
                onClick={() => setSelected(cell.date)}
                className={`relative mx-auto w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                  isToday
                    ? 'bg-[#171633] text-white font-black shadow-md'
                    : isSelected
                    ? 'bg-[#5A32FA] text-white font-bold'
                    : cell.inMonth
                    ? 'text-[#666687] hover:bg-[#F0F1F7] font-medium'
                    : 'text-[#D5D5E8] hover:bg-[#F7F8FC]'
                }`}
              >
                {cell.date.getDate()}
                {hasAktivitas && (
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1 h-1 rounded-full ${
                      isToday || isSelected ? 'bg-white' : 'bg-[#5A32FA]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#F0F1F7]">
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="font-bold text-[#171633]">
            Log: {isSameDay(selected, today) ? 'Hari Ini' : selected.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
          <span className="text-[10px] text-[#A9A9C6]">{aktivitasHariIni.length} mutasi</span>
        </div>

        {aktivitasHariIni.length === 0 ? (
          <p className="text-[11px] text-[#A9A9C6] py-1">Tidak ada mutasi pada tanggal ini.</p>
        ) : (
          <div className="max-h-28 overflow-y-auto pr-0.5">
            <AktivitasTimelineList
              events={aktivitasHariIni}
              timeFormatter={(waktu) =>
                `${new Date(waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}