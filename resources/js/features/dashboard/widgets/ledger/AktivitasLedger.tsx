import type { AktivitasInventoryTerbaru } from '../../types';
import { AKTIVITAS_ASET_STYLE, formatWaktuSingkat } from '../aktivitas/aktivitas';
import { EmptyNote } from './primitives';

// Daftar baris aktivitas (dipakai kartu "Aktivitas terbaru" dan log harian di kalender).
export function AktivitasRows({
  events = [],
  timeFormatter = formatWaktuSingkat,
  kosong = 'Belum ada aktivitas.',
}: {
  events?: AktivitasInventoryTerbaru[];
  timeFormatter?: (waktu: string) => string;
  kosong?: string;
}) {
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return <EmptyNote>{kosong}</EmptyNote>;
  return (
    <>
      {list.map((ev, i) => {
        const label = AKTIVITAS_ASET_STYLE[ev.type]?.label ?? 'mengubah status';
        const kode = ev.inventory?.kode_inventory || '-';
        const pelaku = ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
        return (
          <div key={`${ev.type}-${ev.waktu}-${i}`} className="dv-row">
            <span>
              <b>{kode}</b> {ev.inventory?.nama ?? ''}
              <br />
              {pelaku ? `${pelaku} ` : ''}
              <span className={ev.type === 'lapor_rusak' ? 'dv-alert' : undefined}>{label}</span>
            </span>
            <span className="dv-side">{timeFormatter(ev.waktu)}</span>
          </div>
        );
      })}
    </>
  );
}
