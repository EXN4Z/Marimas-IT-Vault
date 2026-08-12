import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Package, Plus, Pencil, Trash2, X } from 'lucide-react';
import ScrollableTabBar from '../shared/ScrollableTabBar';
import { getJenisAset, createJenisAset, updateJenisAset, deleteJenisAset } from '../../api/jenisAset';
import {
  getKelengkapanMaster,
  createKelengkapanMaster,
  updateKelengkapanMaster,
  deleteKelengkapanMaster,
} from '../../api/kelengkapanMaster';

// Sub-tab child-class dari tab "Kategori" (Inventaris.tsx): Aset & Kelengkapan.
// Sebelumnya ini 2 tab terpisah di MasterData.tsx ("Jenis Aset" dan
// "Kelengkapan Aset") -- dipindah ke sini biar satu atap sama data
// inventaris lain, karena "kategori" nentuin dari tabel mana data diambil
// pas Tambah Aset (tab Aset -> jenis_aset) atau pas checklist kelengkapan
// di form peminjaman (tab Kelengkapan -> kelengkapan_master).
type SubTabKey = 'aset' | 'kelengkapan';

const SUB_TAB_KEYS: SubTabKey[] = ['aset', 'kelengkapan'];

function isSubTabKey(value: string | null): value is SubTabKey {
  return !!value && (SUB_TAB_KEYS as string[]).includes(value);
}

type Item = { id: number; nama: string };

const subTabConfig: Record<
  SubTabKey,
  {
    label: string;
    icon: typeof Boxes;
    singular: string;
    emptyText: string;
    get: () => Promise<Item[]>;
    create: (nama: string) => Promise<Item>;
    update: (id: number, nama: string) => Promise<Item>;
    remove: (id: number) => Promise<{ message: string }>;
  }
> = {
  aset: {
    label: 'Aset',
    icon: Boxes,
    singular: 'Jenis Aset',
    emptyText: 'Belum ada jenis aset.',
    get: getJenisAset,
    create: createJenisAset,
    update: updateJenisAset,
    remove: deleteJenisAset,
  },
  kelengkapan: {
    label: 'Kelengkapan',
    icon: Package,
    singular: 'Kelengkapan',
    emptyText: 'Belum ada kelengkapan.',
    get: getKelengkapanMaster,
    create: createKelengkapanMaster,
    update: updateKelengkapanMaster,
    remove: deleteKelengkapanMaster,
  },
};

export default function TabKategori() {
  const [searchParams, setSearchParams] = useSearchParams();

  // query param terpisah dari tab utama ("?tab=kategori&sub=kelengkapan")
  // biar link dropdown sidebar bisa langsung nunjuk ke sub-tab tertentu
  // tanpa nabrak param "tab" milik Inventaris.tsx.
  const [activeSubTab, setActiveSubTabState] = useState<SubTabKey>(() => {
    const fromUrl = searchParams.get('sub');
    return isSubTabKey(fromUrl) ? fromUrl : 'aset';
  });

  const setActiveSubTab = (sub: SubTabKey) => {
    setActiveSubTabState(sub);
    const next = new URLSearchParams(searchParams);
    next.set('sub', sub);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const fromUrl = searchParams.get('sub');
    if (isSubTabKey(fromUrl) && fromUrl !== activeSubTab) {
      setActiveSubTabState(fromUrl);
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

  const cfg = subTabConfig[activeSubTab];

  const loadData = async (sub: SubTabKey) => {
    setLoading(true);
    setError('');
    try {
      const data = await subTabConfig[sub].get();
      setItems(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError(`Gagal memuat data ${subTabConfig[sub].label.toLowerCase()}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeSubTab);
  }, [activeSubTab]);

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
      loadData(activeSubTab);
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
      loadData(activeSubTab);
    } catch (err: any) {
      setError(err.response?.data?.message || `Gagal menghapus ${cfg.singular.toLowerCase()}.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">
          Kelola kategori aset: tab <span className="font-medium text-slate-700">Aset</span> untuk jenis aset
          utama (Laptop, Speaker, Proyektor, dst), tab{' '}
          <span className="font-medium text-slate-700">Kelengkapan</span> untuk aksesoris yang menyertai aset
          (Tas, Charger, dst).
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
        >
          <Plus size={16} />
          Tambah {cfg.singular}
        </button>
      </div>

      <ScrollableTabBar
        className="mb-6"
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        tabs={(Object.keys(subTabConfig) as SubTabKey[]).map((key) => ({
          key,
          label: subTabConfig[key].label,
          icon: subTabConfig[key].icon,
        }))}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">{cfg.emptyText}</p>
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
                  placeholder={`Contoh: ${activeSubTab === 'aset' ? 'Laptop' : 'Tas'}`}
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
    </>
  );
}