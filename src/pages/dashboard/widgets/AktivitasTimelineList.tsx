import type { AktivitasInventoryTerbaru } from '../useDashboardData';
import { AKTIVITAS_ASET_STYLE } from './aktivitas';
import { THEME } from './theme';

export function AktivitasTimelineList({
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
