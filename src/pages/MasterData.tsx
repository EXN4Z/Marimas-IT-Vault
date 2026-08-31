import '../index.css';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Truck, Plus, Pencil, Trash2, X, Upload, Download, Loader2, Package, Tags, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import TabInventory from '../components/masterData/TabInventory';
import TabKategori from '../components/masterData/TabKategori';
import TabKaryawan from '../components/masterData/TabKaryawan';
import TabCabang from '../components/masterData/TabCabang';
import { useAuth } from '../context/AuthContext';
import { getDepartemen, createDepartemen, updateDepartemen, deleteDepartemen, importDepartemen } from '../api/masterData/departemen';
import { getSupplier, createSupplier, updateSupplier, deleteSupplier, importSupplier } from '../api/masterData/supplier';
import { downloadStyledExcel } from '../utils/excelReport';

// Aset & Kelengkapan Aset pindahan dari Inventaris -- beda pola dari
// Departemen/Supplier (bukan CRUD nama/alamat/telepon generik), makanya
// dirender lewat komponen dedicated-nya sendiri (TabAset / TabKelengkapanAset),
// bukan lewat tabConfig generik di bawah. tabConfig cuma buat tab yang
// bentuknya sama (nama + alamat/telepon opsional).
// Kategori juga dirender lewat komponen dedicated-nya sendiri (TabKategori)
// -- bukan lewat tabConfig generik, karena cuma ada 1 kolom (nama) tanpa
// alamat/telepon. Master Kategori sudah dihapus total (tabelnya digabung
// ke `kategori`, lihat dokumen migrasi Master Kategori -> Kategori).
// Tab "Kelengkapan Inventory" sudah digabung ke tab "Inventory" (1 tabel,
// dibedain lewat kolom Kategori) -- lihat TabInventory.tsx.
type GenericTabKey = 'departemen' | 'supplier';
// BARU: 'karyawan' (Data User) & 'cabang' pindahan dari halaman /karyawan &
// /cabang -- sekarang jadi tab di Master Data juga, sepola sama Aset/Kategori
// (dirender lewat komponen dedicated-nya sendiri, bukan lewat tabConfig
// generik, karena bentuknya beda dari CRUD nama/alamat/telepon).
type CustomTabKey = 'inventory' | 'kategori' | 'karyawan' | 'cabang';
type TabKey = CustomTabKey | GenericTabKey;

// alamat & telepon cuma dipakai tab 'supplier'
type Item = { id: number; nama: string; alamat?: string | null; telepon?: string | null };
type FormPayload = { nama: string; alamat?: string; telepon?: string };

// urutan di sini nentuin urutan tab & jadi acuan "child pertama" buat
// AppLayout nentuin dropdown Master Data mana yang default aktif kalau
// URL belum punya "?tab=" -- harus samain urutannya sama children di
// AppLayout.tsx (Inventory, Kategori, Departemen, Supplier).
const TAB_KEYS: TabKey[] = ['inventory', 'kategori', 'karyawan', 'cabang', 'departemen', 'supplier'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

function isGenericTab(tab: TabKey): tab is GenericTabKey {
  return tab === 'departemen' || tab === 'supplier';
}

const STAFF_ROLES = ['admin', 'hr'];

// `roles` opsional -- kalau diisi, tab ini cuma muncul buat role yang
// disebut (dicek di bagian render ScrollableTabBar di bawah). Data User &
// Cabang admin-only, sinkron sama RoleRoute yang dulu dipasang di App.tsx
// waktu keduanya masih halaman sendiri (/karyawan, /cabang).
const CUSTOM_TABS: { key: CustomTabKey; label: string; icon: typeof Package; roles?: string[] }[] = [
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'kategori', label: 'Kategori', icon: Tags, roles: STAFF_ROLES },
  { key: 'karyawan', label: 'Data User', icon: Users, roles: ['admin'] },
  { key: 'cabang', label: 'Cabang', icon: Building2, roles: ['admin'] },
];

const tabConfig: Record<
  GenericTabKey,
  {
    label: string;
    icon: typeof Building2;
    singular: string;
    get: () => Promise<Item[]>;
    create: (payload: FormPayload) => Promise<Item>;
    update: (id: number, payload: FormPayload) => Promise<Item>;
    remove: (id: number) => Promise<{ message: string }>;
    // import/export cuma disediakan buat Departemen & Supplier.
    import?: (file: File) => Promise<{ success: boolean; message: string }>;
    exportHeaders?: string[];
    exportRow?: (item: Item) => (string | number)[];
  }
