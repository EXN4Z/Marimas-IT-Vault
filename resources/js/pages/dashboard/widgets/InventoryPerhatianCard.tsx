import { AlertTriangle, Wrench, ShieldAlert, ArrowRight } from 'lucide-react';
import { useNavigate } from '../../../lib/router';
import type { InventoryPerhatian } from '../useDashboardData';
import { cardClass } from './theme';
import { SectionHeader, CardIcon } from './primitives';

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
