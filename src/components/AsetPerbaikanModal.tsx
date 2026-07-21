import { useState } from 'react';
import { X, Wrench } from 'lucide-react';
import { laporPerbaikanAset, type Aset, type AsetPerbaikan } from '../api/aset';

interface AsetPerbaikanModalProps {
  aset: Aset;
  onClose: () => void;
  onSuccess: (perbaikan: AsetPerbaikan) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AsetPerbaikanModal({ aset, onClose, onSuccess }: AsetPerbaikanModalProps) {
  const [tanggalPerbaikan, setTanggalPerbaikan] = useState(todayIso());
  const [keteranganKerusakan, setKeteranganKerusakan] = useState('');
  const [teknisiVendor, setTeknisiVendor] = useState('');
  const [biaya, setBiaya] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!keteranganKerusakan.trim()) {
      setError('Keterangan kerusakan wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await laporPerbaikanAset(aset.id, {
        tanggal_perbaikan: tanggalPerbaikan,
        keterangan_kerusakan: keteranganKerusakan.trim(),
        teknisi_vendor: teknisiVendor.trim() || undefined,
        biaya: biaya ? Number(biaya) : undefined,
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mencatat laporan kerusakan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Wrench size={18} className="text-slate-400" />
            Lapor Kerusakan — {aset.kode_aset}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          Status aset akan otomatis berubah jadi <span className="font-medium">Rusak</span> setelah laporan ini disimpan.
        </p>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={tanggalPerbaikan}
              onChange={(e) => setTanggalPerbaikan(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan Kerusakan</label>
            <textarea
              value={keteranganKerusakan}
              onChange={(e) => setKeteranganKerusakan(e.target.value)}
              rows={3}
              autoFocus
              placeholder="cth. layar retak setelah dipakai di lapangan"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teknisi / Vendor (opsional)</label>
            <input
              value={teknisiVendor}
              onChange={(e) => setTeknisiVendor(e.target.value)}
              placeholder="cth. Service Center HP"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estimasi Biaya (opsional)</label>
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
          className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
        </button>
      </div>
    </div>
  );
}