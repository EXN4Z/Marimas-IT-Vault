import { useState, type FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { User as UserIcon, Lock, Building2, Eye, EyeOff, KeyRound } from 'lucide-react';
import Modal from '../../../components/modal/Modal';
import Select from '../../../components/form/Select';
import SearchableSelect from '../../../components/form/SearchableSelect';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';
import KaryawanPasswordModal from './KaryawanPasswordModal';
import type { KaryawanOpsi, KaryawanRow } from '../types';

interface Props {
  /** null = mode Tambah, baris user = mode Edit. */
  user: KaryawanRow | null;
  opsi: KaryawanOpsi;
  onClose: () => void;
  /** Mode Edit: minta parent membuka konfirmasi hapus (modal ini ditutup dulu oleh parent). */
  onDelete: (user: KaryawanRow) => void;
}

interface FormFields {
  name: string;
  email: string;
  phone: string;
  password: string; // hanya dipakai mode Tambah
  role_id: string; // string karena dipakai langsung sebagai value <Select>
  nik: string;
  departemen_id: string;
  perusahaan_id: string;
  cabang_id: string;
  tanggal_masuk: string;
  status: 'aktif' | 'nonaktif'; // hanya dipakai mode Edit
}

const STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nonaktif', label: 'Nonaktif' },
];

// Label tampilan tiap role. Role baru yang tidak ada di sini jatuh ke nama aslinya (huruf pertama kapital).
const ROLE_DISPLAY_LABEL: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
};

function roleLabel(nama: string): string {
  return ROLE_DISPLAY_LABEL[nama] ?? nama.charAt(0).toUpperCase() + nama.slice(1);
}

const sectionClass =
  'rounded-xl border border-line-200-a80 bg-surface-50-a50 p-4 space-y-3.5';
const sectionTitleClass =
  'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500';

