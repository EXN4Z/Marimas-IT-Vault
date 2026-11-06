// DashboardShared — bagian yang dipakai DashboardAdmin DAN DashboardUser.
// Isi (urut dari atas): tema warna · format waktu & gaya aktivitas · meta aktivitas · blok dasar (Panel, EmptyNote,
// HeroBanner, LedgerHeader, DotMeter, DotBars) · Pager · baris aktivitas · notifikasi · skeleton loading.
// Cari bagian lewat komentar bergaris ═══.

import { useMemo, type ReactNode, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Users, Check, CheckCircle2, AlertTriangle, Wrench, Tag, type LucideIcon } from 'lucide-react';
import type { AktivitasInventoryTerbaru, NotificationItem } from './types';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { Skeleton } from '../../components/skeleton';


// ════════════════════════════════════════════════════════════════════════
// TEMA WARNA
//   (dulu: widgets/_shared/theme.ts)
// ════════════════════════════════════════════════════════════════════════

// ==== DEGO-style theme ====
const THEME = {
  violet: '#5A32FA',
  violetDark: '#4C3FE0',
  emerald: '#34A853',
  amber: '#F5A623',
  rose: '#F2453D',
  orange: '#F2994A',
  sky: '#2F80ED',
  purple: '#9B51E0',
  indigo: '#5A32FA',
  teal: '#0D9488',
  slate: '#64748B',
  grid: '#EEF0F7',
  axis: '#A9A9C6',
  bg: '#F7F8FC',
  ink: '#171633',
};


// ════════════════════════════════════════════════════════════════════════
// GAYA AKTIVITAS & FORMAT WAKTU SINGKAT
//   (dulu: widgets/aktivitas/aktivitas.ts)
// ════════════════════════════════════════════════════════════════════════

// ==== Timeline Aktivitas ====
const AKTIVITAS_ASET_STYLE: Record<AktivitasInventoryTerbaru['type'], { color: string; label: string; tone: 'amber' | 'emerald' | 'rose' | 'orange' | 'sky' | 'indigo' }> = {
  pinjam: { color: THEME.amber, label: 'menerima', tone: 'amber' },
  kembali: { color: THEME.emerald, label: 'mengembalikan', tone: 'emerald' },
  lapor_rusak: { color: THEME.rose, label: 'melaporkan kerusakan', tone: 'rose' },
  mulai_perbaikan: { color: THEME.orange, label: 'mulai perbaikan', tone: 'orange' },
  selesai_perbaikan: { color: THEME.sky, label: 'selesai perbaikan', tone: 'sky' },
  dijual: { color: THEME.purple, label: 'menjual', tone: 'indigo' },
};

function formatWaktuSingkat(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}


// ════════════════════════════════════════════════════════════════════════
// META AKTIVITAS (tone, label, jam/tanggal)
//   (dulu: widgets/ledger/aktivitasMeta.ts)
// ════════════════════════════════════════════════════════════════════════

