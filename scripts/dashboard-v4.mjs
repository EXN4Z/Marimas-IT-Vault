#!/usr/bin/env node
// Dashboard V4 (admin) — menerapkan desain "Marimas IT Vault" (Inter 12px, kartu 12px/border, aksen #6d5bf6, kolom kanan 252px).
// Jalankan dari root project:
//   node scripts/dashboard-v4.mjs --dry      # lihat apa yang akan berubah
//   node scripts/dashboard-v4.mjs            # terapkan (backup otomatis ke .migrasi-backup/dashboard-v4/)
//   node scripts/dashboard-v4.mjs --revert   # kembalikan semua file
// Aman dijalankan ulang: patch yang sudah terpasang dilewati; kalau ada potongan kode yang tidak cocok, tidak ada file yang diubah.
import fs from 'node:fs';
import path from 'node:path';

const FILES = {
  "resources/js/features/dashboard/dashboard-v4.css": `/* ===== DASHBOARD V4 (admin) =====
   Tampilan padat: Inter 12px, kartu putih radius 12 / padding 14 / border 1px tanpa bayangan, satu aksen ungu #6d5bf6.
   Semua aturan di-scope lewat .dd-v4 (dipasang di DashboardAdmin) supaya DashboardUser & halaman lain tidak berubah.
   Warna tetap lewat token --dv-* / --dd-* sehingga mode gelap (html.dark) ikut jalan. */
.dv.dd-v4 {
  --dv-ink: #0f1115; --dv-soft: #374151; --dv-muted: #6b7280; --dv-line: #eef0f3; --dv-track: #eef0f3; --dv-surface: #f7f8fb;
  --dv-primary: #6d5bf6; --dv-on-primary: #fff; --dv-alert: #e11d2e;
  --dv-today-bg: #111; --dv-today-fg: #fff;
  --dd-card: #fff; --dd-chip: #f7f8fb; --dd-shadow: none;
  --dd-green: #12b76a; --dd-green-ink: #12b76a; --dd-yellow: #f5b301; --dd-tip-delta: #34d399;
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.4;
}
html.dark .dv.dd-v4 { --dv-primary: #8b7cf8; --dv-on-primary: #fff; --dv-alert: #ff6b6b; --dd-tip-delta: #12b76a; }
.dd-v4 .dv-g { font-family: inherit; }

/* tata letak: kolom kiri fleksibel + kolom kanan 252px, jarak antar kartu 8px */
.dd-v4.dd-page, .dd-v4 .dd-main, .dd-v4 .dd-mcol, .dd-v4 .dd-pair, .dd-v4 .dd-kp { gap: 8px; }
@media (min-width: 1180px) { .dd-v4 .dd-main { grid-template-columns: minmax(0, 1fr) 252px; } }
.dd-v4 .dd-card { border-radius: 12px; padding: 14px; box-shadow: none; border: 1px solid #f0f1f4; }
html.dark .dd-v4 .dd-card { border-color: var(--dv-line); }

/* judul kartu + tautan sekunder */
.dd-v4 .dd-ch { align-items: center; flex-wrap: nowrap; margin-bottom: 10px; }
.dd-v4 .dv-h2 { font-size: 11px; font-weight: 600; line-height: 1.3; }
.dd-v4 .dd-pill { border: 0; border-radius: 0; padding: 0; background: none; font-size: 11px; font-weight: 500; color: var(--dv-soft); }
.dd-v4 .dd-pill:hover { background: none; text-decoration: underline; }
.dd-v4 .dd-link { font-size: 11px; font-weight: 500; color: var(--dv-muted); background: none; cursor: pointer; }
.dd-v4 .dd-link:disabled { opacity: .6; cursor: default; }
.dd-v4 .dd-empty { border-top: 0; padding: 34px 0; text-align: center; font-size: 11px; }
.dd-v4 .dd-fill { margin-bottom: 8px; }
.dd-v4 .dd-fill > .dd-empty { flex: 1; display: grid; place-items: center; padding: 0; }

/* hero */
.dd-v4 .dd-hv { gap: 12px; }
@container (min-width: 640px) { .dd-v4 .dd-hv { grid-template-columns: 230px minmax(0, 1fr); } }
.dd-v4 .dd-hv-k { font-size: 11px; font-weight: 600; color: var(--dv-ink); }
.dd-v4 .dd-hv-big { font-size: 34px; line-height: 1.1; margin-top: 14px; }
.dd-v4 .dd-hv-chg { display: block; font-size: 18px; font-weight: 600; line-height: 1.2; margin-top: 8px; color: var(--dd-green); }
.dd-v4 .dd-hv-chg.is-flat { color: var(--dv-muted); }
.dd-v4 .dd-hv-cap { font-size: 11px; color: var(--dv-muted); margin-top: 2px; }
.dd-v4 .dd-hv-two { display: flex; gap: 24px; margin-top: 22px; }
.dd-v4 .dd-hv-two > div { flex: 0 1 auto; }
.dd-v4 .dd-hv-two small { font-size: 10px; }
.dd-v4 .dd-hv-two b { font-size: 12px; font-weight: 600; }
.dd-v4 .dd-rng { display: flex; justify-content: flex-end; gap: 4px; margin-bottom: 6px; }
.dd-v4 .dd-rng button { font-size: 10px; padding: 3px 8px; border-radius: 6px; color: var(--dv-muted); background: none; cursor: pointer; }
.dd-v4 .dd-rng button.is-on { background: var(--dd-chip); color: var(--dv-ink); font-weight: 600; }
.dd-v4 .dd-rng button:disabled { opacity: .55; cursor: not-allowed; }
html.dark .dd-v4 .dd-rng button.is-on { background: var(--dd-chip); }

/* 4 kartu angka */
@container (min-width: 700px) { .dd-v4 .dd-kp { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.dd-v4 .dd-kc { border-radius: 12px; padding: 14px; gap: 12px; box-shadow: none; border: 1px solid #f0f1f4; transition: none; }
.dd-v4 .dd-kc:hover { transform: none; border-color: #e5e7eb; }
html.dark .dd-v4 .dd-kc { border-color: var(--dv-line); }
.dd-v4 .dd-kc-h { font-size: 11px; font-weight: 600; }
.dd-v4 .dd-kc-n { display: flex; align-items: baseline; gap: 4px; }
.dd-v4 .dd-kc-b b { display: inline; font-size: 22px; font-weight: 600; line-height: 1.2; letter-spacing: 0; }
.dd-v4 .dd-kc-n u { text-decoration: none; font-size: 13px; font-weight: 600; color: var(--dd-green); }
.dd-v4 .dd-kc-b em { font-size: 10px; margin-top: 2px; }

/* aktivitas terbaru */
.dd-v4 .dd-ra { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 0; border-top: 1px solid var(--dv-line); }
.dd-v4 .dd-ra:first-child { border-top: 0; }
.dd-v4 .dd-fill .dd-ra { flex: 1 1 0; min-height: 44px; max-height: 88px; }
.dd-v4 .dd-ra-l { min-width: 0; }
.dd-v4 .dd-ra-n { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; }
.dd-v4 .dd-ra-n span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dd-v4 .dd-ra-n i { flex: none; width: 6px; height: 6px; border-radius: 50%; }
.dd-v4 .dd-ra-m { font-size: 10px; color: var(--dv-muted); padding-left: 12px; }
.dd-v4 .dd-ra-t { flex: none; font-size: 13px; font-weight: 500; white-space: nowrap; }
.dd-v4 .dd-ra-t b { font-size: 10px; font-weight: 600; margin-left: 6px; }
.dd-v4 .dd-ra-n .t-primary, .dd-v4 .dd-mc-dots .t-primary, .dd-v4 .dd-legend .lg-pri { background: #8b5cf6; }
.dd-v4 .dd-ra-n .t-green { background: var(--dd-green); }
.dd-v4 .dd-ra-n .t-yellow { background: var(--dd-yellow); }
.dd-v4 .dd-ra-n .t-alert { background: var(--dv-alert); }
.dd-v4 .dd-ra-n .t-slate { background: var(--dv-muted); }

/* kalender */
.dd-v4 .dd-mc-head { margin: 0; flex-wrap: nowrap; gap: 8px; }
.dd-v4 .dd-mc-head > b { font-size: 12px; font-weight: 600; }
.dd-v4 .dd-mc-head > div { gap: 4px; }
.dd-v4 .dd-pa { width: 22px; height: 22px; border-radius: 6px; border: 1px solid #e5e7eb; background: none; }
html.dark .dd-v4 .dd-pa { border-color: var(--dv-line); }
.dd-v4 .dd-mc-dow { font-size: 9px; font-weight: 500; padding-bottom: 4px; }
.dd-v4 .dd-mc-grid { grid-auto-rows: 30px; gap: 2px; flex: none; }
.dd-v4 .dd-mc { border-radius: 8px; font-size: 11px; font-weight: 500; gap: 2px; }
.dd-v4 .dd-mc.is-out { color: #c4c8d0; opacity: 1; }
.dd-v4 .dd-mc.is-today { font-weight: 700; }
.dd-v4 .dd-mc.is-today:hover { background: var(--dv-primary); }
.dd-v4 .dd-mc.is-sel { box-shadow: inset 0 0 0 1.5px var(--dv-primary) !important; }
.dd-v4 .dd-mc-dots { height: 4px; gap: 2px; }
.dd-v4 .dd-mc-dots i { width: 4px; height: 4px; }
.dd-v4 .dd-legend { gap: 12px; font-size: 9px; margin-top: 8px; }
.dd-v4 .dd-legend i { width: 6px; height: 6px; margin-right: 4px; }
.dd-v4 .dd-legend-end { margin-top: auto; padding-top: 8px; }

/* barang terbanyak di pegang */
.dd-v4 .dd-hl { grid-template-columns: minmax(0, 1fr) 70px 70px; gap: 0; padding: 9px 0; font-size: 10px; font-weight: 500; }
.dd-v4 .dd-hl-n { font-weight: 500; }
.dd-v4 .dd-hl > b { min-width: 0; font-size: 10px; font-weight: 700; }

/* notifikasi */
.dd-v4 .dd-nt.is-row { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; }
.dd-v4 .dd-nlist.is-fill .dd-nt { min-height: 44px; max-height: none; }
.dd-v4 .dd-nt-l b { display: flex; align-items: center; font-size: 11px; font-weight: 600; color: var(--dv-ink); }
.dd-v4 .dd-nt-l small { display: block; font-size: 10px; color: var(--dv-muted); }
.dd-v4 .dd-nt-r { text-align: right; }
.dd-v4 .dd-nt-r b { display: block; font-size: 11px; font-weight: 600; color: var(--dv-ink); }
.dd-v4 .dd-nt-r em { display: block; font-style: normal; font-size: 9.5px; font-weight: 700; margin-top: 1px; }
.dd-v4 .dd-nt-r em.sg { color: var(--dd-green); }
.dd-v4 .dd-nt-r em.sy { color: var(--dd-yellow); }
.dd-v4 .dd-nt-r em.sr { color: var(--dv-alert); }
.dd-v4 .dd-nt:hover .dd-nt-l b { text-decoration: underline; }

/* paginasi */
.dd-v4 .dd-pager { padding-top: 8px; }
.dd-v4 .dd-pager-i { font-size: 10px; }
.dd-v4 .dd-pager-b button { min-width: 22px; height: 22px; padding: 0 4px; border-radius: 6px; border-color: #e5e7eb; font-size: 10px; font-weight: 500; }
html.dark .dd-v4 .dd-pager-b button { border-color: var(--dv-line); }
.dd-v4 .dd-pager-b button.is-on { border-color: var(--dv-primary); }
`,
  "resources/js/features/dashboard/widgets/ledger/aktivitasMeta.ts": `import type { AktivitasInventoryTerbaru } from '../../types';

export type AktivitasTone = 'primary' | 'green' | 'yellow' | 'alert' | 'slate';

// [DASHBOARD-V4] Warna titik: Dipinjam ungu, Dikembalikan hijau, Lapor Rusak kuning, Rusak Berat merah.
export function toneAktivitas(ev: AktivitasInventoryTerbaru): AktivitasTone {
  switch (ev.type) {
    case 'pinjam':
      return 'primary';
    case 'kembali':
      return 'green';
    case 'lapor_rusak':
    case 'mulai_perbaikan':
      return 'yellow';
    case 'selesai_perbaikan':
      return ev.hasil === 'rusak_berat' ? 'alert' : 'green';
    default:
      return 'slate';
  }
}

// Label aksi singkat: "Agnes <Meminjam>".
export function labelAktivitas(ev: AktivitasInventoryTerbaru): string {
  switch (ev.type) {
    case 'pinjam':
      return 'Meminjam';
    case 'kembali':
      return 'Mengembalikan';
    case 'lapor_rusak':
      return 'Lapor Rusak';
    case 'mulai_perbaikan':
      return 'Mulai Perbaikan';
    case 'selesai_perbaikan':
      return ev.hasil === 'rusak_berat' ? 'Rusak Berat' : 'Selesai Perbaikan';
    default:
      return 'Menjual';
  }
}

const dua = (n: number) => String(n).padStart(2, '0');

// "AM 09:10" + "05/10/2026"
export function waktuRingkas(iso: string): { jam: string; tanggal: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { jam: '-', tanggal: '-' };
  return { jam: \`\${d.getHours() < 12 ? 'AM' : 'PM'} \${dua(d.getHours())}:\${dua(d.getMinutes())}\`, tanggal: \`\${dua(d.getDate())}/\${dua(d.getMonth() + 1)}/\${d.getFullYear()}\` };
}
`,
  "resources/js/features/dashboard/widgets/ledger/HeroInventory.tsx": `import { useState } from 'react';
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
  if (p.length === 1) return \`M\${p[0][0]} \${p[0][1]}\`;
  let d = \`M\${p[0][0]} \${p[0][1]}\`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    d += \` C\${b[0] + (c[0] - a[0]) / 6} \${b[1] + (c[1] - a[1]) / 6}, \${c[0] - (e[0] - b[0]) / 6} \${c[1] - (e[1] - b[1]) / 6}, \${c[0]} \${c[1]}\`;
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
  const area = \`\${line} L\${pts[last][0]} \${Y_BASE} L\${pts[0][0]} \${Y_BASE} Z\`;
  const q = pts[active];

  const diff = active > 0 ? vals[active] - vals[active - 1] : null;
  const deltaText = diff === null ? 'Data awal' : \`\${diff >= 0 ? '▲' : '▼'} \${Math.abs(diff)} Unit\`;
  const namaBulan = \`\${rows[active].bulan}\${rows[active].tahun ? \` \${rows[active].tahun}\` : ''}\`;

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
      viewBox={\`0 0 \${W} \${H}\`}
      role="img"
      aria-label={\`Pertumbuhan inventory per bulan. \${namaBulan}: \${vals[active]} unit.\`}
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
      <polygon points={\`\${q[0] - 5},\${by + 52} \${q[0] + 5},\${by + 52} \${q[0]},\${by + 58}\`} style={{ fill: 'var(--dv-today-bg)' }} />
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
        <b className={\`dd-hv-chg \${bulanIni && bulanIni.jumlah > 0 ? '' : 'is-flat'}\`}>{bulanIni && bulanIni.jumlah > 0 ? \`▲ \${bulanIni.jumlah}\` : '–'}</b>
        <span className="dd-hv-cap">Unit (Bulan Ini)</span>
        <div className="dd-hv-two">
          <div>
            <small>Unit Paling Banyak</small>
            <b title={terbanyak?.nama}>{terbanyak ? \`\${terbanyak.nama} : \${terbanyak.jumlah} Unit\` : '-'}</b>
          </div>
          <div>
            <small>Unit Paling Sedikit</small>
            <b title={tersedikit?.nama}>{tersedikit ? \`\${tersedikit.nama} : \${tersedikit.jumlah} Unit\` : '-'}</b>
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
`,
  "resources/js/features/dashboard/widgets/ledger/KpiDots.tsx": `import { ArrowUpRight } from 'lucide-react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { InventoryPerhatian, RingkasanInventory } from '../../types';
import { DotBars } from './primitives';

// [DASHBOARD-V4] 4 kartu angka dengan dot-matrix mini chart. Klik kartu = buka daftar terkait.
export function KpiDots({ ringkasan, perhatian }: { ringkasan: RingkasanInventory; perhatian: InventoryPerhatian }) {
  const navigate = useAppNavigate();

  const items = [
    { label: 'Total Inventory', value: ringkasan?.total ?? 0, caption: 'Total Semua Unit Inventory', color: '#8b5cf6', to: '/master-data?tab=inventory' },
    { label: 'Tersedia', value: ringkasan?.tersedia ?? 0, caption: 'Siap Dipinjam', color: '#22b8f0', to: '/master-data?tab=inventory&status=tersedia' },
    { label: 'Dipakai', value: ringkasan?.dipakai ?? 0, caption: 'Sedang Dipakai', color: '#12b76a', to: '/master-data?tab=inventory&status=dipakai' },
    { label: 'Dalam Penanganan', value: perhatian?.dalamPenanganan ?? 0, caption: 'Sedang Di Tangani', color: '#f79009', to: '/penanganan-inventory' },
  ];

  return (
    <section aria-label="Status inventory" className="dd-kp">
      {items.map((k, i) => (
        <button key={k.label} type="button" className="dd-kc" onClick={() => navigate(k.to)}>
          <span className="dd-kc-h">
            <span>{k.label}</span>
            <i aria-hidden="true">
              <ArrowUpRight size={13} />
            </i>
          </span>
          <span className="dd-kc-b">
            <span>
              <span className="dd-kc-n">
                <b className="dv-g">{k.value}</b>
                <u aria-hidden="true">↑</u>
              </span>
              <em>{k.caption}</em>
            </span>
            <DotBars color={k.color} w={44} h={26} seed={i + 1} />
          </span>
        </button>
      ))}
    </section>
  );
}
`,
  "resources/js/features/dashboard/widgets/ledger/AktivitasKalender.tsx": `import { useMemo, useState } from 'react';
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
const keyOf = (d: Date) => \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
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
        title={selected ? \`Aktivitas \${judulTanggal}\` : 'Aktivitas Terbaru'}
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
        <div className="dd-mc-grid" role="group" aria-label={\`Kalender \${BULAN[view.getMonth()]} \${view.getFullYear()}\`}>
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
                aria-label={\`\${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, \${events.length} aktivitas\`}
                onClick={() => pilih(date)}
              >
                <span className="dv-g">{date.getDate()}</span>
                <span className="dd-mc-dots" aria-hidden="true">
                  {tones.map((t) => (
                    <i key={t} className={\`t-\${t}\`} />
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
`,
  "resources/js/features/dashboard/widgets/ledger/AktivitasLedger.tsx": `import { Users, Check, CheckCircle2, AlertTriangle, Wrench, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AktivitasInventoryTerbaru } from '../../types';
import { AKTIVITAS_ASET_STYLE, formatWaktuSingkat } from '../aktivitas/aktivitas';
import { labelAktivitas, toneAktivitas, waktuRingkas } from './aktivitasMeta';
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
// variant 'tanggal' = lingkaran berisi tanggal; 'ikon' = lingkaran berisi ikon jenis aktivitas;
// 'ringkas' [DASHBOARD-V4] = titik status + kode : nama, pelaku + aksi, dan jam + tanggal di kanan.
export function AktivitasRows({
  events = [],
  timeFormatter = formatWaktuSingkat,
  kosong = 'Belum ada aktivitas.',
  variant = 'tanggal',
}: {
  events?: AktivitasInventoryTerbaru[];
  timeFormatter?: (waktu: string) => string;
  kosong?: string;
  variant?: 'tanggal' | 'ikon' | 'ringkas';
}) {
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return <EmptyNote>{kosong}</EmptyNote>;

  if (variant === 'ringkas') {
    return (
      <div>
        {list.map((ev, i) => {
          const kode = ev.inventory?.kode_inventory || '-';
          const nama = (ev.inventory?.nama ?? '').toUpperCase();
          const pelaku = ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
          const w = waktuRingkas(ev.waktu);
          return (
            <div key={\`\${ev.type}-\${ev.waktu}-\${i}\`} className="dd-ra">
              <div className="dd-ra-l">
                <div className="dd-ra-n">
                  <i className={\`t-\${toneAktivitas(ev)}\`} aria-hidden="true" />
                  <span>{nama ? \`\${kode} : \${nama}\` : kode}</span>
                </div>
                <div className="dd-ra-m">
                  {pelaku ? \`\${pelaku} \` : ''}
                  {labelAktivitas(ev)}
                </div>
              </div>
              <div className="dd-ra-t">
                {w.jam}
                <b>{w.tanggal}</b>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {list.map((ev, i) => {
        const label = AKTIVITAS_ASET_STYLE[ev.type]?.label ?? 'mengubah status';
        const kode = ev.inventory?.kode_inventory || '-';
        const pelaku = ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
        const t = TAMPIL[ev.type] ?? { tone: 'slate', Icon: Tag };
        const day = new Date(ev.waktu).getDate();
        return (
          <div key={\`\${ev.type}-\${ev.waktu}-\${i}\`} className="dd-li">
            <div className={\`dd-dc t-\${t.tone}\`} aria-hidden="true">
              {variant === 'ikon' ? <t.Icon size={18} /> : isNaN(day) ? '-' : String(day).padStart(2, '0')}
            </div>
            <div className="dd-lm">
              <b>
                {kode} {ev.inventory?.nama ?? ''}
              </b>
              <span>
                {pelaku ? \`\${pelaku} \` : ''}
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
`,
  "resources/js/features/dashboard/widgets/ledger/TerbanyakDipegang.tsx": `import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { PemegangTeratas } from '../../types';
import { Panel, EmptyNote, DotBars } from './primitives';

// [DASHBOARD-V4] Karyawan yang saat ini memegang inventory terbanyak (data: DashboardQuery::terbanyakDipegang).
export function TerbanyakDipegang({ data = [] }: { data?: PemegangTeratas[] }) {
  const navigate = useAppNavigate();
  const rows = Array.isArray(data) ? data.slice(0, 5) : [];

  return (
    <Panel
      title="Barang Terbanyak Di Pegang"
      right={
        <button type="button" className="dd-pill" onClick={() => navigate('/master-data?tab=inventory&status=dipakai')}>
          View All
        </button>
      }
    >
      {rows.length === 0 ? (
        <EmptyNote>Belum ada inventory yang sedang dipegang.</EmptyNote>
      ) : (
        <div>
          {rows.map((r, i) => (
            <div key={r.id} className="dd-hl">
              <span className="dd-hl-n" title={r.nama}>
                {r.nama}
              </span>
              <DotBars color="#ef4444" w={60} h={16} seed={i + 5} />
              <b className="dv-g">{r.jumlah} Inventory</b>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
`,
  "resources/js/features/dashboard/widgets/ledger/NotifikasiLedger.tsx": `import { useRef, useState } from 'react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { NotificationItem } from '../../types';
import { formatWaktuSingkat } from '../aktivitas/aktivitas';
import { Pager } from './Pager';
import { Panel, EmptyNote } from './primitives';

const PAGE_SIZE = 3; // default (DashboardUser); admin memakai pageSize lebih besar + fill
const SWIPE_MIN = 40; // px

// [DASHBOARD-V4] Baris ringkas: kode + tipe di kiri, nama pelapor + status di kanan.
// Hanya untuk notifikasi yang payload-nya sudah memuat kode_inventory; notifikasi lama tetap tampil sebagai pesan biasa.
function ringkas(n: NotificationItem) {
  const d: Record<string, any> = n.data ?? {};
  if (!d.kode_inventory) return null;
  const selesai = d.type === 'aset_kerusakan_selesai';
  const status = !selesai
    ? { teks: 'LAPOR RUSAK', cls: 'sy' }
    : d.hasil === 'rusak_berat'
      ? { teks: 'RUSAK BERAT', cls: 'sr' }
      : { teks: 'BERHASIL DIPERBAIKI', cls: 'sg' };
  return { kode: String(d.kode_inventory), tipe: d.inventory_nama ? String(d.inventory_nama) : '-', user: String(d.pelapor ?? '-').toUpperCase(), status };
}

// Notifikasi dengan paginasi: item per halaman tetap, jadi kartu tidak melar ke bawah kalau notifikasinya banyak.
// Geser lewat Pager atau swipe di layar sentuh.
//  - fill: daftar mengisi sisa tinggi kartu (dipakai dashboard admin supaya bawahnya sejajar dengan kolom kiri).
//  - v4: tampilan dashboard admin V4 (baris ringkas kode/tipe + pelapor/status, tautan "Tandai Baca"); default = tampilan lama (DashboardUser).
export function NotifikasiLedger({
  notifications = [],
  onMarkAsRead,
  pageSize = PAGE_SIZE,
  fill = false,
  v4 = false,
}: {
  notifications?: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  pageSize?: number;
  fill?: boolean;
  v4?: boolean;
}) {
  const navigate = useAppNavigate();
  const all = Array.isArray(notifications) ? notifications : [];
  const unread = all.filter((n) => !n?.read_at);

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const cur = Math.min(page, pageCount - 1); // aman kalau notifikasi berkurang (auto-hapus / dibaca)
  const list = all.slice(cur * pageSize, cur * pageSize + pageSize);

  const touchX = useRef<number | null>(null);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(pageCount - 1, n));
    if (next === cur) return;
    setDir(next > cur ? 1 : -1);
    setPage(next);
  };

  const open = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <Panel
      className="flex-1"
      title="Notifikasi"
      subtitle={v4 ? undefined : \`\${unread.length > 0 ? \`\${unread.length} belum dibaca\` : 'Semua sudah dibaca'} \\u00b7 \${all.length} total\`}
      right={
        v4 ? (
          <button type="button" className="dd-link" disabled={unread.length === 0} onClick={() => unread.forEach((n) => onMarkAsRead(n.id))}>
            Tandai Baca
          </button>
        ) : unread.length > 0 ? (
          <button type="button" className="dd-link" onClick={() => unread.forEach((n) => onMarkAsRead(n.id))}>
            Tandai semua dibaca
          </button>
        ) : undefined
      }
    >
      <div
        className={\`dd-nlist \${fill ? 'is-fill' : ''}\`}
        style={fill ? undefined : { height: pageSize * 66 }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) >= SWIPE_MIN) go(dx < 0 ? cur + 1 : cur - 1);
        }}
      >
        {list.length === 0 ? (
          <EmptyNote>Belum ada notifikasi.</EmptyNote>
        ) : (
          <div key={cur} className={dir === 1 ? 'dd-slide-r' : 'dd-slide-l'}>
            {list.map((n) => {
              const r = v4 ? ringkas(n) : null;
              return r ? (
                <button key={n.id} type="button" className="dd-nt is-row" onClick={() => open(n)}>
                  <span className="dd-nt-l">
                    <b>
                      {!n.read_at && <i className="dd-un" aria-label="Belum dibaca" />}
                      {r.kode}
                    </b>
                    <small>{r.tipe}</small>
                  </span>
                  <span className="dd-nt-r">
                    <b>{r.user}</b>
                    <em className={r.status.cls}>{r.status.teks}</em>
                  </span>
                </button>
              ) : (
                <button key={n.id} type="button" className="dd-nt" onClick={() => open(n)}>
                  <span className="dd-nt-m">
                    {!n.read_at && <i className="dd-un" aria-label="Belum dibaca" />}
                    {!n.read_at ? <b>{n.data?.message}</b> : n.data?.message}
                  </span>
                  <span className="dd-nt-d">{formatWaktuSingkat(n.created_at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Pager total={all.length} perPage={pageSize} page={cur + 1} onPage={(p) => go(p - 1)} />
    </Panel>
  );
}
`,
};

