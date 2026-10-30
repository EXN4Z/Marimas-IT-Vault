import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AktivitasInventoryTerbaru } from '../../types';
import { AktivitasRows } from './AktivitasLedger';
import { toneAktivitas } from './aktivitasMeta';
import { Pager } from './Pager';
import { Panel } from './primitives';

const PER_PAGE = 3;
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const byWaktuDesc = (a: AktivitasInventoryTerbaru, b: AktivitasInventoryTerbaru) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime();

// Grid bulan, minggu mulai Senin.
function buildGrid(year: number, month: number) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  for (let d = 1; d <= days; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, next++), inMonth: false });
  return cells;
}

// [DASHBOARD-V4] Dua kartu yang berbagi satu state tanggal:
//  - "Aktivitas terbaru": 3 baris per halaman; tanpa tanggal terpilih = feed terbaru, dengan tanggal terpilih = log hari itu.
//  - "Kalender": titik berwarna per jenis aktivitas; klik tanggal untuk memfilter, klik lagi (atau "Tampilkan Terbaru") untuk reset.
export function AktivitasKalender({ aktivitas = [], onLihatSemua }: { aktivitas?: AktivitasInventoryTerbaru[]; onLihatSemua: () => void }) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);
  const [page, setPage] = useState(1);

  const semua = useMemo(() => (Array.isArray(aktivitas) ? aktivitas : []).filter((e) => !isNaN(new Date(e.waktu).getTime())), [aktivitas]);

  const perTanggal = useMemo(() => {
    const map = new Map<string, AktivitasInventoryTerbaru[]>();
    for (const ev of semua) {
      const k = keyOf(new Date(ev.waktu));
      const list = map.get(k);
      if (list) list.push(ev);
      else map.set(k, [ev]);
    }
    return map;
  }, [semua]);

  const list = useMemo(() => (selected ? [...(perTanggal.get(keyOf(selected)) ?? [])] : [...semua]).sort(byWaktuDesc), [selected, perTanggal, semua]);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const tampil = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  const cells = useMemo(() => buildGrid(view.getFullYear(), view.getMonth()), [view]);

  const pilih = (d: Date) => {
    setSelected((s) => (s && sameDay(s, d) ? null : d));
    setPage(1);
  };
  const reset = () => {
    setSelected(null);
    setPage(1);
  };
  const geser = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const judulTanggal = selected?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  return (
    <div className="dd-pair">
      <Panel
        title={selected ? `Aktivitas ${judulTanggal}` : 'Aktivitas Terbaru'}
        right={
          <button type="button" className="dd-pill" onClick={selected ? reset : onLihatSemua}>
            {selected ? 'Tampilkan Terbaru' : 'Lihat Semua'}
          </button>
        }
      >
        <div className="dd-fill">
          <AktivitasRows events={tampil} variant="ringkas" kosong={selected ? 'Tidak ada aktivitas pada tanggal ini' : 'Belum ada aktivitas.'} />
        </div>
        <Pager total={list.length} perPage={PER_PAGE} page={cur} onPage={setPage} />
      </Panel>

      <Panel
        title="Kalender"
        right={
          <div className="dd-mc-head">
            <b className="dv-g" aria-live="polite">
              {BULAN[view.getMonth()]} {view.getFullYear()}
            </b>
            <div>
              <button type="button" className="dd-pa" aria-label="Bulan sebelumnya" onClick={() => geser(-1)}>
                <ChevronLeft size={13} />
              </button>
              <button type="button" className="dd-pa" aria-label="Bulan berikutnya" onClick={() => geser(1)}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        }
      >
        <div className="dd-mc-dow" aria-hidden="true">
          {HARI.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="dd-mc-grid" role="group" aria-label={`Kalender ${BULAN[view.getMonth()]} ${view.getFullYear()}`}>
          {cells.map(({ date, inMonth }) => {
            const events = perTanggal.get(keyOf(date)) ?? [];
            const tones = [...new Set(events.map(toneAktivitas))].slice(0, 4);
            const isToday = sameDay(date, today);
            const isSel = !!selected && sameDay(date, selected);
            const cls = ['dd-mc', !inMonth && 'is-out', events.length > 0 && 'is-ev', isToday && 'is-today', isSel && 'is-sel'].filter(Boolean).join(' ');
            return (
              <button
                key={keyOf(date)}
                type="button"
                className={cls}
                aria-pressed={isSel}
                aria-label={`${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, ${events.length} aktivitas`}
                onClick={() => pilih(date)}
              >
                <span className="dv-g">{date.getDate()}</span>
                <span className="dd-mc-dots" aria-hidden="true">
                  {tones.map((t) => (
                    <i key={t} className={`t-${t}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="dd-legend dd-legend-end">
          <span>
            <i className="lg-pri" />
            Dipinjam
          </span>
          <span>
            <i className="lg-grn" />
            Dikembalikan
          </span>
          <span>
            <i className="lg-yel" />
            Lapor Rusak
          </span>
          <span>
            <i className="lg-red" />
            Rusak Berat
          </span>
        </div>
      </Panel>
    </div>
  );
}
