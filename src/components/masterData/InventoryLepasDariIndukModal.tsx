import { useState } from 'react';
import { Unlink, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { lepasDariIndukInventory, type Inventory } from '../../api/masterData/inventory';
import { ButtonCancel, ButtonSubmit, Field, Textarea } from '../shared/FormControls';

interface Props {
  inventory: Inventory;
  onClose: () => void;
  onSuccess: (updated: Inventory) => void;
}

export default function InventoryLepasDariIndukModal({ inventory, onClose, onSuccess }: Props) {
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const indukLabel = inventory.parent
    ? `${inventory.parent.kode_inventory}${inventory.parent.nama ? ' — ' + inventory.parent.nama : ''}`
    : `Induk #${inventory.parent_id}`;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await lepasDariIndukInventory(inventory.id, {
        keterangan: keterangan.trim() || undefined,
      });
      toast.success('Kelengkapan berhasil dilepas dari induk.');
      onSuccess(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal melepas kelengkapan dari induk. Coba lagi.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm shrink-0">
              <Unlink size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">Lepas dari Induk</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono font-medium text-slate-700">{inventory.kode_inventory}</span> · {inventory.nama || '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {/* Info induk */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed">
            Kelengkapan ini akan dilepas dari relasi <span className="font-semibold">{indukLabel}</span>. Setelah dilepas, item ini akan menjadi kelengkapan independen (tersedia).
          </div>

          <Field label="Alasan / Keterangan Pelepasan (Opsional)">
            <Textarea
              value={keterangan}
              onChange={setKeterangan}
              rows={3}
              placeholder="Jelaskan alasan mengapa kelengkapan ini dilepas dari induknya..."
            />
          </Field>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 animate-[fadeIn_150ms_ease-out]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/60">
          <ButtonCancel onClick={onClose} disabled={submitting} />
          <ButtonSubmit
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            tone="danger"
            loadingLabel="Melepaskan..."
          >
            Lepas dari Induk
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}