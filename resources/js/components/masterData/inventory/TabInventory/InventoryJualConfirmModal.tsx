import type { Inventory } from '../../../../api/masterData/inventory';

interface InventoryJualConfirmModalProps {
  jualTarget: Inventory;
  jualError: string;
  setJualTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  jualLoading: boolean;
  confirmJual: () => void | Promise<void>;
}

export default function InventoryJualConfirmModal({ jualTarget, jualError, setJualTarget, jualLoading, confirmJual }: InventoryJualConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Tandai inventory sebagai dijual?</h2>
        <p className="text-sm text-slate-500 mb-1">
          <span className="font-medium text-slate-700">{jualTarget.kode_inventory}</span> akan ditandai dengan status{' '}
          <span className="font-medium">Dijual</span> dan tidak bisa diserahkan/dipinjamkan lagi.
        </p>

        <div className="mb-4" />

        {jualError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{jualError}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setJualTarget(null)}
            disabled={jualLoading}
            className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={confirmJual}
            disabled={jualLoading}
            className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {jualLoading ? 'Menyimpan...' : 'Ya, Dijual'}
          </button>
        </div>
      </div>
    </div>
  );
}
