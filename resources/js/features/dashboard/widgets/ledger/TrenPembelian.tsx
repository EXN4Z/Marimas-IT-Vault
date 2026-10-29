import { useState } from 'react';
import type { TrenPembelianInventory } from '../../types';
import { Panel, EmptyNote } from './primitives';

// Chart batang: bulan terakhir ditandai; arahkan kursor ke bar lain untuk melihat angkanya.
export function TrenPembelian({ data = [] }: { data?: TrenPembelianInventory[] }) {
  const rows = Array.isArray(data) ? data : [];
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(0, ...rows.map((r) => r.jumlah));
  const total = rows.reduce((a, r) => a + r.jumlah, 0);
  const lastIdx = rows.length - 1;
  const last = rows[lastIdx];
  const prev = rows[lastIdx - 1];
  const active = hover !== null && hover <= lastIdx ? hover : lastIdx;

  // Skala sumbu Y: 4 interval sama besar.
  const step = Math.max(1, Math.ceil((max * 1.15) / 4));
  const top = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => i * step);

  let caption = '';
  let diff = 0;
  if (last) {
    caption = `${last.bulan} membeli ${last.jumlah} unit`;
    if (prev) {
      diff = last.jumlah - prev.jumlah;
      caption += diff > 0 ? `, naik ${diff} unit dari ${prev.bulan}.` : diff < 0 ? `, turun ${Math.abs(diff)} unit dari ${prev.bulan}.` : `, sama dengan ${prev.bulan}.`;
    } else caption += '.';
  }

  return (
    <Panel title={`Pembelian ${rows.length || 6} bulan terakhir`} subtitle={`Jumlah unit dibeli per bulan. Total ${total} unit.`}>
      {rows.length === 0 ? (
        <EmptyNote>Belum ada data pembelian.</EmptyNote>
      ) : (
        <>
          <div className="dd-plot">
            <div className="dd-grid" aria-hidden="true">
              {ticks.map((t) => (
                <i key={t}>
                  <span>{t}</span>
                </i>
              ))}
            </div>
            <div className="dd-bars">
              {rows.map((r, i) => {
                const ratio = top > 0 ? r.jumlah / top : 0;
                const isActive = i === active;
                return (
                  <div
                    key={r.bulan}
                    className={`dd-bcol ${isActive ? 'is-hi' : ''}`}
                    title={`${r.bulan}: ${r.jumlah} unit`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {isActive && (
                      <div className="dd-tip" style={{ bottom: `calc((100% - 26px) * ${ratio} + 36px)` }}>
                        <b className="dv-g">{r.jumlah}</b>
                        <span>unit &middot; {r.bulan}</span>
                      </div>
                    )}
                    <div className="dd-bar" style={{ height: `calc((100% - 26px) * ${ratio})`, minHeight: r.jumlah > 0 ? 4 : 0 }} />
                    <span className="dd-blb">{r.bulan}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="dd-cap">
            {prev && diff !== 0 && (
              <b className={diff > 0 ? 'is-up' : 'is-down'}>
                {diff > 0 ? '\u2191' : '\u2193'} {Math.abs(diff)} unit
              </b>
            )}
            {caption}
          </p>
        </>
      )}
    </Panel>
  );
}