// [F3-INERTIA] Form Tambah / Edit User sebagai modal overlay di tab Karyawan (gabungan Create.tsx + Edit.tsx lama).
// Data baris dari props list (tidak ada request tambahan), pilihan dropdown dari props `karyawanOpsi`.
// Submit pakai useForm: preserveState + preserveScroll, sukses -> modal ditutup, error validasi tampil di field.
export default function KaryawanFormModal({ user, opsi, onClose, onDelete }: Props) {
  const isEdit = user !== null;

  const { data, setData, post, put, processing, errors, setError, clearErrors, transform } = useForm<FormFields>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
    role_id: user?.role_id != null ? String(user.role_id) : '',
    nik: user?.nik ?? '',
    departemen_id: user?.departemen_id ? String(user.departemen_id) : '',
    perusahaan_id: user?.perusahaan_id ? String(user.perusahaan_id) : '',
    cabang_id: user?.cabang_id ? String(user.cabang_id) : '',
    tanggal_masuk: user?.tanggal_masuk ?? '',
    status: user?.status === 'nonaktif' ? 'nonaktif' : 'aktif',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);

  const selectableRoles = opsi.roles.filter((r) => r.nama !== 'cabang');

  // Esc / klik backdrop / tombol X: diabaikan selama submit berjalan atau modal "Ubah Password" sedang terbuka
  // di atas form ini (supaya isian form tidak ikut kebuang).
  function handleClose() {
    if (processing || showSetPassword) return;
    onClose();
  }

  function change<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) clearErrors(key);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const clientErrors: Partial<Record<keyof FormFields, string>> = {};
    if (!data.name.trim()) clientErrors.name = 'Nama lengkap tidak boleh kosong!';
    if (!isEdit && !data.password.trim()) clientErrors.password = 'Password awal tidak boleh kosong!';
    if (!data.role_id) clientErrors.role_id = 'Role wajib dipilih.';
    if (!data.email.trim()) clientErrors.email = 'Email tidak boleh kosong!';
    if (!data.nik.trim()) clientErrors.nik = 'NIK karyawan tidak boleh kosong!';

    if (Object.keys(clientErrors).length > 0) {
      setError(clientErrors);
      return;
    }

    // Kolom opsional kosong dikirim null. Tambah: kirim password awal (tanpa status). Edit: kirim status (tanpa password).
    transform((d) => {
      const base = {
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        role_id: Number(d.role_id),
        nik: d.nik,
        departemen_id: d.departemen_id || null,
        perusahaan_id: d.perusahaan_id || null,
        cabang_id: d.cabang_id || null,
        tanggal_masuk: d.tanggal_masuk || null,
      };
      return isEdit ? { ...base, status: d.status } : { ...base, password: d.password };
    });

    const options = {
      preserveScroll: true,
      preserveState: true,
      // Sukses -> toast dari flash server (FlashToaster). Error validasi tampil inline di field.
      onSuccess: () => onClose(),
    };

    if (user) put(`/master-data/karyawan/${user.id}`, options);
    else post('/master-data/karyawan', options);
  }

  return (
    <>
      <Modal title={isEdit ? 'Edit User' : 'Tambah User'} onClose={handleClose} maxWidthClassName="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Identitas & Kontak */}
          <div className={sectionClass}>
            <div className={sectionTitleClass}>
              <UserIcon size={14} className="text-ink-400" />
              <span>1. Identitas & Kontak</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Nama Lengkap" error={errors.name} required>
                <TextInput
                  value={data.name}
                  onChange={(v) => change('name', v)}
                  placeholder="Masukkan nama lengkap user"
                  error={!!errors.name}
                  autoFocus
                />
              </Field>

              <Field label="NIK Karyawan" error={errors.nik} required>
                <TextInput
                  value={data.nik}
                  onChange={(v) => change('nik', v)}
                  placeholder="Masukkan NIK karyawan"
                  error={!!errors.nik}
                />
              </Field>

              <Field label="Alamat Email" error={errors.email} required>
                <TextInput
                  type="email"
                  value={data.email}
                  onChange={(v) => change('email', v)}
                  placeholder="Masukkan alamat email"
                  error={!!errors.email}
                />
              </Field>

              <Field label="Nomor Telepon / WhatsApp" error={errors.phone}>
                <TextInput
                  value={data.phone}
                  onChange={(v) => change('phone', v)}
                  placeholder="Masukkan nomor telepon atau WhatsApp"
                  error={!!errors.phone}
                />
              </Field>
            </div>
          </div>

          {/* Section 2: Keamanan Akun & Hak Akses */}
          <div className={sectionClass}>
            <div className={sectionTitleClass}>
              <Lock size={14} className="text-ink-400" />
              <span>2. Keamanan Akun & Hak Akses</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Role Akses" error={errors.role_id} required>
                <Select
                  value={data.role_id}
                  onChange={(v) => change('role_id', v)}
                  placeholder="Pilih role akses"
                  error={!!errors.role_id}
                  options={selectableRoles.map((r) => ({ value: String(r.id), label: roleLabel(r.nama) }))}
                />
              </Field>

              {isEdit ? (
                <Field label="Status Akun Login" error={errors.status}>
                  <Select
                    value={data.status}
                    onChange={(v) => change('status', v as FormFields['status'])}
                    error={!!errors.status}
                    options={STATUS_OPTIONS}
                  />
                </Field>
              ) : (
                <Field label="Password Awal" error={errors.password} required>
                  <div className="relative">
                    <TextInput
                      type={showPassword ? 'text' : 'password'}
                      value={data.password}
                      onChange={(v) => change('password', v)}
                      placeholder="Masukkan password awal"
                      error={!!errors.password}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-1 transition cursor-pointer"
                      title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              )}
            </div>
          </div>

          {/* Section 3: Penempatan Kerja & Organisasi */}
          <div className={sectionClass}>
            <div className={sectionTitleClass}>
              <Building2 size={14} className="text-ink-400" />
              <span>3. Penempatan Kerja & Organisasi</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Departemen" error={errors.departemen_id}>
                <SearchableSelect
                  value={data.departemen_id}
                  onChange={(v) => change('departemen_id', v)}
                  placeholder="Pilih departemen..."
                  error={!!errors.departemen_id}
                  options={opsi.departemen.map((d) => ({ value: String(d.id), label: d.nama }))}
                />
              </Field>

              <Field label="Cabang / Lokasi Kantor" error={errors.cabang_id}>
                <SearchableSelect
                  value={data.cabang_id}
                  onChange={(v) => change('cabang_id', v)}
                  placeholder="Pilih kantor cabang..."
                  error={!!errors.cabang_id}
                  options={opsi.cabang.map((c) => ({ value: String(c.id), label: c.nama }))}
                />
              </Field>

              <Field label="Perusahaan" error={errors.perusahaan_id}>
                <SearchableSelect
                  value={data.perusahaan_id}
                  onChange={(v) => change('perusahaan_id', v)}
                  placeholder="Pilih perusahaan..."
                  error={!!errors.perusahaan_id}
                  options={opsi.perusahaan.map((p) => ({ value: String(p.id), label: p.nama }))}
                />
              </Field>

              <Field label="Tanggal Masuk Kerja" error={errors.tanggal_masuk}>
                <TextInput
                  type="date"
                  value={data.tanggal_masuk}
                  onChange={(v) => change('tanggal_masuk', v)}
                  error={!!errors.tanggal_masuk}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-line-100">
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSetPassword(true)}
                    disabled={processing}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-edge-blue-200 text-blue-600 dark:text-blue-400 hover:bg-tint-blue-50 transition cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={14} />
                    Ubah Password
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(user)}
                    disabled={processing}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-edge-red-200 text-tone-red-600 hover:bg-tint-red-hover-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Hapus User
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <ButtonCancel onClick={handleClose} disabled={processing} />
              <ButtonSubmit type="submit" loading={processing} loadingLabel="Menyimpan...">
                {isEdit ? 'Simpan Perubahan' : 'Simpan User'}
              </ButtonSubmit>
            </div>
          </div>
        </form>
      </Modal>

      {showSetPassword && user && (
        <KaryawanPasswordModal userId={user.id} userName={user.name} onClose={() => setShowSetPassword(false)} />
      )}
    </>
  );
}
