import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { getKategori, type Kategori } from '../../api/masterData/kategori';
import {
  getMasterKategori,
  createMasterKategori,
  updateMasterKategori,
  deleteMasterKategori,
  type MasterKategori,
  type MasterKategoriFormValues,
} from '../../api/masterData/masterKategori';

export default function TabMasterKategori() {
  const [items, setItems] = useState<MasterKategori[]>([]);
  const [kategoriOptions, setKategoriOptions] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MasterKategori | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formKode, setFormKode] = useState('');
  const [formKategoriId, setFormKategoriId] = useState<number | ''>('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MasterKategori | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [masterData, kategoriData] = await Promise.all([getMasterKategori(), getKategori()]);
      setItems(masterData);
      setKategoriOptions(kategoriData);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data master kategori.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const kategoriNama = (id: number) => kategoriOptions.find((k) => k.id === id)?.nama || '-';

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormKode('');
    setFormKategoriId(kategoriOptions[0]?.id ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: MasterKategori) => {
    setEditing(item);
    setFormNama(item.nama);
    setFormKode(item.kode || '');
    setFormKategoriId(item.kategori_id);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!formNama.trim()) {
      setFormError('Nama tidak boleh kosong.');
      return;
    }
    if (formKategoriId === '') {
      setFormError('Kategori wajib dipilih.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload: MasterKategoriFormValues = {
        nama: formNama.trim(),
        kode: formKode.trim() || null,
        kategori_id: formKategoriId,
      };
      if (editing) {
        await updateMasterKategori(editing.id, payload);
        toast.success('Master kategori berhasil diperbarui.');
      } else {
        await createMasterKategori(payload);
        toast.success('Master kategori berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.nama?.[0] ||
        err.response?.data?.errors?.kode?.[0] ||
        err.response?.data?.errors?.kategori_id?.[0] ||
        err.response?.data?.message ||
        'Gagal menyimpan master kategori.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMasterKategori(deleteTarget.id);
      toast.success('Master kategori berhasil dihapus.');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      // 422 khusus: masih dipakai baris Inventory (FK restrictOnDelete di backend).
      if (err.response?.status === 422) {
        setDeleteError(
          err.response?.data?.message ||
            'Master kategori ini masih dipakai oleh data Inventory dan tidak bisa dihapus.'
        );
      } else {
        setDeleteError(err.response?.data?.message || 'Gagal menghapus master kategori.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-1 flex-wrap">
        <p className="text-xs text-slate-400 max-w-md">
          Jenis/tipe barang (mis. Laptop, Proyektor, Charger), masing-masing terhubung ke satu
          Kategori. Kode dipakai buat generate kode Inventory secara otomatis.
        </p>
        <button
          onClick={openCreateModal}
          disabled={loading || !!error}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus size={16} />
          Tambah Master Kategori
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

      {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">Belum ada data master kategori.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Nama</th>
                <th className="px-6 py-3 font-medium">Kode</th>
                <th className="px-6 py-3 font-medium">Kategori</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">
                        <Layers size={14} />
                      </span>
                      {item.nama}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {item.kode ? (
                      <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">
                        {item.kode}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {item.kategori?.nama || kategoriNama(item.kategori_id)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        title="Edit"
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError('');
                          setDeleteTarget(item);
                        }}
                        title="Hapus"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Edit Master Kategori' : 'Tambah Master Kategori'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nama</label>
                <input
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="cth. Laptop"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Kode (opsional)</label>
                <input
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value.toUpperCase())}
                  placeholder="cth. LAPTOP"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-xs text-slate-400 mt-1">Dipakai buat generate kode_inventory otomatis.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Kategori</label>
                <select
                  value={formKategoriId}
                  onChange={(e) => setFormKategoriId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="" disabled>
                    Pilih kategori...
                  </option>
                  {kategoriOptions.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full text-white text-sm font-semibold py-3 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-900 hover:bg-slate-800"
              >
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Hapus Master Kategori?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Yakin mau hapus "{deleteTarget.nama}"? Tindakan ini tidak bisa dibatalkan.
            </p>

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {deleteError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                disabled={deleting}
                className="flex-1 text-sm font-medium py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-40"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
