import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, Lock, Building2, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';
import RouteModal from '../components/shared/RouteModal';
import Select from '../components/shared/Select';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../components/shared/FormControls';
import { getDepartemen, type Departemen } from '../api/masterData/departemen';
import { getPerusahaan, type Perusahaan } from '../api/perusahaan';
import { getCabang, type Cabang } from '../api/cabang';
import { getRoles, type Role } from '../api/masterData/role';
import SearchableSelect from '../components/shared/SearchableSelect';

interface FormState {
    name: string;
    email: string;
    phone: string;
    password: string;
    role_id: number | '';
    nik: string;
    departemen_id: string;
    perusahaan_id: string;
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
    password: '',
    role_id: '',
    nik: '',
    departemen_id: '',
    perusahaan_id: '',
    lokasi_kantor_id: '',
    tanggal_masuk: '',
};

export default function CreateKaryawanPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(initialForm);
    const [departemenList, setDepartemenList] = useState<Departemen[]>([]);
    const [cabangList, setCabangList] = useState<Cabang[]>([]);
    const [perusahaanList, setPerusahaanList] = useState<Perusahaan[]>([]);
    const [roleList, setRoleList] = useState<Role[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [generalError, setGeneralError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        getDepartemen().then(setDepartemenList).catch(() => {});
        getCabang().then(setCabangList).catch(() => {});
        getPerusahaan().then(setPerusahaanList).catch(() => {
            toast.error('Gagal memuat daftar perusahaan.');
        });
        getRoles().then(setRoleList).catch(() => {
            toast.error('Gagal memuat daftar role.');
        });
    }, []);

    const selectableRoles = roleList.filter((r) => r.nama !== 'cabang');

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

    function handleRoleChange(value: string) {
        setForm((prev) => ({ ...prev, role_id: value === '' ? '' : Number(value) }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.role_id;
            return next;
        });
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setGeneralError('');

        const newErrors: FieldErrors = {};
        if (!form.name.trim()) newErrors.name = ['Nama lengkap wajib diisi.'];
        if (!form.password.trim()) newErrors.password = ['Password awal wajib diisi.'];
        if (form.role_id === '') newErrors.role_id = ['Role wajib dipilih.'];
        if (!form.nik.trim()) newErrors.nik = ['NIK karyawan wajib diisi.'];

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
                role_id: form.role_id as number,
                nik: form.nik,
                departemen_id: form.departemen_id || null,
                perusahaan_id: form.perusahaan_id || null,
                lokasi_kantor_id: form.lokasi_kantor_id || null,
                tanggal_masuk: form.tanggal_masuk || null,
            };
            await api.post('/karyawan', payload);
            toast.success('User berhasil dibuat.');
            navigate('/karyawan');
        } catch (err: any) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors ?? {});
                toast.error('Ada data yang belum sesuai dengan format server.');
            } else if (err.response?.status === 403) {
                setGeneralError('Anda tidak punya akses untuk menambah user.');
            } else {
                setGeneralError('Gagal menyimpan user. Coba lagi.');
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <RouteModal
            title="Tambah User"
            description="Buat akun login & lengkapi data kepegawaian baru."
            maxWidthClassName="max-w-2xl"
            fallbackPath="/karyawan"
            onClose={closeModal}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {generalError && (
                    <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
                        {generalError}
                    </p>
                )}

                {/* Section 1: Identitas & Kontak */}
                <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4 space-y-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        <User size={14} className="text-slate-400 dark:text-zinc-500" />
                        <span>1. Identitas & Kontak</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Field label="Nama Lengkap" error={errors.name?.[0]} required>
                            <TextInput
                                value={form.name}
                                onChange={(v) => handleChange('name', v)}
                                error={!!errors.name}
                                placeholder="Nama lengkap karyawan"
                                autoFocus
                            />
                        </Field>

                        <Field label="NIK Karyawan" error={errors.nik?.[0]} required>
                            <TextInput
                                value={form.nik}
                                onChange={(v) => handleChange('nik', v)}
                                error={!!errors.nik}
                                placeholder="Nomor induk karyawan (MPK-001)"
                            />
                        </Field>

                        <Field label="Alamat Email" error={errors.email?.[0]}>
                            <TextInput
                                type="email"
                                value={form.email}
                                onChange={(v) => handleChange('email', v)}
                                error={!!errors.email}
                                placeholder="nama@perusahaan.com"
                            />
                        </Field>

                        <Field label="Nomor Telepon / WhatsApp" error={errors.phone?.[0]}>
                            <TextInput
                                value={form.phone}
                                onChange={(v) => handleChange('phone', v)}
                                error={!!errors.phone}
                                placeholder="08xxxxxxxxxx"
                            />
                        </Field>
                    </div>
                </div>

                {/* Section 2: Keamanan Akun & Hak Akses */}
                <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4 space-y-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        <Lock size={14} className="text-slate-400 dark:text-zinc-500" />
                        <span>2. Keamanan Akun & Hak Akses</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Field label="Role Akses" error={errors.role_id?.[0]} required>
                            <Select
                                value={form.role_id === '' ? '' : String(form.role_id)}
                                onChange={handleRoleChange}
                                placeholder="Pilih role akses"
                                error={!!errors.role_id}
                                options={selectableRoles.map((r) => ({ value: String(r.id), label: r.nama }))}
                            />
                        </Field>

                        <Field label="Password Awal" error={errors.password?.[0]} required>
                            <div className="relative">
                                <TextInput
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={(v) => handleChange('password', v)}
                                    error={!!errors.password}
                                    placeholder="Minimal 8 karakter"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 transition cursor-pointer"
                                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </Field>
                    </div>
                </div>

                {/* Section 3: Penempatan Kerja & Organisasi */}
                <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4 space-y-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        <Building2 size={14} className="text-slate-400 dark:text-zinc-500" />
                        <span>3. Penempatan Kerja & Organisasi</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Field label="Departemen" error={errors.departemen_id?.[0]}>
                            <SearchableSelect
                                value={form.departemen_id}
                                onChange={(v) => handleChange('departemen_id', v)}
                                placeholder="Pilih departemen..."
                                error={!!errors.departemen_id}
                                options={departemenList.map((d) => ({ value: String(d.id), label: d.nama }))}
                            />
                        </Field>

                        <Field label="Cabang / Lokasi Kantor" error={errors.lokasi_kantor_id?.[0]}>
                            <SearchableSelect
                                value={form.lokasi_kantor_id}
                                onChange={(v) => handleChange('lokasi_kantor_id', v)}
                                placeholder="Pilih kantor cabang..."
                                error={!!errors.lokasi_kantor_id}
                                options={cabangList.map((c) => ({ value: String(c.id), label: c.nama }))}
                            />
                        </Field>

                        <Field label="Perusahaan" error={errors.perusahaan_id?.[0]}>
                            <SearchableSelect
                                value={form.perusahaan_id}
                                onChange={(v) => handleChange('perusahaan_id', v)}
                                placeholder="Pilih perusahaan..."
                                error={!!errors.perusahaan_id}
                                options={perusahaanList.map((p) => ({ value: String(p.id), label: p.nama }))}
                            />
                        </Field>

                        <Field label="Tanggal Masuk Kerja" error={errors.tanggal_masuk?.[0]}>
                            <TextInput
                                type="date"
                                value={form.tanggal_masuk}
                                onChange={(v) => handleChange('tanggal_masuk', v)}
                                error={!!errors.tanggal_masuk}
                            />
                        </Field>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <ButtonCancel onClick={closeModal} disabled={saving} />
                    <ButtonSubmit type="submit" loading={saving} loadingLabel="Menyimpan...">
                        Simpan User
                    </ButtonSubmit>
                </div>
            </form>
        </RouteModal>
    );
}