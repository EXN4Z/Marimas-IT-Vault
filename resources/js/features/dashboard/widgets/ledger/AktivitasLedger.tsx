import { Users, Check, CheckCircle2, AlertTriangle, Wrench, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AktivitasInventoryTerbaru } from '../../types';
import { AKTIVITAS_ASET_STYLE, formatWaktuSingkat } from '../aktivitas/aktivitas';
import { EmptyNote } from './primitives';

// Warna lingkaran + ikon per jenis aktivitas.
const TAMPIL: Record<AktivitasInventoryTerbaru['type'], { tone: string; Icon: LucideIcon }> = {
  pinjam: { tone: 'primary', Icon: Users },
  kembali: { tone: 'green', Icon: Check },
  lapor_rusak: { tone: 'alert', Icon: AlertTriangle },
  mulai_perbaikan: { tone: 'yellow', Icon: Wrench },
  selesai_perbaikan: { tone: 'green', Icon: CheckCircle2 },
  dijual: { tone: 'slate', Icon: Tag },
};

// Daftar baris aktivitas (kartu "Aktivitas terbaru" dan log harian di kalender).
// variant 'tanggal' = lingkaran berisi tanggal; 'ikon' = lingkaran berisi ikon jenis aktivitas.
export function AktivitasRows({
  events = [],
  timeFormatter = formatWaktuSingkat,
  kosong = 'Belum ada aktivitas.',
  variant = 'tanggal',
}: {
  events?: AktivitasInventoryTerbaru[];
  timeFormatter?: (waktu: string) => string;
  kosong?: string;
  variant?: 'tanggal' | 'ikon';
}) {
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return <EmptyNote>{kosong}</EmptyNote>;
  return (
    <div>
      {list.map((ev, i) => {
        const label = AKTIVITAS_ASET_STYLE[ev.type]?.label ?? 'mengubah status';
        const kode = ev.inventory?.kode_inventory || '-';
        const pelaku = ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
        const t = TAMPIL[ev.type] ?? { tone: 'slate', Icon: Tag };
        const day = new Date(ev.waktu).getDate();
        return (
          <div key={`${ev.type}-${ev.waktu}-${i}`} className="dd-li">
            <div className={`dd-dc t-${t.tone}`} aria-hidden="true">
              {variant === 'ikon' ? <t.Icon size={18} /> : isNaN(day) ? '-' : String(day).padStart(2, '0')}
            </div>
            <div className="dd-lm">
              <b>
                {kode} {ev.inventory?.nama ?? ''}
              </b>
              <span>
                {pelaku ? `${pelaku} ` : ''}
                <u className={ev.type === 'lapor_rusak' ? 'is-alert' : undefined}>{label}</u>
              </span>
            </div>
            <span className="dd-tm">{timeFormatter(ev.waktu)}</span>
          </div>
        );
      })}
    </div>
  );
}