type AktivitasTone = 'primary' | 'green' | 'yellow' | 'alert' | 'slate';

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
function labelAktivitas(ev: AktivitasInventoryTerbaru): string {
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
function waktuRingkas(iso: string): { jam: string; tanggal: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { jam: '-', tanggal: '-' };
  return { jam: `${d.getHours() < 12 ? 'AM' : 'PM'} ${dua(d.getHours())}:${dua(d.getMinutes())}`, tanggal: `${dua(d.getDate())}/${dua(d.getMonth() + 1)}/${d.getFullYear()}` };
}


// ════════════════════════════════════════════════════════════════════════
// BLOK DASAR (Panel, EmptyNote, HeroBanner, LedgerHeader, DotMeter, DotBars)
//   (dulu: widgets/ledger/primitives.tsx)
// ════════════════════════════════════════════════════════════════════════

// [DASHBOARD-V2] Blok dasar dashboard: kartu (judul + subjudul + isi). Warna lewat kelas .dd-* / .dv-* (index.css).
export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={`dd-card flex flex-col ${className}`}>
      <div className="dd-ch">
        <div className="min-w-0">
          <h2 className="dv-g dv-h2">{title}</h2>
          {subtitle && <p className="dv-sub">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// Meter titik (dot-matrix): `pct` persen kolom terisi. Warna lewat token CSS supaya ikut tema terang/gelap.
function DotMeter({ pct, cols = 12, rows = 3, color = 'var(--dv-primary)', label }: { pct: number; cols?: number; rows?: number; color?: string; label?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.max(p > 0 ? 1 : 0, Math.round((p / 100) * cols));
  const step = 6;
  const dots = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      dots.push(<circle key={`${c}-${r}`} cx={c * step + step / 2} cy={r * step + step / 2} r={2} fill={c < filled ? color : 'var(--dv-track)'} />);
    }
  }
  return (
    <svg className="dd-dm" width={cols * step} height={rows * step} viewBox={`0 0 ${cols * step} ${rows * step}`} role="img" aria-label={label ?? `${Math.round(p)}%`}>
      {dots}
    </svg>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="dd-empty">{children}</p>;
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

interface BannerStat {
  value: number | string;
  label: string;
  alert?: boolean;
}

// Banner gradient di kanan judul (angka ringkas + tombol aksi).
export function HeroBanner({
  title,
  text,
  cta,
  onCta,
  stats,
}: {
  title: ReactNode;
  text: string;
  cta?: string;
  onCta?: () => void;
  stats: BannerStat[];
}) {
  return (
    <div className="dd-banner">
      <span className="arc arc-y" aria-hidden="true" />
      <span className="arc arc-r1" aria-hidden="true" />
      <span className="arc arc-r2" aria-hidden="true" />
      <div>
        <h3 className="dv-g dd-banner-t">{title}</h3>
        <p className="dd-banner-p">{text}</p>
      </div>
      <div className="dd-banner-foot">
        {cta ? (
          <button type="button" className="dd-bgo" onClick={onCta}>
            {cta}
            <ArrowRight size={13} />
          </button>
        ) : (
          <span />
        )}
        <div className="dd-bstats">
          {stats.map((s) => (
            <div key={s.label} className={`dd-bstat ${s.alert && Number(s.value) > 0 ? 'is-alert' : ''}`}>
              <b className="dv-g">{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LedgerHeader({
  name,
  greeting,
  sentence,
  actions,
  banner,
}: {
  name?: string | null;
  greeting?: string; // contoh: "Halo" untuk dashboard user; default sapaan sesuai jam
  sentence: ReactNode;
  actions?: ReactNode;
  banner?: ReactNode;
}) {
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const salam = greeting ?? greetingWord();
  return (
    <header className={`dd-hero ${banner ? 'has-banner' : ''}`}>
      <div className="min-w-0">
        <p className="dv-muted text-[13px] mb-1.5">{today}</p>
        <h1 className="dv-g dd-title">{firstName ? `${salam}, ${firstName}` : salam}</h1>
        <p className="dv-soft text-sm mt-2.5 max-w-[540px] leading-relaxed">{sentence}</p>
        {actions && <div className="flex gap-2.5 flex-wrap mt-[18px]">{actions}</div>}
      </div>
      {banner}
    </header>
  );
}

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
    <svg className="dd-dm" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {dots.map(([cx, cy], k) => (
        <circle key={k} cx={cx} cy={cy} r={1.4} fill={color} />
      ))}
    </svg>
  );
}


// ════════════════════════════════════════════════════════════════════════
// PAGER (halaman ‹ 1 2 3 ›)
//   (dulu: widgets/ledger/Pager.tsx)
// ════════════════════════════════════════════════════════════════════════

// Nomor halaman yang ditampilkan: halaman pertama, terakhir, dan tetangga halaman aktif; sisanya "…".
function windowPages(cur: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, total, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (cur >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => keep.add(n));
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

// [DASHBOARD-V3] Paginasi bersama (Aktivitas terbaru & Notifikasi). `page` mulai dari 1.
export function Pager({ total, perPage, page, onPage }: { total: number; perPage: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (cur - 1) * perPage + 1;
  const to = Math.min(total, cur * perPage);

  return (
    <div className="dd-pager">
      <span className="dd-pager-i" aria-live="polite">
        {from}–{to} dari {total}
      </span>
      <div className="dd-pager-b">
        <button type="button" aria-label="Halaman sebelumnya" disabled={cur <= 1} onClick={() => onPage(cur - 1)}>
          <ChevronLeft size={14} />
        </button>
        {windowPages(cur, pages).map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} aria-hidden="true">
              …
            </span>
          ) : (
            <button key={n} type="button" className={n === cur ? 'is-on' : ''} aria-label={`Halaman ${n}`} aria-current={n === cur ? 'page' : undefined} onClick={() => onPage(n)}>
              {n}
            </button>
          ),
        )}
        <button type="button" aria-label="Halaman berikutnya" disabled={cur >= pages} onClick={() => onPage(cur + 1)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════
// BARIS AKTIVITAS (AktivitasRows) — dipakai kalender admin, kalender user, riwayat user
//   (dulu: widgets/ledger/AktivitasLedger.tsx)
// ════════════════════════════════════════════════════════════════════════

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
            <div key={`${ev.type}-${ev.waktu}-${i}`} className="dd-ra">
              <div className="dd-ra-l">
                <div className="dd-ra-n">
                  <i className={`t-${toneAktivitas(ev)}`} aria-hidden="true" />
                  <span>{nama ? `${kode} : ${nama}` : kode}</span>
                </div>
                <div className="dd-ra-m">
                  {pelaku ? `${pelaku} ` : ''}
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


// ════════════════════════════════════════════════════════════════════════
// NOTIFIKASI (panel daftar notifikasi)
//   (dulu: widgets/ledger/NotifikasiLedger.tsx)
// ════════════════════════════════════════════════════════════════════════

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
      : { teks: 'DIPERBAIKI', cls: 'sg' };
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
      subtitle={v4 ? undefined : `${unread.length > 0 ? `${unread.length} belum dibaca` : 'Semua sudah dibaca'} \u00b7 ${all.length} total`}
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
        className={`dd-nlist ${fill ? 'is-fill' : ''}`}
        style={fill ? ({ '--np': pageSize } as CSSProperties) : { height: pageSize * 66 }}
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
              if (!v4) {
                return (
                  <button key={n.id} type="button" className="dd-nt" onClick={() => open(n)}>
                    <span className="dd-nt-m">
                      {!n.read_at && <i className="dd-un" aria-label="Belum dibaca" />}
                      {!n.read_at ? <b>{n.data?.message}</b> : n.data?.message}
                    </span>
                    <span className="dd-nt-d">{formatWaktuSingkat(n.created_at)}</span>
                  </button>
                );
              }

              // [DASHBOARD-V4] Semua baris memakai satu struktur yang sama: [dot] [judul + keterangan] [pelapor + status].
              // Slot dot selalu ada (transparan kalau sudah dibaca) supaya teks tidak bergeser antar baris.
              const r = ringkas(n);
              const waktu = formatWaktuSingkat(n.created_at);
              const title = r ? r.kode : (n.data?.message ?? 'Notifikasi baru');
              const sub = r ? r.tipe : null;
              const unreadRow = !n.read_at;
              return (
                <button key={n.id} type="button" className={`dd-nt is-row${unreadRow ? ' is-unread' : ''}${r ? '' : ' is-msg'}`} onClick={() => open(n)}>
                  <span className="dd-nt-l">
                    <i className="dd-un" aria-label={unreadRow ? 'Belum dibaca' : undefined} aria-hidden={unreadRow ? undefined : true} />
                    <b title={title}>{title}</b>
                    <small>
                      {sub && <span className="dd-nt-s" title={sub}>{sub}</span>}
                      <span className="dd-nt-w">{sub ? `\u00a0\u00b7 ${waktu}` : waktu}</span>
                    </small>
                  </span>
                  {r && (
                    <span className="dd-nt-r">
                      <b title={r.user}>{r.user}</b>
                      <em className={r.status.cls}>{r.status.teks}</em>
                    </span>
                  )}
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


// ════════════════════════════════════════════════════════════════════════
// SKELETON LOADING (tampil selama data deferred belum datang)
//   (dulu: widgets/_shared/DashboardSkeleton.tsx)
// ════════════════════════════════════════════════════════════════════════

// ==== Skeleton loading buat Dashboard, meniru layout baru tiap varian (kelas .dv / .dd-* sama dengan halaman asli)
// supaya tidak "loncat" pas data beneran datang. Dipakai selagi props deferred (analitik / pribadi) belum datang.
// - 'full'   = DashboardAdmin (v4): hero + 4 kartu angka + aktivitas/kalender di kiri; terbanyak dipegang + notifikasi di kanan
// - 'simple' = DashboardUser: header + banner, dua kolom kartu, lalu kalender + notifikasi ====

// Baris daftar generik: teks dua baris di kiri, angka kecil di kanan (aktivitas, notifikasi, terbanyak dipegang).
function BarisSkeleton({ jumlah, kanan = true }: { jumlah: number; kanan?: boolean }) {
  return (
    <div>
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2.5" style={i > 0 ? { borderTop: '1px solid var(--dv-line)' } : undefined}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 rounded w-3/5" />
            <Skeleton className="h-2.5 rounded w-2/5" />
          </div>
          {kanan && <Skeleton className="h-3 rounded w-12 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// Kepala kartu: judul di kiri, tautan kecil di kanan.
function KepalaKartu({ lebarJudul = 'w-32', tautan = true }: { lebarJudul?: string; tautan?: boolean }) {
  return (
    <div className="dd-ch">
      <Skeleton className={`h-3.5 rounded ${lebarJudul}`} />
      {tautan && <Skeleton className="h-3 rounded w-14" />}
    </div>
  );
}

// Kalender: kepala bulan + nama hari + 5 minggu.
function KalenderSkeleton({ besar = false }: { besar?: boolean }) {
  const cell = besar ? 'h-9 w-9 rounded-full' : 'h-6 w-6 rounded-lg';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="flex gap-1">
          <Skeleton className="h-[22px] w-[22px] rounded-md" />
          <Skeleton className="h-[22px] w-[22px] rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 rounded mx-auto w-4" />
        ))}
      </div>
      <div className={`grid grid-cols-7 ${besar ? 'gap-y-2.5' : 'gap-1'}`}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="grid place-items-center" style={{ height: besar ? 40 : 30 }}>
            <Skeleton className={cell} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardAdminSkeleton() {
  return (
    <div className="dv dd-page dd-v4" aria-busy="true" aria-label="Memuat dashboard">
      <div className="dd-main">
        {/* Kolom kiri */}
        <div className="dd-mcol">
          {/* Hero: ringkasan angka + chart pembelian */}
          <section className="dd-card">
            <div className="dd-hv">
              <div className="dd-hv-l">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-9 w-24 rounded mt-3.5" />
                <Skeleton className="h-4 w-32 rounded mt-2.5" />
                <div className="dd-hv-two">
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
              </div>
              <div className="dd-hv-r">
                <div className="dd-rng">
                  <Skeleton className="h-5 w-10 rounded-md" />
                  <Skeleton className="h-5 w-10 rounded-md" />
                  <Skeleton className="h-5 w-10 rounded-md" />
                </div>
                <div className="flex items-end justify-between gap-2" style={{ height: 190 }}>
                  {[55, 70, 45, 85, 60, 95, 50, 75, 65, 90, 58, 72].map((h, i) => (
                    <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4 kartu angka */}
          <div className="dd-kp">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dd-kc" style={{ cursor: 'default' }}>
                <div className="dd-kc-h">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-[26px] w-[26px] rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-14 rounded" />
                  <Skeleton className="h-2.5 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Aktivitas terbaru + kalender */}
          <div className="dd-pair">
            <section className="dd-card">
              <KepalaKartu lebarJudul="w-36" />
              <BarisSkeleton jumlah={6} />
            </section>
            <section className="dd-card">
              <KalenderSkeleton />
            </section>
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="dd-mcol">
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-40" />
            <BarisSkeleton jumlah={5} />
          </section>
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-24" tautan={false} />
            <BarisSkeleton jumlah={5} />
          </section>
        </div>
      </div>
    </div>
  );
}

function DashboardUserSkeleton() {
  return (
    <div className="dv dd-page" aria-busy="true" aria-label="Memuat dashboard">
      {/* Header: tanggal + sapaan + kalimat, banner di kanan */}
      <header className="dd-hero has-banner">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3.5 w-44 rounded" />
          <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
          <div className="space-y-2 pt-1">
            <Skeleton className="h-3.5 w-full max-w-[540px] rounded" />
            <Skeleton className="h-3.5 w-2/3 max-w-[360px] rounded" />
          </div>
        </div>
        <Skeleton className="w-full rounded-[22px]" style={{ minHeight: 176 }} />
      </header>

      {/* Dua kolom: di tanganmu + riwayat | ringkasan */}
      <div className="dd-row2 dd-row2-user">
        <div className="flex flex-col gap-5 min-w-0">
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-32" />
            <BarisSkeleton jumlah={2} />
          </section>
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-36" tautan={false} />
            <BarisSkeleton jumlah={4} />
          </section>
        </div>
        <section className="dd-card">
          <KepalaKartu lebarJudul="w-24" tautan={false} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dd-stat">
              <Skeleton className="h-3.5 w-36 rounded" />
              <Skeleton className="h-8 w-10 rounded" />
            </div>
          ))}
        </section>
      </div>

      {/* Kalender + notifikasi */}
      <div className="dd-split">
        <section className="dd-card dd-calcard">
          <KepalaKartu lebarJudul="w-40" tautan={false} />
          <KalenderSkeleton besar />
        </section>
        <div className="dd-aside">
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-28" tautan={false} />
            <BarisSkeleton jumlah={4} kanan={false} />
          </section>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ variant = 'simple' }: { variant?: 'simple' | 'full' }) {
  return variant === 'full' ? <DashboardAdminSkeleton /> : <DashboardUserSkeleton />;
}
