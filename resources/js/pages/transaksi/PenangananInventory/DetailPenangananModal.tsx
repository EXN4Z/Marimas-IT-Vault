import { X, Wrench, Printer, ImageOff } from 'lucide-react';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import {
  formatTanggalWaktuId,
  namaPelaporPenanganan,
  formatJenisKerusakan,
  formatDurasi,
} from '../../../utils/inventoryHelpers';
import { STORAGE_BASE_URL, formatRupiah } from './helpers';

// Modal Detail Penanganan
export default function DetailPenangananModal({
  penanganan,
  onClose,
  onPrint,
}: {
  penanganan: InventoryPenanganan;
  onClose: () => void;
  onPrint: (p: InventoryPenanganan) => void;
}) {
  const rusakBerat = penanganan.hasil === 'rusak_berat';
  const totalBiaya = (Number(penanganan.harga_jasa) || 0) + (Number(penanganan.biaya_komponen) || 0);

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
              <Wrench size={18} className={rusakBerat ? 'text-red-600' : 'text-emerald-600'} />
              {rusakBerat ? 'Detail Rusak Berat' : 'Detail Penanganan Inventory'}
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
              <span className="text-slate-500">Nama Unit</span>
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

            {penanganan.tanggal_diterima && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">Diterima Teknisi</span>
                <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.diterima_at ?? null, penanganan.tanggal_diterima)}</span>
              </div>
            )}

            {penanganan.tanggal_selesai && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">Tanggal Selesai</span>
                <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.selesai_at ?? null, penanganan.tanggal_selesai)}</span>
              </div>
            )}

            {penanganan.durasi_detik != null && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">Durasi Pengerjaan</span>
                <span className="font-medium text-slate-800">{formatDurasi(penanganan.durasi_detik)}</span>
              </div>
            )}

            {!rusakBerat && totalBiaya > 0 && (
              <>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                  <span className="text-slate-500">Biaya Komponen</span>
                  <span className="font-medium text-slate-800">{formatRupiah(penanganan.biaya_komponen)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                  <span className="text-slate-500">Biaya Jasa</span>
                  <span className="font-medium text-slate-800">{formatRupiah(penanganan.harga_jasa)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                  <span className="font-bold text-slate-900">Total Biaya</span>
                  <span className="font-bold text-slate-900">{formatRupiah(totalBiaya)}</span>
                </div>
              </>
            )}

            {penanganan.no_struk && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">No. Struk</span>
                <span className="font-mono font-medium text-slate-800">{penanganan.no_struk}</span>
              </div>
            )}

            <div className="pt-1">
              <span className="text-slate-500 block mb-1">Rincian Keluhan:</span>
              <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                {penanganan.keluhan}
              </p>
            </div>

            {penanganan.catatan && (
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Catatan Pengerjaan:</span>
                <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {penanganan.catatan}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          {penanganan.no_struk && (
            <button
              type="button"
              onClick={() => onPrint(penanganan)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <Printer size={15} />
              Cetak Struk
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
