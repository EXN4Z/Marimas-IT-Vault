import { useState, useMemo } from 'react';
import { Package, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import type { InventoryPerMerek, TrenPembelianInventory, InventoryPerhatian, RingkasanInventory, AktivitasInventoryTerbaru, PemegangTeratas, DashboardAdminData, PembelianTitik } from './types';
import { EmptyNote, DotBars, AktivitasRows, toneAktivitas, Pager, Panel, DashboardSkeleton, NotifikasiLedger } from './DashboardShared';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import './dashboard.css';

// PETA HALAMAN ADMIN (dua kolom) — tiap bagian punya komentar bergaris ═══ di bawah:
//   KOLOM KIRI   1. HERO (total + chart pembelian) · 2. KPI (kartu angka) · 3. AKTIVITAS + KALENDER
//   KOLOM KANAN  1. TERBANYAK DIPEGANG · 2. NOTIFIKASI (komponennya di DashboardShared.tsx)

// Dashboard admin [DASHBOARD-V3] (tema & variabel warna: kelas .dv / .dd-* di index.css; terang/gelap otomatis lewat html.dark).
// Tata letak dua kolom:
//   kiri  = hero (ringkasan + chart pembelian) -> 4 kartu angka -> aktivitas terbaru + kalender
//   kanan = barang terbanyak di pegang -> notifikasi
// Kartu terakhir tiap kolom mengisi sisa tinggi, jadi sisi bawah kedua kolom sejajar.
// [F8-INERTIA] Data dari props `analitik` (deferred; DashboardController -> DashboardQuery::admin). Selama belum datang -> skeleton.
export default function DashboardAdmin() {
  const navigate = useAppNavigate();
  const { auth } = useSharedProps();
  const user = auth?.user ?? null;
  const { notifications, handleMarkAsRead } = useDashboardNotifications(user?.id);
  const analitik = (usePage().props as unknown as { analitik?: DashboardAdminData | null }).analitik ?? null;

  if (!analitik) {
    return <DashboardSkeleton variant="full" />;
  }

  const { ringkasanInventory, trenPembelianInventory, pembelianMingguan, pembelianBulanan, inventoryPerhatian, inventoryPerMerek, aktivitasKalender, terbanyakDipegang } = analitik;

  return (
    <div className="dv dd-page dd-v4">
      <div className="dd-main">
        <div className="dd-mcol">
          {/* ═══ KOLOM KIRI · 1. HERO ═══ */}
          <HeroInventory total={ringkasanInventory?.total ?? 0} tren={trenPembelianInventory} perMerek={inventoryPerMerek} mingguan={pembelianMingguan} bulanan={pembelianBulanan} />
          {/* ═══ KOLOM KIRI · 2. KPI ═══ */}
          <KpiDots ringkasan={ringkasanInventory} perhatian={inventoryPerhatian} />
          {/* ═══ KOLOM KIRI · 3. AKTIVITAS + KALENDER ═══ */}
          <AktivitasKalender aktivitas={aktivitasKalender} onLihatSemua={() => navigate('/laporan?tab=riwayat_inventory')} />
        </div>

        <div className="dd-mcol">
          {/* ═══ KOLOM KANAN · 1. TERBANYAK DIPEGANG ═══ */}
          <TerbanyakDipegang data={terbanyakDipegang} />
          {/* ═══ KOLOM KANAN · 2. NOTIFIKASI (DashboardShared.tsx) ═══ */}
          <NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} pageSize={5} fill v4 />
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════
// KOLOM KIRI · 1. HERO — total inventory + chart tren pembelian + per merek
//   (dulu: widgets/ledger/HeroInventory.tsx)
// ════════════════════════════════════════════════════════════════════════

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
  const pilihan = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]; // [CHART] 1 & 2 ditambah untuk chart mingguan/bulanan
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
function PertumbuhanChart({ rows, judulChart }: { rows: PembelianTitik[]; judulChart: string }) {
  const last = rows.length - 1;
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null && hover <= last ? hover : last;

  // nilai chart = unit yang dibeli di bulan itu (reset dari 0 tiap bulan), bukan total kumulatif
  const vals = rows.map((r) => r.jumlah);
  const { lo, step } = skala(vals);
  const top = lo + step * 3;
  const y = (v: number) => Y_BASE - ((v - lo) / (top - lo)) * (Y_BASE - Y_TOP);
  const x = (i: number) => (rows.length === 1 ? (PAD_L + W - PAD_R) / 2 : PAD_L + (i * (W - PAD_L - PAD_R)) / (rows.length - 1));

  const pts = vals.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${pts[last][0]} ${Y_BASE} L${pts[0][0]} ${Y_BASE} Z`;
  const q = pts[active];

  // selisih pembelian bulan ini vs bulan sebelumnya (bukan total kumulatif)
  const diff = active > 0 ? vals[active] - vals[active - 1] : null;
  const deltaText = diff === null ? 'Data awal' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} Unit`;
  const deltaTurun = diff !== null && diff < 0;
  const namaBulan = rows[active].judul;

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
      aria-label={judulChart + '. ' + namaBulan + ': ' + vals[active] + ' unit.'}
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
      <text x={bx + 12} y={by + 46} fontSize={9} style={{ fill: deltaTurun ? 'var(--dd-tip-down)' : 'var(--dd-tip-delta)' }}>
        {deltaText}
      </text>

      {rows.map((r, i) => (
        <text key={r.label + i} x={pts[i][0]} y={H - 8} textAnchor="middle" fontSize={9} fontWeight={i === active ? 700 : 400} style={{ fill: i === active ? 'var(--dv-ink)' : 'var(--dv-muted)' }}>
          {r.label}
        </text>
      ))}
    </svg>
  );
}

