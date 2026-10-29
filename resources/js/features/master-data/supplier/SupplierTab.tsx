import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Download, Loader2, AlertCircle, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';
import ConfirmDeleteModal from '../../../components/modal/ConfirmDeleteModal';
import Pagination from '../../../components/table/Pagination';
import SearchInput from '../../../components/form/SearchInput';
import { downloadStyledExcel } from '../../../lib/export/excelReport';
import { useBackdropClose } from '../../../hooks/useBackdropClose';
import { router, usePage } from '@inertiajs/react';
import type { Supplier } from './types';

// Tab Supplier = CRUD nama + alamat + telepon. Semua UI & logikanya ada di
// file ini (tabel, search, pagination, modal tambah/edit, hapus, import/export Excel).

// pagination client-side -- data dimuat penuh sekali lewat props.supplier (server),
// tinggal dipotong per halaman di sini (pola yang sama dipakai di TabKategori).
const ITEMS_PER_PAGE = 10;

export default function TabSupplier() {
  // Data dari server: MasterDataPageController -> props.supplier (hanya dikirim saat tab "supplier" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const items: Supplier[] = (usePage().props as unknown as { supplier?: Supplier[] }).supplier ?? [];

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

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    // Sukses -> toast dari flash server (FlashToaster). Gagal -> error bag "file".
    router.post('/master-data/supplier/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data supplier.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
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
      setFormError('Nama supplier tidak boleh kosong!');
      return;
    }
    setSubmitting(true);
    setFormError('');

    const payload = {
      nama: formNama.trim(),
      alamat: formAlamat.trim(),
      telepon: formTelepon.trim(),
    };
    // Sukses -> toast dari flash server (FlashToaster). Gagal validasi -> error bag per field.
    const options = {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setModalOpen(false);
        if (!editing) setCurrentPage(1); // biar data baru langsung kelihatan
      },
      onError: (errors: Record<string, string>) =>
        setFormError(errors.nama || errors.alamat || errors.telepon || 'Gagal menyimpan supplier.'),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(`/master-data/supplier/${editing.id}`, payload, options);
    else router.post('/master-data/supplier', payload, options);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Sukses -> toast dari flash server. Gagal -> toast error + tutup modal (perilaku lama).
    router.delete(`/master-data/supplier/${deleteTarget.id}`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => {
        toast.error(errors.delete || 'Gagal menghapus supplier.');
        setDeleteTarget(null);
      },
      onFinish: () => setDeleting(false),
    });
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
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs dark:!bg-white dark:!text-slate-900 dark:hover:!bg-gray-100"
            >
              <Plus size={16} />
              Tambah Supplier
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, alamat, atau telepon supplier..."
            className="flex-1"
          />
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Total Semua: <span className="font-semibold text-slate-900">{filteredItems.length}</span> supplier
        </p>

        <div className="pn-card">
          {items.length === 0 && (
            <p className="pn-empty">Belum ada data supplier.</p>
          )}

          {items.length > 0 && filteredItems.length === 0 && (
            <p className="pn-empty">Supplier tidak ditemukan.</p>
          )}

          {filteredItems.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block pn-scroll">
                <table className="pn-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Alamat</th>
                      <th>Telepon</th>
                      <th className="pn-r">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium">{item.nama}</td>
                        <td className="text-slate-600 max-w-[240px] truncate">{item.alamat || '-'}</td>
                        <td className="text-slate-600 whitespace-nowrap">{item.telepon || '-'}</td>
                        <td>
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
                <div className="-mx-[18px] -mb-3 mt-1 px-6 py-3 border-t border-slate-100">
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
              >
                <TextInput
                  value={formNama}
                  onChange={(val) => {
                    setFormNama(val);
                    if (formError) setFormError('');
                  }}
                  autoFocus
                  placeholder="Masukkan nama supplier"
                  error={!!formError && !formNama.trim()}
                />
              </Field>

              <Field label="Alamat Kantor / Gudang">
                <TextInput
                  value={formAlamat}
                  onChange={setFormAlamat}
                  placeholder="Masukkan alamat kantor atau gudang supplier"
                />
              </Field>

              <Field label="Nomor Kontak / Telepon">
                <TextInput
                  value={formTelepon}
                  onChange={setFormTelepon}
                  placeholder="Masukkan nomor kontak atau telepon supplier"
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