import { useState } from 'react';
import { X } from 'lucide-react';
import { kembalikanAset, type Aset, type AsetPemakai } from '../api/aset';

interface AsetPengembalianModalProps {
  aset: Aset;
  pemakai: AsetPemakai;
  onClose: () => void;
  onSuccess: (pemakai: AsetPemakai) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AsetPengembalianModal({ aset, pemakai, onClose, onSuccess }: AsetPengembalianModalProps) {
  const [nomorPengembalian, setNomorPengembalian] = useState('');
  const [tanggalPengembalian, setTanggalPengembalian] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await kembalikanAset(pemakai.id, {
        no_struk_penerimaan: pemakai.no_struk_penerimaan || '',
        nomor_pengembalian: nomorPengembalian.trim() || undefined,
        tanggal_pengembalian: tanggalPengembalian,
        catatan_pengembalian: catatan.trim() || undefined,
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memproses pengembalian.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Terima Kembali Aset {aset.kode_aset}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg px-3 py-2.5 mb-4 text-sm">
          <p className="text-slate-500 text-xs">Dipakai oleh</p>
          <p className="text-slate-800 font-medium">{pemakai.pekerja?.user?.name || '-'}</p>
          {pemakai.no_struk_penerimaan && (
            <>
              <p className="text-slate-500 text-xs mt-2">Struk Penerimaan</p>
              <p className="text-slate-800 font-medium">{pemakai.no_struk_penerimaan}</p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Pengembalian (opsional)</label>
            <input
              value={nomorPengembalian}
              onChange={(e) => setNomorPengembalian(e.target.value)}
              placeholder="cth. 2026/00001"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
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
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-emerald-700 transition disabled:opacity-40"
        >
          {submitting ? 'Memproses...' : 'Terima Kembali'}
        </button>
      </div>
    </div>
  );
}