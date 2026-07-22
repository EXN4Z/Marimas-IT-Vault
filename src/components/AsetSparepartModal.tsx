import { useState } from 'react';
import { X, Cog } from 'lucide-react';
import { tambahPenggantianSparepart, type Aset, type AsetPenggantianSparepart } from '../api/aset';

interface AsetSparepartModalProps {
  aset: Aset;
  onClose: () => void;
  onSuccess: (sparepart: AsetPenggantianSparepart) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AsetSparepartModal({ aset, onClose, onSuccess }: AsetSparepartModalProps) {
  const [tanggal, setTanggal] = useState(todayIso());
  const [namaSparepart, setNamaSparepart] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [biaya, setBiaya] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!namaSparepart.trim()) {
      setError('Nama sparepart wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await tambahPenggantianSparepart(aset.id, {
        tanggal,
        nama_sparepart: namaSparepart.trim(),
        keterangan: keterangan.trim() || undefined,
        biaya: biaya ? Number(biaya) : undefined,
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mencatat penggantian sparepart. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Cog size={18} className="text-slate-400" />
            Penggantian Sparepart — {aset.kode_aset}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Sparepart</label>
            <input
              value={namaSparepart}
              onChange={(e) => setNamaSparepart(e.target.value)}
              autoFocus
              placeholder="cth. Baterai, Keyboard, SSD"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan (opsional)</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={2}
              placeholder="cth. baterai drop, diganti unit baru"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Biaya (opsional)</label>
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
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}