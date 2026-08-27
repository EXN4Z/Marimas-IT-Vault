import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { selesaikanPenangananInventory } from '../../api/transaksi/inventoryPenanganan';
import type { InventoryPenanganan } from '../../api/transaksi/inventoryPenanganan';
import type { Inventory } from '../../api/masterData/inventory';
import { formatJenisKerusakan } from '../masterData/inventoryHelpers';

interface Props {
  inventory: Inventory;
  penanganan: InventoryPenanganan;
  onClose: () => void;
  onSuccess: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryPenangananSelesaiModal({ inventory, penanganan, onClose, onSuccess }: Props) {
  const [tanggalSelesai, setTanggalSelesai] = useState(todayIso());
  const [hargaJasa, setHargaJasa] = useState(penanganan.harga_jasa != null ? String(penanganan.harga_jasa) : '');
  const [biayaKomponen, setBiayaKomponen] = useState(penanganan.biaya_komponen != null ? String(penanganan.biaya_komponen) : '');
  const [hasil, setHasil] = useState<'diperbaiki' | 'rusak_berat'>(
    penanganan.hasil === 'rusak_berat' ? 'rusak_berat' : 'diperbaiki'
  );
  const [catatan, setCatatan] = useState(penanganan.catatan || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isRusakBerat = hasil === 'rusak_berat';

  const handleHasilChange = (value: 'diperbaiki' | 'rusak_berat') => {
    setHasil(value);
    // rusak berat = gak ada biaya perbaikan, kosongin biar gak ke-submit
    // nilai lama yang sempat diisi sebelum ganti pilihan
    if (value === 'rusak_berat') {
      setBiayaKomponen('');
      setHargaJasa('');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await selesaikanPenangananInventory(penanganan.id, {
        tanggal_selesai: tanggalSelesai,
        harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
        biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
        hasil,
        catatan: catatan.trim() || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.errors?.biaya_komponen?.[0] ||
        err.response?.data?.errors?.harga_jasa?.[0] ||
        err.response?.data?.message ||
        'Gagal menandai penanganan selesai.'
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
              {inventory.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)} — {penanganan.keluhan}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              Tandai Selesai
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
        <div className="px-6 py-5 overflow-y-auto">
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
            <input
              type="date"
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Komponen</label>
              <input
                type="number"
                min={0}
                value={biayaKomponen}
                onChange={(e) => setBiayaKomponen(e.target.value)}
                placeholder={isRusakBerat ? '-' : '0'}
                disabled={isRusakBerat}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Jasa</label>
              <input
                type="number"
                min={0}
                value={hargaJasa}
                onChange={(e) => setHargaJasa(e.target.value)}
                placeholder={isRusakBerat ? '-' : '0'}
                disabled={isRusakBerat}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hasil</label>
            <select
              value={hasil}
              onChange={(e) => handleHasilChange(e.target.value as 'diperbaiki' | 'rusak_berat')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="diperbaiki">Diperbaiki</option>
              <option value="rusak_berat">Rusak Berat (tidak bisa diperbaiki)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (opsional)</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Menyimpan...' : 'Tandai Selesai'}
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