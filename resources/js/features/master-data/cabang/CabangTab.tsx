import { useEffect, useRef, useState } from 'react';
import { Map, Plus, Pencil, Trash2, Upload, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { router, usePage } from '@inertiajs/react';
import type { Cabang } from './types';
import Modal from '../../../components/modal/Modal';
import { Field, TextInput, Textarea, ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';
import ConfirmDeleteModal from '../../../components/modal/ConfirmDeleteModal';
import Pagination from '../../../components/table/Pagination';
import SearchInput from '../../../components/form/SearchInput';
import { downloadStyledExcel } from '../../../lib/export/excelReport';
import { toastFormErrors } from '../../../lib/toastErrors';
import { pnCard, pnEmpty, pnTable } from '../../../components/ui/pn';

// pagination client-side -- data cabang dimuat penuh sekali lewat
// props.cabang dari server, tinggal dipotong per halaman di sini (sama pola yang
// dipakai TabKategori.tsx / TabKaryawan.tsx).
const ITEMS_PER_PAGE = 10;

// Dipindah dari halaman /cabang (CabangPage.tsx) -- sekarang jadi tab
// "Cabang" di dalam Master Data, sepola sama tab Inventory/Kategori/dst
// (lihat MasterData.tsx). Route /cabang lama di-redirect ke sini.
// Admin-only, sinkron sama backend (routes/api.php: apiResource('cabang')
// ada di dalam grup 'role:admin' murni). Semua role selain admin (hr
// termasuk) disamakan persis seperti karyawan -- yaitu TIDAK punya akses.
export default function TabCabang() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin';

  // Data dari server: MasterDataPageController -> props.cabang (hanya dikirim saat tab "cabang" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const cabangList: Cabang[] = (usePage().props as unknown as { cabang?: Cabang[] }).cabang ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cabang | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);


  const [deleteTarget, setDeleteTarget] = useState<Cabang | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  // Import Excel & export Excel -- sepola sama TabPerusahaan.tsx (yang
  // sebelumnya udah lebih dulu punya fitur ini, harusnya mirror persis
  // dari sini tapi kelewat waktu dibikin).
  const [importLoading, setImportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCabang = cabangList.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.nama.toLowerCase().includes(q) ||
      (item.alamat || '').toLowerCase().includes(q) ||
      (item.telepon || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCabang.length / ITEMS_PER_PAGE));
  const paginatedCabang = filteredCabang.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
    router.post('/master-data/cabang/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data cabang.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

  const handleExport = async () => {
    if (cabangList.length === 0) {
      toast.error('Gak ada data cabang buat diexport.');
      return;
    }

    setExporting(true);
    try {
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      await downloadStyledExcel(
        {
          title: 'Data Cabang',
          subtitle: `${cabangList.length} cabang per ${today}`,
          headers: ['Nama', 'Alamat', 'Telepon', 'Link'],
          rows: cabangList.map((item) => [item.nama, item.alamat || '', item.telepon || '', item.link || '']),
          sheetName: 'Data Cabang',
        },
        `Data Cabang - ${today}.xlsx`
      );
      toast.success(`${cabangList.length} cabang berhasil diexport.`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data cabang.');
    } finally {
      setExporting(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setFormNama('');
    setFormAlamat('');
    setFormTelepon('');
    setFormLink('');
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (item: Cabang) => {
    setEditing(item);
    setFormNama(item.nama);
    setFormAlamat(item.alamat || '');
    setFormTelepon(item.telepon || '');
    setFormLink(item.link || '');
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
    if (!formNama.trim()) clientErrors.nama = 'Nama cabang tidak boleh kosong!';
    if (!formAlamat.trim()) clientErrors.alamat = 'Alamat cabang tidak boleh kosong!';
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      toastFormErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    const payload = {
      nama: formNama.trim(),
      alamat: formAlamat.trim(),
      telepon: formTelepon.trim(),
      link: formLink.trim(),
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
        setFormErrors({
          nama: errors.nama,
          alamat: errors.alamat,
          telepon: errors.telepon,
          link: errors.link,
        }),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(`/master-data/cabang/${editing.id}`, payload, options);
    else router.post('/master-data/cabang', payload, options);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Sukses -> toast dari flash server. Gagal (mis. masih ada relasi) -> toast error + tutup modal.
    router.delete(`/master-data/cabang/${deleteTarget.id}`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => {
        toast.error(errors.delete || 'Gagal menghapus cabang.');
        setDeleteTarget(null);
      },
      onFinish: () => setDeleting(false),
    });
  };

  if (!isStaff) {
    return (
        <div className="bg-surface rounded-xl p-8 shadow-sm border border-line-200 text-center">
          <p className="text-sm text-ink-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-ink-500">
          Kelola data cabang / kantor perusahaan beserta lokasi.
        </p>
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-surface border border-line-200 text-ink-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-hover-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
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
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2 bg-surface border border-line-200 text-ink-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-hover-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
          >
            {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {importLoading ? 'Mengimport...' : 'Import Excel'}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-solid text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-solid-hover transition shadow-xs flex-shrink-0 dark:!bg-white dark:!text-slate-900 dark:hover:!bg-gray-100"
          >
            <Plus size={16} />
            Tambah Cabang
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line-200">
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, alamat, atau telepon cabang..."
            className="w-full"
          />
        </div>

        <p className="text-xs text-ink-500 mb-4">
          Total Semua: <span className="font-semibold text-ink-900">{filteredCabang.length}</span> cabang
        </p>

        <div className={pnCard}>
          {cabangList.length === 0 && (
            <p className={pnEmpty}>Belum ada data cabang.</p>
          )}

          {cabangList.length > 0 && filteredCabang.length === 0 && (
            <p className={pnEmpty}>Cabang tidak ditemukan.</p>
          )}

          {filteredCabang.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className={pnTable}>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Alamat</th>
                      <th>Telepon</th>
                      <th>Lokasi</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCabang.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium">{item.nama}</td>
                        <td className="text-ink-600 max-w-[280px] truncate">{item.alamat || '-'}</td>
                        <td className="text-ink-600 whitespace-nowrap">{item.telepon || '-'}</td>
                        <td className="whitespace-nowrap">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-tone-sky-600 hover:text-tone-sky-700"
                            >
                              <Map size={13} />
                              Lihat Lokasi
                            </a>
                          ) : (
                            <span className="text-ink-400">-</span>
                          )}
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

              {/* Mobile List View */}
              <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                {paginatedCabang.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900 truncate">{item.nama}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                          className="p-1.5 text-ink-400 hover:text-ink-900 hover:bg-hover-100 rounded-lg transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(item);
                          }}
                          title="Hapus"
                          className="p-1.5 text-ink-400 hover:text-tone-red-600 hover:bg-tint-red-hover-50 rounded-lg transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {(item.alamat || item.telepon) && (
                      <div className="text-xs text-ink-500 space-y-0.5">
                        {item.alamat && <p className="truncate">{item.alamat}</p>}
                        {item.telepon && <p>{item.telepon}</p>}
                      </div>
                    )}
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-tone-sky-600 hover:text-tone-sky-700"
                      >
                        <Map size={13} />
                        Lihat Lokasi
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="-mx-[18px] -mb-3 mt-1 px-6 py-3 border-t border-line-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={filteredCabang.length}
                    itemLabel="cabang"
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
        <Modal
          title={editing ? 'Edit Cabang' : 'Tambah Cabang'}
          onClose={closeModal}
          maxWidthClassName="max-w-md"
        >
          <div className="flex flex-col gap-4">
            {formErrors._general && (
              <p className="flex items-center gap-2 text-sm text-tone-red-700 bg-tint-red-50 border border-edge-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
                {formErrors._general}
              </p>
            )}

            <Field label="Nama Cabang" error={formErrors.nama} required>
              <TextInput
                value={formNama}
                onChange={(val) => {
                  setFormNama(val);
                  clearFieldError('nama');
                }}
                error={!!formErrors.nama}
                placeholder="Masukkan nama cabang"
                autoFocus
              />
            </Field>

            <Field label="Alamat Lengkap" error={formErrors.alamat} required>
              <Textarea
                value={formAlamat}
                onChange={(val) => {
                  setFormAlamat(val);
                  clearFieldError('alamat');
                }}
                rows={2}
                placeholder="Masukkan alamat lengkap cabang"
                error={!!formErrors.alamat}
              />
            </Field>

            <Field label="Nomor Telepon" error={formErrors.telepon}>
              <TextInput
                value={formTelepon}
                onChange={(val) => {
                  setFormTelepon(val);
                  clearFieldError('telepon');
                }}
                error={!!formErrors.telepon}
                placeholder="Masukkan nomor telepon cabang"
                type="tel"
              />
            </Field>

            <Field label="Link Lokasi Peta (Google Maps)" error={formErrors.link}>
              <TextInput
                value={formLink}
                onChange={(val) => {
                  setFormLink(val);
                  clearFieldError('link');
                }}
                error={!!formErrors.link}
                placeholder="Tempel link Google Maps lokasi cabang"
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-100">
              <ButtonCancel onClick={closeModal} disabled={submitting} />
              <ButtonSubmit onClick={handleSubmit} loading={submitting} loadingLabel="Menyimpan...">
                {editing ? 'Simpan Perubahan' : 'Tambah Cabang'}
              </ButtonSubmit>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.nama || ''}
        itemType="Cabang"
        loading={deleting}
        warningMessage="Pastikan tidak ada data karyawan atau inventaris yang tertaut dengan cabang ini."
        onClose={() => {
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}