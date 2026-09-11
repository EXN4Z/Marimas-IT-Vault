import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/shared/RouteModal';
import Select from '../components/shared/Select';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../components/shared/FormControls';
import { getDepartemen, type Departemen } from '../api/masterData/departemen';
import { getCabang, type Cabang } from '../api/cabang';
import { getRole, type RoleItem } from '../api/masterData/role';
import SearchableSelect from '../components/shared/SearchableSelect';

// BARU: dulu form nyimpen `role` (nama role sebagai string, union type
// tetap). Sekarang backend pakai relasi `role_id` (foreign key ke tabel
// roles), jadi form ini nyimpen ID-nya, bukan namanya -- lihat
// `roleList`/`selectedRole` di bawah buat nentuin field kepegawaian mana
// yang disembunyikan/wajib berdasarkan NAMA role dari id yang dipilih.

interface FormState {
    name: string;
    email: string;
    phone: string;
    password: string;
    role_id: string; // BARU: ganti dari `role: Role` (nama) ke id
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
    role_id: '', // BARU: kosong dulu, di-set setelah roleList kefetch (lihat useEffect)
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
    // Daftar role buat dropdown "Posisi" -- ditarik dari Master Data > Role.
    const [roleList, setRoleList] = useState<RoleItem[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [generalError, setGeneralError] = useState('');

    useEffect(() => {
        getDepartemen().then(setDepartemenList).catch(() => {});
        getCabang().then(setCabangList).catch(() => {});
        // per_page besar biar semua role kebawa sekaligus (dropdown, bukan
        // tabel paginated) -- sama pola dengan handleExport di TabRole.tsx.
        getRole(1, '', 100)
            .then((res) => {
                setRoleList(res.data);
                // BARU: prefill ke role "karyawan" kalau ketemu (dulu default
                // form.role = 'karyawan' langsung di initialForm; sekarang
                // harus nunggu roleList kefetch dulu buat tau id-nya).
                const defaultRole = res.data.find((r) => r.nama === 'karyawan');
                if (defaultRole) {
                    setForm((prev) => ({ ...prev, role_id: String(defaultRole.id) }));
                }
            })
            .catch(() => {});
    }, []);

    // BARU: cari objek role yang sedang dipilih berdasarkan role_id,
    // dipakai buat nentuin isCabang (dulu langsung cek form.role === 'cabang'
    // karena form.role isinya nama; sekarang form.role_id isinya angka jadi
    // harus di-lookup dulu ke roleList).
    const selectedRole = useMemo(
        () => roleList.find((r) => String(r.id) === form.role_id),
        [roleList, form.role_id]
    );
    const isCabang = selectedRole?.nama === 'cabang';

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

    // BARU: parameter sekarang string id (value dari <Select>), bukan nama
    // role. Cek "cabang" dilakukan lewat lookup ke roleList, bukan
    // perbandingan string langsung ke value.
    function handleRoleChange(value: string) {
        const role = roleList.find((r) => String(r.id) === value);
        const goingToCabang = role?.nama === 'cabang';

        setForm((prev) => ({
            ...prev,
            role_id: value,
            // bersihkan field kepegawaian kalau role diganti ke cabang
            ...(goingToCabang
                ? { nik: '', departemen_id: '', tanggal_masuk: '' }
                : {}),
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.role_id;
            if (goingToCabang) {
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
        if (!form.role_id) newErrors.role_id = ['Role wajib dipilih.'];
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
                role_id: Number(form.role_id), // BARU: kirim sebagai integer, bukan string
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

                <Field label="Posisi" error={errors.role_id?.[0]} required>
                    <Select
                        value={form.role_id}
                        onChange={(v) => handleRoleChange(v)}
                        error={!!errors.role_id}
                        placeholder="Pilih posisi"
                        options={roleList.map((r) => ({ value: String(r.id), label: r.label || r.nama }))}
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
                            <SearchableSelect
                                value={form.departemen_id}
                                onChange={(v) => handleChange('departemen_id', v)}
                                placeholder="Cari departemen..."
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