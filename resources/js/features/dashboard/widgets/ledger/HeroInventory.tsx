import { useState, type ReactNode } from 'react';
import { Package } from 'lucide-react';
import type { InventoryPerMerek, TrenPembelianInventory } from '../../types';
import { EmptyNote } from './primitives';

// Ukuran kanvas SVG (viewBox). Chart ikut melebar lewat width 100%, teks ikut mengecil proporsional.
const W = 640;
const H = 230;
const PAD_L = 34;
const PAD_R = 18;
const PAD_T = 64; // ruang untuk tooltip di atas titik tertinggi
const PAD_B = 28;

// Kurva halus (Catmull-Rom -> bezier) melewati semua titik.
function smooth(p: [number, number][]): string {
  if (p.length === 1) return `M${p[0][0]} ${p[0][1]}`;
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    d += ` C${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6}, ${c[0] - (e[0] - b[0]) / 6} ${c[1] - (e[1] - b[1]) / 6}, ${c[0]} ${c[1]}`;
  }
  return d;
}

// Chart garis pembelian per bulan. Arahkan kursor (atau sentuh) untuk melihat angka tiap bulan; default = bulan terakhir.
function PembelianLineChart({ rows }: { rows: TrenPembelianInventory[] }) {
  const last = rows.length - 1;
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null && hover <= last ? hover : last;

  const max = Math.max(0, ...rows.map((r) => r.jumlah));
  const step = Math.max(1, Math.ceil((max * 1.15) / 4));
  const top = step * 4;
  const plotH = H - PAD_T - PAD_B;
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const x = (i: number) => (rows.length === 1 ? (PAD_L + W - PAD_R) / 2 : PAD_L + (i * (W - PAD_L - PAD_R)) / (rows.length - 1));

  const pts = rows.map((r, i) => [x(i), y(r.jumlah)] as [number, number]);
  const line = smooth(pts);
  const baseY = PAD_T + plotH;
  const area = `${line} L${pts[pts.length - 1][0]} ${baseY} L${pts[0][0]} ${baseY} Z`;
  const q = pts[active];

  const prev = rows[active - 1];
  const diff = prev ? rows[active].jumlah - prev.jumlah : null;
  const deltaText = diff === null ? 'Data awal' : diff === 0 ? 'Sama dengan bulan lalu' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} unit`;

  const BW = 118;
  const bx = Math.min(Math.max(q[0] - BW / 2, 4), W - BW - 4);
  const by = Math.max(q[1] - 68, 2);

  const onMove = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) * W) / r.width;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((pt, i) => {
      const dd = Math.abs(pt[0] - vx);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    if (best !== hover) setHover(best);
  };

  return (
    <svg
      className="dd-lc"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Pembelian inventory per bulan. ${rows[active].bulan}: ${rows[active].jumlah} unit.`}
      onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
      onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
    >
      <defs>
        <linearGradient id="dd-lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--dv-primary)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--dv-primary)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3, 4].map((i) => {
        const v = i * step;
        return (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R + 6} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--dv-line)' }} />
            <text x={0} y={y(v) + 3} fontSize={10} style={{ fill: 'var(--dv-muted)' }}>
              {v}
            </text>
          </g>
        );
      })}

      <path d={area} fill="url(#dd-lc-fill)" />
      <path d={line} fill="none" strokeWidth={2.4} strokeLinecap="round" style={{ stroke: 'var(--dv-primary)' }} />

      {pts.map((pt, i) =>
        i === active ? null : <circle key={i} cx={pt[0]} cy={pt[1]} r={3.2} strokeWidth={1.6} style={{ fill: 'var(--dd-card)', stroke: 'var(--dv-primary)' }} />,
      )}

      <line x1={q[0]} x2={q[0]} y1={q[1] + 10} y2={baseY} strokeDasharray="3 3" style={{ stroke: 'var(--dv-primary)' }} />
      <circle cx={q[0]} cy={q[1]} r={10} style={{ fill: 'var(--dv-primary)', fillOpacity: 0.16 }} />
      <circle cx={q[0]} cy={q[1]} r={5} strokeWidth={2} style={{ fill: 'var(--dv-primary)', stroke: 'var(--dd-card)' }} />

      {/* tooltip: warna dari token "today" (gelap di mode terang, terang di mode gelap) */}
      <rect x={bx} y={by} width={BW} height={54} rx={9} style={{ fill: 'var(--dv-today-bg)' }} />
      <polygon points={`${q[0] - 5},${by + 54} ${q[0] + 5},${by + 54} ${q[0]},${by + 60}`} style={{ fill: 'var(--dv-today-bg)' }} />
      <text x={bx + 12} y={by + 17} fontSize={10} style={{ fill: 'var(--dv-today-fg)', opacity: 0.7 }}>
        {rows[active].bulan}
      </text>
      <text x={bx + 12} y={by + 36} fontSize={16} fontWeight={700} style={{ fill: 'var(--dv-today-fg)' }}>
        {rows[active].jumlah} unit
      </text>
      <text x={bx + 12} y={by + 49} fontSize={10} style={{ fill: 'var(--dv-today-dot)' }}>
        {deltaText}
      </text>

      {rows.map((r, i) => (
        <text key={r.bulan + i} x={pts[i][0]} y={H - 6} textAnchor="middle" fontSize={11} fontWeight={i === active ? 700 : 400} style={{ fill: i === active ? 'var(--dv-ink)' : 'var(--dv-muted)' }}>
          {r.bulan}
        </text>
      ))}
    </svg>
  );
}

