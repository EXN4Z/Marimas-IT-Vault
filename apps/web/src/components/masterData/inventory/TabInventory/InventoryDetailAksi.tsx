import { HandCoins, Undo2, Wrench, Tag, Link2 } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { userIdPemakai } from '../../../../utils/inventoryHelpers';
import type { Inventory } from '../../../../api/masterData/inventory';
import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';

interface InventoryDetailAksiProps {
  isAdmin: boolean;
  detail: Inventory;
  setSerahTerimaInventory: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setPengembalianTarget: React.Dispatch<React.SetStateAction<{ inventory: Inventory; pemakai: InventoryPemakai } | null>>;
  setPerbaikanInventoryTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setPasangIndukTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  openJual: (a: Inventory) => void;
  user: ReturnType<typeof useAuth>['user'];
}

export default function InventoryDetailAksi({ isAdmin, detail, setSerahTerimaInventory, setPengembalianTarget, setPerbaikanInventoryTarget, setPasangIndukTarget, openJual, user }: InventoryDetailAksiProps) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2.5">
        Aksi Manajemen Unit
      </h4>
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2">
          {detail.status === 'tersedia' && (
            <button
              type="button"
              onClick={() => setSerahTerimaInventory(detail)}
              className="flex items-center gap-1.5 bg-slate-900 dark:bg-blue-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-blue-500 transition shadow-xs cursor-pointer active:scale-95"
            >
              <HandCoins size={14} />
              Serahkan ke Karyawan
            </button>
          )}

          {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
            <button
              type="button"
              onClick={() => setPengembalianTarget({ inventory: detail, pemakai: detail.pemakai_saat_ini! })}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-xs cursor-pointer active:scale-95"
            >
              <Undo2 size={14} />
              Terima Kembali
            </button>
          )}

          {(detail.status === 'tersedia' || detail.status === 'dipakai') && (
            <button
              type="button"
              onClick={() => setPerbaikanInventoryTarget(detail)}
              className="flex items-center gap-1.5 bg-red-50 dark:bg-rose-950/40 text-red-700 dark:text-rose-300 border border-red-200 dark:border-rose-900/60 text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-red-100 dark:hover:bg-rose-900/50 transition cursor-pointer active:scale-95"
            >
              <Wrench size={14} />
              Lapor Kerusakan
            </button>
          )}

          {(detail.status === 'menunggu_perbaikan' || detail.status === 'diperbaiki' || detail.status === 'rusak_berat') && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-3.5 py-2.5 rounded-xl cursor-default">
              <Wrench size={14} />
              Laporan Kerusakan Terdaftar
            </span>
          )}

          {!detail.parent_id && detail.status === 'tersedia' && (
            <button
              type="button"
              onClick={() => setPasangIndukTarget(detail)}
              className="flex items-center gap-1.5 bg-sky-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-sky-700 transition shadow-xs cursor-pointer active:scale-95"
            >
              <Link2 size={14} />
              Pasang ke Induk
            </button>
          )}

          {(detail.status === 'tersedia' || detail.status === 'rusak_berat') && (() => {
            const adaChild = (detail.children?.length ?? 0) > 0;
            const adaParent = !!detail.parent_id;
            const tidakBisaDijual = adaChild || adaParent;
            const tooltipJual = adaChild
              ? 'Lepas kelengkapan yang menempel dulu sebelum menjual item ini.'
              : adaParent
              ? 'Item ini masih menempel ke induk.'
              : undefined;

            return (
              <button
                type="button"
                onClick={() => !tidakBisaDijual && openJual(detail)}
                disabled={tidakBisaDijual}
                title={tooltipJual}
                className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer active:scale-95"
              >
                <Tag size={14} />
                Jual Inventory
              </button>
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {detail.status === 'dipakai' && userIdPemakai(detail.pemakai_saat_ini) === user?.id && (
            <>
              <button
                type="button"
                onClick={() => setPengembalianTarget({ inventory: detail, pemakai: detail.pemakai_saat_ini! })}
                className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-xs cursor-pointer active:scale-95"
              >
                <Undo2 size={14} />
                Kembalikan Barang
              </button>
              <button
                type="button"
                onClick={() => setPerbaikanInventoryTarget(detail)}
                className="flex items-center gap-1.5 bg-red-50 dark:bg-rose-950/40 text-red-700 dark:text-rose-300 border border-red-200 dark:border-rose-900/60 text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-red-100 transition cursor-pointer active:scale-95"
              >
                <Wrench size={14} />
                Lapor Kerusakan
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
