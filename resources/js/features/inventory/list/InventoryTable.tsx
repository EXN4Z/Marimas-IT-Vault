import { ChevronDown, Link2 } from 'lucide-react';
import Pagination from '../../../components/table/Pagination';
import StatusBadge from '../../../components/feedback/StatusBadge';
import Tooltip from '../../../components/feedback/Tooltip';
// [F4-INERTIA] Loading/pagination sekarang dari props server: tabel cuma merender halaman yang dikirim.
import { namaPemakai } from '../inventoryHelpers';
import type { Inventory } from '../types/inventory';
import InventoryStatusPill from './InventoryStatusPill';
import { pnCard, pnEmpty, pnTable } from '../../../components/ui/pn';

interface InventoryTableProps {
  pageInventory: Inventory[];
  renderAksi: (a: Inventory) => React.ReactNode;
  expandedInventoryId: number | null;
  setExpandedInventoryId: React.Dispatch<React.SetStateAction<number | null>>;
  inventoryLastPage: number;
  inventoryPageClamped: number;
  setInventoryPage: (page: number) => void;
  /** Total inventory hasil filter (semua halaman). */
  totalItems: number;
}

// [INVENTORY-V2] Tabel dalam kartu (pnCard / pnTable), gaya sama dengan halaman Penanganan.
// Pagination memakai pembungkus aslinya (px-6 py-3 border-t); margin negatif hanya membatalkan padding kartu.
export default function InventoryTable({ pageInventory, renderAksi, expandedInventoryId, setExpandedInventoryId, inventoryLastPage, inventoryPageClamped, setInventoryPage, totalItems }: InventoryTableProps) {
  return (
    <div className={pnCard}>
      {pageInventory.length === 0 && <p className={pnEmpty}>Belum ada inventory.</p>}

      {pageInventory.length > 0 && (
        <div className="hidden sm:block overflow-x-auto">
          <table className={pnTable}>
            <thead>
              <tr>
                <th>Kode Inventory</th>
                <th>Nama</th>
                <th className="text-center">Kategori</th>
                <th className="text-center">Jumlah</th>
                <th className="text-center">Status</th>
                <th>Dipakai Oleh</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageInventory.map((a) => {
                // isChild: item menempel ke induk (parent_id terisi)
                const isChild = a.parent_id !== null;
                return (
                  <tr key={a.id}>
                    <td className="leading-[1.25] font-bold text-dv-ink whitespace-nowrap">{a.kode_inventory}</td>
                    <td style={{ maxWidth: 200 }}>
                      <Tooltip content={a.nama || '-'}>
                        <p className="font-bold text-dv-ink min-w-0 truncate">{a.nama || '-'}</p>
                      </Tooltip>
                      {/* Indikator "Menempel ke ..." untuk item yang parent_id-nya terisi -- data a.parent dari eager-load backend. */}
                      {isChild && a.parent && (
                        <p className="text-[11px] font-normal text-dv-muted flex items-center gap-1 mt-0.5">
                          <Link2 size={11} className="shrink-0" />
                          Menempel ke {a.parent.kode_inventory}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-center">
                      <StatusBadge colorClass={'border border-line-200 bg-surface-50 text-ink-700'}>
                        {a.kategori?.nama || '-'}
                      </StatusBadge>
                    </td>
                    <td className="whitespace-nowrap text-center">{a.jumlah ?? 1}</td>
                    <td className="whitespace-nowrap text-center">
                      <InventoryStatusPill status={a.status} />
                    </td>
                    <td style={{ maxWidth: 180 }}>
                      <Tooltip content={a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}>
                        <p className="min-w-0 truncate">{a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini) || '-'}</p>
                      </Tooltip>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">{renderAksi(a)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE: list card dengan dropdown expand-in-place per baris, gantiin tabel yang kepenuhan di layar sempit. */}
      {pageInventory.length > 0 && (
        <div className="sm:hidden flex flex-col divide-y divide-slate-100">
          {pageInventory.map((a) => {
            const expanded = expandedInventoryId === a.id;
            const isChild = a.parent_id !== null;
            return (
              <div key={a.id} className="py-3">
                <button
                  type="button"
                  onClick={() => setExpandedInventoryId(expanded ? null : a.id)}
                  className="w-full flex items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="leading-[1.25] font-bold text-dv-ink">{a.kode_inventory}</p>
                    <p className="text-xs text-ink-500 truncate">
                      {`${a.nama || '-'} · Jumlah: ${a.jumlah ?? 1}`}
                    </p>
                    {isChild && a.parent && (
                      <p className="text-[11px] font-normal text-dv-muted flex items-center gap-1 mt-0.5">
                        <Link2 size={11} className="shrink-0" />
                        Menempel ke {a.parent.kode_inventory}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <InventoryStatusPill status={a.status} small />
                      <StatusBadge colorClass={'border border-line-200 bg-surface-50 text-ink-700'} size="xs">
                        {a.kategori?.nama || '-'}
                      </StatusBadge>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-ink-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {expanded && (
                  <div className="mt-3 pt-3 border-t border-line-100 flex flex-col gap-2">
                    <p className="text-xs text-ink-500">
                      Dipakai Oleh:{' '}
                      <span className="text-ink-700 font-medium">
                        {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini) || '-'}
                      </span>
                    </p>
                    <div className="flex items-center flex-wrap gap-1.5">{renderAksi(a)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (komponen yang sekarang, tidak diubah) */}
      {pageInventory.length > 0 && inventoryLastPage > 1 && (
        <div className="-mx-[18px] -mb-3 mt-1 px-6 py-3 border-t border-line-100">
          <Pagination
            currentPage={inventoryPageClamped}
            totalPages={inventoryLastPage}
            onPageChange={setInventoryPage}
            totalItems={totalItems}
            itemLabel="inventory"
            className="pt-0 mt-0 border-t-0"
          />
        </div>
      )}
    </div>
  );
}
