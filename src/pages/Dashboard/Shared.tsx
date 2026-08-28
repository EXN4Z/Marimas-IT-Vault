import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
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
  Zap,
  Building2,
  Users,
  CheckCircle2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

export const THEME = {
  violet: '#6D5DFC',
  violetDark: '#4C3FE0',
  emerald: '#12B76A',
  amber: '#F59E0B',
  rose: '#F04438',
  orange: '#FF7A50',
  sky: '#0284C7',
  purple: '#A855F7',
  indigo: '#4F46E5',
  teal: '#0D9488',
  slate: '#64748B',
  grid: '#F1F5F9',
  axis: '#94A3B8',
};

export const cardClass =
  'bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between';

export const NOTIF_VISIBLE_COUNT = 3;

export function LegendDot({ color, label, value, subvalue }: { color: string; label: string; value: number | string; subvalue?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <div className="flex items-center gap-1.5 text-slate-600 truncate min-w-0 pr-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="font-bold text-slate-800 text-xs">{value}</span>
        {subvalue && <span className="text-[10px] text-slate-400">({subvalue})</span>}
      </div>
    </div>
  );
}

export function CardIcon({ icon: Icon, tone = 'violet' }: { icon: LucideIcon; tone?: 'violet' | 'orange' | 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'slate' }) {
  const toneMap: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
    violet: 'bg-[#EEECFF] text-[#6D5DFC]',
  };
  const toneClass = toneMap[tone] || toneMap.violet;
  return (
    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClass}`}>
      <Icon size={16} />
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

export function WelcomeHeader({ user }: { user?: UserType | null }) {
  if (!user) return null;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user.name?.split(' ')[0] ?? user.name;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-200/60 mb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-900 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
          <Sparkles size={18} className="text-amber-300" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
            {greetingWord()}, {firstName}!
          </h2>
          <p className="text-xs text-slate-500 font-medium capitalize mt-0.5">{today}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-[#6D5DFC] bg-[#EEECFF] border border-[#DDD8FF] px-2.5 py-1 rounded-md whitespace-nowrap">
          {GREETING_ROLE_LABEL[user.role] ?? user.role}
        </span>
        {user.departemen?.nama && (
          <span className="text-[11px] font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md whitespace-nowrap">
            {user.departemen.nama}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Sistem Online
        </span>
      </div>
    </div>
  );
}

// ==== Quick Actions Bar ====
export function QuickActionBar({ role }: { role?: string }) {
  const navigate = useNavigate();
  const isStaff = ['admin', 'hr', 'manajer'].includes(role ?? '');

  const actions = [
    { label: 'Master Inventory', icon: Package, path: '/master-data?tab=inventory', tone: 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100/70', show: true },
    { label: 'Penanganan Inventory', icon: Wrench, path: '/penanganan-inventory', tone: 'text-amber-600 bg-amber-50 border-amber-100 hover:bg-amber-100/70', show: true },
    { label: 'Riwayat & Mutasi', icon: Activity, path: '/laporan?tab=riwayat_inventory', tone: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100/70', show: isStaff },
    { label: 'Data Karyawan', icon: Users, path: '/karyawan', tone: 'text-sky-600 bg-sky-50 border-sky-100 hover:bg-sky-100/70', show: role === 'admin' },
    { label: 'Export Laporan', icon: Layers, path: '/laporan', tone: 'text-slate-700 bg-slate-100/80 border-slate-200 hover:bg-slate-200/70', show: isStaff },
  ].filter((a) => a.show);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm flex items-center gap-2 overflow-x-auto mb-3">
      <div className="flex items-center gap-1 text-slate-400 pl-1 pr-2 border-r border-slate-200 text-xs font-bold uppercase tracking-wider flex-shrink-0">
        <Zap size={14} className="text-amber-500 fill-amber-500" />
        <span className="hidden md:inline">Aksi Cepat:</span>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              onClick={() => navigate(act.path)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 ${act.tone}`}
            >
              <Icon size={14} />
              <span className="whitespace-nowrap">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==== KPI mini card (Bento style, high density) ====
