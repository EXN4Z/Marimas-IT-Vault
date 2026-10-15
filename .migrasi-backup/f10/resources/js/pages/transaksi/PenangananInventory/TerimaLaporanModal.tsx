import { X, PlayCircle, ImageOff, Loader2 } from 'lucide-react';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import { formatTanggalWaktuId, namaPelaporPenanganan, formatJenisKerusakan } from '../../../utils/inventoryHelpers';
import { STORAGE_BASE_URL } from './helpers';

// Modal Review Sebelum Terima Laporan
export default function TerimaLaporanModal({
  penanganan,
  loading,
  onClose,
  onConfirm,
}: {
  penanganan: InventoryPenanganan;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <PlayCircle size={18} className="text-amber-600" />
              Terima Laporan Kerusakan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div className="w-full h-44 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
            {(penanganan as any).foto ? (
              <img
                src={STORAGE_BASE_URL + (penanganan as any).foto}
                alt="Foto kerusakan"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400">
                <ImageOff size={24} />
                <span className="text-xs">Tidak ada lampiran foto</span>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2.5 text-slate-600">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Kode Inventory</span>
              <span className="font-semibold text-slate-900 font-mono">{penanganan.inventory?.kode_inventory || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Nama Barang</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]">{penanganan.inventory?.nama || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Jenis Kerusakan</span>
              <span className="font-medium text-slate-800">{formatJenisKerusakan(penanganan.jenis_kerusakan)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Pelapor</span>
              <span className="font-medium text-slate-800">{namaPelaporPenanganan(penanganan)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Tanggal Lapor</span>
              <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.lapor_at, penanganan.tanggal_lapor)}</span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 block mb-1">Rincian Keluhan:</span>
              <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                {penanganan.keluhan}
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            Menerima laporan ini akan mengubah status inventaris menjadi <span className="font-semibold">"Sedang Diperbaiki"</span> dan mencatat teknisi yang menangani.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-xs"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
            {loading ? 'Memproses...' : 'Ya, Terima'}
          </button>
        </div>
      </div>
    </div>
  );
}
