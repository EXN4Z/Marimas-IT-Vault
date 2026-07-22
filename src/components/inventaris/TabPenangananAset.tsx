import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Wrench } from 'lucide-react';
import { getAsetPenanganan, selesaikanPenanganan, type AsetPenanganan } from '../../api/asetPenanganan';
import { formatTanggalId } from './AsetDetailModal';

interface Props {
  onCount?: (count: number) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatRupiah(n?: number | null) {
  if (n == null) return '-';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function TabPenangananAset({ onCount }: Props) {
  const [penangananList, setPenangananList] = useState<AsetPenanganan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePenanganan, setActivePenanganan] = useState<AsetPenanganan | null>(null);

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

  const handleSelesai = (updated: AsetPenanganan) => {
    setPenangananList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setActivePenanganan(null);
    toast.success('Perbaikan selesai dicatat.');
  };

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
                  p.tanggal_selesai ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {p.tanggal_selesai ? 'Berhasil Diperbaiki' : 'Dalam Perbaikan'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Dilaporkan oleh <span className="font-medium">{p.pemakai?.pekerja?.user?.name || '-'}</span> · {formatTanggalId(p.tanggal_lapor)}
            </p>
            <p className="text-sm text-slate-700 mt-2">
              <span className="font-medium">{p.jenis_kerusakan}</span> — {p.keluhan}
            </p>

            {p.tanggal_selesai ? (
              <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 flex flex-col gap-1">
                <p><span className="font-medium">Hasil:</span> {p.hasil || '-'}</p>
                <p>
                  <span className="font-medium">Biaya:</span> {formatRupiah(p.total_biaya)}
                  {' '}(komponen {formatRupiah(p.biaya_komponen)} + jasa {formatRupiah(p.harga_jasa)})
                </p>
                <p><span className="font-medium">Durasi:</span> {p.durasi_hari != null ? `${p.durasi_hari} hari` : '-'}</p>
                {p.catatan && <p><span className="font-medium">Catatan:</span> {p.catatan}</p>}
              </div>
            ) : (
              <button
                onClick={() => setActivePenanganan(p)}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 w-fit"
              >
                <Wrench size={14} />
                Perbaiki
              </button>
            )}
          </div>
        ))}
        {penangananList.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada laporan kerusakan.</p>
        )}
      </div>

      {activePenanganan && (
        <FormPerbaikanModal
          penanganan={activePenanganan}
          onClose={() => setActivePenanganan(null)}
          onSuccess={handleSelesai}
        />
      )}
    </div>
  );
}

function FormPerbaikanModal({
  penanganan,
  onClose,
  onSuccess,
}: {
  penanganan: AsetPenanganan;
  onClose: () => void;
  onSuccess: (updated: AsetPenanganan) => void;
}) {
  const [tanggalSelesai, setTanggalSelesai] = useState(todayIso());
  const [hasil, setHasil] = useState('');
  const [biayaKomponen, setBiayaKomponen] = useState('');
  const [hargaJasa, setHargaJasa] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await selesaikanPenanganan(penanganan.id, {
        tanggal_selesai: tanggalSelesai,
        biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
        harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
        hasil: hasil.trim() || null,
        catatan: catatan.trim() || null,
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menyimpan perbaikan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Wrench size={18} className="text-emerald-600" />
            Form Perbaikan
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          {penanganan.aset?.kode_aset} · {penanganan.jenis_kerusakan} — {penanganan.keluhan}
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Apa yang diperbaiki (hasil)</label>
            <input
              value={hasil}
              onChange={(e) => setHasil(e.target.value)}
              placeholder="cth. Ganti SSD, sudah normal"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Komponen</label>
              <input
                type="number"
                min={0}
                value={biayaKomponen}
                onChange={(e) => setBiayaKomponen(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Jasa</label>
              <input
                type="number"
                min={0}
                value={hargaJasa}
                onChange={(e) => setHargaJasa(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (opsional)</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
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
          className="w-full bg-emerald-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-emerald-700 transition disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : 'Simpan & Tandai Selesai'}
        </button>
      </div>
    </div>
  );
}