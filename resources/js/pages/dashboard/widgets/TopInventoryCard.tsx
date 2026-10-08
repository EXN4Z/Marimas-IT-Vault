import { useMemo } from 'react';
import { Package } from 'lucide-react';
import { useNavigate } from '../../../lib/router';
import type { InventoryPerMerek } from '../useDashboardData';
import { cardClass } from './theme';
import { SectionHeader } from './primitives';

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
                    <span className="w-5 h-5 rounded-full bg-[#EFEAFF] dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800/40 text-[10px] font-bold text-[#5A32FA] flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-[#171633] dark:text-zinc-200 truncate" title={item.nama}>
                      {item.nama}
                    </span>
                  </div>
                  <span className="font-extrabold text-[#171633] dark:text-zinc-100 text-xs">{item.jumlah} <span className="text-[10px] font-normal text-[#A9A9C6] dark:text-zinc-400">unit</span></span>
                </div>
                <div className="w-full bg-[#F0F1F7] dark:bg-[#222226] border border-transparent dark:border-[#383842] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5A32FA] dark:bg-[#818cf8] rounded-full transition-all"
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
