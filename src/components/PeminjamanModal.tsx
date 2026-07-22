import { useEffect, useRef, useState } from 'react';
import { X, HandCoins, Undo2, Search, Check, Plus, Trash2 } from 'lucide-react';
import type { Barang } from '../api/barang';
import {
  getPeminjamanAktifByBarang,
  pinjamkanBarang,
  kembalikanPeminjaman,
  searchUser,
  type Peminjaman,
  type User,
} from '../api/peminjaman';

function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isTerlambat(p: Peminjaman): boolean {
  return new Date(p.tanggal_kembali_rencana).getTime() < Date.now();
}

let rowIdCounter = 0;
function nextRowId(): string {
  rowIdCounter += 1;
  return `row-${rowIdCounter}`;
}

interface RowState {
  id: string;
  user: User | null;
  jumlah: string;
}

function emptyRow(): RowState {
  return { id: nextRowId(), user: null, jumlah: '1' };
}

// --- Satu baris input peminjam: search-combobox user + jumlah, mengelola state pencariannya sendiri ---
interface RowInputProps {
  row: RowState;
  satuan: string;
  otherSelectedIds: number[];
  onChangeUser: (user: User | null) => void;
  onChangeJumlah: (jumlah: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function PeminjamRowInput({
  row,
  satuan,
  otherSelectedIds,
  onChangeUser,
  onChangeJumlah,
  onRemove,
  canRemove,
}: RowInputProps) {
  const [query, setQuery] = useState(row.user?.name ?? '');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || row.user) {
      setResults([]);
      setHasSearched(false);
      setSearchError('');
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const data = await searchUser(query.trim());
        setResults(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setResults([]);
        setSearchError(
          err.response?.status === 404
            ? 'Endpoint pencarian user tidak ditemukan (cek route backend).'
            : err.response?.data?.message || 'Gagal mencari user. Coba lagi.'
        );
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, row.user]);

  const pick = (u: User) => {
    onChangeUser(u);
    setQuery(u.name);
    setResults([]);
  };

  const duplikat = row.user !== null && otherSelectedIds.includes(row.user.id);

  return (
    <div className="border border-slate-200 rounded-lg p-3 mb-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onChangeUser(null);
              }}
              placeholder="Cari nama user..."
              className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {row.user && !duplikat && (
              <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
            )}

            {!row.user && query.trim() !== '' && (searching || hasSearched) && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                {searching && <p className="text-xs text-slate-400 px-3 py-2">Mencari...</p>}
                {!searching && searchError && (
                  <p className="text-xs text-red-600 px-3 py-2">{searchError}</p>
                )}
                {!searching &&
                  !searchError &&
                  results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => pick(u)}
                      className="w-full text-left text-sm px-3 py-2 hover:bg-slate-50 transition"
                    >
                      {u.name}
                    </button>
                  ))}
                {!searching && !searchError && results.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-2">User tidak ditemukan.</p>
                )}
              </div>
            )}
          </div>
          {duplikat && (
            <p className="text-xs text-red-600 mt-1">User ini sudah ada di baris lain.</p>
          )}
        </div>

        <input
          type="number"
          value={row.jumlah}
          onChange={(e) => onChangeJumlah(e.target.value)}
          placeholder="Jml"
          title={`Jumlah (${satuan})`}
          className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          title="Hapus baris"
          className="w-9 h-9 flex-shrink-0 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

interface Props {
  barang: Barang;
  onClose: () => void;
  onBarangUpdate: (barang: Barang) => void;
  onPeminjamanBaru?: (peminjaman: Peminjaman[]) => void;
}