const KPI_CONFIG = {
  default: { accent: '#6D5DFC', bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-[#6D5DFC]' },
  emerald: { accent: '#12B76A', bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-600' },
  amber: { accent: '#F59E0B', bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-600' },
  rose: { accent: '#F04438', bg: 'bg-rose-50/50', border: 'border-rose-100', text: 'text-rose-600' },
  sky: { accent: '#0284C7', bg: 'bg-sky-50/50', border: 'border-sky-100', text: 'text-sky-600' },
  orange: { accent: '#FF7A50', bg: 'bg-orange-50/50', border: 'border-orange-100', text: 'text-orange-600' },
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
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone?: keyof typeof KPI_CONFIG;
  hint?: string;
  badge?: string;
  progress?: number; // 0 - 100
  onClick?: () => void;
  className?: string;
}) {
  const cfg = KPI_CONFIG[tone] || KPI_CONFIG.default;
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden bg-white border border-slate-200/80 rounded-xl px-3.5 py-2.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Subtle left border indicator */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: cfg.accent }} />

      <div className="flex items-center justify-between gap-2.5 pl-1">
        {/* Left: Icon box */}
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.text} group-hover:scale-105 transition-transform`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>

        {/* Right: Value & Label */}
        <div className="text-right min-w-0 flex-1">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-none">
              {value}
            </span>
            {badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text} leading-none`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 tracking-wide truncate mt-0.5" title={label}>
            {label}
          </p>
        </div>
      </div>

      {/* Sleek bottom progress bar (as shown in reference) */}
      {progress !== undefined && (
        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-2 ml-1 pr-1">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: cfg.accent }}
          />
        </div>
      )}

      {/* Optional micro hint */}
      {progress === undefined && hint && (
        <div className="mt-1 text-[10px] text-slate-400 font-medium truncate text-right pl-1">
          {hint}
        </div>
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CardIcon icon={Boxes} tone="violet" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Status Inventory</h3>
              <p className="text-[11px] text-slate-500">Komposisi ketersediaan barang</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/master-data?tab=inventory')}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
          >
            Buka <ArrowRight size={11} />
          </button>
        </div>

        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 my-2">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Terdaftar</span>
            <p className="text-2xl font-black text-slate-900 leading-none mt-0.5">{inventoryTotal}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={12} />
              {tersediaRatePct}% Siap Pakai
            </span>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100 my-2">
          {inventoryTotal > 0 ? (
            <>
              <div style={{ width: `${tersediaPct}%`, background: THEME.emerald }} title={`Tersedia: ${inventoryTersedia}`} />
              <div style={{ width: `${dipakaiPct}%`, background: THEME.violet }} title={`Dipakai: ${inventoryDipakai}`} />
              <div style={{ width: `${rusakBeratPct}%`, background: THEME.rose }} title={`Rusak Berat: ${inventoryRusakBerat}`} />
              <div style={{ width: `${dijualPct}%`, background: '#94A3B8' }} title={`Dijual: ${inventoryDijual}`} />
            </>
          ) : (
            <div className="w-full h-full bg-slate-100" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2 border-t border-slate-100 mt-1">
        <LegendDot color={THEME.emerald} label="Tersedia" value={inventoryTersedia} subvalue={`${Math.round(tersediaPct)}%`} />
        <LegendDot color={THEME.violet} label="Dipakai" value={inventoryDipakai} subvalue={`${Math.round(dipakaiPct)}%`} />
        <LegendDot color={THEME.rose} label="Rusak Berat" value={inventoryRusakBerat} subvalue={`${Math.round(rusakBeratPct)}%`} />
        <LegendDot color="#94A3B8" label="Dijual" value={inventoryDijual} subvalue={`${Math.round(dijualPct)}%`} />
      </div>
    </div>
  );
}

// ==== Hero Chart: Tren Pembelian Inventory ====
export function HeroTrenPembelianInventoryChart({
  trenPembelianInventory,
  className = '',
}: {
  trenPembelianInventory: TrenPembelianInventory[];
  className?: string;
}) {
  const totalTahunIni = trenPembelianInventory.reduce((sum, d) => sum + d.jumlah, 0);
  const maxJumlah = trenPembelianInventory.length ? Math.max(...trenPembelianInventory.map((d) => d.jumlah)) : 0;
  const avgJumlah = trenPembelianInventory.length ? totalTahunIni / trenPembelianInventory.length : 0;
  const peakIndex = maxJumlah > 0 ? trenPembelianInventory.findIndex((d) => d.jumlah === maxJumlah) : -1;

  const lastIdx = trenPembelianInventory.length - 1;
  const lastVal = lastIdx >= 0 ? trenPembelianInventory[lastIdx].jumlah : 0;
  const prevVal = lastIdx >= 1 ? trenPembelianInventory[lastIdx - 1].jumlah : null;
  const delta = prevVal !== null ? lastVal - prevVal : null;

  const renderPeakLabel = (props: any) => {
    const { x, y, width, index } = props;
    if (index !== peakIndex || maxJumlah <= 0) return null;
    const cx = x + width / 2;
    const boxW = 38;
    return (
      <g>
        <rect x={cx - boxW / 2} y={y - 24} width={boxW} height={18} rx={4} fill={THEME.orange} />
        <text x={cx} y={y - 11} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">
          MAX
        </text>
      </g>
    );
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CardIcon icon={TrendingUp} tone="orange" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Tren Pembelian Barang</h3>
            <p className="text-[11px] text-slate-500">Aktivitas pengadaan 6 bulan terakhir</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900">{totalTahunIni}</span>
            <span className="text-[11px] font-semibold text-slate-500">unit</span>
          </div>
          {delta !== null && delta !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                delta > 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
              }`}
            >
              {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {delta > 0 ? `+${delta}` : delta} bln ini
            </span>
          )}
        </div>
      </div>

      <div className="h-44 sm:h-52 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trenPembelianInventory} margin={{ top: 25, right: 6, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="2 2" stroke={THEME.grid} />
            <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: THEME.axis }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.35, 4)]} />
            {maxJumlah > 0 && (
              <ReferenceLine y={avgJumlah} stroke={THEME.orange} strokeDasharray="3 3" strokeOpacity={0.4} />
            )}
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, padding: '4px 8px' }}
            />
            <Bar
              dataKey="jumlah"
              name="Pengadaan Unit"
              fill={THEME.orange}
              radius={[6, 6, 0, 0]}
              barSize={24}
              label={renderPeakLabel}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 mt-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: THEME.orange }} />
            Jumlah Unit
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0 border-t border-dashed" style={{ borderColor: THEME.orange }} />
            Rata-rata: {Math.round(avgJumlah * 10) / 10} / bln
          </span>
        </div>
        <span className="text-[10px] text-slate-400">Periode Berjalan</span>
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
  statusInventoryDistribusi,
  className = '',
}: {
  statusInventoryDistribusi: StatusInventoryDistribusi[];
  className?: string;
}) {
  const total = statusInventoryDistribusi.reduce((sum, d) => sum + d.jumlah, 0);

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CardIcon icon={Layers} tone="sky" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Distribusi Status</h3>
            <p className="text-[11px] text-slate-500">Detail kondisi seluruh item</p>
          </div>
        </div>
        <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
          {total} Total
        </span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">Belum ada data inventory</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2 my-auto">
          <div className="sm:col-span-5 h-36 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusInventoryDistribusi}
                  dataKey="jumlah"
                  nameKey="status"
                  innerRadius={38}
                  outerRadius={56}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {statusInventoryDistribusi.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_ASET_COLOR[entry.status] ?? THEME.axis} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, padding: '4px 8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-black text-slate-900 leading-none">{total}</span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Unit</span>
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

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
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
    { label: 'Rusak Berat', value: rusak, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-100', path: '/master-data?tab=inventory&status=rusak_berat' },
    { label: 'Proses Perbaikan', value: dalamPenanganan, icon: Wrench, color: 'text-amber-600 bg-amber-50 border-amber-100', path: '/penanganan-inventory' },
    { label: 'Garansi < 30 Hari', value: garansiSegeraHabis, icon: ShieldAlert, color: 'text-orange-600 bg-orange-50 border-orange-100', path: '/master-data?tab=inventory' },
  ];

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CardIcon icon={ShieldAlert} tone={totalPerhatian > 0 ? 'rose' : 'emerald'} />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Perhatian Khusus</h3>
            <p className="text-[11px] text-slate-500">Barang kendala & garansi</p>
          </div>
        </div>
        {totalPerhatian > 0 ? (
          <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full animate-pulse">
            {totalPerhatian} Item
          </span>
        ) : (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            Aman
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 my-auto">
        {rows.map((r) => (
          <div
            key={r.label}
            onClick={() => navigate(r.path)}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-slate-200/50 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center border flex-shrink-0 ${r.color}`}>
                <r.icon size={13} />
              </div>
              <span className="text-xs font-semibold text-slate-700 truncate">{r.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-extrabold ${r.value > 0 ? 'text-slate-900 font-black' : 'text-slate-400'}`}>
                {r.value}
              </span>
              <ArrowRight size={12} className="text-slate-400" />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 text-[10px]">Tindak lanjuti segera</span>
        <button
          onClick={() => navigate('/penanganan-inventory')}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
        >
          Ke Penanganan &rarr;
        </button>
      </div>
    </div>
  );
}

// ==== Top Inventory Items / Distribusi per Nama ====
export function TopInventoryCard({
  inventoryPerMerek,
  className = '',
}: {
  inventoryPerMerek: InventoryPerMerek[];
  className?: string;
}) {
  const navigate = useNavigate();
  const topItems = useMemo(() => inventoryPerMerek.slice(0, 5), [inventoryPerMerek]);
  const maxCount = topItems.length > 0 ? Math.max(...topItems.map((i) => i.jumlah), 1) : 1;

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CardIcon icon={Package} tone="indigo" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Top Item Inventory</h3>
            <p className="text-[11px] text-slate-500">Barang terbanyak terdaftar</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/master-data?tab=inventory')}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Lihat Semua
        </button>
      </div>

      {topItems.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">Belum ada item inventory</p>
      ) : (
        <div className="flex flex-col gap-2 my-auto">
          {topItems.map((item, idx) => {
            const pct = Math.round((item.jumlah / maxCount) * 100);
            return (
              <div key={item.nama} className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 truncate" title={item.nama}>
                      {item.nama}
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900 text-xs">{item.jumlah} <span className="text-[10px] font-normal text-slate-400">unit</span></span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>Berdasarkan nama & model</span>
        <span>{inventoryPerMerek.length} varian total</span>
      </div>
    </div>
  );
}

// ==== Distribusi Departemen Card ====
export function DepartemenDistribusiCard({
  departemen,
  className = '',
}: {
  departemen: DepartemenDistribusi[];
  className?: string;
}) {
  const totalKaryawan = useMemo(() => departemen.reduce((s, d) => s + d.jumlah, 0), [departemen]);
  const sorted = useMemo(() => [...departemen].sort((a, b) => b.jumlah - a.jumlah).slice(0, 5), [departemen]);

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CardIcon icon={Building2} tone="emerald" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Distribusi Departemen</h3>
            <p className="text-[11px] text-slate-500">{departemen.length} Departemen / {totalKaryawan} Karyawan</p>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          {totalKaryawan} Staff
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">Belum ada data departemen</p>
      ) : (
        <div className="flex flex-col gap-2 my-auto">
          {sorted.map((dept) => {
            const pct = totalKaryawan > 0 ? Math.round((dept.jumlah / totalKaryawan) * 100) : 0;
            return (
              <div key={dept.departemen} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 truncate">{dept.departemen}</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {dept.jumlah} <span className="text-[10px] text-slate-400">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>Struktur Organisasi</span>
        <span>Top 5 departemen</span>
      </div>
    </div>
  );
}

// ==== Notifikasi Card ====
export function NotifikasiCard({
  notifications,
  onMarkAsRead,
  className = '',
}: {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleClick = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CardIcon icon={Bell} tone="violet" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Notifikasi Sistem</h3>
            <p className="text-[11px] text-slate-500">Pemberitahuan & pengingat</p>
          </div>
        </div>
        {unreadCount > 0 ? (
          <span className="text-[10px] font-bold text-white bg-indigo-600 px-2 py-0.5 rounded-full">
            {unreadCount} Baru
          </span>
        ) : (
          <span className="text-[10px] font-medium text-slate-400">Semua dibaca</span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-slate-400">Belum ada notifikasi</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto pr-0.5 my-auto max-h-[190px]">
          {notifications.slice(0, 5).map((n) => {
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors border ${
                  unread ? 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-100/60' : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100'
                }`}
                onClick={() => handleClick(n)}
              >
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${unread ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${unread ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>{n.data.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>{notifications.length} notifikasi tersimpan</span>
        <span>Auto-sync Pusher</span>
      </div>
    </div>
  );
}

// ==== Timeline Aktivitas ====
const AKTIVITAS_ASET_STYLE: Record<AktivitasInventoryTerbaru['type'], { color: string; label: string }> = {
  pinjam: { color: THEME.amber, label: 'menerima' },
  kembali: { color: THEME.emerald, label: 'mengembalikan' },
  lapor_rusak: { color: THEME.rose, label: 'melaporkan kerusakan' },
  mulai_perbaikan: { color: THEME.orange, label: 'mulai perbaikan' },
  selesai_perbaikan: { color: THEME.sky, label: 'selesai perbaikan' },
  dijual: { color: THEME.purple, label: 'menjual' },
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
  events,
  timeFormatter,
}: {
  events: AktivitasInventoryTerbaru[];
  timeFormatter: (waktu: string) => string;
}) {
  return (
    <ul className="flex flex-col">
      {events.map((ev, idx) => {
        const s = AKTIVITAS_ASET_STYLE[ev.type] || { color: THEME.slate, label: 'mengubah status' };
        const kode = ev.inventory?.kode_inventory || '-';
        const pelaku =
          ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
        const isLast = idx === events.length - 1;
        return (
          <li key={`${ev.type}-${idx}`} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: s.color }} />
              {!isLast && <span className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>
            <div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-2.5'}`}>
              <p className="text-xs text-slate-700 leading-snug">
                {pelaku && <span className="font-bold text-slate-900">{pelaku} </span>}
                {s.label} <span className="font-semibold text-indigo-600">{kode}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{timeFormatter(ev.waktu)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AktivitasInventoryCard({
  aktivitasInventoryTerbaru,
  className = '',
}: {
  aktivitasInventoryTerbaru: AktivitasInventoryTerbaru[];
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CardIcon icon={Activity} tone="emerald" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Aktivitas Terkini</h3>
            <p className="text-[11px] text-slate-500">Mutasi & transaksi terkini</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/laporan?tab=riwayat_inventory')}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
        >
          Lihat Semua <ArrowRight size={11} />
        </button>
      </div>

      {aktivitasInventoryTerbaru.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">Belum ada aktivitas inventory.</p>
      ) : (
        <div className="overflow-y-auto pr-0.5 my-auto max-h-[190px]">
          <AktivitasTimelineList events={aktivitasInventoryTerbaru} timeFormatter={formatWaktuSingkat} />
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>Log mutasi otomatis</span>
        <span>Terakhir sinkron: Saat ini</span>
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

  const aktivitasPerTanggal = useMemo(() => {
    const map = new Map<string, AktivitasInventoryTerbaru[]>();
    for (const ev of aktivitas) {
      const d = new Date(ev.waktu);
      if (isNaN(d.getTime())) continue;
      const key = dateKeyLocal(d);
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    return map;
  }, [aktivitas]);

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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CardIcon icon={CalendarDays} tone="violet" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Kalender Operasional</h3>
              <p className="text-[11px] text-slate-500">Jadwal & log harian</p>
            </div>
          </div>
          {!isCurrentMonthView && (
            <button
              onClick={goToToday}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md"
            >
              Hari Ini
            </button>
          )}
        </div>

        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-lg p-1.5 mb-2">
          <button
            onClick={() => goToMonth(-1)}
            aria-label="Bulan sebelumnya"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-xs font-bold text-slate-800">
            {BULAN_LABEL[viewDate.getMonth()]} {viewDate.getFullYear()}
          </p>
          <button
            onClick={() => goToMonth(1)}
            aria-label="Bulan berikutnya"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {HARI_LABEL.map((h) => (
            <span key={h} className="text-[10px] font-bold text-slate-400 pb-0.5">
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
                className={`relative mx-auto w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                  isToday
                    ? 'bg-emerald-600 text-white font-black shadow-sm'
                    : isSelected
                    ? 'bg-indigo-600 text-white font-bold'
                    : cell.inMonth
                    ? 'text-slate-700 hover:bg-slate-100 font-medium'
                    : 'text-slate-300 hover:bg-slate-50'
                }`}
              >
                {cell.date.getDate()}
                {hasAktivitas && (
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1 h-1 rounded-full ${
                      isToday || isSelected ? 'bg-white' : 'bg-indigo-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-bold text-slate-700">
            Log: {isSameDay(selected, today) ? 'Hari Ini' : selected.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
          <span className="text-[10px] text-slate-400">{aktivitasHariIni.length} mutasi</span>
        </div>

        {aktivitasHariIni.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-1">Tidak ada mutasi pada tanggal ini.</p>
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