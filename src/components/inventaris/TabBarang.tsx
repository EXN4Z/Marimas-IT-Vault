import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, QrCode, X } from 'lucide-react';
import {
  getBarang,
  getKategoriBarang,
  createBarang,
  updateBarang,
  deleteBarang,
  type Barang,
  type KategoriBarang,
} from '../../api/barang';
import { useAuth } from '../../context/AuthContext';
import QrCodeModal from '../QrCodeModal';

interface BarangFormState {
  nama: string;
  kategori_id: string;
  satuan: string;
  stok: string;
  stok_minimum: string;
}

const emptyForm: BarangFormState = {
  nama: '',
  kategori_id: '',
  satuan: '',
  stok: '0',
  stok_minimum: '0',
};

interface Props {
  search: string;
  onlyMenipis?: boolean;
  onCount?: (count: number) => void;
}

export default function TabBarang({ search, onlyMenipis, onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [barang, setBarang] = useState<Barang[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriBarang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [qrBarang, setQrBarang] = useState<Barang | null>(null);

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState<BarangFormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [barangToDelete, setBarangToDelete] = useState<Barang | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    getBarang()
      .then(setBarang)
      .catch((err) => {
        setError('Gagal memuat data barang. Coba refresh halaman.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    getKategoriBarang().then(setKategoriList).catch(() => {});
  }, [isAdmin]);

  // guard: cuma lapor ke parent kalau angkanya beneran berubah,
  // biar gak ikut numpuk loop kalau suatu saat onCount dikirim tanpa useCallback
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current !== barang.length) {
      lastCount.current = barang.length;
      onCount?.(barang.length);
    }
  }, [barang, onCount]);

  const openCreateForm = () => {
    setFormData(emptyForm);
    setFormError('');
    setEditingId(null);
    setFormMode('create');
  };

  const openEditForm = (item: Barang) => {
    setFormData({
      nama: item.nama,
      kategori_id: item.kategori_id ? String(item.kategori_id) : '',
      satuan: item.satuan,
      stok: String(item.stok),
      stok_minimum: String(item.stok_minimum),
    });
    setFormError('');
    setEditingId(item.id);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setFormData(emptyForm);
    setFormError('');
    setEditingId(null);
  };

  const handleFormSubmit = async () => {
    if (!formData.nama.trim()) {
      setFormError('Nama barang wajib diisi.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        nama: formData.nama.trim(),
        kategori_id: formData.kategori_id ? Number(formData.kategori_id) : null,
        satuan: formData.satuan.trim() || undefined,
        stok_minimum: formData.stok_minimum ? Number(formData.stok_minimum) : undefined,
      };

      if (formMode === 'create') {
        const created = await createBarang({ ...payload, stok: Number(formData.stok) || 0 });
        setBarang((prev) => [created, ...prev]);
      } else if (formMode === 'edit' && editingId !== null) {
        const updated = await updateBarang(editingId, payload);
        setBarang((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
      closeForm();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan barang. Coba lagi.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDeleteBarang = async () => {
    if (!barangToDelete) return;
    setDeleting(true);
    try {
      await deleteBarang(barangToDelete.id);
      setBarang((prev) => prev.filter((b) => b.id !== barangToDelete.id));
      setBarangToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menghapus barang. Coba lagi.');
      setBarangToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredBarang = barang
    .filter(
      (b) =>
        b.nama.toLowerCase().includes(search.toLowerCase()) ||
        b.kode_barang.toLowerCase().includes(search.toLowerCase())
    )
    .filter((b) => !onlyMenipis || b.stok < b.stok_minimum);

  if (loading) {
    return <p className="text-sm text-slate-500">Memuat data barang...</p>;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          {onlyMenipis ? 'Barang Stok Menipis' : 'Daftar Barang'}
        </h3>
        {isAdmin && !onlyMenipis && (
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition"
          >
            <Plus size={16} />
            Tambah Barang
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredBarang.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{item.nama}</p>
                {item.stok < item.stok_minimum && (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    Stok menipis
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {item.kode_barang} · {item.kategori_barang?.nama || 'kategori tidak ada'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{item.stok_tersedia}</p>
                <p className="text-[11px] text-slate-400">{item.satuan}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setQrBarang(item)}
                  title="Lihat / Cetak QR"
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition"
                >
                  <QrCode size={16} />
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => openEditForm(item)}
                      title="Edit Barang"
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setBarangToDelete(item)}
                      title="Hapus Barang"
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredBarang.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            {onlyMenipis ? 'Tidak ada barang dengan stok menipis.' : 'Barang tidak ditemukan.'}
          </p>
        )}
      </div>

      {qrBarang && <QrCodeModal barang={qrBarang} onClose={() => setQrBarang(null)} />}

      {formMode && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {formMode === 'create' ? 'Tambah Barang' : 'Edit Barang'}
              </h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Barang</label>
                <input
                  value={formData.nama}
                  onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))}
                  placeholder="cth. Bor Tangan Bosch"
                  autoFocus
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                <select
                  value={formData.kategori_id}
                  onChange={(e) => setFormData((f) => ({ ...f, kategori_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="">Tanpa kategori</option>
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Satuan</label>
                  <input
                    value={formData.satuan}
                    onChange={(e) => setFormData((f) => ({ ...f, satuan: e.target.value }))}
                    placeholder="pcs, unit, set..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stok Minimum</label>
                  <input
                    type="number"
                    value={formData.stok_minimum}
                    onChange={(e) => setFormData((f) => ({ ...f, stok_minimum: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {formMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    value={formData.stok}
                    onChange={(e) => setFormData((f) => ({ ...f, stok: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              )}

              {formMode === 'edit' && (
                <p className="text-xs text-slate-400">
                  Stok tidak diedit di sini — pakai tombol Pinjamkan / Kembalikan supaya riwayat peminjamannya tetap tercatat.
                </p>
              )}
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {formError}
              </p>
            )}

            <button
              onClick={handleFormSubmit}
              disabled={formSubmitting || !formData.nama.trim()}
              className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {formSubmitting ? 'Menyimpan...' : formMode === 'create' ? 'Tambah Barang' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      )}

      {barangToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Hapus barang?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-medium text-slate-700">{barangToDelete.nama}</span> akan dihapus
              permanen beserta riwayat peminjamannya, dan tidak bisa dikembalikan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBarangToDelete(null)}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteBarang}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}