export default function PeminjamanModal({ barang, onClose, onBarangUpdate, onPeminjamanBaru }: Props) {
  const [aktif, setAktif] = useState<Peminjaman[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState<RowState[]>([emptyRow()]);
  const [tanggalRencana, setTanggalRencana] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [returningId, setReturningId] = useState<number | null>(null);

  const stokDipinjam = aktif.reduce((sum, p) => sum + p.jumlah, 0);
  const stokTersedia = barang.stok - stokDipinjam;
  const totalDiminta = rows.reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPeminjamanAktifByBarang(barang.id)
      .then((data) => mounted && setAktif(data))
      .catch(() => mounted && setError('Gagal memuat daftar peminjam.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [barang.id]);

  const openForm = () => {
    setShowForm(true);
    setRows([emptyRow()]);
    setTanggalRencana('');
    setFormError('');
  };

  const updateRowUser = (id: string, user: User | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, user } : r)));
  };

  const updateRowJumlah = (id: string, jumlah: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, jumlah } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handlePinjamkan = async () => {
    if (rows.some((r) => !r.user)) {
      setFormError('Semua baris harus punya peminjam yang dipilih dari hasil pencarian.');
      return;
    }
    const ids = rows.map((r) => r.user!.id);
    if (new Set(ids).size !== ids.length) {
      setFormError('Ada peminjam yang sama dipilih di lebih dari satu baris.');
      return;
    }
    if (rows.some((r) => !Number(r.jumlah) || Number(r.jumlah) <= 0)) {
      setFormError('Jumlah tiap baris harus lebih dari 0.');
      return;
    }
    if (totalDiminta > stokTersedia) {
      setFormError(`Total yang diminta (${totalDiminta}) melebihi stok tersedia (${stokTersedia} ${barang.satuan}).`);
      return;
    }
    if (!tanggalRencana) {
      setFormError('Isi tanggal rencana kembali.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const result = await pinjamkanBarang(barang.id, {
        items: rows.map((r) => ({ user_id: r.user!.id, jumlah: Number(r.jumlah) })),
        tanggal_kembali_rencana: tanggalRencana,
      });
      setAktif((prev) => [...result.peminjaman, ...prev]);
      onBarangUpdate(result.barang);
      onPeminjamanBaru?.(result.peminjaman);
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal mencatat peminjaman. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKembalikan = async (p: Peminjaman) => {
    setReturningId(p.id);
    setError('');
    try {
      const result = await kembalikanPeminjaman(p.id);
      setAktif((prev) => prev.filter((item) => item.id !== p.id));
      onBarangUpdate(result.barang);
      onPeminjamanBaru?.([result.peminjaman]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memproses pengembalian.');
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Peminjaman Barang</h3>
            <p className="text-xs text-slate-400">{barang.nama}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">{barang.kode_barang}</p>
            <p className="text-sm text-slate-600">
              Total stok: <span className="font-semibold text-slate-800">{barang.stok}</span> {barang.satuan}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Tersedia</p>
            <p className={`text-lg font-bold ${barang.stok_tersedia <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {barang.stok_tersedia}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Sedang dipinjam ({aktif.length})</p>
          {!showForm && (
            <button
              onClick={openForm}
              disabled={stokTersedia <= 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <HandCoins size={14} />
              Pinjamkan
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-4 text-center">Memuat data peminjam...</p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {aktif.map((p) => {
              const terlambat = isTerlambat(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between border border-slate-200 rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.user?.name || '-'}</p>
                    <p className="text-xs text-slate-400">
                      {p.jumlah} {barang.satuan} · pinjam {formatTanggal(p.tanggal_pinjam)}
                    </p>
                    <p className={`text-xs ${terlambat ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                      {terlambat ? 'Terlambat, ' : 'Rencana kembali '}
                      {formatTanggal(p.tanggal_kembali_rencana)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleKembalikan(p)}
                    disabled={returningId === p.id}
                    title="Kembalikan"
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50 flex-shrink-0 ml-3"
                  >
                    <Undo2 size={14} />
                    {returningId === p.id ? '...' : 'Kembalikan'}
                  </button>
                </div>
              );
            })}

            {aktif.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada yang meminjam barang ini.</p>
            )}
          </div>
        )}

        {showForm && (
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700">Tambah peminjam</p>
              <p className="text-xs text-slate-400">
                Total: <span className={totalDiminta > stokTersedia ? 'text-red-600 font-semibold' : ''}>{totalDiminta}</span> / {stokTersedia} {barang.satuan}
              </p>
            </div>

            {rows.map((row) => (
              <PeminjamRowInput
                key={row.id}
                row={row}
                satuan={barang.satuan}
                otherSelectedIds={rows.filter((r) => r.id !== row.id).map((r) => r.user?.id).filter((v): v is number => !!v)}
                onChangeUser={(u) => updateRowUser(row.id, u)}
                onChangeJumlah={(j) => updateRowJumlah(row.id, j)}
                onRemove={() => removeRow(row.id)}
                canRemove={rows.length > 1}
              />
            ))}

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-3"
            >
              <Plus size={14} />
              Tambah baris peminjam
            </button>

            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rencana kembali <span className="text-slate-400 font-normal">(berlaku untuk semua baris)</span>
            </label>
            <input
              type="date"
              value={tanggalRencana}
              onChange={(e) => setTanggalRencana(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 mb-3"
            />

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {formError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handlePinjamkan}
                disabled={submitting}
                className="flex-1 bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
              >
                {submitting ? 'Menyimpan...' : `Pinjamkan (${rows.length} orang)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}