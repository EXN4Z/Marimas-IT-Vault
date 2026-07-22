import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/RouteModal';
import { getDepartemen } from '../api/departemen';
import { getJabatan, type Jabatan } from '../api/jabatan';
import { getCabang, type Cabang } from '../api/cabang';
import type { Departemen } from '../api/departemen';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan' | 'guest';

interface Pekerja {
    id: number;
    nip: string;
    departemen_id: number | null;
    jabatan_id: number | null;
    lokasi_kantor_id: number | null;
    tanggal_masuk: string | null;
}

interface User {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    role: Role;
    pekerja: Pekerja | null;
}

interface FormState {
    name: string;
    email: string;
    phone: string;
    role: Role;
    nip: string;
    departemen_id: string;
    jabatan_id: string;
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
    nip: '',
    departemen_id: '',
    jabatan_id: '',
    lokasi_kantor_id: '',
    tanggal_masuk: '',
};

export default function EditKaryawanPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(initialForm);
    const [departemenList, setDepartemenList] = useState<Departemen[]>([]);
    const [jabatanList, setJabatanList] = useState<Jabatan[]>([]);
    const [cabangList, setCabangList] = useState<Cabang[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<FieldErrors>({});

    useEffect(() => {
        getDepartemen().then(setDepartemenList).catch(() => {});
        getJabatan().then(setJabatanList).catch(() => {});
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
                    nip: u.pekerja?.nip ?? '',
                    departemen_id: u.pekerja?.departemen_id ? String(u.pekerja.departemen_id) : '',
                    jabatan_id: u.pekerja?.jabatan_id ? String(u.pekerja.jabatan_id) : '',
                    lokasi_kantor_id: u.pekerja?.lokasi_kantor_id ? String(u.pekerja.lokasi_kantor_id) : '',
                    tanggal_masuk: u.pekerja?.tanggal_masuk ?? '',
                });
            })
            .catch(() => {
                toast.error('Gagal memuat data karyawan.');
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

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        try {
            const payload = {
                ...form,
                departemen_id: form.departemen_id || null,
                jabatan_id: form.jabatan_id || null,
                lokasi_kantor_id: form.lokasi_kantor_id || null,
                tanggal_masuk: form.tanggal_masuk || null,
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

    if (loading) {
        return (
            <RouteModal title="Edit Karyawan" fallbackPath="/karyawan" onClose={closeModal}>
                <p className="text-center text-sm text-gray-400 py-16">Memuat data...</p>
            </RouteModal>
        );
    }

    return (
        <RouteModal
            title="Edit Karyawan"
            description="Perbarui data pengguna ini."
            fallbackPath="/karyawan"
            onClose={closeModal}
        >
            <>
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

                    <Field label="NIP" error={errors.nip?.[0]}>
                        <input
                            type="text"
                            value={form.nip}
                            onChange={(e) => handleChange('nip', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                            required
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
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

                        <Field label="Jabatan" error={errors.jabatan_id?.[0]}>
                            <select
                                value={form.jabatan_id}
                                onChange={(e) => handleChange('jabatan_id', e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                            >
                                <option value="">Pilih jabatan</option>
                                {jabatanList.map((j) => (
                                    <option key={j.id} value={j.id}>
                                        {j.nama}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <Field label="Cabang" error={errors.lokasi_kantor_id?.[0]}>
                        <select
                            value={form.lokasi_kantor_id}
                            onChange={(e) => handleChange('lokasi_kantor_id', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        >
                            <option value="">Pilih cabang</option>
                            {cabangList.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nama}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Tanggal Masuk" error={errors.tanggal_masuk?.[0]}>
                        <input
                            type="date"
                            value={form.tanggal_masuk}
                            onChange={(e) => handleChange('tanggal_masuk', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </Field>

                    <Field label="Role" error={errors.role?.[0]}>
                        <select
                            value={form.role}
                            onChange={(e) => handleChange('role', e.target.value as Role)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        >
                            <option value="karyawan">Karyawan</option>
                            <option value="manajer">Manajer</option>
                            <option value="hr">HR</option>
                            <option value="admin">Admin</option>
                            <option value="guest">Guest</option>
                        </select>
                    </Field>

                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="text-sm text-red-600 hover:text-red-700"
                        >
                            Hapus karyawan
                        </button>

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
            </>
        </RouteModal>
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