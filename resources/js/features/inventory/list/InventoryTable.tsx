import { ChevronDown, Link2 } from 'lucide-react';
import Pagination from '../../../components/table/Pagination';
import StatusBadge from '../../../components/feedback/StatusBadge';
import Tooltip from '../../../components/feedback/Tooltip';
// [F4-INERTIA] Loading/pagination sekarang dari props server: tabel cuma merender halaman yang dikirim.
import { namaPemakai } from '../inventoryHelpers';
import type { Inventory } from '../types/inventory';
import { STATUS_AKSEN } from './helpers';
import InventoryStatusPill from './InventoryStatusPill';

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

export default function InventoryTable({ pageInventory, renderAksi, expandedInventoryId, setExpandedInventoryId, inventoryLastPage, inventoryPageClamped, setInventoryPage, totalItems }: InventoryTableProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {pageInventory.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">Belum ada inventory.</p>
      )}

      {pageInventory.length > 0 && (
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-50 text-[11px] text-slate-500">
                <th className="px-6 py-3 font-medium">Kode Inventory</th>
                <th className="px-6 py-3 font-medium">Nama</th>
                <th className="px-6 py-3 font-medium">Kategori</th>
                <th className="px-6 py-3 font-medium">Jumlah</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Dipakai Oleh</th>
                <th className="px-6 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageInventory.map((a) => {
                // isChild: item menempel ke induk (parent_id terisi)
                const isChild = a.parent_id !== null;
                return (
                  <tr key={a.id} className="text-center border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className={['px-6 py-3 font-medium text-slate-800 whitespace-nowrap', STATUS_AKSEN[a.status] ?? ''].join(' ')}>{a.kode_inventory}</td>
                    <td className="px-6 py-3 text-slate-600 max-w-[160px]">
                      <Tooltip content={a.nama || '-'}>
                        <p className="truncate">{a.nama || '-'}</p>
                      </Tooltip>
                      {/* Indikator "Menempel ke ..." untuk item yang parent_id-nya
                          terisi -- data a.parent sudah dari eager-load backend. */}
                      {isChild && a.parent && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                          <Link2 size={11} className="shrink-0" />
                          Menempel ke {a.parent.kode_inventory}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <StatusBadge colorClass={isChild ? 'border border-dashed border-slate-300 bg-slate-50 text-slate-600' : 'border border-slate-200 bg-slate-50 text-slate-700'}>
                        {a.kategori?.nama || '-'}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{a.jumlah ?? 1}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <InventoryStatusPill status={a.status} />
                    </td>
                    <td className="px-6 py-3 text-slate-600 max-w-[160px]">
                      <Tooltip content={a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}>
                        <p className="truncate">
                          {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini) || '-'}
                        </p>
                      </Tooltip>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1 flex-nowrap">
                        {renderAksi(a)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE: list card dengan dropdown expand-in-place per baris,
          gantiin tabel yang kepenuhan di layar sempit. Pola sama kayak
          "Dropdown detail" Riwayat Pemakai/Perbaikan di panel detail. */}
      {pageInventory.length > 0 && (
        <div className="sm:hidden flex flex-col divide-y divide-slate-100">
          {pageInventory.map((a) => {
            const expanded = expandedInventoryId === a.id;
            const isChild = a.parent_id !== null;
            return (
              <div key={a.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedInventoryId(expanded ? null : a.id)}
                  className="w-full flex items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{a.kode_inventory}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {`${a.nama || '-'} · Jumlah: ${a.jumlah ?? 1}`}
                    </p>
                    {isChild && a.parent && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <Link2 size={11} className="shrink-0" />
                        Menempel ke {a.parent.kode_inventory}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <InventoryStatusPill status={a.status} small />
                      <StatusBadge colorClass={isChild ? 'border border-dashed border-slate-300 bg-slate-50 text-slate-600' : 'border border-slate-200 bg-slate-50 text-slate-700'} size="xs">
                        {a.kategori?.nama || '-'}
                      </StatusBadge>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {expanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <p className="text-xs text-slate-500">
                      Dipakai Oleh:{' '}
                      <span className="text-slate-700 font-medium">
                        {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini) || '-'}
                      </span>
                    </p>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {renderAksi(a)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageInventory.length > 0 && inventoryLastPage > 1 && (
        <div className="px-6 py-3 border-t border-slate-100">
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
