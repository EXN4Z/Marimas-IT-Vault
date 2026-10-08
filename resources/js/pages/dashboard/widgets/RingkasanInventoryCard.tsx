import { Boxes, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from '../../../lib/router';
import type { RingkasanInventory } from '../useDashboardData';
import { cardClass, THEME } from './theme';
import { SectionHeader, LegendDot } from './primitives';

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
        <div className="flex w-full h-2 rounded-full overflow-hidden bg-[#F0F1F7] dark:bg-[#222226] border border-transparent dark:border-[#383842] my-2">
          {inventoryTotal > 0 ? (
            <>
              <div style={{ width: `${tersediaPct}%`, background: THEME.emerald }} title={`Tersedia: ${inventoryTersedia}`} />
              <div style={{ width: `${dipakaiPct}%`, background: THEME.violet }} title={`Dipakai: ${inventoryDipakai}`} />
              <div style={{ width: `${rusakBeratPct}%`, background: THEME.rose }} title={`Rusak Berat: ${inventoryRusakBerat}`} />
              <div style={{ width: `${dijualPct}%`, background: '#A9A9C6' }} title={`Dijual: ${inventoryDijual}`} />
            </>
          ) : (
            <div className="w-full h-full bg-[#F0F1F7] dark:bg-[#222226]" />
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
