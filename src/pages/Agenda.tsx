import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getAgendaMendatang, createAgenda, deleteAgenda, type AgendaItem } from '../api/agenda';

const STAFF_ROLES = ['admin', 'hr'];

function formatTanggal(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJam(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function Agenda() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartAt, setFormStartAt] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AgendaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAgendaMendatang(50);
      setItems(data);
    } catch (err) {
      setError('Gagal memuat data agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormStartAt('');
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formStartAt) {
      setFormError('Judul dan tanggal/waktu wajib diisi.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await createAgenda({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        start_at: formStartAt,
      });
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan agenda.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgenda(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      setError('Gagal menghapus agenda.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // grup agenda per tanggal biar enak dibaca
  const grouped = items.reduce<Record<string, AgendaItem[]>>((acc, item) => {
    const key = new Date(item.start_at).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <AppLayout title="Agenda">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500 max-w-lg">
          Daftar agenda dan kegiatan mendatang perusahaan, diurutkan dari yang paling dekat.
        </p>
        {isStaff && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
          >
            <Plus size={16} />
            Tambah Agenda
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat agenda...</p>}

      {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <CalendarDays className="mx-auto text-slate-300 mb-2" size={28} />
          <p className="text-sm text-slate-400">Belum ada agenda mendatang.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([dateKey, agendaOnDate]) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {formatTanggal(agendaOnDate[0].start_at)}
              </p>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-50">
                {agendaOnDate.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4">
                    <div className="w-16 flex-shrink-0 text-sm font-semibold text-slate-900">
                      {formatJam(item.start_at)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {isStaff && (
                      <button
                        onClick={() => setDeleteTarget(item)}
                        title="Hapus"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL TAMBAH AGENDA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Tambah Agenda</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Judul</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  maxLength={150}
                  placeholder="Contoh: Rapat evaluasi bulanan"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Tanggal & Waktu</label>
                <input
                  type="datetime-local"
                  value={formStartAt}
                  onChange={(e) => setFormStartAt(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Deskripsi (opsional)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Detail agenda..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
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
                {submitting ? 'Menyimpan...' : 'Simpan Agenda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Hapus Agenda?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Yakin mau hapus agenda "{deleteTarget.title}"? Tindakan ini tidak bisa dibatalkan.
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
    </AppLayout>
  );
}