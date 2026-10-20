import { useEffect, useRef, useState } from 'react';
import { Building2, MapPin, Phone, Map, Plus, Pencil, Trash2, Upload, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { router, usePage } from '@inertiajs/react';
import type { Perusahaan } from './types';
import Modal from '../../../components/modal/Modal';
import { Field, TextInput, Textarea, ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';
import ConfirmDeleteModal from '../../../components/modal/ConfirmDeleteModal';
import Pagination from '../../../components/table/Pagination';
import SearchInput from '../../../components/form/SearchInput';
import { downloadStyledExcel } from '../../../lib/export/excelReport';

// pagination client-side -- data perusahaan dimuat penuh sekali lewat
// props.perusahaan dari server, tinggal dipotong per halaman di sini (sama pola yang
// dipakai TabCabang.tsx / TabKategori.tsx).
const ITEMS_PER_PAGE = 10;

// Mirror dari TabCabang.tsx -- sepola sama tab "Cabang" di Master Data,
// tapi TANPA badge jumlah pegawai & TANPA warning "masih ada karyawan/
// inventaris tertaut" saat hapus, karena Perusahaan sengaja belum
// dikaitkan ke tabel lain (lihat api/perusahaan.ts).
// Admin-only, sinkron sama backend (routes/api.php: apiResource('perusahaan')
// ada di dalam grup 'role:admin' murni). Semua role selain admin (hr
// termasuk) disamakan persis seperti karyawan -- yaitu TIDAK punya akses,
// jadi di sini gak ada lagi STAFF_ROLES yang ngasih hr pengecualian.
export default function TabPerusahaan() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin';

  // Data dari server: MasterDataPageController -> props.perusahaan (hanya dikirim saat tab "perusahaan" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const perusahaanList: Perusahaan[] = (usePage().props as unknown as { perusahaan?: Perusahaan[] }).perusahaan ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Perusahaan | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Perusahaan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  // Import Excel & export Excel -- sepola sama tabConfig generik di
  // MasterData.tsx (Departemen/Supplier), tapi disematkan langsung di sini
  // karena Perusahaan adalah custom tab (dirender sendiri, bukan lewat
  // tabConfig).
  const [importLoading, setImportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredPerusahaan = perusahaanList.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.nama.toLowerCase().includes(q) ||
      (item.alamat || '').toLowerCase().includes(q) ||
      (item.telepon || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredPerusahaan.length / ITEMS_PER_PAGE));
  const paginatedPerusahaan = filteredPerusahaan.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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


  //salin data ke cabang

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    // Sukses -> toast dari flash server (FlashToaster). Gagal -> error bag "file".
    router.post('/master-data/perusahaan/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data perusahaan.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

  const handleExport = async () => {
    if (perusahaanList.length === 0) {
      toast.error('Gak ada data perusahaan buat diexport.');
      return;
    }

    setExporting(true);
    try {
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      await downloadStyledExcel(
        {
          title: 'Data Perusahaan',
          subtitle: `${perusahaanList.length} perusahaan per ${today}`,
          headers: ['Nama', 'Alamat', 'Telepon', 'Link'],
          rows: perusahaanList.map((item) => [item.nama, item.alamat || '', item.telepon || '', item.link || '']),
          sheetName: 'Data Perusahaan',
        },
        `Data Perusahaan - ${today}.xlsx`
      );
      toast.success(`${perusahaanList.length} perusahaan berhasil diexport.`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data perusahaan.');
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

  const openEditModal = (item: Perusahaan) => {
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
    if (!formNama.trim()) clientErrors.nama = 'Nama perusahaan wajib diisi.';
    if (!formAlamat.trim()) clientErrors.alamat = 'Alamat perusahaan wajib diisi.';
    if (!formTelepon.trim()) clientErrors.telepon = 'Nomor telepon perusahaan wajib diisi.';
    if (!formLink.trim()) clientErrors.link = 'Link lokasi Google Maps wajib diisi.';
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      toast.error('Mohon lengkapi semua kolom yang wajib diisi.');
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

    if (editing) router.put(`/master-data/perusahaan/${editing.id}`, payload, options);
    else router.post('/master-data/perusahaan', payload, options);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    // Sukses -> toast dari flash server. Gagal (mis. masih ada relasi) -> error bag "delete", tampil di modal.
    router.delete(`/master-data/perusahaan/${deleteTarget.id}`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => setDeleteError(errors.delete || 'Gagal menghapus perusahaan.'),
      onFinish: () => setDeleting(false),
    });
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
          Kelola data perusahaan beserta lokasi kantornya.
        </p>
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
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
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
          >
            {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {importLoading ? 'Mengimport...' : 'Import Excel'}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs flex-shrink-0"
          >
            <Plus size={16} />
            Tambah Perusahaan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, alamat, atau telepon perusahaan..."
            className="w-full"
          />
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Total Semua: <span className="font-semibold text-slate-900">{filteredPerusahaan.length}</span> perusahaan
        </p>

        {perusahaanList.length === 0 && (
          <div className="rounded-xl p-12 text-center bg-slate-50 border border-dashed border-slate-200">
            <Building2 size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Belum ada data perusahaan.</p>
          </div>
        )}

        {perusahaanList.length > 0 && filteredPerusahaan.length === 0 && (
          <div className="rounded-xl p-12 text-center bg-slate-50 border border-dashed border-slate-200">
            <Building2 size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Perusahaan tidak ditemukan.</p>
          </div>
        )}

        {filteredPerusahaan.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedPerusahaan.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50/60 rounded-xl p-5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-slate-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{item.nama}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      title="Edit"
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
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

                {item.link && (
                  <div className="flex items-center justify-end pt-3 border-t border-slate-200">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      <Map size={13} />
                      Lihat Lokasi
                    </a>
                  </div>
                )}
              </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredPerusahaan.length}
                  itemLabel="perusahaan"
                  className="pt-0 mt-0 border-t-0"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT */}

      {modalOpen && (
        <Modal
          title={editing ? 'Edit Perusahaan' : 'Tambah Perusahaan'}
          onClose={closeModal}
          maxWidthClassName="max-w-md"
        >
          <div className="flex flex-col gap-4">
            {formErrors._general && (
              <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
                {formErrors._general}
              </p>
            )}

            <Field label="Nama Perusahaan" error={formErrors.nama} required>
              <TextInput
                value={formNama}
                onChange={(val) => {
                  setFormNama(val);
                  clearFieldError('nama');
                }}
                error={!!formErrors.nama}
                placeholder="Masukkan nama perusahaan"
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
                placeholder="Masukkan alamat lengkap perusahaan"
                error={!!formErrors.alamat}
              />
            </Field>

            <Field label="Nomor Telepon" error={formErrors.telepon} required>
              <TextInput
                value={formTelepon}
                onChange={(val) => {
                  setFormTelepon(val);
                  clearFieldError('telepon');
                }}
                error={!!formErrors.telepon}
                placeholder="Masukkan nomor telepon perusahaan"
                type="tel"
              />
            </Field>

            <Field label="Link Lokasi Peta (Google Maps)" error={formErrors.link} required>
              <TextInput
                value={formLink}
                onChange={(val) => {
                  setFormLink(val);
                  clearFieldError('link');
                }}
                error={!!formErrors.link}
                placeholder="Tempel link Google Maps lokasi perusahaan"
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <ButtonCancel onClick={closeModal} disabled={submitting} />
              <ButtonSubmit onClick={handleSubmit} loading={submitting} loadingLabel="Menyimpan...">
                {editing ? 'Simpan Perubahan' : 'Tambah Perusahaan'}
              </ButtonSubmit>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.nama || ''}
        itemType="Perusahaan"
        loading={deleting}
        errorMessage={deleteError}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
      />
    </>
  );
}