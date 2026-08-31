import { useEffect, useState } from 'react';
import { Building2, MapPin, Phone, Users, Map, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCabang, createCabang, updateCabang, deleteCabang, type Cabang } from '../../api/cabang';
import RouteModal from '../shared/RouteModal';

const STAFF_ROLES = ['admin', 'hr'];

// Dipindah dari halaman /cabang (CabangPage.tsx) -- sekarang jadi tab
// "Cabang" di dalam Master Data, sepola sama tab Inventory/Kategori/dst
// (lihat MasterData.tsx). Route /cabang lama di-redirect ke sini.
export default function TabCabang() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cabang | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Cabang | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCabang();
      setCabangList(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data cabang.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormAlamat('');
    setFormTelepon('');
    setFormLink('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: Cabang) => {
    setEditing(item);
    setFormNama(item.nama);
    setFormAlamat(item.alamat || '');
    setFormTelepon(item.telepon || '');
    setFormLink(item.link || '');
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!formNama.trim()) {
      setFormError('Nama cabang tidak boleh kosong.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        nama: formNama.trim(),
        alamat: formAlamat.trim(),
        telepon: formTelepon.trim(),
        link: formLink.trim(),
      };
      if (editing) {
        await updateCabang(editing.id, payload);
      } else {
        await createCabang(payload);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.nama?.[0] ||
        err.response?.data?.errors?.link?.[0] ||
        err.response?.data?.message ||
        'Gagal menyimpan cabang.';
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
      await deleteCabang(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus cabang.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isStaff) {
    return (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-slate-500">
          Kelola data cabang / kantor perusahaan beserta lokasi dan jumlah pegawainya.
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
        >
          <Plus size={16} />
          Tambah Cabang
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-12">Memuat data cabang...</p>}

      {!loading && error && <p className="text-sm text-red-500 text-center py-12">{error}</p>}

      {!loading && !error && cabangList.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <Building2 size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Belum ada data cabang.</p>
        </div>
      )}

      {!loading && !error && cabangList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cabangList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-slate-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{item.nama}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEditModal(item)}
                    title="Edit"
                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setDeleteTarget(item);
                      setDeleteError('');
                    }}
                    title="Hapus"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs text-slate-500">
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="flex-shrink-0 mt-0.5 text-slate-400" />
                  <span>{item.alamat || 'Alamat belum diisi'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="flex-shrink-0 text-slate-400" />
                  <span>{item.telepon || '-'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full">
                  <Users size={12} />
                  {item.pekerja_count} Pegawai
                </span>

                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700"
                  >
                    <Map size={13} />
                    Lihat Lokasi
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <RouteModal
          title={editing ? 'Edit Cabang' : 'Tambah Cabang'}
          onClose={closeModal}
          maxWidthClassName="max-w-md"
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nama Cabang</label>
              <input
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                maxLength={150}
                placeholder="Contoh: Kantor Pusat Semarang"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Alamat</label>
              <textarea
                value={formAlamat}
                onChange={(e) => setFormAlamat(e.target.value)}
                rows={2}
                placeholder="Alamat lengkap cabang..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nomor Telepon</label>
              <input
                value={formTelepon}
                onChange={(e) => setFormTelepon(e.target.value)}
                placeholder="cth. 024-1234567"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Link Lokasi (Google Maps, dsb)</label>
              <input
                value={formLink}
                onChange={(e) => setFormLink(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
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
        </RouteModal>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Hapus Cabang?</h3>
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