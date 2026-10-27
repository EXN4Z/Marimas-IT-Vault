import type { InventoryStatus } from '../types/inventory';
import { STATUS_LABEL, STATUS_BAR_CLASS } from './helpers';

const URUTAN: InventoryStatus[] = ['tersedia', 'dipakai', 'menunggu_perbaikan', 'diperbaiki', 'rusak_berat', 'dijual'];

// Bar proporsi inventory per status (gaya PenangananProgressBar). Angka = jumlah di populasi filter kategori aktif
// (props.inventory.status_counts dari server), tidak ikut berubah saat tab status / pencarian dipakai.
export default function InventoryStatusBar({ counts }: { counts?: Record<InventoryStatus, number> }) {
  if (!counts) return null;
  const aktif = URUTAN.filter((s) => (counts[s] ?? 0) > 0);
  if (aktif.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex gap-0.5 h-2.5" role="img" aria-label="Proporsi inventory per status">
        {aktif.map((s) => (
          <div key={s} className={['rounded-[1px]', STATUS_BAR_CLASS[s]].join(' ')} style={{ flex: counts[s], minWidth: 4 }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
        {aktif.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={['w-2 h-2 rounded-full', STATUS_BAR_CLASS[s]].join(' ')} />
            {STATUS_LABEL[s]} <span className="font-semibold text-slate-900">{counts[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