const PATCHES = [
  { file: `app/Queries/Dashboard/DashboardQuery.php`, ops: [
    { find: `        // 6 bulan terakhir (termasuk bulan ini), jumlah inventory yang tanggal_invoice-nya jatuh di bulan itu
        $bulan = [];
        for ($i = 5; $i >= 0; $i--) {
            $d = Carbon::now()->startOfMonth()->subMonthsNoOverflow($i);
            $bulan[$d->format('Y-n')] = ['bulan' => self::BULAN_ID[$d->month - 1], 'jumlah' => 0];
        }
`, replace: `        // 12 bulan terakhir (termasuk bulan ini).
        //  - jumlah = unit yang tanggal_invoice-nya jatuh di bulan itu
        //  - total  = total unit s/d akhir bulan itu (kumulatif; unit tanpa tanggal invoice / sebelum rentang jadi titik awal)
        $awalRentang = Carbon::now()->startOfMonth()->subMonthsNoOverflow(11);
        $sebelumRentang = 0;
        $bulan = [];
        for ($i = 11; $i >= 0; $i--) {
            $d = Carbon::now()->startOfMonth()->subMonthsNoOverflow($i);
            $bulan[$d->format('Y-n')] = ['bulan' => self::BULAN_ID[$d->month - 1], 'tahun' => $d->year, 'jumlah' => 0, 'total' => 0];
        }
`, marker: `$awalRentang = Carbon`, },
    { find: `            if ($a->tanggal_invoice) {
                $key = Carbon::parse($a->tanggal_invoice)->format('Y-n');
                if (isset($bulan[$key])) $bulan[$key]['jumlah']++;
            }
        }
`, replace: `            if ($a->tanggal_invoice) {
                $tgl = Carbon::parse($a->tanggal_invoice);
                $key = $tgl->format('Y-n');
                if (isset($bulan[$key])) $bulan[$key]['jumlah']++;
                elseif ($tgl->lt($awalRentang)) $sebelumRentang++;
            } else {
                $sebelumRentang++;
            }
        }

        $berjalan = $sebelumRentang;
        foreach ($bulan as $key => $row) {
            $berjalan += $row['jumlah'];
            $bulan[$key]['total'] = $berjalan;
        }
`, marker: `$berjalan = $sebelumRentang`, },
  ] },
  { file: `app/Notifications/AsetKerusakanDilaporkan.php`, ops: [
    { find: `            'inventory_id' => $this->penanganan->inventory_id,
`, replace: `            'inventory_id' => $this->penanganan->inventory_id,
            'kode_inventory' => $this->penanganan->inventory?->kode_inventory,
            'inventory_nama' => $this->penanganan->inventory?->nama,
            'pelapor' => $this->pelaporName,
`, marker: `'kode_inventory' =>`, },
  ] },
  { file: `app/Notifications/AsetKerusakanSelesai.php`, ops: [
    { find: `            'inventory_id' => $this->penanganan->inventory_id,
`, replace: `            'inventory_id' => $this->penanganan->inventory_id,
            'kode_inventory' => $this->penanganan->inventory?->kode_inventory,
            'inventory_nama' => $this->penanganan->inventory?->nama,
            'pelapor' => optional(\\App\\Models\\User::find($this->penanganan->dilaporkan_oleh_user_id))->name,
`, marker: `'kode_inventory' =>`, },
  ] },
  { file: `resources/views/app.blade.php`, ops: [
    { find: `&family=Public+Sans:wght@400;500;600&display=swap`, replace: `&family=Public+Sans:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap`, marker: `family=Inter:`, },
  ] },
  { file: `resources/js/features/dashboard/types.ts`, ops: [
    { find: `export interface TrenPembelianInventory {
  bulan: string;
  jumlah: number;
}`, replace: `export interface TrenPembelianInventory {
  bulan: string;
  tahun?: number; // tooltip chart: "Okt 2026"
  jumlah: number; // unit baru pada bulan itu
  total?: number; // total unit s/d akhir bulan itu (kumulatif) -> yang digambar di chart hero
}`, marker: `total?: number;`, },
  ] },
  { file: `resources/js/features/dashboard/widgets/ledger/primitives.tsx`, ops: [
    { find: `import type { ReactNode } from 'react';`, replace: `import { useMemo, type ReactNode } from 'react';`, marker: `import { useMemo, type ReactNode }`, },
    { append: `
// [DASHBOARD-V4] Dot-matrix bar chart dekoratif: kolom tiap 4px, tumpukan titik dari bawah, tinggi acak tapi stabil (seeded) dan cenderung naik ke kanan.
export function DotBars({ color, w = 44, h = 26, seed = 1 }: { color: string; w?: number; h?: number; seed?: number }) {
  const dots = useMemo(() => {
    let s = seed * 37;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const cols = Math.floor(w / 4);
    const rows = Math.floor(h / 4);
    const out: [number, number][] = [];
    for (let i = 0; i < cols; i++) {
      const n = Math.max(1, Math.round(rows * (0.25 + 0.75 * rnd() * (0.5 + i / cols / 2))));
      for (let j = 0; j < n; j++) out.push([i * 4 + 2, h - j * 4 - 2]);
    }
    return out;
  }, [seed, w, h]);
  return (
    <svg className="dd-dm" width={w} height={h} viewBox={\`0 0 \${w} \${h}\`} aria-hidden="true">
      {dots.map(([cx, cy], k) => (
        <circle key={k} cx={cx} cy={cy} r={1.4} fill={color} />
      ))}
    </svg>
  );
}
`, marker: `export function DotBars`, },
  ] },
  { file: `resources/js/features/dashboard/widgets/ledger/index.ts`, ops: [
    { find: `DotMeter } from './primitives';`, replace: `DotMeter, DotBars } from './primitives';`, marker: `DotBars }`, },
  ] },
  { file: `resources/js/features/dashboard/DashboardAdmin.tsx`, ops: [
    { find: `import type { DashboardAdminData } from './types';`, replace: `import type { DashboardAdminData } from './types';
import './dashboard-v4.css';`, marker: `dashboard-v4.css`, },
    { find: `className="dv dd-page"`, replace: `className="dv dd-page dd-v4"`, marker: `dd-page dd-v4`, },
    { regex: /  const rusak = inventoryPerhatian[\s\S]*?(?=  return \()/, replace: ``, applied: (s) => !s.includes('const rusak = inventoryPerhatian'), },
    { regex: /          <HeroInventory[\s\S]*?\n          \/>\n/, replace: `          <HeroInventory total={ringkasanInventory?.total ?? 0} tren={trenPembelianInventory} perMerek={inventoryPerMerek} />
`, marker: `<HeroInventory total=`, },
    { find: `pageSize={5} fill />`, replace: `pageSize={5} fill v4 />`, marker: `fill v4 />`, },
  ] },
];

// ===== Runner =====
const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');
const BK = path.join(ROOT, '.migrasi-backup', 'dashboard-v4');
const MANIFEST = path.join(BK, '_manifest.json');
const abs = (p) => path.join(ROOT, p);
const log = (...a) => console.log(...a);

if (!fs.existsSync(abs('artisan')) || !fs.existsSync(abs('resources/js'))) {
  console.error('Jalankan dari root project (folder yang berisi artisan & resources/).');
  process.exit(1);
}

const targets = [...Object.keys(FILES), ...PATCHES.map((p) => p.file)];

if (REVERT) {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Tidak ada backup dashboard-v4 untuk di-revert.');
    process.exit(1);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const f of m.backed) {
    log(`${DRY ? '[dry] ' : ''}kembalikan ${f}`);
    if (!DRY) fs.copyFileSync(path.join(BK, f), abs(f));
  }
  for (const f of m.created) {
    log(`${DRY ? '[dry] ' : ''}hapus ${f}`);
    if (!DRY && fs.existsSync(abs(f))) fs.unlinkSync(abs(f));
  }
  if (!DRY) fs.rmSync(BK, { recursive: true, force: true });
  log(DRY ? '\nDry-run revert selesai.' : '\nRevert selesai.');
  process.exit(0);
}

