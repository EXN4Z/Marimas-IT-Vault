import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Tags, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../shared/skeleton';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../shared/FormControls';
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal';
import { useBackdropClose } from '../../hooks/useBackdropClose';
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

  const backdropModal = useBackdropClose(closeModal);

  const handleSubmit = async () => {
    if (!formNama.trim()) {
      setFormError('Nama kategori wajib diisi.');
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
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
          {...backdropModal}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden transform transition-all animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Tags size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editing ? 'Edit Kategori' : 'Tambah Kategori'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editing ? 'Perbarui nama kelompok kategori barang' : 'Buat kelompok kategori barang baru'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="p-6 space-y-4"
            >
              <Field
                label="Nama Kategori"
                required
                error={formError && !formNama.trim() ? formError : undefined}
                hint="Contoh: Laptop, Monitor, Smartphone, Printer, Audio"
              >
                <TextInput
                  value={formNama}
                  onChange={(val) => {
                    setFormNama(val);
                    if (formError) setFormError('');
                  }}
                  placeholder="Contoh: Laptop / Komputer"
                  autoFocus
                  error={!!formError && !formNama.trim()}
                />
              </Field>

              {formError && formNama.trim() && (
                <div className="flex items-start gap-2.5 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl animate-[fadeIn_150ms_ease-out]">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <ButtonCancel onClick={closeModal} disabled={submitting} />
                <ButtonSubmit type="submit" loading={submitting} loadingLabel="Menyimpan...">
                  {editing ? 'Simpan Perubahan' : 'Tambah Kategori'}
                </ButtonSubmit>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.nama || ''}
        itemType="Kategori"
        loading={deleting}
        errorMessage={deleteError}
        warningMessage="Pastikan tidak ada aset/inventory yang sedang terkait dengan kategori ini."
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}