// [CHART] Pilihan rentang chart hero. 1 Minggu = Senin–Minggu (minggu ini), 1 Bulan = Minggu 1–4 (bulan ini),
// keduanya dari tanggal_invoice (DashboardQuery::pembelianMingguan/pembelianBulanan).
// 1 Tahun tetap memakai tren 12 bulan yang sudah ada (trenPembelianInventory).
type Rentang = 'minggu' | 'bulan' | 'tahun';
const RENTANG: { id: Rentang; teks: string; judul: string }[] = [
  { id: 'minggu', teks: '1 Minggu', judul: 'Pembelian inventory minggu ini (Senin sampai Minggu)' },
  { id: 'bulan', teks: '1 Bulan', judul: 'Pembelian inventory bulan ini (Minggu 1 sampai 4)' },
  { id: 'tahun', teks: '1 Tahun', judul: 'Pertumbuhan inventory per bulan' },
];

// [DASHBOARD-V4] Kartu utama dashboard admin: total + perubahan bulan ini di kiri, chart pertumbuhan (hover) di kanan.
function HeroInventory({
  total,
  tren = [],
  perMerek = [],
  mingguan = [],
  bulanan = [],
}: {
  total: number;
  tren?: TrenPembelianInventory[];
  perMerek?: InventoryPerMerek[];
  mingguan?: PembelianTitik[];
  bulanan?: PembelianTitik[];
}) {
  const rows = Array.isArray(tren) ? tren : [];
  const merek = Array.isArray(perMerek) ? perMerek : [];
  // [CHART] rentang aktif -> titik chart (semua dibentuk jadi PembelianTitik supaya satu komponen chart untuk ketiganya)
  const [rentang, setRentang] = useState<Rentang>('tahun');
  const titik: PembelianTitik[] =
    rentang === 'minggu'
      ? Array.isArray(mingguan) ? mingguan : []
      : rentang === 'bulan'
        ? Array.isArray(bulanan) ? bulanan : []
        : rows.map((r) => ({ label: r.bulan, judul: r.bulan + (r.tahun ? ' ' + r.tahun : ''), jumlah: r.jumlah }));
  const judulChart = RENTANG.find((r) => r.id === rentang)?.judul ?? '';
  const bulanIni = rows[rows.length - 1];
  const bulanLalu = rows.length > 1 ? rows[rows.length - 2] : undefined;
  const net = bulanIni ? bulanIni.jumlah - (bulanLalu?.jumlah ?? 0) : 0;
  const terbanyak = merek[0];
  // const tersedikit = merek.length > 1 ? merek[merek.length - 1] : null;

  return (
    <section aria-label="Ringkasan inventory" className="dd-card dd-hv">
      <div className="dd-hv-l">
        <div className="dd-hv-k">
          <Package size={13} aria-hidden="true" />
          Marimas IT Vault
        </div>
        <b className="dv-g dd-hv-big">{total}</b>
        <b className={`dd-hv-chg ${net > 0 ? '' : net < 0 ? 'is-down' : 'is-flat'}`}>{net > 0 ? `▲ ${net}` : net < 0 ? `▼ ${Math.abs(net)}` : '0'}</b>
        <span className="dd-hv-cap">Unit (Bulan Ini)</span>
        <div className="dd-hv-two">
          <div>
            <small>Unit Paling Banyak</small>
            <b title={terbanyak?.nama}>{terbanyak ? `${terbanyak.nama} : ${terbanyak.jumlah} Unit` : '-'}</b>
          </div>
        </div>
      </div>

      <div className="dd-hv-r">
        <div className="dd-rng" role="group" aria-label="Rentang waktu">
          {RENTANG.map((r) => (
            <button key={r.id} type="button" className={rentang === r.id ? 'is-on' : ''} aria-pressed={rentang === r.id} onClick={() => setRentang(r.id)}>
              {r.teks}
            </button>
          ))}
        </div>
        {titik.length === 0 ? <EmptyNote>Belum ada data inventory.</EmptyNote> : <PertumbuhanChart key={rentang} rows={titik} judulChart={judulChart} />}
      </div>
    </section>
  );
}


// ════════════════════════════════════════════════════════════════════════
// KOLOM KIRI · 2. KPI — kartu angka (status inventory & perhatian)
//   (dulu: widgets/ledger/KpiDots.tsx)
// ════════════════════════════════════════════════════════════════════════

// [DASHBOARD-V4] 4 kartu angka dengan dot-matrix mini chart. Klik kartu = buka daftar terkait.
function KpiDots({ ringkasan, perhatian }: { ringkasan: RingkasanInventory; perhatian: InventoryPerhatian }) {
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


// ════════════════════════════════════════════════════════════════════════
// KOLOM KIRI · 3. AKTIVITAS + KALENDER — daftar aktivitas terbaru + kalender mutasi
//   (dulu: widgets/ledger/AktivitasKalender.tsx)
// ════════════════════════════════════════════════════════════════════════

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
function AktivitasKalender({ aktivitas = [], onLihatSemua }: { aktivitas?: AktivitasInventoryTerbaru[]; onLihatSemua: () => void }) {
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


// ════════════════════════════════════════════════════════════════════════
// KOLOM KANAN · 1. TERBANYAK DIPEGANG — pemegang inventory teratas
//   (dulu: widgets/ledger/TerbanyakDipegang.tsx)
// ════════════════════════════════════════════════════════════════════════

// [DASHBOARD-V4] Karyawan yang saat ini memegang inventory terbanyak (data: DashboardQuery::terbanyakDipegang).
function TerbanyakDipegang({ data = [] }: { data?: PemegangTeratas[] }) {
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