> = {
  departemen: {
    label: 'Departemen',
    icon: Building2,
    singular: 'Departemen',
    get: getDepartemen as () => Promise<Item[]>,
    create: (payload) => createDepartemen(payload.nama),
    update: (id, payload) => updateDepartemen(id, payload.nama),
    remove: deleteDepartemen,
    import: importDepartemen,
  },
  supplier: {
    label: 'Supplier',
    icon: Truck,
    singular: 'Supplier',
    get: getSupplier as () => Promise<Item[]>,
    create: (payload) => createSupplier(payload),
    update: (id, payload) => updateSupplier(id, { nama: payload.nama, alamat: payload.alamat, telepon: payload.telepon }),
    remove: deleteSupplier,
    import: importSupplier,
    exportHeaders: ['Nama', 'Alamat', 'Telepon'],
    exportRow: (item) => [item.nama, item.alamat || '', item.telepon || ''],
  },
};

export default function MasterData() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const isAdmin = !!user && user.role === 'admin';

  // BARU: helper terpusat buat nentuin siapa boleh liat tab apa -- Inventory
  // kebuka buat semua yang bisa akses Master Data, Kategori/Departemen/Supplier
  // staff-only (admin/hr), Data User & Cabang admin-only (sinkron sama
  // RoleRoute yang dulu dipasang di App.tsx waktu keduanya masih halaman
  // sendiri, /karyawan & /cabang).
  const canViewTab = (tab: TabKey): boolean => {
    if (tab === 'inventory') return true;
    if (tab === 'karyawan' || tab === 'cabang') return isAdmin;
    return isStaff;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    // kalau URL nunjuk ke tab yang gak boleh diakses role ini, paksa balik
    // ke 'inventory' daripada nolak seluruh halaman.
    if (isTabKey(fromUrl) && canViewTab(fromUrl)) return fromUrl;
    return 'inventory';
  });

  // ganti tab sekaligus sinkronin ke query param "?tab=" biar link dari sidebar
  // (dan tombol back/forward browser) nyambung ke tab yang bener.
  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // kalau user klik link dropdown sidebar yang query-nya beda (mis. lagi di tab
  // "departemen" terus klik "Supplier"), pathname sama jadi gak remount komponen —
  // effect ini yang nangkep perubahan query dan update activeTab-nya.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl) && fromUrl !== activeTab && canViewTab(fromUrl)) {
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
  const [formAlamat, setFormAlamat] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import Excel (Departemen & Supplier) & export Excel (semua tab yang
  // sudah dimuat di `items`).
  const [importLoading, setImportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // null kalau tab aktifnya Aset/Kelengkapan Aset -- keduanya dirender lewat
  // komponen dedicated-nya sendiri, bukan lewat blok tabel generik di bawah.
  const cfg = isGenericTab(activeTab) ? tabConfig[activeTab] : null;

  const loadData = async (tab: GenericTabKey) => {
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
    if (isGenericTab(activeTab)) loadData(activeTab);
  }, [activeTab]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!cfg || !file || !cfg.import) return;

    setImportLoading(true);
    try {
      const res = await cfg.import(file);
      toast.success(res.message || `Berhasil import data ${cfg.label.toLowerCase()}.`);
      loadData(activeTab as GenericTabKey);
    } catch (err: any) {
      const apiErrors: string[] | undefined = err.response?.data?.errors;
      const msg =
        (apiErrors && apiErrors[0]) ||
        err.response?.data?.message ||
        `Gagal import data ${cfg.label.toLowerCase()}.`;
      toast.error(msg);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
    }
  };

  const handleExport = async () => {
    if (!cfg || !cfg.exportHeaders || !cfg.exportRow) return;
    if (items.length === 0) {
      toast.error(`Gak ada data ${cfg.label.toLowerCase()} buat diexport.`);
      return;
    }

    setExporting(true);
    try {
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      await downloadStyledExcel(
        {
          title: `Data ${cfg.label}`,
          subtitle: `${items.length} ${cfg.label.toLowerCase()} per ${today}`,
          headers: cfg.exportHeaders,
          rows: items.map((item) => cfg.exportRow!(item)),
          sheetName: `Data ${cfg.label}`,
        },
        `Data ${cfg.label} - ${today}.xlsx`
      );
      toast.success(`${items.length} ${cfg.label.toLowerCase()} berhasil diexport.`);
    } catch (err) {
      console.error(err);
      toast.error(`Gagal export data ${cfg.label.toLowerCase()}.`);
    } finally {
      setExporting(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormAlamat('');
    setFormTelepon('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditing(item);
    setFormNama(item.nama);
    setFormAlamat(item.alamat || '');
    setFormTelepon(item.telepon || '');
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!cfg) return;
    if (!formNama.trim()) {
      setFormError('Nama tidak boleh kosong.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload: FormPayload = {
        nama: formNama.trim(),
        ...(activeTab === 'supplier' ? { alamat: formAlamat.trim(), telepon: formTelepon.trim() } : {}),
      };
      if (editing) {
        await cfg.update(editing.id, payload);
      } else {
        await cfg.create(payload);
      }
      setModalOpen(false);
      loadData(activeTab as GenericTabKey);
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
    if (!deleteTarget || !cfg) return;
    setDeleting(true);
    try {
      await cfg.remove(deleteTarget.id);
      setDeleteTarget(null);
      loadData(activeTab as GenericTabKey);
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
          {isStaff
            ? isAdmin
              ? 'Kelola data inventory, kategori, departemen, supplier, data user, dan cabang yang dipakai di seluruh sistem.'
              : 'Kelola data referensi aset, kelengkapan aset, departemen, dan supplier yang dipakai di seluruh sistem.'
            : 'Lihat inventory yang tersedia atau lagi kamu pinjam.'}
        </p>
        {cfg && (
          <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
            {cfg.exportHeaders && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {exporting ? 'Mengexport...' : 'Export Excel'}
              </button>
            )}

            {cfg.import && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importLoading}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {importLoading ? 'Mengimport...' : 'Import Excel'}
                </button>
              </>
            )}

            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
            >
              <Plus size={16} />
              Tambah {cfg.singular}
            </button>
          </div>
        )}
      </div>

      <ScrollableTabBar
        className="mb-6"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          // BARU: non-staff cuma liat tab "Inventory" -- Kategori, Data
          // User, Cabang, dan tab generik (Departemen/Supplier) dibatasi
          // lewat `roles` per-tab, sinkron sama pembatasan `roles` di child
          // sidebar (AppLayout.tsx) dan sama backend.
          ...CUSTOM_TABS.filter((t) => !t.roles || t.roles.includes(user?.role ?? '')).map((t) => ({ key: t.key, label: t.label, icon: t.icon })),
          ...(isStaff ? (Object.keys(tabConfig) as GenericTabKey[]) : []).map((key) => ({
            key,
            label: tabConfig[key].label,
            icon: tabConfig[key].icon,
          })),
        ]}
      />

      {activeTab === 'inventory' ? (
        <TabInventory onCount={() => {}} />
      ) : activeTab === 'kategori' ? (
        <TabKategori />
      ) : activeTab === 'karyawan' ? (
        <TabKaryawan />
      ) : activeTab === 'cabang' ? (
        <TabCabang />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

          {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Belum ada data {cfg?.label.toLowerCase()}.</p>
          )}

          {!loading && !error && items.length > 0 && cfg && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Nama</th>
                  {activeTab === 'supplier' && (
                    <>
                      <th className="px-6 py-3 font-medium">Alamat</th>
                      <th className="px-6 py-3 font-medium">Telepon</th>
                    </>
                  )}
                  <th className="px-6 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3 text-slate-800">{item.nama}</td>
                    {activeTab === 'supplier' && (
                      <>
                        <td className="px-6 py-3 text-slate-600">{item.alamat || '-'}</td>
                        <td className="px-6 py-3 text-slate-600">{item.telepon || '-'}</td>
                      </>
                    )}
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
      )}

      {/* MODAL TAMBAH / EDIT -- cuma relevan buat tab generik (Departemen/Supplier) */}
      {modalOpen && cfg && (
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

            {activeTab === 'supplier' && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Alamat</label>
                  <input
                    value={formAlamat}
                    onChange={(e) => setFormAlamat(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Telepon</label>
                  <input
                    value={formTelepon}
                    onChange={(e) => setFormTelepon(e.target.value)}
                    placeholder="cth. 0812xxxxxxx"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </>
            )}

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
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteTarget && cfg && (
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