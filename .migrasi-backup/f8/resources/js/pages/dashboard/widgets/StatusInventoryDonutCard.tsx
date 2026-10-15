import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import type { StatusInventoryDistribusi } from '../useDashboardData';
import { THEME, cardClass } from './theme';
import { SectionHeader, LegendDot } from './primitives';

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
  const { isDark } = useTheme();
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
          <span className="text-xs font-bold text-[#171633] bg-[#F7F8FC] dark:bg-[#27272a] dark:text-zinc-200 dark:border dark:border-[#3f3f46] px-3 py-1.5 rounded-lg">
            {total} Total
          </span>
        }
      />

      {total === 0 ? (
        <p className="text-xs text-[#A9A9C6] dark:text-zinc-400 py-6 text-center">Belum ada data inventory</p>
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
                <Tooltip contentStyle={isDark ? { backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: 12, border: '1px solid #2c2c31', boxShadow: '0 8px 30px rgba(0,0,0,0.8)', fontSize: 11, padding: '8px 12px' } : { borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(23,22,51,0.12)', fontSize: 11, padding: '8px 12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-[#171633] dark:text-white leading-none">{total}</span>
              <span className="text-[9px] uppercase font-bold text-[#A9A9C6] dark:text-zinc-400 mt-1">Unit</span>
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

      <div className="pt-3 border-t border-[#F0F1F7] dark:border-[#2c2c31] flex items-center justify-between text-[10px] text-[#A9A9C6] dark:text-zinc-400">
        <span>6 kategori status sistem</span>
        <span>Realtime sync</span>
      </div>
    </div>
  );
}
