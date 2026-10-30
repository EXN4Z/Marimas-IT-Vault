import { ChevronLeft, ChevronRight } from 'lucide-react';

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
