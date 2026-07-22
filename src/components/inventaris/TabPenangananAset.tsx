import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getAsetPenanganan, selesaikanPenanganan, type AsetPenanganan } from '../../api/asetPenanganan';
import { formatTanggalId } from './AsetDetailModal';

interface Props {
  onCount?: (count: number) => void;
}

export default function TabPenangananAset({ onCount }: Props) {
  const [penangananList, setPenangananList] = useState<AsetPenanganan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleTandaiSelesai = async (id: number) => {
    setProcessingId(id);
    try {
      const updated = await selesaikanPenanganan(id);
      setPenangananList((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success('Laporan ditandai selesai.');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menandai laporan selesai.');
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    getAsetPenanganan()
      .then(setPenangananList)
      .catch((err) => {
        setError('Gagal memuat laporan penanganan aset.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    const belumDitangani = penangananList.filter((p) => !p.tanggal_selesai).length;
    if (lastCount.current !== belumDitangani) {
      lastCount.current = belumDitangani;
      onCount?.(belumDitangani);
    }
  }, [penangananList, onCount]);

  if (loading) {
    return <p className="text-sm text-slate-500">Memuat laporan penanganan aset...</p>;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-base font-semibold text-slate-900 mb-1">Forum Penanganan Aset</h3>
      <p className="text-sm text-slate-500 mb-4">Laporan kerusakan dari peminjam yang belum/sudah ditangani.</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {penangananList.map((p) => (
          <div key={p.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-800">{p.aset?.kode_aset}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  p.tanggal_selesai ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {p.tanggal_selesai ? 'Selesai' : 'Belum ditangani'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Dilaporkan oleh <span className="font-medium">{p.peminjaman?.pekerja?.user?.name || '-'}</span> · {formatTanggalId(p.tanggal_lapor)}
            </p>
            <p className="text-sm text-slate-700 mt-2">
              <span className="font-medium">{p.jenis_kerusakan}</span> — {p.keluhan}
            </p>
            {!p.tanggal_selesai && (
              <button
                onClick={() => handleTandaiSelesai(p.id)}
                disabled={processingId === p.id}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-40"
              >
                {processingId === p.id ? 'Memproses...' : 'Tandai Selesai'}
              </button>
            )}
          </div>
        ))}
        {penangananList.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada laporan kerusakan.</p>
        )}
      </div>
    </div>
  );
}