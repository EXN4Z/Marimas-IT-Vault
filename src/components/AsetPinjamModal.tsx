import { useState } from 'react';
import { X, HandCoins } from 'lucide-react';
import { requestPinjamAset } from '../api/aset';
import type { Aset } from '../api/aset';

interface Props {
  aset: Aset;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AsetPinjamModal({ aset, onClose, onSuccess }: Props) {
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await requestPinjamAset(aset.id, {
        catatan_penerimaan: catatan.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengirim permintaan pinjam. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <HandCoins size={18} className="text-slate-400" />
            Ajukan Pinjam Aset
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          {aset.kode_aset} · {[aset.merek, aset.tipe].filter(Boolean).join(' ') || '-'}
        </p>

        <p className="text-sm text-slate-500 mb-4">
          Permintaan ini akan dikirim ke admin untuk disetujui. Aset baru resmi jadi milikmu setelah admin menyetujui.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (opsional)</label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={3}
            placeholder="cth. dipakai untuk kebutuhan tugas lapangan..."
            autoFocus
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
        >
          {submitting ? 'Mengirim...' : 'Ajukan Pinjam'}
        </button>
      </div>
    </div>
  );
}