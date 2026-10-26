import type { ReactNode } from 'react';

// Blok dasar gaya "ledger": judul + subjudul, lalu isi. Warna semua lewat kelas .dv-* (index.css).
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
    <section aria-label={title} className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
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
  return <p className="dv-row dv-muted" style={{ display: 'block' }}>{children}</p>;
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function LedgerHeader({
  name,
  greeting,
  sentence,
  actions,
}: {
  name?: string | null;
  greeting?: string; // contoh: "Halo" untuk dashboard user; default sapaan sesuai jam
  sentence: ReactNode;
  actions?: ReactNode;
}) {
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const salam = greeting ?? greetingWord();
  return (
    <header className="flex items-end justify-between gap-6 flex-wrap">
      <div>
        <p className="dv-muted text-[13px] mb-1.5">{today}</p>
        <h1 className="dv-g dv-title">{firstName ? `${salam}, ${firstName}` : salam}</h1>
        <p className="dv-soft text-sm mt-2 max-w-[560px] leading-relaxed">{sentence}</p>
      </div>
      {actions && <div className="flex gap-2.5 flex-wrap">{actions}</div>}
    </header>
  );
}
