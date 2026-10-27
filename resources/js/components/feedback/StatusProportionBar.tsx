// Bar segmen proporsi per status (dipakai Penanganan & Inventory).
// Lebar tiap segmen = jumlahnya; label + angka ditaruh tepat di bawah segmennya.
// Warna: isi className (Tailwind, bisa ada varian dark:) ATAU color (hex / css color).

export interface StatusBarSegment {
  key: string;
  label: string;
  count: number;
  className?: string;
  color?: string;
}

interface StatusProportionBarProps {
  segments: StatusBarSegment[];
  ariaLabel: string;
  className?: string;
}

export default function StatusProportionBar({ segments, ariaLabel, className = '' }: StatusProportionBarProps) {
  const aktif = segments.filter((s) => s.count > 0);
  if (aktif.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex gap-0.5 h-2.5" role="img" aria-label={ariaLabel}>
        {aktif.map((s) => (
          <div
            key={s.key}
            className={['rounded-[1px]', s.className ?? ''].join(' ')}
            style={{ flex: s.count, minWidth: 4, ...(s.color ? { background: s.color } : {}) }}
          />
        ))}
      </div>
      <div className="flex gap-0.5 mt-1.5 text-[11px] text-slate-500">
        {aktif.map((s) => {
          const teks = (s.label + ' ' + s.count).trim();
          return (
            <span key={s.key} style={{ flex: s.count }} className="truncate" title={teks}>
              {teks}
            </span>
          );
        })}
      </div>
    </div>
  );
}
