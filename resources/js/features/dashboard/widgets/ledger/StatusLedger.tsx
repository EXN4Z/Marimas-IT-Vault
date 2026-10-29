import type { CSSProperties, ReactNode } from 'react';
import { Package, Check, Users, AlertTriangle } from 'lucide-react';
import type { RingkasanInventory } from '../../types';

type Tone = 'green' | 'yellow' | 'salmon';

function KpiRing({
  icon,
  label,
  value,
  caption,
  pct,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  caption: string;
  pct: number;
  tone: Tone;
}) {
  return (
    <div className={`dd-k dd-k-${tone}`}>
      <span className="dd-k-blob" aria-hidden="true" />
      <span className="dd-k-blob2" aria-hidden="true" />
      <div className="dd-k-ic">{icon}</div>
      <div className="dd-k-tx">
        <small>{label}</small>
        <b className="dv-g">{value}</b>
        <em>{caption}</em>
      </div>
      <div className="dd-k-rg" style={{ '--p': pct } as CSSProperties} role="img" aria-label={`${pct}% dari total inventory`}>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

// 4 kartu KPI admin: total aset (hero + bar bersegmen) dan 3 kartu ber-ring (tersedia / dipakai / rusak berat).
export function StatusLedger({ ringkasan }: { ringkasan: RingkasanInventory }) {
  const total = ringkasan?.total ?? 0;
  const tersedia = ringkasan?.tersedia ?? 0;
  const dipakai = ringkasan?.dipakai ?? 0;
  const rusak = ringkasan?.rusakBerat ?? 0;
  const dijual = ringkasan?.dijual ?? 0;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const segs = [
    { label: 'Tersedia', value: tersedia, color: '#5EE09A' },
    { label: 'Dipakai', value: dipakai, color: '#F5B83D' },
    { label: 'Rusak', value: rusak, color: '#FF8A7A' },
    { label: 'Dijual', value: dijual, color: 'rgba(255,255,255,.55)' },
  ];
  const summary = segs.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ');

  return (
    <section aria-label="Status inventory" className="dd-kpis">
      <div className="dd-k dd-k-hero">
        <span className="dd-k-r1" aria-hidden="true" />
        <span className="dd-k-r2" aria-hidden="true" />
        <div className="dd-k-top">
          <div className="dd-k-ic">
            <Package size={23} />
          </div>
          <div className="dd-k-tx">
            <small>Total inventory</small>
            <b className="dv-g">{total}</b>
          </div>
        </div>
        <div>
          <div className="dd-seg" role="img" aria-label={`Dari ${total} inventory: ${summary}`}>
            {total === 0 ? (
              <i style={{ flex: 1, background: 'rgba(255,255,255,.25)' }} />
            ) : (
              segs.filter((s) => s.value > 0).map((s) => <i key={s.label} style={{ flex: s.value, minWidth: 6, background: s.color }} />)
            )}
          </div>
          <div className="dd-seg-cap">
            {segs.map((s) => (
              <span key={s.label}>
                <u style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <KpiRing tone="green" icon={<Check size={23} />} label="Tersedia" value={tersedia} caption="siap dipinjam" pct={pct(tersedia)} />
      <KpiRing tone="yellow" icon={<Users size={23} />} label="Dipakai" value={dipakai} caption="sedang dipakai" pct={pct(dipakai)} />
      <KpiRing tone="salmon" icon={<AlertTriangle size={23} />} label="Rusak berat" value={rusak} caption="belum ditangani" pct={pct(rusak)} />
    </section>
  );
}
