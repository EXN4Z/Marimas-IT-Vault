import { useMemo, useState } from 'react';
import { X, Link2, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { pasangPenggantiKelengkapanInventory, type Inventory } from '../../api/masterData/inventory';
import { ButtonCancel, ButtonSubmit, inputClass } from '../shared/FormControls';

interface Props {
  inventory: Inventory;
  indukOptions: Inventory[];
  onClose: () => void;
  onSuccess: (updated: Inventory) => void;
}

export default function InventoryPasangIndukModal({ inventory, indukOptions, onClose, onSuccess }: Props) {
  const [parentId, setParentId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return indukOptions;
    return indukOptions.filter(
      (p) => p.kode_inventory.toLowerCase().includes(q) || (p.nama || '').toLowerCase().includes(q)
    );
  }, [indukOptions, search]);

  const selected = indukOptions.find((p) => p.id === parentId) || null;

  const handleSubmit = async () => {
    if (!parentId) {
      toast.error('Pilih salah satu unit induk terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updated = await pasangPenggantiKelengkapanInventory(inventory.id, parentId);
      toast.success('Kelengkapan berhasil dipasangkan ke induk.');
      onSuccess(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal memasang kelengkapan ke induk.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center z-[70] p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <Link2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">Pasang ke Induk</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono font-medium text-slate-700">{inventory.kode_inventory}</span> · {inventory.nama || '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Pilih unit induk tempat kelengkapan ini akan dipasangkan sebagai aksesoris resmi:
          </p>

          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau nama item induk..."
              className={`${inputClass} pl-9`}
              autoFocus
            />
          </div>

          {selected && (
            <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 text-xs">
              <div className="truncate">
                <span className="text-slate-500">Unit Terpilih: </span>
                <span className="font-semibold text-slate-900">{selected.kode_inventory} — {selected.nama || '-'}</span>
              </div>
              <button
                type="button"
                onClick={() => setParentId(null)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0"
              >
                Ganti
              </button>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
            {filteredOptions.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                {indukOptions.length === 0
                  ? 'Belum ada item yang bisa dipilih jadi induk.'
                  : 'Tidak ada item yang cocok dengan pencarian.'}
              </p>
            )}
            {filteredOptions.map((p) => {
              const isSelected = p.id === parentId;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setParentId(p.id)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3.5 py-2.5 text-sm transition ${
                    isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{p.kode_inventory}</span>
                    <span className={`block text-xs truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {p.nama || '-'}
                    </span>
                  </span>
                  {isSelected && <Check size={16} className="shrink-0 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 animate-[fadeIn_150ms_ease-out]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/60">
          <ButtonCancel onClick={onClose} disabled={loading} />
          <ButtonSubmit
            onClick={handleSubmit}
            disabled={!parentId || loading}
            loading={loading}
            loadingLabel="Memasang..."
          >
            Pasangkan
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}