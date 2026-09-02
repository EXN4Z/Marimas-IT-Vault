import { useMemo, useState } from 'react';
import { X, Link2, Search, Check } from 'lucide-react';
import { pasangPenggantiKelengkapanInventory, type Inventory } from '../../api/masterData/inventory';
import { ButtonCancel, ButtonSubmit, inputClass } from '../shared/FormControls';

interface Props {
  // Kelengkapan yang mau dipasang -- selalu status 'tersedia' & parent_id
  // null saat modal ini dibuka (dijamin sama syarat tampil tombolnya di
  // TabInventory.tsx), tapi tetap divalidasi juga di backend
  // (pasangPenggantiKelengkapan() nolak kalau status bukan 'tersedia').
  inventory: Inventory;
  // Daftar item yang bisa dipilih jadi induk -- dikirim dari parent
  // (TabInventory.tsx) hasil filter inventoryList yang udah ada di state,
  // biar gak perlu fetch ulang.
  indukOptions: Inventory[];
  onClose: () => void;
  onSuccess: (updated: Inventory) => void;
}

export default function InventoryPasangIndukModal({ inventory, indukOptions, onClose, onSuccess }: Props) {
  // null merepresentasikan "belum ada induk yang dipilih". Sengaja
  // TIDAK di-submit selama masih null -- endpoint pasang-pengganti-kelengkapan
  // di backend mensyaratkan parent_id wajib terisi, jadi tombol Pasang
  // di-disable selama belum ada yang dipilih.
  const [parentId, setParentId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // BARU: filter list induk pakai search box -- dibanding <select>
  // polos, ini lebih gampang dicari di antara data yang bisa banyak banget
  // (cocokkan kode_inventory ATAU nama, biar bisa dicari dari kode atau
  // nama barangnya).
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return indukOptions;
    return indukOptions.filter(
      (p) => p.kode_inventory.toLowerCase().includes(q) || (p.nama || '').toLowerCase().includes(q)
    );
  }, [indukOptions, search]);

  const selected = indukOptions.find((p) => p.id === parentId) || null;

  const handleSubmit = async () => {
    if (!parentId) return;
    setLoading(true);
    setError('');
    try {
      const updated = await pasangPenggantiKelengkapanInventory(inventory.id, parentId);
      onSuccess(updated);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memasang kelengkapan ke induk.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] px-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Link2 size={16} className="text-slate-400" />
            Pasang ke Induk
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Pilih induk tempat{' '}
          <span className="font-medium text-slate-700">
            {inventory.kode_inventory} — {inventory.nama || '-'}
          </span>{' '}
          akan dipasang.
        </p>

        <label className="block text-xs font-medium text-slate-500 mb-1.5">Induk</label>

        {/* BARU: search box + list, ganti <select> polos -- biar gampang
            dicari di antara data item yang bisa banyak banget. */}
        <div className="relative mb-2">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama item..."
            className={`${inputClass} pl-9`}
          />
        </div>

        {selected && (
          <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2 text-sm">
            <span className="text-slate-700 truncate">
              Dipilih: <span className="font-medium">{selected.kode_inventory} — {selected.nama || '-'}</span>
            </span>
            <button
              type="button"
              onClick={() => setParentId(null)}
              className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              Ganti
            </button>
          </div>
        )}

        <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto mb-4 divide-y divide-slate-100">
          {filteredOptions.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
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
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 text-sm transition ${
                  isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium truncate">{p.kode_inventory}</span>
                  <span className={`block text-xs truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    {p.nama || '-'}
                  </span>
                </span>
                {isSelected && <Check size={15} className="flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <ButtonCancel onClick={onClose} disabled={loading} />
          <ButtonSubmit onClick={handleSubmit} disabled={!parentId} loading={loading} loadingLabel="Memasang...">
            Pasang
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}