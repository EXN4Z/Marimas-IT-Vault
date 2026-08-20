import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/shared/RouteModal';
import { getDepartemen } from '../api/departemen';
import { getCabang, type Cabang } from '../api/cabang';
import { setKaryawanPassword } from '../api/auth';
import type { Departemen } from '../api/departemen';
import { createPortal } from 'react-dom';

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



    // BARU: state buat modal "Ubah password" (admin nentuin sendiri password-nya)
    const [showSetPassword, setShowSetPassword] = useState<boolean>(false);

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
                toast.error('Gagal memuat data karyawan.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    // Bersihin password baru dari state pas keluar halaman, biar gak ketinggalan nempel di layar
    useEffect(() => {
        return () => setNewPassword(null);
    }, []);

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
                toast.error('Periksa kembali data yang diisi.');
            } else if (err.response?.status === 403) {
                toast.error('Anda tidak punya akses untuk mengubah data ini.');
            } else {
                toast.error('Gagal menyimpan perubahan. Coba lagi.');
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!window.confirm('Hapus karyawan ini? Tindakan ini tidak bisa dibatalkan.')) return;

        try {
            await api.delete(`/karyawan/${id}`);
            toast.success('Karyawan berhasil dihapus.');
            navigate('/karyawan');
        } catch {
            toast.error('Gagal menghapus karyawan.');
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
            <RouteModal title="Edit Karyawan" fallbackPath="/karyawan" onClose={closeModal}>
                <p className="text-center text-sm text-gray-400 py-16">Memuat data...</p>
            </RouteModal>
        );
    }

    return (
        <>
            <RouteModal
                title="Edit Karyawan"
                description="Perbarui data pengguna ini."
                fallbackPath="/karyawan"
                onClose={closeModal}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Field label="Nama" error={errors.name?.[0]}>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                            required
                        />
                    </Field>

                    <Field label="Email" error={errors.email?.[0]}>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </Field>

                    <Field label="Nomor Telepon" error={errors.phone?.[0]}>
                        <input
                            type="text"
                            value={form.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </Field>

                    <Field label="Role" error={errors.role?.[0]}>
                        <select
                            value={form.role}
                            onChange={(e) => handleRoleChange(e.target.value as Role)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        >
                            <option value="karyawan">Karyawan</option>
                            <option value="manajer">Manajer</option>
                            <option value="hr">HR</option>
                            <option value="admin">Admin</option>
                            <option value="guest">Guest</option>
                            <option value="cabang">Cabang</option>
                        </select>
                    </Field>

                    {!isCabang && (
                        <Field label="NIK" error={errors.nik?.[0]}>
                            <input
                                type="text"
                                value={form.nik}
                                onChange={(e) => handleChange('nik', e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                                required
                            />
                        </Field>
                    )}

                    {!isCabang && (
                        <Field label="Departemen" error={errors.departemen_id?.[0]}>
                            <select
                                value={form.departemen_id}
                                onChange={(e) => handleChange('departemen_id', e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                            >
                                <option value="">Pilih departemen</option>
                                {departemenList.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.nama}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    <Field label="Cabang" error={errors.lokasi_kantor_id?.[0]}>
                        <select
                            value={form.lokasi_kantor_id}
                            onChange={(e) => handleChange('lokasi_kantor_id', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                            required={isCabang}
                        >
                            <option value="">Pilih cabang</option>
                            {cabangList.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nama}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {!isCabang && (
                        <Field label="Tanggal Masuk" error={errors.tanggal_masuk?.[0]}>
                            <input
                                type="date"
                                value={form.tanggal_masuk}
                                onChange={(e) => handleChange('tanggal_masuk', e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
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
                                Hapus karyawan
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSetPassword(true)}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Ubah password
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
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
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            {children}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
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
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);

        if (password !== confirmation) {
            setError('Konfirmasi password tidak sama.');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(password, confirmation);
        } catch (err: any) {
            if (err.response?.status === 422) {
                const errors = err.response.data?.errors ?? {};
                setError(errors.password?.[0] ?? 'Periksa kembali password yang diisi.');
            } else if (err.response?.status === 403) {
                setError('Anda tidak punya akses untuk mengubah password ini.');
            } else {
                setError('Gagal mengubah password. Coba lagi.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
            onClick={onClose}
        >
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-sm font-semibold text-gray-900">Ubah password</h3>
                <p className="text-xs text-gray-500 mt-1">
                    Tentukan password baru untuk akun ini secara langsung.
                </p>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Password baru</label>
                        <input
                            type="password"
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Konfirmasi password</label>
                        <input
                            type="password"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            required
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                        {submitting ? 'Menyimpan...' : 'Simpan password'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}