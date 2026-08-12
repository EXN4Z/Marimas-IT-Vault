import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Check, Plus } from 'lucide-react';
import { serahTerimaAset, searchKaryawan, getAset, type Aset, type AsetPemakai, type KaryawanUser } from '../../api/aset';
import AsetFotoUpload from './AsetFotoUpload';

interface AsetSerahTerimaModalProps {
  aset: Aset; // aset utama yang mau diserahkan (mis. laptop) -- diklik dari tabel/detail
  onClose: () => void;
  // dikirim SETELAH semua item (aset utama + kelengkapan yang dicentang)
  // berhasil diserahkan. Array selalu berisi minimal 1 elemen (aset utama).
  onSuccess: (results: { aset: Aset; pemakai: AsetPemakai }[]) => void;
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

  const [tanggalPenerimaan, setTanggalPenerimaan] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [fotoPenerimaan, setFotoPenerimaan] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // BARU: checklist kelengkapan (tas, charger, dst) yang ikut diserahkan
  // bareng aset utama ini dalam satu proses -- satu penerima, satu tanggal,
  // satu set foto, satu struk gabungan. Diambil dari /api/aset, difilter di
  // sini ke kategori jenis "kelengkapan" & status "tersedia" (dan bukan
  // aset utamanya sendiri, buat jaga-jaga kalau kebetulan sama).
  const [kelengkapanPool, setKelengkapanPool] = useState<Aset[]>([]);
  const [kelengkapanQuery, setKelengkapanQuery] = useState('');
  const [selectedKelengkapan, setSelectedKelengkapan] = useState<Aset[]>([]);
  const [loadingKelengkapan, setLoadingKelengkapan] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAset()
      .then((list) => {
        if (cancelled) return;
        const pool = list.filter(
          (a) => a.id !== aset.id && a.status === 'tersedia' && (a.jenis?.kategori ?? 'aset_utama') === 'kelengkapan'
        );
        setKelengkapanPool(pool);
      })
      .catch(() => {
        if (!cancelled) setKelengkapanPool([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingKelengkapan(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aset.id]);

  const kelengkapanMatches = useMemo(() => {
    const q = kelengkapanQuery.trim().toLowerCase();
    const belumDipilih = kelengkapanPool.filter((a) => !selectedKelengkapan.some((s) => s.id === a.id));
    if (!q) return belumDipilih;
    return belumDipilih.filter((a) => {
      const haystack = [a.kode_aset, a.jenis?.nama, a.merek, a.tipe, a.serial_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [kelengkapanPool, selectedKelengkapan, kelengkapanQuery]);

  const addKelengkapan = (a: Aset) => {
    setSelectedKelengkapan((prev) => (prev.some((s) => s.id === a.id) ? prev : [...prev, a]));
    setKelengkapanQuery('');
  };

  const removeKelengkapan = (id: number) => {
    setSelectedKelengkapan((prev) => prev.filter((s) => s.id !== id));
  };

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
    if (fotoPenerimaan.length !== 3) {
      setError('Harus Kirim 3 foto');
      return;
    }

    setSubmitting(true);
    setError('');

    // Semua item (aset utama duluan, baru kelengkapan yang dicentang)
    // diserahkan satu-satu ke backend (endpoint /aset/{id}/pemakai tetap
    // per-aset, tidak berubah) -- tapi pakai penerima/tanggal/catatan/foto
    // yang SAMA persis buat semuanya, jadi kelihatan seperti satu proses.
    const semuaItem = [aset, ...selectedKelengkapan];
    const hasil: { aset: Aset; pemakai: AsetPemakai }[] = [];

    try {
      for (const item of semuaItem) {
        const formData = new FormData();
        if (mode === 'karyawan') {
          formData.append('pekerja_id', String(selected!.pekerja!.id));
        } else {
          formData.append('user_id', String(selected!.id));
        }
        formData.append('tanggal_penerimaan', tanggalPenerimaan);
        if (catatan.trim()) formData.append('catatan_penerimaan', catatan.trim());
        fotoPenerimaan.forEach((file) => formData.append('foto_penerimaan[]', file));

        const pemakai = await serahTerimaAset(item.id, formData);
        hasil.push({ aset: item, pemakai });
      }
      onSuccess(hasil);
    } catch (err: any) {
      const namaGagal = semuaItem[hasil.length]?.kode_aset;
      setError(
        (hasil.length > 0 ? `${hasil.length} aset berhasil diserahkan, tapi gagal lanjut di ${namaGagal}: ` : '') +
          (err.response?.data?.errors?.foto_penerimaan?.[0] ||
            err.response?.data?.message ||
            'Gagal mencatat serah-terima. Coba lagi.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
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

          {/* BARU: checklist kelengkapan -- cari & tambahin tas/charger/dst
              yang ikut dipinjamkan bareng aset utama ini. Opsional, boleh
              kosong (cuma pinjam aset utama doang). */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kelengkapan yang Ikut Dipinjamkan <span className="text-slate-400 font-normal">(opsional)</span>
            </label>

            {selectedKelengkapan.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedKelengkapan.map((k) => (
                  <span
                    key={k.id}
                    className="flex items-center gap-1 text-xs font-medium bg-slate-900 text-white pl-2.5 pr-1.5 py-1 rounded-full"
                  >
                    {k.kode_aset} · {k.jenis?.nama || k.merek || '-'}
                    <button
                      type="button"
                      onClick={() => removeKelengkapan(k.id)}
                      className="hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={kelengkapanQuery}
                onChange={(e) => setKelengkapanQuery(e.target.value)}
                placeholder={loadingKelengkapan ? 'Memuat kelengkapan tersedia...' : 'Cari tas, charger, dst...'}
                disabled={loadingKelengkapan}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
              />

              {!loadingKelengkapan && kelengkapanQuery.trim() !== '' && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {kelengkapanMatches.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => addKelengkapan(k)}
                      className="w-full flex items-center justify-between gap-2 text-left text-sm px-3 py-2 hover:bg-slate-50 transition"
                    >
                      <span>
                        {k.kode_aset} · {k.jenis?.nama || k.merek || '-'}
                      </span>
                      <Plus size={13} className="text-slate-400 flex-shrink-0" />
                    </button>
                  ))}
                  {kelengkapanMatches.length === 0 && (
                    <p className="text-xs text-slate-400 px-3 py-2">Kelengkapan tersedia tidak ditemukan.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <AsetFotoUpload files={fotoPenerimaan} onChange={setFotoPenerimaan} max={3} label="Foto Bukti Serah Terima (3 Foto)" />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
        >
          {submitting
            ? 'Memproses...'
            : selectedKelengkapan.length > 0
            ? `Serahkan Aset + ${selectedKelengkapan.length} Kelengkapan`
            : 'Serahkan Aset'}
        </button>
      </div>
    </div>
  );
}