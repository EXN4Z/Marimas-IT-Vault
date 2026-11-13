import { useState } from 'react';
import { Unlink, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { router } from '@inertiajs/react';
import type { Inventory } from '../types/inventory';
import { ButtonCancel, ButtonSubmit, Field, Textarea } from '../../../components/form/FormControls';

interface Props {
  inventory: Inventory;
  onClose: () => void;
  /** [F4-INERTIA] Sukses -> toast dari flash server; parent cukup menutup modal. */
  onSuccess: () => void;
}

export default function InventoryLepasDariIndukModal({ inventory, onClose, onSuccess }: Props) {
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const indukLabel = inventory.parent
    ? `${inventory.parent.kode_inventory}${inventory.parent.nama ? ' — ' + inventory.parent.nama : ''}`
    : `Induk #${inventory.parent_id}`;

  const handleSubmit = () => {
    setSubmitting(true);
    router.post(`/master-data/inventory/${inventory.id}/lepas-dari-induk`, { keterangan: keterangan.trim() || undefined }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) => {
        const msg = errors.lepas || Object.values(errors)[0] || 'Gagal melepas kelengkapan dari induk. Coba lagi.';
        toast.error(msg);
      },
      onFinish: () => setSubmitting(false),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-line-200-a80 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-line-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tint-amber-50 border border-edge-amber-100 flex items-center justify-center text-tone-amber-600 shadow-sm shrink-0">
              <Unlink size={20} className="text-tone-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink-900 leading-tight">Lepas dari Induk</h3>
              <p className="text-xs text-ink-500 mt-0.5">
                <span className="font-mono font-medium text-ink-700">{inventory.kode_inventory}</span> · {inventory.nama || '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
            className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-hover-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {/* Info induk */}
          <div className="bg-tint-amber-50 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-3.5 text-xs text-tone-amber-900 leading-relaxed">
            Kelengkapan ini akan dilepas dari relasi <span className="font-semibold">{indukLabel}</span>. Setelah dilepas, item ini akan menjadi kelengkapan independen (tersedia).
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-line-100 shrink-0 bg-surface-50-a60">
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