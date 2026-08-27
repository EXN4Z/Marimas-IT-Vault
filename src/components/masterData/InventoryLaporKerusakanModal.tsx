import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { laporKerusakanInventory } from '../../api/transaksi/inventoryPenanganan';
import type { Inventory } from '../../api/masterData/inventory';
import InventoryFotoUpload from './InventoryFotoUpload';
import { JENIS_KERUSAKAN_BARANG_UTAMA, JENIS_KERUSAKAN_KELENGKAPAN } from './inventoryHelpers';

interface Props {
  inventory: Inventory;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryLaporKerusakanModal({ inventory, onClose, onSuccess }: Props) {
  // Kelengkapan (charger, tas, kabel, dll) gak punya sisi "software" sama
  // sekali, jadi dikasih daftar opsi sendiri -- bukan Hardware/Software.
  const isKelengkapan = inventory.kategori?.nama === 'Kelengkapan';
  const opsiJenisKerusakan = isKelengkapan ? JENIS_KERUSAKAN_KELENGKAPAN : JENIS_KERUSAKAN_BARANG_UTAMA;

  const [jenisKerusakan, setJenisKerusakan] = useState('');
  const [keluhan, setKeluhan] = useState('');
  const [fotoKerusakan, setFotoKerusakan] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!jenisKerusakan.trim() || !keluhan.trim()) {
      setError('Jenis kerusakan dan keluhan wajib diisi.');
      return;
    }
    if (fotoKerusakan.length === 0) {
      setError('Unggah minimal 1 foto bukti kerusakan.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await laporKerusakanInventory({
        inventory_id: inventory.id,
        jenis_kerusakan: jenisKerusakan,
        keluhan: keluhan.trim(),
        foto: fotoKerusakan[0], // ambil 1 file pertama, sesuai kolom foto di backend
      });
      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.errors?.jenis_kerusakan?.[0] ||
          err.response?.data?.errors?.foto?.[0] ||
          err.response?.data?.message ||
          'Gagal mengirim laporan. Coba lagi.'
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
              <AlertTriangle size={18} className="text-red-500" />
              Lapor Kerusakan
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kerusakan</label>
            <select
              value={jenisKerusakan}
              onChange={(e) => setJenisKerusakan(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">Pilih jenis...</option>
              {opsiJenisKerusakan.map((opsi) => (
                <option key={opsi.value} value={opsi.value}>
                  {opsi.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keluhan</label>
            <textarea
              value={keluhan}
              onChange={(e) => setKeluhan(e.target.value)}
              rows={4}
              placeholder="Jelasin kondisi & kejadiannya..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>

          <InventoryFotoUpload
            files={fotoKerusakan}
            onChange={setFotoKerusakan}
            max={1}
            label="Foto Bukti Kerusakan"
          />
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
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Mengirim...' : 'Kirim Laporan'}
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