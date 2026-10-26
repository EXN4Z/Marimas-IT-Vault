import type { TrenPembelianInventory } from '../../types';
import { Panel, EmptyNote } from './primitives';

const TINGGI_MAKS = 136;

export function TrenPembelian({ data = [] }: { data?: TrenPembelianInventory[] }) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(0, ...rows.map((r) => r.jumlah));
  const total = rows.reduce((a, r) => a + r.jumlah, 0);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  let caption = '';
  if (last) {
    caption = `${last.bulan} membeli ${last.jumlah} unit`;
    if (prev) {
      const diff = last.jumlah - prev.jumlah;
      caption += diff > 0 ? `, naik ${diff} unit dari ${prev.bulan}.` : diff < 0 ? `, turun ${Math.abs(diff)} unit dari ${prev.bulan}.` : `, sama dengan ${prev.bulan}.`;
    } else caption += '.';
  }

  return (
    <Panel title={`Pembelian ${rows.length || 6} bulan terakhir`} subtitle={`Jumlah unit dibeli per bulan. Total ${total} unit.`}>
      {rows.length === 0 ? (
        <EmptyNote>Belum ada data pembelian.</EmptyNote>
      ) : (
        <>
          <div className="flex items-end gap-3.5" style={{ height: TINGGI_MAKS + 24, borderBottom: '1px solid var(--dv-ink)' }}>
            {rows.map((r, i) => {
              const isLast = i === rows.length - 1;
              const h = max > 0 ? Math.max(r.jumlah > 0 ? 4 : 0, Math.round((r.jumlah / max) * TINGGI_MAKS)) : 0;
              return (
                <div key={r.bulan} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${r.bulan}: ${r.jumlah} unit`}>
                  <span className="text-[12px] dv-muted" style={isLast ? { color: 'var(--dv-ink)', fontWeight: 600 } : undefined}>{r.jumlah}</span>
                  <div style={{ width: '100%', height: h, borderRadius: '2px 2px 0 0', background: isLast ? 'var(--dv-primary)' : 'var(--dv-bar-soft)' }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3.5 text-[12px] dv-muted mt-1.5 text-center">
            {rows.map((r, i) => (
              <span key={r.bulan} className="flex-1" style={i === rows.length - 1 ? { color: 'var(--dv-ink)', fontWeight: 600 } : undefined}>
                {r.bulan}
              </span>
            ))}
          </div>
          <p className="dv-soft text-[13px] mt-3.5 leading-relaxed">{caption}</p>
        </>
      )}
    </Panel>
  );
}
