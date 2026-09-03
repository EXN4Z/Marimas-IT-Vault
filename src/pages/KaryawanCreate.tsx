import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/shared/RouteModal';
import Select from '../components/shared/Select';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../components/shared/FormControls';
import { getDepartemen, type Departemen } from '../api/masterData/departemen';
import { getCabang, type Cabang } from '../api/cabang';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan' | 'guest' | 'cabang';

interface FormState {
    name: string;
    email: string;
    phone: string;
    password: string;
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
    password: '',
    role: 'karyawan',
    nik: '',
    departemen_id: '',
    lokasi_kantor_id: '',
    tanggal_masuk: '',
};

export default function CreateKaryawanPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(initialForm);
    const [departemenList, setDepartemenList] = useState<Departemen[]>([]);
    const [cabangList, setCabangList] = useState<Cabang[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    // BARU: pesan error umum (non-per-field), dirender sebagai banner --
    // dulu dipakein toast.error, sekarang disamain sama pola InventoryFormModal
    // (errors._general) biar desainnya konsisten di semua form.
    const [generalError, setGeneralError] = useState('');

    const isCabang = form.role === 'cabang';

    useEffect(() => {
        getDepartemen().then(setDepartemenList).catch(() => {});
        getCabang().then(setCabangList).catch(() => {});
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
            // bersihkan field kepegawaian kalau role diganti ke cabang
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
        if (!form.password.trim()) newErrors.password = ['Password awal wajib diisi.'];
        else if (form.password.length < 6) newErrors.password = ['Password minimal 6 karakter.'];
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
            await api.post('/karyawan', payload);
            toast.success('User berhasil dibuat.');
            navigate('/karyawan');
        } catch (err: any) {
            if (err.response?.status === 422) {
                // error per-field dirender di bawah masing-masing input (lihat Field
                // di bawah) -- gak perlu toast lagi, cukup banner umum kalau memang
                // ada pesan non-per-field dari server.
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
            description="Buat akun & data kepegawaian baru."
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

                <Field label="Password" error={errors.password?.[0]} required>
                    <TextInput
                        type="password"
                        value={form.password}
                        onChange={(v) => handleChange('password', v)}
                        error={!!errors.password}
                    />
                </Field>

                <Field label="Posisi" error={errors.role?.[0]} required>
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

                <div className={`grid gap-4 ${!isCabang ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
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
                </div>

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

                <div className="flex items-center justify-end gap-3 pt-2">
                    <ButtonCancel onClick={closeModal} disabled={saving} />
                    <ButtonSubmit type="submit" loading={saving} loadingLabel="Menyimpan...">
                        Simpan User
                    </ButtonSubmit>
                </div>
            </form>
        </RouteModal>
    );
}