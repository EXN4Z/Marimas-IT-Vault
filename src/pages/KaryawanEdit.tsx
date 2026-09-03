import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/shared/RouteModal';
import Select from '../components/shared/Select';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../components/shared/FormControls';
import { getDepartemen } from '../api/masterData/departemen';
import { getCabang, type Cabang } from '../api/cabang';
import { setKaryawanPassword } from '../api/auth';
import type { Departemen } from '../api/masterData/departemen';
import { createPortal } from 'react-dom';
import { Skeleton } from '../components/shared/skeleton';
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal';
import { KeyRound, X } from 'lucide-react';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan' | 'guest' | 'cabang';

interface User {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    role: Role;
    nik: string | null;
    departemen_id?: number | null;
    lokasi_kantor_id?: number | null;
    tanggal_masuk: string | null;
}

interface FormState {
    name: string;
    email: string;
    phone: string;
    role: Role;
    nik: string;
    departemen_id: string;
    lokasi_kantor_id: string;
    tanggal_masuk: string;
}

interface FieldErrors {
    [key: string]: string[];
}

const initialForm: FormState = {
    name: '',
    email: '',
    phone: '',
    role: 'karyawan',
    nik: '',
    departemen_id: '',
    lokasi_kantor_id: '',
    tanggal_masuk: '',
};

