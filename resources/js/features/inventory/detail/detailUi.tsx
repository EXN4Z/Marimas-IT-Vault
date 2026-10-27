// Potongan UI kecil bersama untuk modal detail inventory (gaya ledger dashboard, token .dv-* di index.css).

export function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <h4 className="dv-label">{title}</h4>
      {meta && <span className="text-xs dv-muted">{meta}</span>}
    </div>
  );
}

// Titik status; className = warna dari STATUS_BAR_CLASS (sudah ada varian dark).
export function StatusDot({ className }: { className: string }) {
  return <span className={['inline-block w-[7px] h-[7px] rounded-full mr-[7px] shrink-0', className].join(' ')} />;
}
