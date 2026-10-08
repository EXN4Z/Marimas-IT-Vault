import { ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AktivitasInventoryTerbaru } from '../useDashboardData';
import { cardClass } from './theme';
import { SectionHeader } from './primitives';
import { AktivitasTimelineList } from './AktivitasTimelineList';
import { formatWaktuSingkat } from './aktivitas';

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