export default function EditKaryawanPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(initialForm);
    const [departemenList, setDepartemenList] = useState<Departemen[]>([]);
    const [cabangList, setCabangList] = useState<Cabang[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    // BARU: pesan error umum (non-per-field) -- disamain sama pola
    // InventoryFormModal (errors._general), gantiin toast.error yang dulu
    // dipakai buat kasus 422/403/gagal-simpan.
    const [generalError, setGeneralError] = useState('');

    // BARU: state buat modal "Ubah password" (admin nentuin sendiri password-nya)
    const [showSetPassword, setShowSetPassword] = useState<boolean>(false);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);

    const isCabang = form.role === 'cabang';

    useEffect(() => {
        getDepartemen().then(setDepartemenList).catch(() => {});
        getCabang().then(setCabangList).catch(() => {});

        api
            .get<User>(`/karyawan/${id}`)
            .then((res) => {
                const u = res.data;
                setForm({
                    name: u.name,
                    email: u.email ?? '',
                    phone: u.phone ?? '',
                    role: u.role,
                    nik: u.nik ?? '',
                    departemen_id: u.departemen_id ? String(u.departemen_id) : '',
                    lokasi_kantor_id: u.lokasi_kantor_id ? String(u.lokasi_kantor_id) : '',
                    tanggal_masuk: u.tanggal_masuk ?? '',
                });
            })
            .catch(() => {
                toast.error('Gagal memuat data user.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    function closeModal() {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/karyawan', { replace: true });
        }
    }

    function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    }

    function handleRoleChange(value: Role) {
        setForm((prev) => ({
            ...prev,
            role: value,
            ...(value === 'cabang'
                ? { nik: '', departemen_id: '', tanggal_masuk: '' }
                : {}),
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.role;
            if (value === 'cabang') {
                delete next.nik;
                delete next.departemen_id;
                delete next.tanggal_masuk;
            }
            return next;
        });
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setGeneralError('');

        const newErrors: FieldErrors = {};
        if (!form.name.trim()) newErrors.name = ['Nama lengkap wajib diisi.'];
        if (!form.role) newErrors.role = ['Role wajib dipilih.'];
        if (!isCabang && !form.nik.trim()) newErrors.nik = ['NIK karyawan wajib diisi.'];
        if (isCabang && !form.lokasi_kantor_id) newErrors.lokasi_kantor_id = ['Cabang penempatan wajib dipilih.'];

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Mohon lengkapi kolom yang bertanda bintang (*).');
            return;
        }

        setSaving(true);
        setErrors({});

        try {
            const payload = {
                ...form,
                nik: isCabang ? null : form.nik,
                departemen_id: isCabang ? null : form.departemen_id || null,
                lokasi_kantor_id: form.lokasi_kantor_id || null,
                tanggal_masuk: isCabang ? null : form.tanggal_masuk || null,
            };
            await api.put(`/karyawan/${id}`, payload);
            toast.success('Perubahan berhasil disimpan.');
            navigate('/karyawan');
        } catch (err: any) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors ?? {});
                toast.error('Ada data yang belum sesuai dengan format server.');
            } else if (err.response?.status === 403) {
                setGeneralError('Anda tidak punya akses untuk mengubah data ini.');
            } else {
                setGeneralError('Gagal menyimpan perubahan. Coba lagi.');
            }
        } finally {
            setSaving(false);
        }
    }

    function handleDelete() {
        setShowDeleteModal(true);
    }

    async function confirmDeleteUser() {
        setDeleting(true);
        try {
            await api.delete(`/karyawan/${id}`);
            toast.success('User berhasil dihapus.');
            navigate('/karyawan');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Gagal menghapus user.');
            setShowDeleteModal(false);
        } finally {
            setDeleting(false);
        }
    }

    // BARU: admin nentuin sendiri password baru untuk karyawan ini (bukan random)
    async function handleSetPassword(password: string, passwordConfirmation: string) {
        await setKaryawanPassword(Number(id), password, passwordConfirmation);
        toast.success('Password berhasil diubah.');
        setShowSetPassword(false);
    }

    if (loading) {
        return (
            <RouteModal title="Edit User" fallbackPath="/karyawan" onClose={closeModal}>
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-1.5">
                            <Skeleton className="h-3 w-24 rounded" />
                            <Skeleton className="h-9 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </RouteModal>
        );
    }

    return (
        <>
            <RouteModal
                title="Edit User"
                description="Perbarui data pengguna ini."
                fallbackPath="/karyawan"
                onClose={closeModal}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {generalError && (
                        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
                            {generalError}
                        </p>
                    )}

                    <Field label="Nama" error={errors.name?.[0]} required>
                        <TextInput
                            value={form.name}
                            onChange={(v) => handleChange('name', v)}
                            error={!!errors.name}
                            autoFocus
                        />
                    </Field>

                    <Field label="Email" error={errors.email?.[0]}>
                        <TextInput
                            type="email"
                            value={form.email}
                            onChange={(v) => handleChange('email', v)}
                            error={!!errors.email}
                        />
                    </Field>

                    <Field label="Nomor Telepon" error={errors.phone?.[0]}>
                        <TextInput
                            value={form.phone}
                            onChange={(v) => handleChange('phone', v)}
                            error={!!errors.phone}
                        />
                    </Field>

                    <Field label="Role" error={errors.role?.[0]} required>
                        <Select
                            value={form.role}
                            onChange={(v) => handleRoleChange(v as Role)}
                            error={!!errors.role}
                            options={[
                                { value: 'karyawan', label: 'Karyawan' },
                                { value: 'manajer', label: 'Manajer' },
                                { value: 'hr', label: 'HR' },
                                { value: 'admin', label: 'Admin' },
                                { value: 'guest', label: 'Guest' },
                                { value: 'cabang', label: 'Cabang' },
                            ]}
                        />
                    </Field>

                    {!isCabang && (
                        <Field label="NIK" error={errors.nik?.[0]} required>
                            <TextInput
                                value={form.nik}
                                onChange={(v) => handleChange('nik', v)}
                                error={!!errors.nik}
                            />
                        </Field>
                    )}

                    {!isCabang && (
                        <Field label="Departemen" error={errors.departemen_id?.[0]}>
                            <Select
                                value={form.departemen_id}
                                onChange={(v) => handleChange('departemen_id', v)}
                                placeholder="Pilih departemen"
                                error={!!errors.departemen_id}
                                options={departemenList.map((d) => ({ value: String(d.id), label: d.nama }))}
                            />
                        </Field>
                    )}

                    <Field label="Cabang" error={errors.lokasi_kantor_id?.[0]} required={isCabang}>
                        <Select
                            value={form.lokasi_kantor_id}
                            onChange={(v) => handleChange('lokasi_kantor_id', v)}
                            placeholder="Pilih cabang"
                            error={!!errors.lokasi_kantor_id}
                            options={cabangList.map((c) => ({ value: String(c.id), label: c.nama }))}
                        />
                    </Field>

                    {!isCabang && (
                        <Field label="Tanggal Masuk" error={errors.tanggal_masuk?.[0]}>
                            <TextInput
                                type="date"
                                value={form.tanggal_masuk}
                                onChange={(v) => handleChange('tanggal_masuk', v)}
                                error={!!errors.tanggal_masuk}
                            />
                        </Field>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="text-sm text-red-600 hover:text-red-700"
                            >
                                Hapus user
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSetPassword(true)}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Ubah password
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <ButtonCancel onClick={closeModal} disabled={saving} />
                            <ButtonSubmit type="submit" loading={saving} loadingLabel="Menyimpan...">
                                Simpan Perubahan
                            </ButtonSubmit>
                        </div>
                    </div>
                </form>
            </RouteModal>

            {showSetPassword && (
                <SetPasswordModal
                    onClose={() => setShowSetPassword(false)}
                    onSubmit={handleSetPassword}
                />
            )}

            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                itemName={form.name || 'User ini'}
                itemCode={form.nik || undefined}
                itemType="Karyawan / User"
                warningMessage="Akun login dan seluruh hak akses user ini akan dicabut secara permanen."
                loading={deleting}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDeleteUser}
            />
        </>
    );
}

