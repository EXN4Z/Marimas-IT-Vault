import StatusProportionBar from '../../../components/feedback/StatusProportionBar';
import type { InventoryStatus } from '../types/inventory';
import { STATUS_LABEL, STATUS_BAR_CLASS } from './helpers';

const URUTAN: InventoryStatus[] = ['tersedia', 'dipakai', 'menunggu_perbaikan', 'diperbaiki', 'rusak_berat', 'dijual'];

// Bar proporsi inventory per status (komponen bersama StatusProportionBar, sama dengan Penanganan).
// Angka = jumlah di populasi filter kategori aktif (props.inventory.status_counts dari server),
// tidak ikut berubah saat tab status / pencarian dipakai.
export default function InventoryStatusBar({ counts }: { counts?: Record<InventoryStatus, number> }) {
  if (!counts) return null;
  return (
    <StatusProportionBar
      className="mb-5"
      ariaLabel="Proporsi inventory per status"
      segments={URUTAN.map((s) => ({ key: s, label: STATUS_LABEL[s], count: counts[s] ?? 0, className: STATUS_BAR_CLASS[s] }))}
    />
  );
}
