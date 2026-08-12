import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  getJenisAset,
  createJenisAset,
  updateJenisAset,
  deleteJenisAset,
  type JenisAset,
} from '../../api/jenisAset';

// CRUD kelengkapan aset (Tas, Charger, Case/Dus, dst) -- dulu tabel sendiri
// (kelengkapan_master), sekarang cuma jenis_aset dengan kategori
// 'kelengkapan' (lihat migration drop_kelengkapan_master_and_aset_kelengkapan
// & add_kategori_to_jenis_aset_table di backend). Fisiknya tetap dilacak
// sebagai baris `aset` biasa (kode unik, S/N, riwayat pinjam sendiri) --
// yang di-CRUD di sini cuma daftar jenisnya, bukan unit fisiknya.
export default function TabKelengkapanMaster() {
  const [items, setItems] = useState<JenisAset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JenisAset | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<JenisAset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getJenisAset('kelengkapan');
      setItems(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? 'Anda tidak punya akses ke halaman ini.' : 'Gagal memuat data kelengkapan.');
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

  const openEditModal = (item: JenisAset) => {
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
      if (editing) {
        await updateJenisAset(editing.id, formNama.trim(), 'kelengkapan');
      } else {
        await createJenisAset(formNama.trim(), 'kelengkapan');
      }
      setModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: { nama?: string[] }; message?: string } } };
      const msg = e.response?.data?.errors?.nama?.[0] || e.response?.data?.message || 'Gagal menyimpan kelengkapan.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJenisAset(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Gagal menghapus kelengkapan.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">
          Kelola daftar kelengkapan (Tas, Charger, Case/Dus, dst) yang bisa dipilih saat checklist
          kelengkapan di form peminjaman aset.
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
        >
          <Plus size={16} />
          Tambah Kelengkapan
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada kelengkapan.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto">
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
                    <td className="px-6 py-3 text-slate-800">{item.nama}</td>
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
                          onClick={() => setDeleteTarget(item)}
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
      </div>

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Edit Kelengkapan' : 'Tambah Kelengkapan'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nama Kelengkapan</label>
                <input
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  maxLength={150}
                  placeholder="Contoh: Tas"
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
            <h3 className="text-base font-semibold text-slate-900 mb-2">Hapus Kelengkapan?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Yakin mau hapus "{deleteTarget.nama}"? Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
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
    </>
  );
}