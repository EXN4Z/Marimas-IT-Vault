import type { InventoryStatus } from '../types/inventory';
import { STATUS_LABEL, STATUS_BAR_CLASS } from './helpers';

// Pill status baru: titik berwarna + teks netral (warna pastel tetap terbaca di terang & gelap).
export default function InventoryStatusPill({ status, small = false }: { status: InventoryStatus; small?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 font-semibold text-slate-800 whitespace-nowrap',
        small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      ].join(' ')}
    >
      <span className={['w-1.5 h-1.5 rounded-full', STATUS_BAR_CLASS[status]].join(' ')} />
      {STATUS_LABEL[status]}
    </span>
  );
}
