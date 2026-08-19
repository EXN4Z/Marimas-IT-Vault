 import { useState } from 'react';
import toast from 'react-hot-toast';
import { updateStatusAsetKelengkapan, type AsetKelengkapan } from '../../api/asetKelengkapan';

interface Props {
  item: AsetKelengkapan | null;
  onClose: () => void;
  onUpdated: (updated: AsetKelengkapan) => void;
}

export default function ModalStatusKerusakan({ item, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState<'rusak' | 'rusak_berat'>('rusak');
  const [keterangan, setKeterangan] = useState('');
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const updated = await updateStatusAsetKelengkapan(item.id, status, keterangan);
      toast.success(`Status ${item.kode_kelengkapan} diubah jadi ${status === 'rusak' ? 'Rusak' : 'Rusak Berat'}.`);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Tandai Kerusakan</h2>
        <p className="text-sm text-slate-500 mb-4">
          <span className="font-medium text-slate-700">{item.kode_kelengkapan}</span> — pilih tingkat kerusakannya.
        </p>

        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="status_kerusakan"
              checked={status === 'rusak'}
              onChange={() => setStatus('rusak')}
            />
            Rusak
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="status_kerusakan"
              checked={status === 'rusak_berat'}
              onChange={() => setStatus('rusak_berat')}
            />
            Rusak Berat
          </label>
        </div>

        <textarea
          placeholder="Keterangan (opsional)"
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}