// 1) Hitung semua perubahan dulu (tidak ada yang ditulis kalau satu patch gagal).
const plan = []; // { file, content, status }
const errors = [];

for (const [file, content] of Object.entries(FILES)) {
  const exists = fs.existsSync(abs(file));
  const cur = exists ? fs.readFileSync(abs(file), 'utf8') : null;
  plan.push({ file, content, status: !exists ? 'dibuat' : cur === content ? 'sama (lewati)' : 'ditimpa', exists });
}

for (const { file, ops } of PATCHES) {
  if (!fs.existsSync(abs(file))) {
    errors.push(`File tidak ditemukan: ${file}`);
    continue;
  }
  const orig = fs.readFileSync(abs(file), 'utf8');
  let s = orig;
  let changed = 0;
  ops.forEach((o, i) => {
    const done = o.applied ? o.applied(s) : s.includes(o.marker);
    if (done) return;
    if (o.append !== undefined) {
      s = s.replace(/\s*$/, '\n') + o.append;
    } else if (o.regex) {
      if (!o.regex.test(s)) return errors.push(`${file}: pola #${i + 1} tidak ditemukan (kode sudah berbeda dari versi zip?)`);
      s = s.replace(o.regex, o.replace);
    } else {
      if (!s.includes(o.find)) return errors.push(`${file}: potongan #${i + 1} tidak ditemukan (kode sudah berbeda dari versi zip?)`);
      s = s.replace(o.find, o.replace);
    }
    changed++;
  });
  plan.push({ file, content: s, status: changed ? `dipatch (${changed} bagian)` : 'sudah terpasang (lewati)', exists: true, patch: true });
}

