import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import type { DepartemenDistribusi } from '../useDashboardData';
import { cardClass } from './theme';
import { SectionHeader } from './primitives';

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
                  <span className="font-semibold text-[#171633] dark:text-zinc-200 truncate">{dept.departemen}</span>
                  <span className="font-bold text-[#171633] dark:text-zinc-100 text-xs">
                    {dept.jumlah} <span className="text-[10px] text-[#A9A9C6] dark:text-zinc-400">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-[#F0F1F7] dark:bg-[#222226] border border-transparent dark:border-[#383842] h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-[#34A853] dark:bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
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