// [DASHBOARD-V3] Kartu utama dashboard admin: ringkasan di kiri, chart pembelian (hover) di kanan.
export function HeroInventory({
  total,
  tren = [],
  perMerek = [],
  kalimat,
  actions,
}: {
  total: number;
  tren?: TrenPembelianInventory[];
  perMerek?: InventoryPerMerek[];
  kalimat: string;
  actions?: ReactNode;
}) {
  const rows = Array.isArray(tren) ? tren : [];
  const merek = Array.isArray(perMerek) ? perMerek : [];
  const bulanIni = rows[rows.length - 1];
  const terbanyak = merek[0];
  const tersedikit = merek.length > 1 ? merek[merek.length - 1] : null;
  const totalBeli = rows.reduce((a, r) => a + r.jumlah, 0);

  return (
    <section aria-label="Ringkasan inventory" className="dd-card dd-hv">
      <div className="dd-hv-l">
        <div className="dd-hv-k">
          <Package size={14} aria-hidden="true" />
          Marimas IT Vault
        </div>
        <b className="dv-g dd-hv-big">{total}</b>
        <span className="dd-hv-sub">total inventory</span>
        <p className="dd-hv-d">
          {bulanIni && bulanIni.jumlah > 0 ? (
            <>
              <b className="is-up">▲ {bulanIni.jumlah}</b> unit baru ({bulanIni.bulan})
            </>
          ) : (
            <span className="dv-muted">Belum ada pembelian bulan ini</span>
          )}
        </p>
        <div className="dd-hv-two">
          <div>
            <small>Unit paling banyak</small>
            <b title={terbanyak?.nama}>{terbanyak ? `${terbanyak.nama} : ${terbanyak.jumlah} Unit` : '-'}</b>
          </div>
          <div>
            <small>Unit paling sedikit</small>
            <b title={tersedikit?.nama}>{tersedikit ? `${tersedikit.nama} : ${tersedikit.jumlah} Unit` : '-'}</b>
          </div>
        </div>
        <p className="dd-hv-note">{kalimat}</p>
        {actions && <div className="dd-hv-act">{actions}</div>}
      </div>

      <div className="dd-hv-r">
        <div className="dd-hv-rh">
          <b className="dv-g">Pembelian {rows.length || 6} bulan terakhir</b>
          <span>Total {totalBeli} unit</span>
        </div>
        {rows.length === 0 ? <EmptyNote>Belum ada data pembelian.</EmptyNote> : <PembelianLineChart rows={rows} />}
      </div>
    </section>
  );
}
