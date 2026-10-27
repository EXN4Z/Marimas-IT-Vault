import { HandCoins, Undo2, Wrench, Tag, Link2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { userIdPemakai } from '../inventoryHelpers';
import type { Inventory } from '../types/inventory';
import type { InventoryPemakai } from '../types/inventoryPemakai';

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
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          {detail.status === 'tersedia' && (
            <button
              type="button"
              onClick={() => setSerahTerimaInventory(detail)}
              className="dv-btn dv-btn-primary inline-flex items-center gap-2 active:scale-95"
            >
              <HandCoins size={14} />
              Serahkan ke Karyawan
            </button>
          )}

          {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
            <button
              type="button"
              onClick={() => setPengembalianTarget({ inventory: detail, pemakai: detail.pemakai_saat_ini! })}
              className="dv-btn dv-btn-primary inline-flex items-center gap-2 active:scale-95"
            >
              <Undo2 size={14} />
              Terima Kembali
            </button>
          )}

          {(detail.status === 'tersedia' || detail.status === 'dipakai') && (
            <button
              type="button"
              onClick={() => setPerbaikanInventoryTarget(detail)}
              className="dv-btn dv-btn-danger inline-flex items-center gap-2 active:scale-95"
            >
              <Wrench size={14} />
              Lapor Kerusakan
            </button>
          )}

          {(detail.status === 'menunggu_perbaikan' || detail.status === 'diperbaiki' || detail.status === 'rusak_berat') && (
            <span className="dv-btn inline-flex items-center gap-2 !cursor-default opacity-70">
              <Wrench size={14} />
              Laporan Kerusakan Terdaftar
            </span>
          )}

          {!detail.parent_id && detail.status === 'tersedia' && (
            <button
              type="button"
              onClick={() => setPasangIndukTarget(detail)}
              className="dv-btn inline-flex items-center gap-2 active:scale-95"
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
                className="dv-btn inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                <Tag size={14} />
                Jual Inventory
              </button>
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          {detail.status === 'dipakai' && userIdPemakai(detail.pemakai_saat_ini) === user?.id && (
            <>
              <button
                type="button"
                onClick={() => setPengembalianTarget({ inventory: detail, pemakai: detail.pemakai_saat_ini! })}
                className="dv-btn dv-btn-primary inline-flex items-center gap-2 active:scale-95"
              >
                <Undo2 size={14} />
                Kembalikan Barang
              </button>
              <button
                type="button"
                onClick={() => setPerbaikanInventoryTarget(detail)}
                className="dv-btn dv-btn-danger inline-flex items-center gap-2 active:scale-95"
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
