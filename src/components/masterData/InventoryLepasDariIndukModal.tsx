import { useState } from 'react';
import { Unlink } from 'lucide-react';
import { lepasDariIndukInventory, type Inventory } from '../../api/masterData/inventory';

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
      onSuccess(updated);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Gagal melepas kelengkapan dari induk. Coba lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-sm max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {inventory.kode_inventory} · {inventory.nama || '-'}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Unlink size={18} className="text-amber-500" />
              Lepas dari Induk
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
          {/* Info induk */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
            Kelengkapan ini akan dilepas dari{' '}
            <span className="font-semibold">{indukLabel}</span>. Aksi ini tidak bisa dibatalkan.
          </div>

          {/* Info status saat ini -- tidak berubah, cuma informasi */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600">
            Status item saat ini <span className="font-semibold">tidak berubah</span> oleh aksi ini
            {inventory.status ? (
              <>
                {' '}
                (<span className="font-semibold">{inventory.status}</span>)
              </>
            ) : null}
            .
          </div>

          {/* Textarea keterangan */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Keterangan <span className="text-slate-400 font-normal">(opsional)</span>
            </label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={3}
              placeholder="Kenapa kelengkapan ini dilepas dari induknya?"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Menyimpan...' : 'Lepas dari Induk'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}