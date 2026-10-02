import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import type { TrenPembelianInventory } from '../useDashboardData';
import { THEME, cardClass } from './theme';
import { SectionHeader } from './primitives';

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

  const { isDark } = useTheme();

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

      <div className="flex items-center justify-between bg-[#F7F8FC] dark:bg-[#1e1e22] dark:border dark:border-[#2c2c31] rounded-xl px-3.5 py-2.5 mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-[#171633] dark:text-white">{totalTahunIni}</span>
          <span className="text-xs font-semibold text-[#A9A9C6] dark:text-zinc-400">unit total</span>
        </div>
        {delta !== null && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${
              delta > 0 ? 'text-[#34A853] bg-[#E7F6EC] dark:bg-emerald-950/50 dark:text-emerald-300' : 'text-[#F2453D] bg-[#FDECEB] dark:bg-rose-950/50 dark:text-rose-300'
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
                <stop offset="0%" stopColor={isDark ? '#818cf8' : THEME.violet} stopOpacity={isDark ? 0.35 : 0.25} />
                <stop offset="100%" stopColor={isDark ? '#818cf8' : THEME.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={isDark ? '#27272a' : THEME.grid} />
            <XAxis
              dataKey="bulan"
              tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : THEME.axis }}
              axisLine={false}
              tickLine={false}
              padding={{ left: 32, right: 16 }}
            />
            <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.35, 4)]} />
            {maxJumlah > 0 && (
              <ReferenceLine y={avgJumlah} stroke={isDark ? '#818cf8' : THEME.violet} strokeDasharray="3 3" strokeOpacity={0.35} />
            )}
            <Tooltip
              cursor={{ stroke: isDark ? '#818cf8' : THEME.violet, strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={isDark ? { backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: 12, border: '1px solid #2c2c31', boxShadow: '0 8px 30px rgba(0,0,0,0.8)', fontSize: 11, padding: '8px 12px' } : { borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(23,22,51,0.12)', fontSize: 11, padding: '8px 12px' }}
            />
            <Area
              type="linear"
              dataKey="jumlah"
              name="Pengadaan Unit"
              stroke={isDark ? '#818cf8' : THEME.violet}
              strokeWidth={3}
              fill="url(#trenPembelianGradient)"
              dot={renderDot}
              activeDot={{ r: 7, fill: '#fff', stroke: isDark ? '#818cf8' : THEME.violet, strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#A9A9C6] dark:text-zinc-400 pt-3 border-t border-[#F0F1F7] dark:border-[#2c2c31] mt-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: isDark ? '#818cf8' : THEME.violet }} />
            Jumlah Unit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t border-dashed" style={{ borderColor: isDark ? '#818cf8' : THEME.violet }} />
            Rata-rata: {Math.round(avgJumlah * 10) / 10} / bln
          </span>
        </div>
        <span className="text-[10px]">Periode Berjalan</span>
      </div>
    </div>
  );
}
