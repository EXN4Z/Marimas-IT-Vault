import { useEffect, useRef, useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import { serahTerimaAset, searchKaryawan, type Aset, type AsetPemakai, type KaryawanUser } from '../api/aset';

interface AsetSerahTerimaModalProps {
  aset: Aset;
  onClose: () => void;
  onSuccess: (pemakai: AsetPemakai) => void;
}

type PenerimaMode = 'karyawan' | 'cabang';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AsetSerahTerimaModal({ aset, onClose, onSuccess }: AsetSerahTerimaModalProps) {
  const [mode, setMode] = useState<PenerimaMode>('karyawan');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KaryawanUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<KaryawanUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nomorPenerimaan, setNomorPenerimaan] = useState('');
  const [tanggalPenerimaan, setTanggalPenerimaan] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleModeChange(next: PenerimaMode) {
    setMode(next);
    // reset pencarian tiap ganti mode biar nggak ketuker antara akun karyawan & cabang
    setQuery('');
    setResults([]);
    setSelected(null);
    setError('');
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // TODO: pastikan searchKaryawan di api/aset.ts menerima param role
        // dan meneruskannya sebagai query string ke endpoint pencarian,
        // misal: GET /karyawan/search?q=...&role=cabang
        const data = await searchKaryawan(query.trim(), mode === 'cabang' ? 'cabang' : undefined);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, mode]);

  const pick = (u: KaryawanUser) => {
    setSelected(u);
    setQuery(u.name);
    setResults([]);
  };

  const handleSubmit = async () => {
    if (mode === 'karyawan' && !selected?.pekerja?.id) {
      setError('Pilih karyawan yang datanya sudah lengkap sebagai pekerja.');
      return;
    }
    if (mode === 'cabang' && !selected?.id) {
      setError('Pilih akun cabang penerima.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await serahTerimaAset(aset.id, {
        // karyawan disimpan lewat pekerja_id, cabang lewat user_id
        ...(mode === 'karyawan'
          ? { pekerja_id: selected!.pekerja!.id }
          : { user_id: selected!.id }),
        nomor_penerimaan: nomorPenerimaan.trim() || undefined,
        tanggal_penerimaan: tanggalPenerimaan,
        catatan_penerimaan: catatan.trim() || undefined,
      });
      onSuccess(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mencatat serah-terima. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Serahkan Aset {aset.kode_aset}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Serahkan Kepada</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('karyawan')}
                className={`text-sm font-medium py-2 rounded-lg border transition ${
                  mode === 'karyawan'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Karyawan
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('cabang')}
                className={`text-sm font-medium py-2 rounded-lg border transition ${
                  mode === 'cabang'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Cabang
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {mode === 'karyawan' ? 'Karyawan Penerima' : 'Akun Cabang Penerima'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                autoFocus
                placeholder={mode === 'karyawan' ? 'Cari nama karyawan...' : 'Cari nama cabang...'}
                className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {selected && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />}

              {!selected && query.trim() !== '' && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {searching && <p className="text-xs text-slate-400 px-3 py-2">Mencari...</p>}
                  {!searching &&
                    results.map((u) => {
                      // untuk karyawan, hanya bisa dipilih kalau punya data pekerja;
                      // untuk cabang, akun itu sendiri sudah cukup (nggak butuh pekerja)
                      const disabled = mode === 'karyawan' && !u.pekerja;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => pick(u)}
                          disabled={disabled}
                          className="w-full text-left text-sm px-3 py-2 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.name}
                          {disabled && <span className="text-xs text-slate-400"> — belum ada data pekerja</span>}
                        </button>
                      );
                    })}
                  {!searching && results.length === 0 && (
                    <p className="text-xs text-slate-400 px-3 py-2">
                      {mode === 'karyawan' ? 'Karyawan tidak ditemukan.' : 'Cabang tidak ditemukan.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Penerimaan (opsional)</label>
            <input
              value={nomorPenerimaan}
              onChange={(e) => setNomorPenerimaan(e.target.value)}
              placeholder="cth. 26/00001"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Penerimaan</label>
            <input
              type="date"
              value={tanggalPenerimaan}
              onChange={(e) => setTanggalPenerimaan(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              placeholder="cth. diterima dalam keadaan baik"
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
          {submitting ? 'Memproses...' : 'Serahkan Aset'}
        </button>
      </div>
    </div>
  );
}