import { ArrowUpRight } from 'lucide-react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { InventoryPerhatian, RingkasanInventory } from '../../types';
import { DotMeter } from './primitives';

// [DASHBOARD-V3] 4 kartu angka dengan meter titik (porsi terhadap total inventory). Klik kartu = buka daftar terkait.
export function KpiDots({ ringkasan, perhatian }: { ringkasan: RingkasanInventory; perhatian: InventoryPerhatian }) {
  const navigate = useAppNavigate();
  const total = ringkasan?.total ?? 0;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const items = [
    { label: 'Total inventory', value: total, caption: 'Total semua unit inventory', pct: total > 0 ? 100 : 0, color: 'var(--dv-primary)', to: '/master-data?tab=inventory' },
    { label: 'Tersedia', value: ringkasan?.tersedia ?? 0, caption: 'Siap dipinjam', pct: pct(ringkasan?.tersedia ?? 0), color: 'var(--dd-green)', to: '/master-data?tab=inventory&status=tersedia' },
    { label: 'Dipakai', value: ringkasan?.dipakai ?? 0, caption: 'Sedang dipakai', pct: pct(ringkasan?.dipakai ?? 0), color: 'var(--dd-yellow)', to: '/master-data?tab=inventory&status=dipakai' },
    { label: 'Dalam penanganan', value: perhatian?.dalamPenanganan ?? 0, caption: 'Sedang ditangani', pct: pct(perhatian?.dalamPenanganan ?? 0), color: 'var(--dd-salmon)', to: '/penanganan-inventory' },
  ];

  return (
    <section aria-label="Status inventory" className="dd-kp">
      {items.map((k) => (
        <button key={k.label} type="button" className="dd-kc" onClick={() => navigate(k.to)}>
          <span className="dd-kc-h">
            <span>{k.label}</span>
            <i aria-hidden="true">
              <ArrowUpRight size={14} />
            </i>
          </span>
          <span className="dd-kc-b">
            <span>
              <b className="dv-g">{k.value}</b>
              <em>{k.caption}</em>
            </span>
            <DotMeter pct={k.pct} color={k.color} label={`${k.pct}% dari total inventory`} />
          </span>
        </button>
      ))}
    </section>
  );
}
