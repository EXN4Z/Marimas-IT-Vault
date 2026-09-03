import { useEffect, useRef, useState } from 'react';
import { Building2, MapPin, Phone, Map, Plus, Pencil, Trash2, Upload, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getPerusahaan, createPerusahaan, updatePerusahaan, deletePerusahaan, importPerusahaan, type Perusahaan } from '../../api/perusahaan';
import RouteModal from '../shared/RouteModal';
import { Skeleton } from '../shared/skeleton';
import { Field, TextInput, Textarea, ButtonCancel, ButtonSubmit } from '../shared/FormControls';
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal';
import { downloadStyledExcel } from '../../utils/excelReport';

const STAFF_ROLES = ['admin', 'hr'];

// Mirror dari TabCabang.tsx -- sepola sama tab "Cabang" di Master Data,
// tapi TANPA badge jumlah pegawai & TANPA warning "masih ada karyawan/
// inventaris tertaut" saat hapus, karena Perusahaan sengaja belum
// dikaitkan ke tabel lain (lihat api/perusahaan.ts).
export default function TabPerusahaan() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [perusahaanList, setPerusahaanList] = useState<Perusahaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // Import Excel & export Excel -- sepola sama tabConfig generik di
  // MasterData.tsx (Departemen/Supplier), tapi disematkan langsung di sini
  // karena Perusahaan adalah custom tab (dirender sendiri, bukan lewat
  // tabConfig).
  const [importLoading, setImportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPerusahaan();
      setPerusahaanList(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data perusahaan.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const res = await importPerusahaan(file);
      toast.success(res.message || 'Berhasil import data perusahaan.');
      loadData();
    } catch (err: any) {
      const apiErrors: string[] | undefined = err.response?.data?.errors;
      const msg = (apiErrors && apiErrors[0]) || err.response?.data?.message || 'Gagal import data perusahaan.';
      toast.error(msg);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
    }
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
    try {
      const payload = {
        nama: formNama.trim(),
        alamat: formAlamat.trim(),
        telepon: formTelepon.trim(),
        link: formLink.trim(),
      };
      if (editing) {
        await updatePerusahaan(editing.id, payload);
        toast.success('Data perusahaan berhasil diperbarui.');
      } else {
        await createPerusahaan(payload);
        toast.success('Perusahaan baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.response?.status === 422) {
        const apiErrors = err.response.data?.errors ?? {};
        setFormErrors({
          nama: apiErrors.nama?.[0],
          alamat: apiErrors.alamat?.[0],
          telepon: apiErrors.telepon?.[0],
          link: apiErrors.link?.[0],
        });
      } else {
        setFormErrors({ _general: err.response?.data?.message || 'Gagal menyimpan perusahaan.' });
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
      await deletePerusahaan(deleteTarget.id);
      toast.success('Perusahaan berhasil dihapus.');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus perusahaan.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-slate-500">
          Kelola data perusahaan beserta lokasi kantornya.
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
            Tambah Perusahaan
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
              <div className="pt-3 border-t border-slate-100">
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && <p className="text-sm text-red-500 text-center py-12">{error}</p>}

      {!loading && !error && perusahaanList.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <Building2 size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Belum ada data perusahaan.</p>
        </div>
      )}

      {!loading && !error && perusahaanList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {perusahaanList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-slate-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{item.nama}</h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEditModal(item)}
                    title="Edit"
                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
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
                <div className="flex items-center justify-end pt-3 border-t border-slate-100">
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
      )}

      {/* MODAL TAMBAH / EDIT */}
      {modalOpen && (
        <RouteModal
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

            <Field label="Nama Perusahaan" error={formErrors.nama} required hint="Nama identitas perusahaan">
              <TextInput
                value={formNama}
                onChange={(val) => {
                  setFormNama(val);
                  clearFieldError('nama');
                }}
                placeholder="Contoh: PT Sumber Makmur Solusindo"
                error={!!formErrors.nama}
                autoFocus
              />
            </Field>

            <Field label="Alamat Lengkap" error={formErrors.alamat} required hint="Alamat fisik operasional perusahaan">
              <Textarea
                value={formAlamat}
                onChange={(val) => {
                  setFormAlamat(val);
                  clearFieldError('alamat');
                }}
                rows={2}
                placeholder="Contoh: Jl. Mayjen Sungkono No. 88, Dukuh Pakis, Surabaya"
                error={!!formErrors.alamat}
              />
            </Field>

            <Field label="Nomor Telepon" error={formErrors.telepon} required hint="Nomor telepon aktif perusahaan / WhatsApp CS">
              <TextInput
                value={formTelepon}
                onChange={(val) => {
                  setFormTelepon(val);
                  clearFieldError('telepon');
                }}
                placeholder="Contoh: 031-7345678 / 0812-3344-5566"
                error={!!formErrors.telepon}
                type="tel"
              />
            </Field>

            <Field label="Link Lokasi Peta (Google Maps)" error={formErrors.link} required hint="Tautan URL Google Maps atau koordinat GPS">
              <TextInput
                value={formLink}
                onChange={(val) => {
                  setFormLink(val);
                  clearFieldError('link');
                }}
                placeholder="https://maps.app.goo.gl/..."
                error={!!formErrors.link}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <ButtonCancel onClick={closeModal} disabled={submitting} />
              <ButtonSubmit onClick={handleSubmit} loading={submitting} loadingLabel="Menyimpan...">
                {editing ? 'Simpan Perubahan' : 'Tambah Perusahaan'}
              </ButtonSubmit>
            </div>
          </div>
        </RouteModal>
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