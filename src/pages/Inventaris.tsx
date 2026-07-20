import { useEffect, useState } from 'react';
import {
  Package,
  HandCoins,
  Undo2,
  Search,
  X,
  AlertTriangle,
  ScanLine,
  QrCode,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import ScanQrModal from '../components/ScanQrModal';
import QrCodeModal from '../components/QrCodeModal';
import PeminjamanModal from '../components/PeminjamanModal';
import { useAuth } from '../context/AuthContext';
import {
  getBarang,
  getBarangByKode,
  getKategoriBarang,
  createBarang,
  updateBarang,
  deleteBarang,
  type Barang,
  type KategoriBarang,
} from '../api/barang';
import { getRiwayatPeminjaman, type Peminjaman } from '../api/peminjaman';

function formatWaktu(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

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

export default function Inventaris() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [barang, setBarang] = useState<Barang[]>([]);
  const [riwayat, setRiwayat] = useState<Peminjaman[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriBarang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'semua' | 'stok_menipis'>('semua');

  const [peminjamanBarang, setPeminjamanBarang] = useState<Barang | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [qrBarang, setQrBarang] = useState<Barang | null>(null);
  const [lookingUpBarang, setLookingUpBarang] = useState(false);

  // CRUD barang (khusus admin)
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState<BarangFormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [barangToDelete, setBarangToDelete] = useState<Barang | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [barangData, riwayatData] = await Promise.all([getBarang(), getRiwayatPeminjaman(10)]);
      setBarang(barangData);
      setRiwayat(riwayatData);
    } catch (err) {
      setError('Gagal memuat data inventaris. Coba refresh halaman.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    getKategoriBarang()
      .then(setKategoriList)
      .catch(() => {}); // gagal ambil kategori bukan blocker, form tetap bisa dipakai tanpa kategori
  }, [isAdmin]);

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
    .filter((b) => activeTab === 'semua' || b.stok < b.stok_minimum);

  const totalBarang = barang.length;
  const stokMenipis = barang.filter((b) => b.stok < b.stok_minimum).length;
  const riwayatCount = riwayat.length;

  const handleScanSuccess = async (kodeBarang: string) => {
    setScanError('');
    setLookingUpBarang(true); // modal scan TETEP kebuka, kasih overlay loading
    try {
      const found = await getBarangByKode(kodeBarang);
      setPeminjamanBarang(found); // langsung buka modal kelola peminjaman
      setScannerOpen(false); // baru tutup modal scan SETELAH barang ketemu
    } catch (err: any) {
      setScanError(
        err.response?.data?.message || `Kode "${kodeBarang}" tidak dikenali sebagai barang.`
      );
    } finally {
      setLookingUpBarang(false);
    }
  };

  const handleBarangUpdateFromModal = (updated: Barang) => {
    setBarang((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setPeminjamanBarang(updated);
  };

  const handlePeminjamanBaru = (list: Peminjaman[]) => {
    setRiwayat((prev) => [...list, ...prev].slice(0, 10));
  };

  if (loading) {
    return (
      <AppLayout title="Inventaris">
        <p className="text-sm text-slate-500">Memuat data inventaris...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Inventaris">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">Kelola stok barang dan peminjaman.</p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-50 transition"
            >
              <Plus size={16} />
              Tambah Barang
            </button>
          )}
          <button
            onClick={() => {
              setScanError('');
              setScannerOpen(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <ScanLine size={16} />
            Scan QR
          </button>
        </div>
      </div>

      <nav className="mb-6">
        <ul className="flex items-center gap-6 border-b border-slate-200">
          <li>
            <button
              onClick={() => setActiveTab('semua')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'semua'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Package size={16} />
              Semua Barang
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {totalBarang}
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('stok_menipis')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'stok_menipis'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlertTriangle size={16} />
              Stok Menipis
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">
                {stokMenipis}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {scanError && (
        <div className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
          <span>{scanError}</span>
          <button onClick={() => setScanError('')} className="text-amber-500 hover:text-amber-700">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DAFTAR BARANG */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Daftar Barang</h3>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau kode barang..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

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
                    <button
                      onClick={() => setPeminjamanBarang(item)}
                      title="Kelola Peminjaman"
                      className="h-8 px-3 rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1.5 hover:bg-slate-200 transition"
                    >
                      <HandCoins size={16} />
                      <span className="text-xs font-semibold">Pinjamkan</span>
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
              <p className="text-sm text-slate-400 text-center py-8">Barang tidak ditemukan.</p>
            )}
          </div>
        </div>

        {/* RIWAYAT PEMINJAMAN */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Riwayat <span className="text-slate-400 font-normal">({riwayatCount})</span>
          </h3>
          <ul className="flex flex-col gap-4">
            {riwayat.map((p) => {
              const dikembalikan = p.status === 'dikembalikan';
              const waktu = dikembalikan ? p.tanggal_kembali_aktual! : p.tanggal_pinjam;
              return (
                <li key={p.id} className="flex items-start gap-3">
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      dikembalikan ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {dikembalikan ? <Undo2 size={16} /> : <HandCoins size={16} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{p.user?.name || '-'}</span>{' '}
                      {dikembalikan ? 'mengembalikan' : 'meminjam'}{' '}
                      <span className="font-medium">{p.jumlah}</span> pcs
                    </p>
                    <p className="text-xs text-slate-400">{formatWaktu(waktu)}</p>
                  </div>
                </li>
              );
            })}

            {riwayat.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Belum ada riwayat peminjaman.</p>
            )}
          </ul>
        </div>
      </div>

      {peminjamanBarang && (
        <PeminjamanModal
          barang={peminjamanBarang}
          onClose={() => setPeminjamanBarang(null)}
          onBarangUpdate={handleBarangUpdateFromModal}
          onPeminjamanBaru={handlePeminjamanBaru}
        />
      )}

      {scannerOpen && (
        <ScanQrModal
          onClose={() => setScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
          isProcessing={lookingUpBarang}
        />
      )}

      {qrBarang && <QrCodeModal barang={qrBarang} onClose={() => setQrBarang(null)} />}

      {/* FORM TAMBAH / EDIT BARANG (khusus admin) */}
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
              {formSubmitting
                ? 'Menyimpan...'
                : formMode === 'create'
                ? 'Tambah Barang'
                : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      )}

      {/* KONFIRMASI HAPUS BARANG (khusus admin) */}
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
    </AppLayout>
  );
}