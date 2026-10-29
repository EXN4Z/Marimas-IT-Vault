import type { ReactNode } from 'react';
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
