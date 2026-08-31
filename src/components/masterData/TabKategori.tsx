import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../shared/skeleton';
import {
  getKategori,
  createKategori,
  updateKategori,
  deleteKategori,
  type Kategori,
  type KategoriFormValues,
} from '../../api/masterData/kategori';

// Sekarang full CRUD -- beda dari sebelumnya (read-only 2 baris fix).
// (REFACTOR KATEGORI BEBAS Fase 4: peringatan lama di sini -- yang bilang
// baris "Barang Utama"/"Kelengkapan" dipakai logic sistem lewat nama --
// sudah gak berlaku. Sejak Fase 1-2, semua logic (validasi parent_id,
// filter struktur induk/menempel, dst) murni berbasis kolom parent_id,
// gak baca nama kategori sama sekali. Kategori sekarang cuma label bebas,
// aman di-rename/hapus/tambah tanpa mempengaruhi fitur lain.)
export default function TabKategori() {
  const [items, setItems] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Kategori | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Kategori | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getKategori();
      setItems(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data kategori.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: Kategori) => {
    setEditing(item);
    setFormNama(item.nama);
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
    setSubmitting(true);
    setFormError('');
    try {
      const payload: KategoriFormValues = { nama: formNama.trim() };
      if (editing) {
        await updateKategori(editing.id, payload);
        toast.success('Kategori berhasil diperbarui.');
      } else {
        await createKategori(payload);
        toast.success('Kategori berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.nama?.[0] ||
        err.response?.data?.message ||
        'Gagal menyimpan kategori.';
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
      await deleteKategori(deleteTarget.id);
      toast.success('Kategori berhasil dihapus.');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      // 422 khusus: masih dipakai baris Inventory (FK restrictOnDelete di backend).
      if (err.response?.status === 422) {
        setDeleteError(
          err.response?.data?.message || 'Kategori ini masih dipakai oleh data Inventory dan tidak bisa dihapus.'
        );
      } else {
        setDeleteError(err.response?.data?.message || 'Gagal menghapus kategori.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-1 flex-wrap">
        <p className="text-xs text-slate-400 max-w-md">
          Kategori adalah label jenis barang (mis. Laptop, Charger, Speaker) buat mengelompokkan
          data Inventory. Nama bebas apa saja -- gak menentukan field atau alur mana pun.
        </p>
        <button
          onClick={openCreateModal}
          disabled={loading || !!error}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus size={16} />
          Tambah Kategori
        </button>
      </div>

      {loading && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[420px]">
            <tbody>
              <SkeletonTable columns={2} rows={2} />
            </tbody>
          </table>
        </div>
      )}

      {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">Belum ada data kategori.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Nama</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">
                        <Tags size={14} />
                      </span>
                      {item.nama}
                    </div>
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
                {editing ? 'Edit Kategori' : 'Tambah Kategori'}
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
            <h3 className="text-base font-semibold text-slate-900 mb-2">Hapus Kategori?</h3>
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