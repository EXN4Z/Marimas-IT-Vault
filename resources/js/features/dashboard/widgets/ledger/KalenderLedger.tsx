import { useMemo, useState, type ReactNode } from 'react';
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

// `aside` = kartu tambahan di bawah log harian (kolom kanan), mis. notifikasi.
export function KalenderLedger({
  aktivitas = [],
  subtitle,
  aside,
}: {
  aktivitas?: AktivitasInventoryTerbaru[];
  subtitle: string;
  aside?: ReactNode;
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
    <div className="dd-split">
      <Panel title="Kalender operasional" subtitle={subtitle} className="dd-calcard">
        <div className="dd-cal-head">
          <button type="button" className="dd-pa is-back" aria-label="Bulan sebelumnya" onClick={() => geser(-1)}>
            <ChevronLeft size={16} />
          </button>
          <b className="dv-g dd-cal-mn" aria-live="polite">
            {BULAN[view.getMonth()]} {view.getFullYear()}
          </b>
          <button type="button" className="dd-pa" aria-label="Bulan berikutnya" onClick={() => geser(1)}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="dd-btn dd-btn-sm" onClick={kembaliKeHariIni}>
            Hari ini
          </button>
        </div>

        <div className="dd-dow" aria-hidden="true">
          {HARI.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="dd-days" role="group" aria-label={`Kalender ${BULAN[view.getMonth()]} ${view.getFullYear()}`}>
          {cells.map(({ date, inMonth }) => {
            const events = perTanggal.get(keyOf(date)) ?? [];
            const adaLapor = events.some((e) => e.type === 'lapor_rusak');
            const isToday = sameDay(date, today);
            const isSel = sameDay(date, selected);
            const cls = [
              'dd-cell',
              !inMonth && 'is-out',
              events.length > 0 && 'is-ev',
              adaLapor && 'is-al',
              isToday && 'is-today',
              isSel && 'is-sel',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={keyOf(date)}
                type="button"
                className={cls}
                aria-pressed={isSel}
                aria-label={`${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, ${events.length} mutasi${adaLapor ? ', ada laporan kerusakan' : ''}`}
                onClick={() => setSelected(date)}
              >
                <span className="dv-g">{String(date.getDate()).padStart(2, '0')}</span>
              </button>
            );
          })}
        </div>
        <div className="dd-legend">
          <span>
            <i className="lg-today" />
            Hari ini
          </span>
          <span>
            <i className="lg-ev" />
            Ada mutasi
          </span>
          <span>
            <i className="lg-al" />
            Ada laporan rusak
          </span>
        </div>
      </Panel>

      <div className="dd-aside">
        <Panel title={judulLog} subtitle={log.length > 0 ? `${log.length} mutasi pada tanggal ini` : 'Pilih tanggal untuk melihat lognya.'}>
          <div className="dd-logscroll">
            <AktivitasRows
              events={log}
              variant="ikon"
              kosong="Tidak ada mutasi pada tanggal ini."
              timeFormatter={(w) => new Date(w).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            />
          </div>
        </Panel>
        {aside}
      </div>
    </div>
  );
}
