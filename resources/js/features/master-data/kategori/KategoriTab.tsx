import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Tags, Download, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';
import ConfirmDeleteModal from '../../../components/modal/ConfirmDeleteModal';
import Pagination from '../../../components/table/Pagination';
import SearchInput from '../../../components/form/SearchInput';
import KategoriExportModal from '../../laporan/export/KategoriExportModal';
import { router, usePage } from '@inertiajs/react';
import type { Kategori } from './types';
import { pnCard, pnEmpty, pnTable } from '../../../components/ui/pn';

// Sekarang full CRUD -- beda dari sebelumnya (read-only 2 baris fix).
// (REFACTOR KATEGORI BEBAS Fase 4: peringatan lama di sini -- yang bilang
// baris "Barang Utama"/"Kelengkapan" dipakai logic sistem lewat nama --
// sudah gak berlaku. Sejak Fase 1-2, semua logic (validasi parent_id,
// filter struktur induk/menempel, dst) murni berbasis kolom parent_id,
// gak baca nama kategori sama sekali. Kategori sekarang cuma label bebas,
// aman di-rename/hapus/tambah tanpa mempengaruhi fitur lain.)

// pagination client-side -- data kategori dimuat penuh sekali lewat
// props.kategori dari server, jadi tinggal dipotong per halaman di sini (sama pola
// yang dipakai buat tab Departemen/Supplier di GenericMasterTab.tsx).
const ITEMS_PER_PAGE = 10;

export default function TabKategori() {
  // Data dari server: MasterDataPageController -> props.kategori (hanya dikirim saat tab "kategori" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const items: Kategori[] = (usePage().props as unknown as { kategori?: Kategori[] }).kategori ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Kategori | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Kategori | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [search, setSearch] = useState('');

  // Import Excel (kolom: Nama / Nama Kategori; nama yang sudah ada dilewati).
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredItems = items.filter((item) => item.nama.toLowerCase().includes(search.toLowerCase().trim()));

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
    router.post('/master-data/kategori/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setCurrentPage(1),
      onError: (errors) => toast.error(errors.file || 'Gagal import data kategori.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

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

  const handleSubmit = async () => {
    if (!formNama.trim()) {
      setFormError('Nama kategori tidak boleh kosong!');
      return;
    }
    setSubmitting(true);
    setFormError('');

    const payload = { nama: formNama.trim() };
    // Sukses -> toast dari flash server (FlashToaster). Gagal validasi -> error bag per field.
    const options = {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setModalOpen(false);
        if (!editing) setCurrentPage(1); // biar kategori baru langsung kelihatan
      },
      onError: (errors: Record<string, string>) => toast.error(errors.nama || 'Gagal menyimpan kategori.'),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(`/master-data/kategori/${editing.id}`, payload, options);
    else router.post('/master-data/kategori', payload, options);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Sukses -> toast dari flash server. Gagal (masih dipakai Inventory) -> toast error + tutup modal.
    router.delete(`/master-data/kategori/${deleteTarget.id}`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => {
        toast.error(errors.delete || 'Gagal menghapus kategori.');
        setDeleteTarget(null);
      },
      onFinish: () => setDeleting(false),
    });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-ink-500">
          Kelola kategori aset dan inventory untuk pengelompokan jenis barang di seluruh sistem.
        </p>
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-surface border border-line-200 text-ink-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-hover-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
          >
            <Download size={16} />
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
            className="flex items-center gap-2 bg-surface border border-line-200 text-ink-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-hover-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
          >
            {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import Excel
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-solid text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-solid-hover disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs dark:!bg-white dark:!text-slate-900 dark:hover:!bg-gray-100"
          >
            <Plus size={16} />
            Tambah Kategori
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama kategori..."
          className="flex-1"
        />
      </div>

      <p className="text-xs text-ink-500 mb-4">
        Total Semua: <span className="font-semibold text-ink-900">{filteredItems.length}</span> kategori
      </p>

      <div className={pnCard}>
        {items.length === 0 && (
          <p className={pnEmpty}>Belum ada data kategori.</p>
        )}

        {items.length > 0 && filteredItems.length === 0 && (
          <p className={pnEmpty}>Kategori tidak ditemukan.</p>
        )}

        {filteredItems.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className={pnTable}>
                <thead>
                  <tr>
                    <th>Nama Kategori</th>
                    <th className="text-center">Jumlah Inventory</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">
                        {item.nama}
                      </td>
                      <td className="text-center">
                        <span className="text-ink-700 text-sm font-semibold">
                          {item.inventory_count ?? 0}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit"
                              className="p-2 text-ink-400 hover:text-ink-900 hover:bg-hover-100 rounded-lg transition"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(item);
                              }}
                              title="Hapus"
                              className="p-2 text-ink-400 hover:text-tone-red-600 hover:bg-tint-red-hover-50 rounded-lg transition"
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

            {/* Mobile Card View */}
            <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                {paginatedItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{item.nama}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Edit"
                        className="p-1.5 text-ink-400 hover:text-ink-900 hover:bg-hover-100 rounded-lg transition"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(item);
                        }}
                        title="Hapus"
                        className="p-1.5 text-ink-400 hover:text-tone-red-600 hover:bg-tint-red-hover-50 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {totalPages > 1 && (
              <div className="-mx-[18px] -mb-3 mt-1 px-6 py-3 border-t border-line-100">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredItems.length}
                  itemLabel="kategori"
                  className="pt-0 mt-0 border-t-0"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
        >
          <div className="bg-surface rounded-2xl shadow-2xl border border-line-200-a80 w-full max-w-md overflow-hidden transform transition-all animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line-100 bg-surface-50-a60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-solid text-white flex items-center justify-center shadow-sm shrink-0">
                  <Tags size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink-900">
                    {editing ? 'Edit Kategori' : 'Tambah Kategori'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-hover-100 transition disabled:opacity-40"
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
              >
                <TextInput
                  value={formNama}
                  onChange={(val) => {
                    setFormNama(val);
                    if (formError) setFormError('');
                  }}
                  autoFocus
                  placeholder="Masukkan nama kategori"
                  error={!!formError && !formNama.trim()}
                />
              </Field>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-100">
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
        warningMessage="Pastikan tidak ada aset/inventory yang sedang terkait dengan kategori ini."
        onClose={() => {
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />

      {/* MODAL EXPORT */}
      <KategoriExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={items}
      />
    </>
  );
}