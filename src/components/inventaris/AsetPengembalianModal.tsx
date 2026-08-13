import { useState } from 'react';
import { kembalikanAset, type Aset, type AsetPemakai } from '../../api/aset';
import { namaPemakai } from './asetHelpers';
import AsetFotoUpload from './AsetFotoUpload';

interface AsetPengembalianModalProps {
  aset: Aset;
  pemakai: AsetPemakai;
  isAdmin: boolean;
  onClose: () => void;
  onSuccess: (pemakai: AsetPemakai) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AsetPengembalianModal({ aset, pemakai, isAdmin, onClose, onSuccess }: AsetPengembalianModalProps) {
  const [kodeStruk, setKodeStruk] = useState('');
  const [tanggalPengembalian, setTanggalPengembalian] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [fotoPengembalian, setFotoPengembalian] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!kodeStruk.trim()) {
      setError('Masukkan kode struk penerimaan yang tertera di struk fisik sebagai bukti pengembalian.');
      return;
    }
    if (fotoPengembalian.length !== 3) {
      setError('Harus 3 Foto.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // pakai FormData (bukan JSON) karena ada file foto yang diunggah
      const formData = new FormData();
      formData.append('no_struk_penerimaan', kodeStruk.trim());
      formData.append('tanggal_pengembalian', tanggalPengembalian);
      if (catatan.trim()) formData.append('catatan_pengembalian', catatan.trim());
      fotoPengembalian.forEach((file) => formData.append('foto_pengembalian[]', file));

      const res = await kembalikanAset(pemakai.id, formData);
      onSuccess(res);
    } catch (err: any) {
      setError(
        err.response?.data?.errors?.no_struk_penerimaan?.[0] ||
          err.response?.data?.errors?.foto_pengembalian?.[0] ||
          err.response?.data?.message ||
          'Gagal memproses pengembalian.'
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
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pengembalian</p>
            <h3 className="text-lg font-semibold text-slate-900">
              {isAdmin ? `Terima Kembali Aset ${aset.kode_aset}` : `Kembalikan Aset ${aset.kode_aset}`}
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
        <div className="bg-slate-50 rounded-lg px-3 py-2.5 mb-4 text-sm">
          <p className="text-slate-500 text-xs">{isAdmin ? 'Dipakai oleh' : 'Kamu sedang memakai'}</p>
          <p className="text-slate-800 font-medium">{namaPemakai(pemakai)}</p>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kode Struk Penerimaan <span className="text-red-500">*</span>
            </label>
            <input
              value={kodeStruk}
              onChange={(e) => setKodeStruk(e.target.value)}
              autoFocus
              placeholder="cth. STJ-20260722-0001"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">
              {isAdmin
                ? 'Minta karyawan menunjukkan struk penerimaan aset, lalu ketik kodenya di sini sebagai bukti pengembalian sah.'
                : 'Cek struk penerimaan fisik yang kamu terima waktu serah-terima aset ini, lalu ketik kodenya di sini.'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pengembalian</label>
            <input
              type="date"
              value={tanggalPengembalian}
              onChange={(e) => setTanggalPengembalian(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              placeholder="cth. dikembalikan dalam kondisi baik"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <AsetFotoUpload
            files={fotoPengembalian}
            onChange={setFotoPengembalian}
            max={3}
            label="Foto Bukti Kondisi Aset (3 Foto)"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
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
            {submitting ? 'Memproses...' : isAdmin ? 'Terima Kembali' : 'Kembalikan'}
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