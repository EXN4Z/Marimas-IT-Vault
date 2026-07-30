import { useState } from 'react';
import { X } from 'lucide-react';
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
    if (fotoPengembalian.length === 0) {
      setError('Unggah minimal 1 foto bukti kondisi aset saat dikembalikan (maksimal 3).');
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
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            {isAdmin ? `Terima Kembali Aset ${aset.kode_aset}` : `Kembalikan Aset ${aset.kode_aset}`}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

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
            label="Foto Bukti Kondisi Aset"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-emerald-700 transition disabled:opacity-40"
        >
          {submitting ? 'Memproses...' : isAdmin ? 'Terima Kembali' : 'Kembalikan'}
        </button>
      </div>
    </div>
  );
}