// BARU: modal buat admin nentuin sendiri password baru untuk karyawan
function SetPasswordModal({
    onClose,
    onSubmit,
}: {
    onClose: () => void;
    onSubmit: (password: string, passwordConfirmation: string) => Promise<void>;
}) {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setErrors({});

        const newErrors: { password?: string; confirmation?: string } = {};
        if (!password.trim()) {
            newErrors.password = 'Password baru wajib diisi.';
        } else if (password.length < 6) {
            newErrors.password = 'Password minimal 6 karakter.';
        }

        if (!confirmation.trim()) {
            newErrors.confirmation = 'Konfirmasi password wajib diisi.';
        } else if (password && confirmation && password !== confirmation) {
            newErrors.confirmation = 'Konfirmasi password tidak cocok.';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Mohon periksa kembali isian password.');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(password, confirmation);
        } catch (err: any) {
            if (err.response?.status === 422) {
                const apiErrors = err.response.data?.errors ?? {};
                setErrors({
                    password: apiErrors.password?.[0] ?? 'Periksa kembali password yang diisi.',
                });
                toast.error(apiErrors.password?.[0] || 'Password tidak memenuhi kriteria.');
            } else if (err.response?.status === 403) {
                setErrors({ password: 'Anda tidak punya akses untuk mengubah password ini.' });
            } else {
                setErrors({ password: 'Gagal mengubah password. Coba lagi.' });
            }
        } finally {
            setSubmitting(false);
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <KeyRound size={22} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 leading-tight">Ubah Password</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Tentukan kata sandi baru untuk akun pengguna ini.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        aria-label="Tutup"
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Field label="Password Baru" error={errors.password} required>
                        <TextInput
                            type="password"
                            autoFocus
                            placeholder="Minimal 6 karakter"
                            value={password}
                            onChange={(v) => {
                                setPassword(v);
                                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                            }}
                            error={!!errors.password}
                        />
                    </Field>

                    <Field label="Konfirmasi Password Baru" error={errors.confirmation} required>
                        <TextInput
                            type="password"
                            placeholder="Ulangi password baru"
                            value={confirmation}
                            onChange={(v) => {
                                setConfirmation(v);
                                if (errors.confirmation) setErrors((prev) => ({ ...prev, confirmation: '' }));
                            }}
                            error={!!errors.confirmation}
                        />
                    </Field>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                        <ButtonCancel onClick={onClose} disabled={submitting} />
                        <ButtonSubmit type="submit" loading={submitting} loadingLabel="Menyimpan...">
                            Simpan Password
                        </ButtonSubmit>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}