import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, BriefcaseBusiness, Tags, Plus, Pencil, Trash2, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getDepartemen, createDepartemen, updateDepartemen, deleteDepartemen } from '../api/departemen';
import { getJabatan, createJabatan, updateJabatan, deleteJabatan } from '../api/jabatan';
import {
  getKategoriBarang,
  createKategoriBarang,
  updateKategoriBarang,
  deleteKategoriBarang,
} from '../api/kategoriBarang';

type TabKey = 'departemen' | 'jabatan' | 'kategori';
type Item = { id: number; nama: string };

const TAB_KEYS: TabKey[] = ['departemen', 'jabatan', 'kategori'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

const STAFF_ROLES = ['admin', 'hr'];

const tabConfig: Record<
  TabKey,
  {
    label: string;
    icon: typeof Building2;
    singular: string;
    get: () => Promise<Item[]>;
    create: (nama: string) => Promise<Item>;
    update: (id: number, nama: string) => Promise<Item>;
    remove: (id: number) => Promise<{ message: string }>;
  }
> = {
  departemen: {
    label: 'Departemen',
    icon: Building2,
    singular: 'Departemen',
    get: getDepartemen as () => Promise<Item[]>,
    create: createDepartemen,
    update: updateDepartemen,
    remove: deleteDepartemen,
  },
  jabatan: {
    label: 'Jabatan',
    icon: BriefcaseBusiness,
    singular: 'Jabatan',
    get: getJabatan as () => Promise<Item[]>,
    create: createJabatan,
    update: updateJabatan,
    remove: deleteJabatan,
  },
  kategori: {
    label: 'Kategori Barang',
    icon: Tags,
    singular: 'Kategori',
    get: getKategoriBarang as () => Promise<Item[]>,
    create: createKategoriBarang,
    update: updateKategoriBarang,
    remove: deleteKategoriBarang,
  },
};

export default function MasterData() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    return isTabKey(fromUrl) ? fromUrl : 'departemen';
  });

  // ganti tab sekaligus sinkronin ke query param "?tab=" biar link dari sidebar
  // (dan tombol back/forward browser) nyambung ke tab yang bener.
  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // kalau user klik link dropdown sidebar yang query-nya beda (mis. lagi di tab
  // "departemen" terus klik "Jabatan"), pathname sama jadi gak remount komponen —
  // effect ini yang nangkep perubahan query dan update activeTab-nya.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl) && fromUrl !== activeTab) {
      setActiveTabState(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  const cfg = tabConfig[activeTab];

  const loadData = async (tab: TabKey) => {
    setLoading(true);
    setError('');
    try {
      const data = await tabConfig[tab].get();
      setItems(data as unknown as Item[]);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError(`Gagal memuat data ${tabConfig[tab].label.toLowerCase()}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: Item) => {
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
        await cfg.update(editing.id, formNama.trim());
      } else {
        await cfg.create(formNama.trim());
      }
      setModalOpen(false);
      loadData(activeTab);
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.nama?.[0] ||
        err.response?.data?.message ||
        `Gagal menyimpan ${cfg.singular.toLowerCase()}.`;
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await cfg.remove(deleteTarget.id);
      setDeleteTarget(null);
      loadData(activeTab);
    } catch (err: any) {
      setError(err.response?.data?.message || `Gagal menghapus ${cfg.singular.toLowerCase()}.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!isStaff) {
    return (
      <AppLayout title="Master Data">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Master Data">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Kelola data referensi departemen, jabatan, dan kategori barang yang dipakai di seluruh sistem.
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
        >
          <Plus size={16} />
          Tambah {cfg.singular}
        </button>
      </div>

      <nav className="mb-6">
        <ul className="flex items-center gap-6 border-b border-slate-200">
          {(Object.keys(tabConfig) as TabKey[]).map((key) => {
            const Icon = tabConfig[key].icon;
            return (
              <li key={key}>
                <button
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    activeTab === key
                      ? 'border-slate-900 text-slate-900 font-medium'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon size={16} />
                  {tabConfig[key].label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada data {cfg.label.toLowerCase()}.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
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
        )}
      </div>

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? `Edit ${cfg.singular}` : `Tambah ${cfg.singular}`}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nama {cfg.singular}</label>
                <input
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  maxLength={150}
                  placeholder={`Contoh: ${cfg.label}`}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Hapus {cfg.singular}?</h3>
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
    </AppLayout>
  );
}