import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { laporKerusakan, selesaikanPenanganan, type Aset, type AsetPenanganan } from '../api/aset';
import { printStruk } from '../utils/printStruk';

interface AsetPenangananModalProps {
  aset: Aset;
  /** Kalau ada laporan yang masih 'proses' (hasil belum diisi), modal ini
   *  langsung masuk mode "selesaikan" alih-alih "lapor kerusakan baru". */
  openPenanganan: AsetPenanganan | null;
  onClose: () => void;
  onSuccess: (penanganan: AsetPenanganan) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTanggalId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function AsetPenangananModal({
  aset,
  openPenanganan,
  onClose,
  onSuccess,
}: AsetPenangananModalProps) {
  const mode = openPenanganan ? 'selesaikan' : 'lapor';

  // ── state form lapor kerusakan ──
  const [jenisKerusakan, setJenisKerusakan] = useState<'software' | 'hardware'>('hardware');
  const [keluhan, setKeluhan] = useState('');
  const [tanggalLapor, setTanggalLapor] = useState(todayIso());
  const [kondisi, setKondisi] = useState<'rusak_ringan' | 'rusak_berat'>('rusak_ringan');

  // ── state form selesaikan ──
  const [tanggalSelesai, setTanggalSelesai] = useState(todayIso());
  const [hargaJasa, setHargaJasa] = useState('0');
  const [biayaKomponen, setBiayaKomponen] = useState('0');
  const [hasilAkhir, setHasilAkhir] = useState<'diperbaiki' | 'rusak_berat'>('diperbaiki');

  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasil, setHasil] = useState<AsetPenanganan | null>(null);

  const handleSubmitLapor = async () => {
    if (!keluhan.trim()) {
      setError('Keluhan/kerusakan wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await laporKerusakan(aset.id, {
        jenis_kerusakan: jenisKerusakan,
        keluhan: keluhan.trim(),
        tanggal_lapor: tanggalLapor,
        kondisi,
        catatan: catatan.trim() || undefined,
      });
      onSuccess(res.penanganan);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mencatat laporan kerusakan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSelesai = async () => {
    if (!openPenanganan) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await selesaikanPenanganan(openPenanganan.id, {
        tanggal_selesai: tanggalSelesai,
        harga_jasa: Number(hargaJasa) || 0,
        biaya_komponen: Number(biayaKomponen) || 0,
        hasil: hasilAkhir,
        catatan: catatan.trim() || undefined,
      });
      setHasil(res.penanganan);
      onSuccess(res.penanganan);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menyelesaikan penanganan.');
    } finally {
      setSubmitting(false);
    }
  };

  const cetakStruk = () => {
    if (!hasil) return;
    const total = Number(hasil.harga_jasa) + Number(hasil.biaya_komponen);
    printStruk({
      judul: 'Struk Penanganan / Perbaikan Aset',
      noStruk: hasil.no_struk || '-',
      tanggal: hasil.tanggal_selesai ? formatTanggalId(hasil.tanggal_selesai) : formatTanggalId(todayIso()),
      rows: [
        { label: 'Kode Aset', value: aset.kode_aset },
        { label: 'Jenis Kerusakan', value: hasil.jenis_kerusakan === 'hardware' ? 'Hardware' : 'Software' },
        { label: 'Keluhan', value: hasil.keluhan },
        { label: 'Biaya Jasa', value: formatRupiah(Number(hasil.harga_jasa)) },
        { label: 'Biaya Komponen', value: formatRupiah(Number(hasil.biaya_komponen)) },
        { label: 'Hasil', value: hasil.hasil === 'diperbaiki' ? 'Berhasil Diperbaiki' : 'Rusak Berat' },
      ],
      totalLabel: 'Total Biaya',
      totalValue: formatRupiah(total),
      catatan: hasil.catatan,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            {mode === 'lapor' ? `Lapor Kerusakan — ${aset.kode_aset}` : `Selesaikan Penanganan — ${aset.kode_aset}`}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {mode === 'lapor' && !hasil && (
          <>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kerusakan</label>
                <select
                  value={jenisKerusakan}
                  onChange={(e) => setJenisKerusakan(e.target.value as 'software' | 'hardware')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kondisi</label>
                <select
                  value={kondisi}
                  onChange={(e) => setKondisi(e.target.value as 'rusak_ringan' | 'rusak_berat')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="rusak_ringan">Rusak Ringan</option>
                  <option value="rusak_berat">Rusak Berat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keluhan / Apa yang Rusak</label>
                <textarea
                  value={keluhan}
                  onChange={(e) => setKeluhan(e.target.value)}
                  rows={3}
                  placeholder="cth. Layar retak, engsel patah..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Lapor</label>
                <input
                  type="date"
                  value={tanggalLapor}
                  onChange={(e) => setTanggalLapor(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <button
              onClick={handleSubmitLapor}
              disabled={submitting}
              className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
            </button>
          </>
        )}

        {mode === 'selesaikan' && !hasil && (
          <>
            <div className="flex flex-col gap-3 mb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                Keluhan: {openPenanganan?.keluhan}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Jasa (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={hargaJasa}
                    onChange={(e) => setHargaJasa(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Komponen (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={biayaKomponen}
                    onChange={(e) => setBiayaKomponen(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hasil</label>
                <select
                  value={hasilAkhir}
                  onChange={(e) => setHasilAkhir(e.target.value as 'diperbaiki' | 'rusak_berat')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="diperbaiki">Berhasil Diperbaiki</option>
                  <option value="rusak_berat">Rusak Berat (tidak bisa diperbaiki)</option>
                </select>
              </div>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <button
              onClick={handleSubmitSelesai}
              disabled={submitting}
              className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Selesaikan & Buat Struk'}
            </button>
          </>
        )}

        {hasil && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-emerald-700 font-medium">Penanganan berhasil diselesaikan.</p>
              <p className="text-xs text-emerald-600 mt-1">No. Struk: {hasil.no_struk}</p>
            </div>
            <button
              onClick={cetakStruk}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition mb-2"
            >
              <Printer size={16} />
              Cetak Struk
            </button>
            <button
              onClick={onClose}
              className="w-full text-sm font-medium py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Tutup
            </button>
          </>
        )}
      </div>
    </div>
  );
}
