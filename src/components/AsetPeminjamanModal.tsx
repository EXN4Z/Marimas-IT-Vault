import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { pinjamkanAset, type Aset, type AsetPeminjaman } from '../api/aset';
import { printStruk } from '../utils/printStruk';

interface AsetPeminjamanModalProps {
  aset: Aset;
  onClose: () => void;
  onSuccess: (peminjaman: AsetPeminjaman) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTanggalId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AsetPeminjamanModal({ aset, onClose, onSuccess }: AsetPeminjamanModalProps) {
  const [namaPeminjam, setNamaPeminjam] = useState('');
  const [nikPeminjam, setNikPeminjam] = useState('');
  const [tanggalPinjam, setTanggalPinjam] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [selectedKelengkapan, setSelectedKelengkapan] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasil, setHasil] = useState<{ peminjaman: AsetPeminjaman } | null>(null);

  const toggleKelengkapan = (id: number) => {
    setSelectedKelengkapan((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!namaPeminjam.trim()) {
      setError('Nama peminjam wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await pinjamkanAset(aset.id, {
        nama_peminjam: namaPeminjam.trim(),
        nik_peminjam: nikPeminjam.trim() || undefined,
        tanggal_pinjam: tanggalPinjam,
        catatan: catatan.trim() || undefined,
        kelengkapan_ids: selectedKelengkapan.length ? selectedKelengkapan : undefined,
      });
      setHasil(res);
      onSuccess(res.peminjaman);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mencatat peminjaman. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const cetakStruk = () => {
    if (!hasil) return;
    const p = hasil.peminjaman;
    printStruk({
      judul: 'Bukti Peminjaman Aset',
      noStruk: p.no_struk_pinjam || '-',
      tanggal: formatTanggalId(p.tanggal_pinjam),
      rows: [
        { label: 'Kode Aset', value: aset.kode_aset },
        { label: 'Nama Barang', value: aset.merk ? `${aset.merk} ${aset.tipe || ''}`.trim() : aset.barang?.nama || '-' },
        { label: 'Peminjam', value: p.nama_peminjam },
        ...(p.nik_peminjam ? [{ label: 'NIK', value: p.nik_peminjam }] : []),
        { label: 'Kondisi Saat Pinjam', value: p.kondisi_saat_pinjam || '-' },
      ],
      catatan: p.catatan,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Pinjamkan Aset {aset.kode_aset}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {!hasil ? (
          <>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Peminjam</label>
                <input
                  value={namaPeminjam}
                  onChange={(e) => setNamaPeminjam(e.target.value)}
                  autoFocus
                  placeholder="Nama lengkap"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NIK (opsional)</label>
                <input
                  value={nikPeminjam}
                  onChange={(e) => setNikPeminjam(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pinjam</label>
                <input
                  type="date"
                  value={tanggalPinjam}
                  onChange={(e) => setTanggalPinjam(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {!!aset.kelengkapan?.length && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kelengkapan yang dibawa</label>
                  <div className="flex flex-col gap-1.5 border border-slate-200 rounded-lg p-2.5">
                    {aset.kelengkapan.map((k) => (
                      <label key={k.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedKelengkapan.includes(k.id)}
                          onChange={() => toggleKelengkapan(k.id)}
                        />
                        {k.nama}
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
            >
              {submitting ? 'Memproses...' : 'Pinjamkan'}
            </button>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-emerald-700 font-medium">Peminjaman berhasil dicatat.</p>
              <p className="text-xs text-emerald-600 mt-1">No. Bukti: {hasil.peminjaman.no_struk_pinjam}</p>
            </div>
            <button
              onClick={cetakStruk}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition mb-2"
            >
              <Printer size={16} />
              Cetak Bukti Pinjam
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
