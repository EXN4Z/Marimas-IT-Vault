import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AktivitasInventoryTerbaru } from '../../types';
import { AktivitasRows } from './AktivitasLedger';
import { Panel } from './primitives';

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Grid bulan, minggu mulai hari Senin.
function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const inMonthDays = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  for (let d = 1; d <= inMonthDays; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, next++), inMonth: false });
  return cells;
}

export function KalenderLedger({
  aktivitas = [],
  subtitle,
}: {
  aktivitas?: AktivitasInventoryTerbaru[];
  subtitle: string;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(() => buildGrid(view.getFullYear(), view.getMonth()), [view]);

  const perTanggal = useMemo(() => {
    const map = new Map<string, AktivitasInventoryTerbaru[]>();
    for (const ev of Array.isArray(aktivitas) ? aktivitas : []) {
      const d = new Date(ev.waktu);
      if (isNaN(d.getTime())) continue;
      const k = keyOf(d);
      const list = map.get(k);
      if (list) list.push(ev);
      else map.set(k, [ev]);
    }
    return map;
  }, [aktivitas]);

  const log = useMemo(
    () => [...(perTanggal.get(keyOf(selected)) ?? [])].sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime()),
    [perTanggal, selected],
  );

  const geser = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const kembaliKeHariIni = () => {
    setView(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };
  const judulLog = selected.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="dv-cols lg:grid-cols-[2fr_1fr]">
      <Panel
        title="Kalender operasional"
        subtitle={subtitle}
        right={
          <div className="flex items-center gap-2">
            <button type="button" className="dv-btn" style={{ padding: 0, width: 44 }} aria-label="Bulan sebelumnya" onClick={() => geser(-1)}>
              <ChevronLeft size={18} className="mx-auto" />
            </button>
            <b className="dv-g text-[17px] text-center" style={{ minWidth: 124 }} aria-live="polite">
              {BULAN[view.getMonth()]} {view.getFullYear()}
            </b>
            <button type="button" className="dv-btn" style={{ padding: 0, width: 44 }} aria-label="Bulan berikutnya" onClick={() => geser(1)}>
              <ChevronRight size={18} className="mx-auto" />
            </button>
            <button type="button" className="dv-btn ml-1.5" onClick={kembaliKeHariIni}>Hari ini</button>
          </div>
        }
      >
        <div className="dv-cal" role="group" aria-label={`Kalender ${BULAN[view.getMonth()]} ${view.getFullYear()}`}>
          {HARI.map((h) => (
            <span key={h} className="text-[12px] dv-muted px-2.5 pb-2">{h}</span>
          ))}
          {cells.map(({ date, inMonth }) => {
            const events = perTanggal.get(keyOf(date)) ?? [];
            const adaLapor = events.some((e) => e.type === 'lapor_rusak');
            const isToday = sameDay(date, today);
            const isSel = sameDay(date, selected);
            const cls = ['dv-cell', !inMonth && 'is-out', isToday && 'is-today', isSel && 'is-sel'].filter(Boolean).join(' ');
            return (
              <button
                key={keyOf(date)}
                type="button"
                className={cls}
                aria-pressed={isSel}
                aria-label={`${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, ${events.length} mutasi${adaLapor ? ', ada laporan kerusakan' : ''}`}
                onClick={() => setSelected(date)}
              >
                <b className="dv-g">{date.getDate()}</b>
                {events.length > 0 && (
                  <span className="dv-dots" aria-hidden="true">
                    <span className="dv-dot" />
                    {adaLapor && <span className="dv-dot is-alert" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title={judulLog} subtitle={log.length > 0 ? `${log.length} mutasi pada tanggal ini` : 'Pilih tanggal untuk melihat lognya.'}>
        <div className="max-h-[380px] overflow-y-auto">
          <AktivitasRows
            events={log}
            kosong="Tidak ada mutasi pada tanggal ini."
            timeFormatter={(w) => new Date(w).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          />
        </div>
      </Panel>
    </div>
  );
}
