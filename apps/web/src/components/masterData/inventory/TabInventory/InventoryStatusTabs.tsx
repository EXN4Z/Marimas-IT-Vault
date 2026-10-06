import ScrollableTabBar from '../../../shared/ScrollableTabBar';
import type { InventoryStatus } from '../../../../api/masterData/inventory';
import { STATUS_LABEL, STATUS_KHUSUS_INDUK } from './helpers';

interface InventoryStatusTabsProps {
  statusFilter: InventoryStatus | '';
  setStatusFilter: React.Dispatch<React.SetStateAction<InventoryStatus | ''>>;
  statusCounts?: Record<InventoryStatus, number>;
  adaIndukDiFilterAktif: boolean;
}

export default function InventoryStatusTabs({ statusFilter, setStatusFilter, adaIndukDiFilterAktif }: InventoryStatusTabsProps) {
  return (
    <ScrollableTabBar
      className="mb-4"
      activeTab={statusFilter === '' ? 'semua' : statusFilter}
      onChange={(key) => setStatusFilter(key === 'semua' ? '' : (key as InventoryStatus))}
      tabs={[
        {
          key: 'semua' as const,
          label: 'Semua Status',
        },
        // Status "Dijual" disembunyikan kalau semua item di filter aktif
        // adalah child (parent_id terisi) -- karena endpoint jual() menolak
        // item yang punya parent_id. Cek via adaIndukDiFilterAktif.
        ...(Object.keys(STATUS_LABEL) as InventoryStatus[])
          .filter((s) => adaIndukDiFilterAktif || !STATUS_KHUSUS_INDUK.includes(s))
          .map((s) => ({
            key: s,
            label: STATUS_LABEL[s],
          })),
      ]}
    />
  );
}
