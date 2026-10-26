import type { RingkasanInventory } from '../../types';

// Hero admin: total aset + satu bar bersegmen (tersedia / dipakai / rusak berat / dijual).
export function StatusLedger({ ringkasan }: { ringkasan: RingkasanInventory }) {
  const total = ringkasan?.total ?? 0;
  const segs = [
    { label: 'Tersedia', value: ringkasan?.tersedia ?? 0, color: 'var(--dv-primary)', alert: false },
    { label: 'Dipakai', value: ringkasan?.dipakai ?? 0, color: 'var(--dv-seg-dipakai)', alert: false },
    { label: 'Rusak berat', value: ringkasan?.rusakBerat ?? 0, color: 'var(--dv-alert)', alert: true },
    { label: 'Dijual', value: ringkasan?.dijual ?? 0, color: 'var(--dv-seg-dijual)', alert: false },
  ];
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const summary = segs.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ');

  return (
    <section aria-label="Status inventory" className="grid gap-6 lg:gap-10 lg:grid-cols-[260px_1fr] items-end">
      <div>
        <div className="dv-g text-[72px] sm:text-[96px] leading-[0.9] font-bold">{total}</div>
        <p className="dv-soft text-sm mt-2">aset terdata</p>
      </div>
      <div>
        <div className="flex gap-[3px] h-[26px]" role="img" aria-label={`Dari ${total} aset: ${summary}`}>
          {total === 0 ? (
            <div className="flex-1 dv-track" style={{ height: '100%' }} />
          ) : (
            segs.filter((s) => s.value > 0).map((s) => (
              <div key={s.label} style={{ flex: s.value, minWidth: 4, background: s.color }} />
            ))
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-[13px] dv-soft">
          {segs.map((s) => (
            <div key={s.label}>
              <b className={`dv-g text-[22px] ${s.alert && s.value > 0 ? 'dv-alert' : ''}`} style={s.alert && s.value > 0 ? undefined : { color: 'var(--dv-ink)' }}>
                {s.value}
              </b>
              <br />
              {s.label}
              {s.label !== 'Rusak berat' && total > 0 ? ` (${pct(s.value)}%)` : ''}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
