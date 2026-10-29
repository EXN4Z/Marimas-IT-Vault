import type { DepartemenDistribusi } from '../../types';
import { Panel, EmptyNote } from './primitives';

const PODIUM = [
  { cls: 'g', rank: '1st' },
  { cls: 'p', rank: '2nd' },
  { cls: 'y', rank: '3rd' },
];

function inisial(nama: string): string {
  const w = nama.trim().split(/\s+/).filter(Boolean);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return nama.trim().slice(0, 2).toUpperCase() || '?';
}

// Data sumbernya distribusi KARYAWAN per departemen (bukan aset).
// 3 terbesar jadi kartu podium; 3 berikutnya bar; sisanya digabung "Lainnya".
export function DepartemenKaryawan({ data = [] }: { data?: DepartemenDistribusi[] }) {
  const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => b.jumlah - a.jumlah);
  const top = sorted.slice(0, 3);
  const sisa = sorted.slice(3);
  const berikut = sisa.slice(0, 3);
  const lebih = sisa.slice(3);
  const bars =
    lebih.length > 0
      ? [...berikut, { departemen: `Lainnya (${lebih.length} departemen)`, jumlah: lebih.reduce((a, d) => a + d.jumlah, 0), percent: 0 }]
      : berikut;
  const max = Math.max(1, ...bars.map((r) => r.jumlah));
  const totalKaryawan = sorted.reduce((a, d) => a + d.jumlah, 0);

  return (
    <Panel
      title="Karyawan per departemen"
      subtitle={`${sorted.length} departemen, ${totalKaryawan} karyawan.${sorted.length > 3 ? ' Tiga terbesar di atas, sisanya di bawah.' : ''}`}
    >
      {sorted.length === 0 ? (
        <EmptyNote>Belum ada data departemen.</EmptyNote>
      ) : (
        <div className={`dd-dept ${bars.length > 0 ? 'has-bars' : ''}`}>
          <div className="dd-podium">
            {top.map((d, i) => (
              <div key={d.departemen} className={`dd-pod ${PODIUM[i].cls}`}>
                <span className="deco" aria-hidden="true" />
                <div className="av">{inisial(d.departemen)}</div>
                <b className="n">{d.departemen}</b>
                <small>Departemen</small>
                <div className="v dv-g">{d.jumlah}</div>
                <div className="rk">{PODIUM[i].rank}</div>
              </div>
            ))}
          </div>
          {bars.length > 0 && (
            <div>
              {bars.map((r) => (
                <div key={r.departemen} className="dd-drow">
                  <span className="truncate">{r.departemen}</span>
                  <div className="tr" role="img" aria-label={`${r.departemen}: ${r.jumlah} karyawan`}>
                    <i style={{ width: `${(r.jumlah / max) * 100}%` }} />
                  </div>
                  <b>{r.jumlah}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
