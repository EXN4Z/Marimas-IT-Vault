import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import RouteModal from '../components/RouteModal';
import { getDepartemen, type Departemen } from '../api/departemen';
import { getJabatan, type Jabatan } from '../api/jabatan';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan';

interface FormState {
    name: string;
    email: string;
    phone: string;
    role: Role;
    nip: string;
    departemen_id: string;
    jabatan_id: string;
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
    tanggal_masuk: '',
};

export default function CreateKaryawanPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(initialForm);
    const [departemenList, setDepartemenList] = useState<Departemen[]>([]);
    const [jabatanList, setJabatanList] = useState<Jabatan[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [errorMsg, setErrorMsg] = useState<string>('');

    const [generatedPassword, setGeneratedPassword] = useState<string>('');
    const [createdName, setCreatedName] = useState<string>('');

    useEffect(() => {
        getDepartemen().then(setDepartemenList).catch(() => {});
        getJabatan().then(setJabatanList).catch(() => {});
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

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setErrorMsg('');
        setErrors({});

        try {
            const payload = {
                ...form,
                departemen_id: form.departemen_id || null,
                jabatan_id: form.jabatan_id || null,
                tanggal_masuk: form.tanggal_masuk || null,
            };
            const res = await api.post('/karyawan', payload);
            setGeneratedPassword(res.data.password);
            setCreatedName(res.data.user.name);
        } catch (err: any) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors ?? {});
            } else if (err.response?.status === 403) {
                setErrorMsg('Anda tidak punya akses untuk menambah karyawan.');
            } else {
                setErrorMsg('Gagal menyimpan karyawan. Coba lagi.');
            }
        } finally {
            setSaving(false);
        }
    }

    if (generatedPassword) {
        return (
            <RouteModal title="Karyawan Berhasil Dibuat" fallbackPath="/karyawan">
                <div className="text-center">
                    <p className="text-sm text-gray-500 mb-4">
                        Catat atau kirim password ini ke <span className="font-medium">{createdName}</span>.
                        Password hanya ditampilkan sekali dan tidak bisa dilihat lagi.
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg py-3 px-4 mb-6">
                        <p className="text-2xl font-mono font-bold tracking-wider text-gray-900">
                            {generatedPassword}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/karyawan')}
                        className="w-full text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
                    >
                        Selesai
                    </button>
                </div>
            </RouteModal>
        );
    }

    return (
        <RouteModal
            title="Tambah Karyawan"
            description="Buat akun & data kepegawaian baru."
            fallbackPath="/karyawan"
            onClose={closeModal}
        >
            <>
                {errorMsg && (
                    <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{errorMsg}</div>
                )}

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
                        </select>
                    </Field>

                    <div className="flex justify-end gap-2 pt-2">
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
                            {saving ? 'Menyimpan...' : 'Simpan Karyawan'}
                        </button>
                    </div>
                </form>
            </>
        </RouteModal>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            {children}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
    );
}