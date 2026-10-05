import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Download, Loader2, AlertCircle, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../shared/FormControls';
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal';
import { SkeletonTable } from '../shared/skeleton';
import Pagination from '../shared/Pagination';
import SearchInput from '../shared/SearchInput';
import { downloadStyledExcel } from '../../utils/excelReport';
import { useBackdropClose } from '../../hooks/useBackdropClose';
import {
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  importSupplier,
  type Supplier,
} from '../../api/masterData/supplier';

// Tab Supplier = CRUD nama + alamat + telepon. Semua UI & logikanya ada di
// file ini (tabel, search, pagination, modal tambah/edit, hapus, import/export Excel).

// pagination client-side -- data dimuat penuh sekali lewat getSupplier(),
// tinggal dipotong per halaman di sini (pola yang sama dipakai di TabKategori).
const ITEMS_PER_PAGE = 10;

export default function TabSupplier() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import Excel & export Excel (export baca dari `items` yang sudah dimuat).
  const [importLoading, setImportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  // Catatan: state (search, halaman, modal) otomatis ke-reset tiap pindah tab
  // karena MasterData me-render komponen tab yang beda -> remount.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getSupplier());
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data supplier.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.nama.toLowerCase().includes(q) ||
      (item.alamat || '').toLowerCase().includes(q) ||
      (item.telepon || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // kalau data berkurang (mis. abis hapus item terakhir di halaman
  // terakhir, atau abis ngetik kata kunci search), pastikan currentPage
  // gak nyangkut di halaman kosong.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // balik ke halaman 1 tiap kali kata kunci search berubah.
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const res = await importSupplier(file);
      toast.success(res.message || 'Berhasil import data supplier.');
      loadData();
    } catch (err: any) {
      const apiErrors: string[] | undefined = err.response?.data?.errors;
      const msg = (apiErrors && apiErrors[0]) || err.response?.data?.message || 'Gagal import data supplier.';
      toast.error(msg);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
    }
  };

  const handleExport = async () => {
    if (items.length === 0) {
      toast.error('Gak ada data supplier buat diexport.');
      return;
    }

    setExporting(true);
    try {
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      await downloadStyledExcel(
        {
          title: 'Data Supplier',
          subtitle: `${items.length} supplier per ${today}`,
          headers: ['Nama', 'Alamat', 'Telepon'],
          rows: items.map((item) => [item.nama, item.alamat || '', item.telepon || '']),
          sheetName: 'Data Supplier',
        },
        `Data Supplier - ${today}.xlsx`
      );
      toast.success(`${items.length} supplier berhasil diexport.`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data supplier.');
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

  const openEditModal = (item: Supplier) => {
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

  const backdropModal = useBackdropClose(closeModal);

  const handleSubmit = async () => {
    if (!formNama.trim()) {
      setFormError('Nama supplier wajib diisi.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        nama: formNama.trim(),
        alamat: formAlamat.trim(),
        telepon: formTelepon.trim(),
      };
      if (editing) {
        await updateSupplier(editing.id, payload);
        toast.success('Supplier berhasil diperbarui.');
      } else {
        await createSupplier(payload);
        toast.success('Supplier berhasil ditambahkan.');
        setCurrentPage(1); // biar data baru langsung kelihatan
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.nama?.[0] || err.response?.data?.message || 'Gagal menyimpan supplier.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      toast.success('Supplier berhasil dihapus.');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus supplier.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <p className="text-sm text-slate-500">Kelola data supplier yang dipakai di seluruh sistem.</p>
          <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export Excel
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
            >
              {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import Excel
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs"
            >
              <Plus size={16} />
              Tambah Supplier
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari nama, alamat, atau telepon supplier..."
              className="flex-1"
            />
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {loading && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/50">
                      <th className="px-6 py-3.5 font-medium">Nama</th>
                      <th className="px-6 py-3.5 font-medium">Alamat</th>
                      <th className="px-6 py-3.5 font-medium">Telepon</th>
                      <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SkeletonTable columns={4} rows={5} />
                  </tbody>
                </table>
              </div>
            )}

            {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

            {!loading && !error && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada data supplier.</p>
            )}

            {!loading && !error && items.length > 0 && filteredItems.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Supplier tidak ditemukan.</p>
            )}

            {!loading && !error && filteredItems.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/50">
                        <th className="px-6 py-3.5 font-medium">Nama</th>
                        <th className="px-6 py-3.5 font-medium">Alamat</th>
                        <th className="px-6 py-3.5 font-medium">Telepon</th>
                        <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                          <td className="px-6 py-3.5 text-slate-800 font-medium">{item.nama}</td>
                          <td className="px-6 py-3.5 text-slate-600 max-w-[240px] truncate">{item.alamat || '-'}</td>
                          <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">{item.telepon || '-'}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title="Edit"
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
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

                {/* Mobile List View */}
                <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                  {paginatedItems.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{item.nama}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="Hapus"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {(item.alamat || item.telepon) && (
                        <div className="text-xs text-slate-500 space-y-0.5">
                          {item.alamat && <p className="truncate">{item.alamat}</p>}
                          {item.telepon && <p>{item.telepon}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="px-6 py-3 border-t border-slate-100">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      totalItems={filteredItems.length}
                      itemLabel="supplier"
                      className="pt-0 mt-0 border-t-0"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

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
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editing ? 'Edit Supplier' : 'Tambah Supplier'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editing ? 'Perbarui data supplier' : 'Isi data supplier baru'}
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
                label="Nama Supplier"
                required
                error={formError && !formNama.trim() ? formError : undefined}
                hint=""
              >
                <TextInput
                  value={formNama}
                  onChange={(val) => {
                    setFormNama(val);
                    if (formError) setFormError('');
                  }}
                  placeholder="Contoh: PT Sumber Makmur Solusindo"
                  autoFocus
                  error={!!formError && !formNama.trim()}
                />
              </Field>

              <Field label="Alamat Kantor / Gudang" hint="">
                <TextInput
                  value={formAlamat}
                  onChange={setFormAlamat}
                  placeholder="Contoh: Jl. Pahlawan No. 45, Semarang"
                />
              </Field>

              <Field label="Nomor Kontak / Telepon" hint="">
                <TextInput
                  value={formTelepon}
                  onChange={setFormTelepon}
                  placeholder="Contoh: 0812-3456-7890 / 024-8765432"
                  type="tel"
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
                  {editing ? 'Simpan Perubahan' : 'Tambah Supplier'}
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
        itemType="Supplier"
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}