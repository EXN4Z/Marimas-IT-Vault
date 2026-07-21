import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { selesaikanPerbaikanAset, type Aset, type AsetPerbaikan } from '../api/aset';

interface AsetPerbaikanSelesaiModalProps {
  aset: Aset;
  perbaikan: AsetPerbaikan;
  onClose: () => void;
  onSuccess: (perbaikan: AsetPerbaikan) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AsetPerbaikanSelesaiModal({ aset, perbaikan, onClose, onSuccess }: AsetPerbaikanSelesaiModalProps) {
  const [tanggalSelesai, setTanggalSelesai] = useState(todayIso());
  const [biaya, setBiaya] = useState(perbaikan.biaya != null ? String(perbaikan.biaya) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await selesaikanPerbaikanAset(perbaikan.id, {
        tanggal_selesai: tanggalSelesai,
        biaya: biaya ? Number(biaya) : undefined,
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menandai perbaikan selesai. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            Tandai Selesai — {aset.kode_aset}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
          {perbaikan.keterangan_kerusakan}
        </p>

        <p className="text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4">
          Status aset akan otomatis kembali jadi <span className="font-medium">Tersedia</span>.
        </p>

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Biaya (opsional)</label>
            <input
              type="number"
              min="0"
              value={biaya}
              onChange={(e) => setBiaya(e.target.value)}
              placeholder="0"
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
          {submitting ? 'Menyimpan...' : 'Tandai Selesai'}
        </button>
      </div>
    </div>
  );
}