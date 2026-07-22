import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { laporKerusakanAset } from '../api/asetPenanganan';
import type { Aset } from '../api/aset';

interface Props {
  aset: Aset;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AsetLaporKerusakanModal({ aset, onClose, onSuccess }: Props) {
  const [jenisKerusakan, setJenisKerusakan] = useState('');
  const [keluhan, setKeluhan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!jenisKerusakan.trim() || !keluhan.trim()) {
      setError('Jenis kerusakan dan keluhan wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await laporKerusakanAset({
        aset_id: aset.id,
        jenis_kerusakan: jenisKerusakan.trim(),
        keluhan: keluhan.trim(),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengirim laporan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Lapor Kerusakan
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          {aset.kode_aset} · {[aset.merek, aset.tipe].filter(Boolean).join(' ') || '-'}
        </p>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kerusakan</label>
            <select
              value={jenisKerusakan}
              onChange={(e) => setJenisKerusakan(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">Pilih jenis...</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
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
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-red-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-40"
        >
          {submitting ? 'Mengirim...' : 'Kirim Laporan'}
        </button>
      </div>
    </div>
  );
}