import { useState } from 'react';
import { Package } from 'lucide-react';
import type { InventoryPerMerek, TrenPembelianInventory } from '../../types';
import { EmptyNote } from './primitives';

// Kanvas SVG (viewBox). Chart ikut melebar lewat width 100%, teks ikut mengecil proporsional.
const W = 720;
const H = 190;
const PAD_L = 44;
const PAD_R = 16;
const Y_TOP = 60; // garis grid paling atas
const Y_BASE = 160; // garis dasar (grid paling bawah)

// Skala 4 garis grid: nilai terendah dibulatkan ke bawah, jarak antar garis dipilih supaya nilai tertinggi masih masuk.
function skala(vals: number[]) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pilihan = [5, 10, 20, 25, 50, 100, 200, 500, 1000];
  let step = pilihan[pilihan.length - 1];
  for (const s of pilihan) {
    if (Math.floor(min / s) * s + 3 * s >= max) {
      step = s;
      break;
    }
  }
  return { lo: Math.floor(min / step) * step, step };
}

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

// Chart pertumbuhan inventory per bulan. Arahkan kursor (atau sentuh) untuk pindah bulan aktif; default = bulan terakhir.
function PertumbuhanChart({ rows }: { rows: TrenPembelianInventory[] }) {
  const last = rows.length - 1;
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null && hover <= last ? hover : last;

  const vals = rows.map((r) => r.total ?? r.jumlah);
  const { lo, step } = skala(vals);
  const top = lo + step * 3;
  const y = (v: number) => Y_BASE - ((v - lo) / (top - lo)) * (Y_BASE - Y_TOP);
  const x = (i: number) => (rows.length === 1 ? (PAD_L + W - PAD_R) / 2 : PAD_L + (i * (W - PAD_L - PAD_R)) / (rows.length - 1));

  const pts = vals.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${pts[last][0]} ${Y_BASE} L${pts[0][0]} ${Y_BASE} Z`;
  const q = pts[active];

  const diff = active > 0 ? vals[active] - vals[active - 1] : null;
  const deltaText = diff === null ? 'Data awal' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} Unit`;
  const namaBulan = `${rows[active].bulan}${rows[active].tahun ? ` ${rows[active].tahun}` : ''}`;

  const BW = 110;
  const bx = Math.min(Math.max(q[0] - BW / 2, 4), W - BW - 4);
  const by = Math.max(q[1] - 70, 2);

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
      aria-label={`Pertumbuhan inventory per bulan. ${namaBulan}: ${vals[active]} unit.`}
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

      {[0, 1, 2, 3].map((i) => {
        const v = lo + i * step;
        return (
          <g key={v}>
            <line x1={PAD_L - 14} x2={W - 4} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--dv-line)' }} />
            <text x={0} y={y(v) + 3} fontSize={9} style={{ fill: 'var(--dv-muted)' }}>
              {v}
            </text>
          </g>
        );
      })}

      <path d={area} fill="url(#dd-lc-fill)" />
      <path d={line} fill="none" strokeWidth={2.2} strokeLinecap="round" style={{ stroke: 'var(--dv-primary)' }} />

      {pts.map((pt, i) =>
        i === active ? null : <circle key={i} cx={pt[0]} cy={pt[1]} r={3} strokeWidth={1.5} style={{ fill: 'var(--dd-card)', stroke: 'var(--dv-primary)' }} />,
      )}

      <line x1={q[0]} x2={q[0]} y1={q[1] + 9} y2={Y_BASE} strokeDasharray="3 3" style={{ stroke: 'var(--dv-primary)' }} />
      <circle cx={q[0]} cy={q[1]} r={9} style={{ fill: 'var(--dv-primary)', fillOpacity: 0.15 }} />
      <circle cx={q[0]} cy={q[1]} r={5} strokeWidth={2} style={{ fill: 'var(--dv-primary)', stroke: 'var(--dd-card)' }} />

      {/* tooltip: #111 di mode terang, terang di mode gelap (token today) */}
      <rect x={bx} y={by} width={BW} height={52} rx={8} style={{ fill: 'var(--dv-today-bg)' }} />
      <polygon points={`${q[0] - 5},${by + 52} ${q[0] + 5},${by + 52} ${q[0]},${by + 58}`} style={{ fill: 'var(--dv-today-bg)' }} />
      <text x={bx + 12} y={by + 17} fontSize={9} style={{ fill: 'var(--dv-today-fg)', opacity: 0.6 }}>
        {namaBulan}
      </text>
      <text x={bx + 12} y={by + 34} fontSize={14} fontWeight={700} style={{ fill: 'var(--dv-today-fg)' }}>
        {vals[active]} Unit
      </text>
      <text x={bx + 12} y={by + 46} fontSize={9} style={{ fill: 'var(--dd-tip-delta)' }}>
        {deltaText}
      </text>

      {rows.map((r, i) => (
        <text key={r.bulan + i} x={pts[i][0]} y={H - 8} textAnchor="middle" fontSize={9} fontWeight={i === active ? 700 : 400} style={{ fill: i === active ? 'var(--dv-ink)' : 'var(--dv-muted)' }}>
          {r.bulan}
        </text>
      ))}
    </svg>
  );
}

// [DASHBOARD-V4] Kartu utama dashboard admin: total + perubahan bulan ini di kiri, chart pertumbuhan (hover) di kanan.
export function HeroInventory({ total, tren = [], perMerek = [] }: { total: number; tren?: TrenPembelianInventory[]; perMerek?: InventoryPerMerek[] }) {
  const rows = Array.isArray(tren) ? tren : [];
  const merek = Array.isArray(perMerek) ? perMerek : [];
  const bulanIni = rows[rows.length - 1];
  const terbanyak = merek[0];
  const tersedikit = merek.length > 1 ? merek[merek.length - 1] : null;

  return (
    <section aria-label="Ringkasan inventory" className="dd-card dd-hv">
      <div className="dd-hv-l">
        <div className="dd-hv-k">
          <Package size={13} aria-hidden="true" />
          Marimas IT Vault
        </div>
        <b className="dv-g dd-hv-big">{total}</b>
        <b className={`dd-hv-chg ${bulanIni && bulanIni.jumlah > 0 ? '' : 'is-flat'}`}>{bulanIni && bulanIni.jumlah > 0 ? `▲ ${bulanIni.jumlah}` : '–'}</b>
        <span className="dd-hv-cap">Unit (Bulan Ini)</span>
        <div className="dd-hv-two">
          <div>
            <small>Unit Paling Banyak</small>
            <b title={terbanyak?.nama}>{terbanyak ? `${terbanyak.nama} : ${terbanyak.jumlah} Unit` : '-'}</b>
          </div>
          <div>
            <small>Unit Paling Sedikit</small>
            <b title={tersedikit?.nama}>{tersedikit ? `${tersedikit.nama} : ${tersedikit.jumlah} Unit` : '-'}</b>
          </div>
        </div>
      </div>

      <div className="dd-hv-r">
        {/* Data harian/mingguan belum disediakan backend: hanya rentang 1 Tahun (12 bulan) yang aktif. */}
        <div className="dd-rng" role="group" aria-label="Rentang waktu">
          <button type="button" disabled title="Belum tersedia">
            1 Minggu
          </button>
          <button type="button" disabled title="Belum tersedia">
            1 Bulan
          </button>
          <button type="button" className="is-on" aria-pressed="true">
            1 Tahun
          </button>
        </div>
        {rows.length === 0 ? <EmptyNote>Belum ada data inventory.</EmptyNote> : <PertumbuhanChart rows={rows} />}
      </div>
    </section>
  );
}
