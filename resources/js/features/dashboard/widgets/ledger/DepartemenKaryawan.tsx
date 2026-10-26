import type { DepartemenDistribusi } from '../../types';
import { Panel, EmptyNote } from './primitives';

const TAMPIL = 5;

// Data sumbernya distribusi KARYAWAN per departemen (bukan aset).
export function DepartemenKaryawan({ data = [] }: { data?: DepartemenDistribusi[] }) {
  const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => b.jumlah - a.jumlah);
  const top = sorted.slice(0, TAMPIL);
  const sisa = sorted.slice(TAMPIL);
  const rows = sisa.length > 0
    ? [...top, { departemen: `Lainnya (${sisa.length} departemen)`, jumlah: sisa.reduce((a, d) => a + d.jumlah, 0), percent: 0 }]
    : top;
  const max = Math.max(1, ...rows.map((r) => r.jumlah));
  const totalKaryawan = sorted.reduce((a, d) => a + d.jumlah, 0);

  return (
    <Panel title="Karyawan per departemen" subtitle={`${sorted.length} departemen, ${totalKaryawan} karyawan.`}>
      {rows.length === 0 ? (
        <EmptyNote>Belum ada data departemen.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-3.5 text-[13px]">
          {rows.map((r) => (
            <div key={r.departemen}>
              <div className="flex justify-between mb-1.5 dv-soft">
                <span>{r.departemen}</span>
                <b style={{ color: 'var(--dv-ink)' }}>{r.jumlah}</b>
              </div>
              <div className="dv-track" role="img" aria-label={`${r.departemen}: ${r.jumlah} karyawan`}>
                <div className="dv-fill" style={{ width: `${(r.jumlah / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
