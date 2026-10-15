import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { AktivitasInventoryTerbaru } from '../useDashboardData';
import { cardClass } from './theme';
import { SectionHeader } from './primitives';
import { AktivitasTimelineList } from './AktivitasTimelineList';

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
