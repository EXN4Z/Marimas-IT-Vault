import { useEffect, useRef, useState } from 'react';
import { HandCoins, Check, X } from 'lucide-react';
import {
  getPendingAsetPemakai,
  setujuiAsetPemakai,
  tolakAsetPemakai,
  type AsetPemakai,
} from '../../api/aset';

function formatTanggalWaktu(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  onCount?: (count: number) => void;
}

export default function TabPersetujuanAset({ onCount }: Props) {
  const [list, setList] = useState<AsetPemakai[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [tolakTarget, setTolakTarget] = useState<AsetPemakai | null>(null);
  const [catatanTolak, setCatatanTolak] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    getPendingAsetPemakai()
      .then(setList)
      .catch((err) => {
        setError('Gagal memuat daftar permintaan pinjam aset.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current !== list.length) {
      lastCount.current = list.length;
      onCount?.(list.length);
    }
  }, [list, onCount]);

  const handleSetujui = async (item: AsetPemakai) => {
    setProcessingId(item.id);
    setError('');
    try {
      await setujuiAsetPemakai(item.id);
      setList((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menyetujui permintaan.');
    } finally {
      setProcessingId(null);
    }
  };

  const openTolak = (item: AsetPemakai) => {
    setTolakTarget(item);
    setCatatanTolak('');
  };

  const handleTolak = async () => {
    if (!tolakTarget) return;
    setProcessingId(tolakTarget.id);
    setError('');
    try {
      await tolakAsetPemakai(tolakTarget.id, { catatan_penolakan: catatanTolak.trim() || undefined });
      setList((prev) => prev.filter((p) => p.id !== tolakTarget.id));
      setTolakTarget(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menolak permintaan.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Memuat permintaan pinjam aset...</p>;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-base font-semibold text-slate-900 mb-1">Persetujuan Peminjaman Aset</h3>
      <p className="text-sm text-slate-500 mb-4">Permintaan pinjam aset dari karyawan yang menunggu persetujuan.</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {list.map((item) => (
          <div key={item.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <HandCoins size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-800">{item.aset?.kode_aset}</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    Pending
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Diminta oleh <span className="font-medium">{item.pekerja?.user?.name || '-'}</span> ·{' '}
                  {formatTanggalWaktu(item.created_at ?? '')}
                </p>
                {item.catatan_penerimaan && (
                  <p className="text-sm text-slate-700 mt-2">{item.catatan_penerimaan}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openTolak(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                >
                  <X size={14} />
                  Tolak
                </button>
                <button
                  onClick={() => handleSetujui(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <Check size={14} />
                  {processingId === item.id ? 'Memproses...' : 'Setujui'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Tidak ada permintaan pinjam aset yang menunggu.</p>
        )}
      </div>

      {tolakTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Tolak permintaan?</h3>
            <p className="text-sm text-slate-500 mb-4">
              {tolakTarget.aset?.kode_aset} — {tolakTarget.pekerja?.user?.name}
            </p>
            <textarea
              value={catatanTolak}
              onChange={(e) => setCatatanTolak(e.target.value)}
              rows={3}
              placeholder="Alasan penolakan (opsional)..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setTolakTarget(null)}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleTolak}
                disabled={processingId === tolakTarget.id}
                className="flex-1 bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-red-700 transition disabled:opacity-40"
              >
                {processingId === tolakTarget.id ? 'Memproses...' : 'Ya, Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}