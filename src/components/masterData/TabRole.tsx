import { useEffect, useRef, useState } from 'react';
import { Shield, Plus, Pencil, Trash2, Upload, Download, Loader2, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getRole, createRole, updateRole, deleteRole, importRole, type RoleItem } from '../../api/masterData/role';
import RouteModal from '../shared/RouteModal';
import Pagination from '../shared/Pagination';
import { SkeletonTable } from '../shared/skeleton';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../shared/FormControls';
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal';
import { downloadStyledExcel } from '../../utils/excelReport';

// Tab "Role" di Master Data -- CRUD data referensi role (nama, label
// tampilan, level hak akses) yang dipakai App\Models\User::hasRoleAtLeast()
// di backend (lihat routes/api.php & User.php). Admin-only, sama pola
// dengan TabCabang.tsx/TabPerusahaan.tsx, tapi paginated SERVER-SIDE
// (bukan client-side kayak tabConfig generik di MasterData.tsx) karena
// ada search & jumlah baris berpotensi tumbuh -- lihat RoleController::index().
export default function TabRole() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin';

  const [roleList, setRoleList] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formLevel, setFormLevel] = useState('1');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [importLoading, setImportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // debounce pencarian 350ms biar gak nembak request tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const loadData = async (page = currentPage) => {
    setLoading(true);
    setError('');
    try {
      const res = await getRole(page, debouncedSearch);
      setRoleList(res.data);
      setCurrentPage(res.current_page);
      setTotalPages(res.last_page);
      setTotalItems(res.total);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data role.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, debouncedSearch]);

  useEffect(() => {
    if (isStaff) loadData(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const res = await importRole(file);
      toast.success(res.message || 'Berhasil import data role.');
      loadData(1);
    } catch (err: any) {
      const apiErrors: string[] | undefined = err.response?.data?.errors;
      const msg = (apiErrors && apiErrors[0]) || err.response?.data?.message || 'Gagal import data role.';
      toast.error(msg);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export narik SEMUA baris yang cocok filter pencarian (bukan cuma
  // halaman yang lagi ditampilkan) -- beda dari tabel di layar yang
  // paginated, biar hasil Excel-nya lengkap.
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getRole(1, debouncedSearch, 1000);
      if (res.data.length === 0) {
        toast.error('Gak ada data role buat diexport.');
        return;
      }
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      await downloadStyledExcel(
        {
          title: 'Data Role',
          subtitle: `${res.data.length} role per ${today}`,
          headers: ['Nama', 'Label', 'Level', 'Jumlah User'],
          rows: res.data.map((item) => [item.nama, item.label || '', item.level, item.users_count]),
          sheetName: 'Data Role',
        },
        `Data Role - ${today}.xlsx`
      );
      toast.success(`${res.data.length} role berhasil diexport.`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data role.');
    } finally {
      setExporting(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormLabel('');
    setFormLevel('1');
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (item: RoleItem) => {
    setEditing(item);
    setFormNama(item.nama);
    setFormLabel(item.label || '');
    setFormLevel(String(item.level));
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const clearFieldError = (field: string) => {
    if (formErrors[field] || formErrors._general) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        delete next._general;
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    const clientErrors: Record<string, string> = {};
    if (!formNama.trim()) clientErrors.nama = 'Nama role wajib diisi.';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formNama.trim())) {
      clientErrors.nama = 'Cuma boleh huruf, angka, strip, dan underscore (tanpa spasi) -- ini yang bakal dipakai di kolom role user.';
    }
    if (formLevel.trim() === '' || Number.isNaN(Number(formLevel))) clientErrors.level = 'Level wajib diisi dan harus berupa angka.';
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      toast.error('Mohon lengkapi semua kolom yang wajib diisi.');
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    try {
      const payload = {
        nama: formNama.trim().toLowerCase(),
        label: formLabel.trim() || undefined,
        level: Number(formLevel),
      };
      if (editing) {
        await updateRole(editing.id, payload);
        toast.success('Data role berhasil diperbarui.');
      } else {
        await createRole(payload);
        toast.success('Role baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData(editing ? currentPage : 1);
    } catch (err: any) {
      if (err.response?.status === 422) {
        const apiErrors = err.response.data?.errors ?? {};
        setFormErrors({
          nama: apiErrors.nama?.[0],
          label: apiErrors.label?.[0],
          level: apiErrors.level?.[0],
          _general: !apiErrors.nama && !apiErrors.label && !apiErrors.level ? err.response.data?.message : undefined,
        });
      } else {
        setFormErrors({ _general: err.response?.data?.message || 'Gagal menyimpan role.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteRole(deleteTarget.id);
      toast.success('Role berhasil dihapus.');
      setDeleteTarget(null);
      // kalau ini baris terakhir di halaman ini & bukan halaman pertama,
      // mundur satu halaman biar gak nampilin halaman kosong.
      const nextPage = roleList.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      loadData(nextPage);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus role.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">
          Kelola role & level hak aksesnya -- dipakai buat menentukan hak akses tiap role selain admin (semua disamakan level 1, persis seperti karyawan).
        </p>
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Mengexport...' : 'Export Excel'}
          </button>

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

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
          >
            <Plus size={16} />
            Tambah Role
          </button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau label role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <tbody>
                <SkeletonTable columns={5} rows={5} />
              </tbody>
            </table>
          </div>
        )}

        {!loading && error && <p className="text-sm text-red-500 text-center py-12">{error}</p>}

        {!loading && !error && roleList.length === 0 && (
          <div className="p-12 text-center">
            <Shield size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Belum ada data role.</p>
          </div>
        )}

        {!loading && !error && roleList.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                    <th className="px-6 py-3 font-medium">Nama</th>
                    <th className="px-6 py-3 font-medium">Label</th>
                    <th className="px-6 py-3 font-medium">Level</th>
                    <th className="px-6 py-3 font-medium">Jumlah User</th>
                    <th className="px-6 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {roleList.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                      <td className="px-6 py-3 text-slate-800 font-medium">{item.nama}</td>
                      <td className="px-6 py-3 text-slate-600">{item.label || '-'}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {item.level}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={13} className="text-slate-400" />
                          {item.users_count}
                        </span>
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
                              setDeleteTarget(item);
                              setDeleteError('');
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

            <div className="px-6 pb-5">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
                itemLabel="role"
              />
            </div>
          </>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <RouteModal
          title={editing ? 'Edit Role' : 'Tambah Role'}
          onClose={closeModal}
          maxWidthClassName="max-w-md"
        >
          <div className="flex flex-col gap-4">
            {formErrors._general && (
              <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
                {formErrors._general}
              </p>
            )}

            <Field
              label="Nama Role"
              error={formErrors.nama}
              required
              hint="Nilai persis ini yang disimpan di kolom role user -- huruf/angka/strip/underscore, tanpa spasi."
            >
              <TextInput
                value={formNama}
                onChange={(val) => {
                  setFormNama(val);
                  clearFieldError('nama');
                }}
                placeholder="Contoh: supervisor"
                error={!!formErrors.nama}
                autoFocus
              />
            </Field>

            <Field label="Label Tampilan" error={formErrors.label} hint="Opsional, nama yang ditampilkan di UI (kalau kosong pakai Nama Role)">
              <TextInput
                value={formLabel}
                onChange={(val) => {
                  setFormLabel(val);
                  clearFieldError('label');
                }}
                placeholder="Contoh: Supervisor"
              />
            </Field>

            <Field
              label="Level"
              error={formErrors.level}
              required
              hint="Menentukan hak akses lintas role -- admin level 5, role lain sengaja disamakan level 1 (persis seperti karyawan)."
            >
              <TextInput
                value={formLevel}
                onChange={(val) => {
                  setFormLevel(val.replace(/[^0-9]/g, ''));
                  clearFieldError('level');
                }}
                placeholder="1"
                error={!!formErrors.level}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <ButtonCancel onClick={closeModal} disabled={submitting} />
              <ButtonSubmit onClick={handleSubmit} loading={submitting} loadingLabel="Menyimpan...">
                {editing ? 'Simpan Perubahan' : 'Tambah Role'}
              </ButtonSubmit>
            </div>
          </div>
        </RouteModal>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.nama || ''}
        itemType="Role"
        loading={deleting}
        errorMessage={deleteError}
        warningMessage="Role yang masih dipakai user tidak bisa dihapus."
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}