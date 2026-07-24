import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Wrench, Printer, PlayCircle } from 'lucide-react';
import api from '../../api/axios';
import { terimaPenangananAset, selesaikanPenangananAset, type AsetPenanganan } from '../../api/aset';
import { formatTanggalId } from './asetHelpers';
import { printStruk } from '../../utils/printStruk';

// pakai tipe dari api/aset.ts (yang sudah punya tanggal_diterima), tapi hit
// endpoint yang sama '/aset-penanganan' — konsisten sama tab Aset & backend.
async function getAsetPenanganan(): Promise<AsetPenanganan[]> {
  const res = await api.get<AsetPenanganan[]>('/aset-penanganan');
  return res.data;
}

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

  const load = () => {
    setLoading(true);
    setError('');
    getAsetPenanganan()
      .then(setPenangananList)
      .catch((err) => {
        setError('Gagal memuat laporan penanganan aset.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  // versi diam-diam buat polling — gak nyalain loading spinner / error state
  const loadSilent = () => {
    getAsetPenanganan()
      .then(setPenangananList)
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    load();
  }, []);

  // auto-refresh tiap 5 detik biar status (menunggu perbaikan / sedang
  // diperbaiki / selesai) langsung update di layar tanpa perlu F5.
  useEffect(() => {
    const interval = setInterval(loadSilent, 5000);
    return () => clearInterval(interval);
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    const belumDitangani = penangananList.filter((p) => !p.tanggal_selesai).length;
    if (lastCount.current !== belumDitangani) {
      lastCount.current = belumDitangani;
      onCount?.(belumDitangani);
    }
  }, [penangananList, onCount]);

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  const handleTerima = async (p: AsetPenanganan) => {
    setTerimaLoadingId(p.id);
    try {
      const updated = await terimaPenangananAset(p.id);
      setPenangananList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Laporan diterima, aset ditandai sedang diperbaiki.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menerima laporan.');
    } finally {
      setTerimaLoadingId(null);
    }
  };

  const handleSelesai = (updated: AsetPenanganan) => {
    setPenangananList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setActivePenanganan(null);
    toast.success('Perbaikan selesai dicatat.');
  };

  const handlePrintStruk = (p: AsetPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
      // rusak berat: gak ada biaya/proses perbaikan, jadi struknya diringkes
      // -- cuma hasil & durasi (catatan & no. struk udah otomatis ke-print
      // di luar rows lewat parameter catatan/noStruk)
      printStruk({
        judul: 'Bukti Penanganan Aset',
        noStruk: p.no_struk,
        tanggal: formatTanggalId(p.tanggal_selesai),
        rows: [
          { label: 'Hasil', value: 'Rusak Berat (tidak bisa diperbaiki)' },
          { label: 'Durasi', value: p.durasi_hari != null ? `${p.durasi_hari} hari` : '-' },
        ],
        catatan: p.catatan,
      });
      return;
    }

    const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
    printStruk({
      judul: 'Bukti Penanganan Aset',
      noStruk: p.no_struk,
      tanggal: formatTanggalId(p.tanggal_selesai),
      rows: [
        { label: 'Aset', value: p.aset?.kode_aset || '-' },
        { label: 'Jenis Kerusakan', value: p.jenis_kerusakan === 'hardware' ? 'Hardware' : 'Software' },
        { label: 'Keluhan', value: p.keluhan },
        { label: 'Hasil', value: p.hasil || '-' },
        { label: 'Tanggal Lapor', value: formatTanggalId(p.tanggal_lapor) },
        { label: 'Durasi', value: p.durasi_hari != null ? `${p.durasi_hari} hari` : '-' },
        { label: 'Biaya Komponen', value: formatRupiah(p.biaya_komponen) },
        { label: 'Biaya Jasa', value: formatRupiah(p.harga_jasa) },
      ],
      totalLabel: 'Total Biaya',
      totalValue: formatRupiah(totalBiaya),
      catatan: p.catatan,
    });
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
        {penangananList.map((p) => {
          const selesai = !!p.tanggal_selesai;
          const diterima = !!p.tanggal_diterima;
          const statusLabel = selesai
            ? (p.hasil === 'rusak_berat' ? 'Rusak Berat' : 'Berhasil Diperbaiki')
            : diterima
              ? 'Sedang Diperbaiki'
              : 'Menunggu Perbaikan';
          const statusStyle = selesai
            ? (p.hasil === 'rusak_berat' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')
            : diterima
              ? 'bg-orange-50 text-orange-700'
              : 'bg-yellow-50 text-yellow-700';

          return (
          <div key={p.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-800">{p.aset?.kode_aset}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                {statusLabel}
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
                <p><span className="font-medium">Hasil:</span> {p.hasil === 'rusak_berat' ? 'Rusak Berat (tidak bisa diperbaiki)' : 'Diperbaiki'}</p>
                {p.hasil !== 'rusak_berat' && (
                  <p>
                    <span className="font-medium">Biaya:</span> {formatRupiah(p.total_biaya)}
                    {' '}(komponen {formatRupiah(p.biaya_komponen)} + jasa {formatRupiah(p.harga_jasa)})
                  </p>
                )}
                <p><span className="font-medium">Durasi:</span> {p.durasi_hari != null ? `${p.durasi_hari} hari` : '-'}</p>
                {p.catatan && <p><span className="font-medium">Catatan:</span> {p.catatan}</p>}
                {p.no_struk && <p><span className="font-medium">No. Struk:</span> {p.no_struk}</p>}
                {p.no_struk && (
                  <button
                    onClick={() => handlePrintStruk(p)}
                    className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5 w-fit"
                  >
                    <Printer size={14} />
                    Cetak Struk
                  </button>
                )}
              </div>
            ) : !diterima ? (
              <button
                onClick={() => handleTerima(p)}
                disabled={terimaLoadingId === p.id}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition flex items-center gap-1.5 w-fit disabled:opacity-40"
              >
                <PlayCircle size={14} />
                {terimaLoadingId === p.id ? 'Memproses...' : 'Terima Laporan'}
              </button>
            ) : (
              <button
                onClick={() => setActivePenanganan(p)}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 w-fit"
              >
                <Wrench size={14} />
                Tandai Selesai
              </button>
            )}
          </div>
          );
        })}
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
  const [hasil, setHasil] = useState<'diperbaiki' | 'rusak_berat'>('diperbaiki');
  const [biayaKomponen, setBiayaKomponen] = useState('');
  const [hargaJasa, setHargaJasa] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isRusakBerat = hasil === 'rusak_berat';

  const handleHasilChange = (value: 'diperbaiki' | 'rusak_berat') => {
    setHasil(value);
    // rusak berat = gak ada biaya perbaikan, kosongin biar gak ke-submit
    // nilai lama yang sempat diisi sebelum ganti pilihan
    if (value === 'rusak_berat') {
      setBiayaKomponen('');
      setHargaJasa('');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await selesaikanPenangananAset(penanganan.id, {
        tanggal_selesai: tanggalSelesai,
        biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
        harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
        hasil,
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
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Hasil</label>
            <select
              value={hasil}
              onChange={(e) => handleHasilChange(e.target.value as 'diperbaiki' | 'rusak_berat')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="diperbaiki">Diperbaiki</option>
              <option value="rusak_berat">Rusak Berat (tidak bisa diperbaiki)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Komponen</label>
              <input
                type="number"
                min={0}
                value={biayaKomponen}
                onChange={(e) => setBiayaKomponen(e.target.value)}
                placeholder={isRusakBerat ? '-' : '0'}
                disabled={isRusakBerat}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Jasa</label>
              <input
                type="number"
                min={0}
                value={hargaJasa}
                onChange={(e) => setHargaJasa(e.target.value)}
                placeholder={isRusakBerat ? '-' : '0'}
                disabled={isRusakBerat}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Detail Perbaikan / Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              placeholder="cth. Ganti SSD baru, sudah normal"
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