if (errors.length) {
  console.error('Dibatalkan, tidak ada file yang diubah:\n - ' + errors.join('\n - '));
  process.exit(1);
}

// 2) Tulis (atau tampilkan saja kalau --dry).
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { backed: [], created: [] };
for (const p of plan) {
  log(`${DRY ? '[dry] ' : ''}${p.status.padEnd(24)} ${p.file}`);
  if (DRY || p.status.includes('lewati')) continue;
  if (p.exists) {
    if (!manifest.backed.includes(p.file)) {
      fs.mkdirSync(path.dirname(path.join(BK, p.file)), { recursive: true });
      fs.copyFileSync(abs(p.file), path.join(BK, p.file));
      manifest.backed.push(p.file);
    }
  } else if (!manifest.created.includes(p.file)) {
    manifest.created.push(p.file);
  }
  fs.mkdirSync(path.dirname(abs(p.file)), { recursive: true });
  fs.writeFileSync(abs(p.file), p.content);
}
if (!DRY) {
  fs.mkdirSync(BK, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  log('\nSelesai. Backup: .migrasi-backup/dashboard-v4/ (kembalikan: node scripts/dashboard-v4.mjs --revert)');
  log('Lanjut: npm run build (cek tipe/kompilasi), lalu buka dashboard admin.');
} else {
  log('\nDry-run selesai, tidak ada file yang diubah.');
}
