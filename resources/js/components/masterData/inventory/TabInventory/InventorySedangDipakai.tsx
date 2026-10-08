import { Undo2, Wrench } from 'lucide-react';
import StatusBadge from '../../../shared/StatusBadge';
import type { Inventory } from '../../../../api/masterData/inventory';
import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';
import { STATUS_STYLE, STATUS_LABEL } from './helpers';

interface InventorySedangDipakaiProps {
  myBorrowedItems: Inventory[];
  openDetail: (id: number) => void | Promise<void>;
  setPengembalianTarget: React.Dispatch<React.SetStateAction<{ inventory: Inventory; pemakai: InventoryPemakai } | null>>;
  setPerbaikanInventoryTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
}

export default function InventorySedangDipakai({ myBorrowedItems, openDetail, setPengembalianTarget, setPerbaikanInventoryTarget }: InventorySedangDipakaiProps) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-slate-900 mb-3">Sedang Anda Pakai</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {myBorrowedItems.map((a) => (
          <div key={a.id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{a.kode_inventory}</p>
                <p className="text-xs text-slate-500 truncate">{a.nama || '-'}</p>
              </div>
              <StatusBadge colorClass={STATUS_STYLE[a.status]} className="shrink-0">
                {STATUS_LABEL[a.status]}
              </StatusBadge>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => openDetail(a.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              >
                Detail
              </button>
              {a.status === 'dipakai' && a.pemakai_saat_ini && (
                <>
                  <button
                    onClick={() => setPengembalianTarget({ inventory: a, pemakai: a.pemakai_saat_ini! })}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                  >
                    <Undo2 size={13} />
                    Kembalikan
                  </button>
                  <button
                    onClick={() => setPerbaikanInventoryTarget(a)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition"
                  >
                    <Wrench size={13} />
                    Lapor Kerusakan
                  </button>
                </>
              )}
              {(a.status === 'menunggu_perbaikan' || a.status === 'diperbaiki' || a.status === 'rusak_berat') && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg cursor-default">
                  <Wrench size={13} />
                  Sudah Lapor
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
