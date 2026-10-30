import { ArrowUpRight } from 'lucide-react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { InventoryPerhatian, RingkasanInventory } from '../../types';
import { DotBars } from './primitives';

// [DASHBOARD-V4] 4 kartu angka dengan dot-matrix mini chart. Klik kartu = buka daftar terkait.
export function KpiDots({ ringkasan, perhatian }: { ringkasan: RingkasanInventory; perhatian: InventoryPerhatian }) {
  const navigate = useAppNavigate();

  const items = [
    { label: 'Total Inventory', value: ringkasan?.total ?? 0, caption: 'Total Semua Unit Inventory', color: '#8b5cf6', to: '/master-data?tab=inventory' },
    { label: 'Tersedia', value: ringkasan?.tersedia ?? 0, caption: 'Siap Dipinjam', color: '#22b8f0', to: '/master-data?tab=inventory&status=tersedia' },
    { label: 'Dipakai', value: ringkasan?.dipakai ?? 0, caption: 'Sedang Dipakai', color: '#12b76a', to: '/master-data?tab=inventory&status=dipakai' },
    { label: 'Dalam Penanganan', value: perhatian?.dalamPenanganan ?? 0, caption: 'Sedang Di Tangani', color: '#f79009', to: '/penanganan-inventory' },
  ];

  return (
    <section aria-label="Status inventory" className="dd-kp">
      {items.map((k, i) => (
        <button key={k.label} type="button" className="dd-kc" onClick={() => navigate(k.to)}>
          <span className="dd-kc-h">
            <span>{k.label}</span>
            <i aria-hidden="true">
              <ArrowUpRight size={13} />
            </i>
          </span>
          <span className="dd-kc-b">
            <span>
              <span className="dd-kc-n">
                <b className="dv-g">{k.value}</b>
                <u aria-hidden="true">↑</u>
              </span>
              <em>{k.caption}</em>
            </span>
            <DotBars color={k.color} w={44} h={26} seed={i + 1} />
          </span>
        </button>
      ))}
    </section>
  );
}
