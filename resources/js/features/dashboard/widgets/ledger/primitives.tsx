import { useMemo, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

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
export function DotMeter({ pct, cols = 12, rows = 3, color = 'var(--dv-primary)', label }: { pct: number; cols?: number; rows?: number; color?: string; label?: string }) {
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

export interface BannerStat {
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
