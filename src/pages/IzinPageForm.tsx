import { useMemo, useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/RouteModal';

type JenisIzin = 'tahunan' | 'pribadi' | 'sakit' | 'terlambat' | 'pulang_cepat' | 'dinas' | 'lahiran' | 'pendamping_lahiran' | 'duka_serumah' | 'duka_keluarga_inti' | 'lainnya';

const jenisOptions: { value: JenisIzin; label: string }[] = [
    { value: 'tahunan', label: 'Cuti Tahunan' },
    { value: 'pribadi', label: 'Izin Pribadi' },
    { value: 'sakit', label: 'Izin Sakit' },
    { value: 'terlambat', label: 'Izin Terlambat' },
    { value: 'pulang_cepat', label: 'Izin Pulang Cepat' },
    { value: 'dinas', label: 'Izin Dinas' },
    { value: 'lahiran', label: 'Cuti Lahiran' },
    { value: 'pendamping_lahiran', label: 'Cuti Mendampingi Istri Lahiran' },
    { value: 'duka_serumah', label: 'Izin Duka - Anggota Serumah Meninggal' },
    { value: 'duka_keluarga_inti', label: 'Izin Duka - Pasangan/Anak/Orang Tua Meninggal' },
    { value: 'lainnya', label: 'Izin Lainnya' },
];

// Durasi default per jenis izin yang punya aturan tetap: lahiran 3 bulan,
// mendampingi istri lahiran 2 hari, duka serumah 1 hari, duka keluarga inti
// (pasangan/anak/orang tua) 2 hari. Jenis lain nggak di-auto-fill.
const DURASI_HARI: Partial<Record<JenisIzin, number>> = {
    pendamping_lahiran: 2,
    duka_serumah: 1,
    duka_keluarga_inti: 2,
};

// Cuti lahiran defaultnya berdurasi 3 bulan penuh dari tanggal mulai.
function tambahBulan(tanggalMulai: string, jumlahBulan: number): string {
    const d = new Date(tanggalMulai);
    d.setMonth(d.getMonth() + jumlahBulan);
    d.setDate(d.getDate() - 1); // inklusif: 3 bulan dihitung dari tanggal mulai
    return d.toISOString().split('T')[0];
}

// Buat izin dengan durasi tetap dalam hari (mis. 2 hari), dihitung inklusif.
function tambahHari(tanggalMulai: string, jumlahHari: number): string {
    const d = new Date(tanggalMulai);
    d.setDate(d.getDate() + jumlahHari - 1); // inklusif: tanggal mulai dihitung hari ke-1
    return d.toISOString().split('T')[0];
}

interface FormState {
    tanggal_mulai: string;
    tanggal_selesai: string;
    jenis_izin: JenisIzin | '';
    alasan: string;
    kontak_darurat: string;
}

interface FormErrors {
    tanggal_mulai?: string;
    tanggal_selesai?: string;
    jenis_izin?: string;
    alasan?: string;
    bukti?: string;
}

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

function hitungLamaIzin(mulai: string, selesai: string): number {
    if (!mulai || !selesai) return 0;
    const diff = Math.round((new Date(selesai).getTime() - new Date(mulai).getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
}

const MAX_FILE_MB = 5;

export default function IzinFormPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>({
        tanggal_mulai: '',
        tanggal_selesai: '',
        jenis_izin: '',
        alasan: '',
        kontak_darurat: '',
    });
    const [bukti, setBukti] = useState<File | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState<boolean>(false);

    const lamaIzin = useMemo(() => hitungLamaIzin(form.tanggal_mulai, form.tanggal_selesai), [form.tanggal_mulai, form.tanggal_selesai]);

    function closeModal() {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/izin', { replace: true });
        }
    }

    function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    }

    function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;

        if (file) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                setErrors((prev) => ({ ...prev, bukti: 'Format harus PDF, JPG, atau PNG.' }));
                setBukti(null);
                return;
            }
            if (file.size > MAX_FILE_MB * 1024 * 1024) {
                setErrors((prev) => ({ ...prev, bukti: `Ukuran file maksimal ${MAX_FILE_MB}MB.` }));
                setBukti(null);
                return;
            }
        }

        setErrors((prev) => ({ ...prev, bukti: undefined }));
        setBukti(file);
    }

    function validate(): boolean {
        const next: FormErrors = {};

        if (!form.tanggal_mulai) next.tanggal_mulai = 'Tanggal mulai wajib diisi.';
        if (!form.tanggal_selesai) next.tanggal_selesai = 'Tanggal selesai wajib diisi.';
        if (form.tanggal_mulai && form.tanggal_selesai && new Date(form.tanggal_selesai) < new Date(form.tanggal_mulai)) {
            next.tanggal_selesai = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
        }
        if (!form.jenis_izin) next.jenis_izin = 'Jenis izin wajib dipilih.';
        if (!form.alasan.trim()) next.alasan = 'Alasan wajib diisi.';

        setErrors((prev) => ({ ...prev, ...next }));

        if (Object.keys(next).length > 0) {
            toast.error('Mohon lengkapi form terlebih dahulu.');
        }

        return Object.keys(next).length === 0;
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (!validate()) return;

        setSubmitting(true);
        try {
            const payload = new FormData();
            payload.append('tanggal_mulai', form.tanggal_mulai);
            payload.append('tanggal_selesai', form.tanggal_selesai);
            payload.append('jenis_izin', form.jenis_izin);
            payload.append('alasan', form.alasan.trim());
            if (form.kontak_darurat.trim()) payload.append('kontak_darurat', form.kontak_darurat.trim());
            if (bukti) payload.append('bukti', bukti);

            await api.post('/izin', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Pengajuan izin berhasil dikirim.');
            navigate('/izin');
        } catch (err: any) {
            if (err.response?.status === 422 && err.response.data?.errors) {
                const apiErrors = err.response.data.errors as Record<string, string[]>;
                setErrors({
                    tanggal_mulai: apiErrors.tanggal_mulai?.[0],
                    tanggal_selesai: apiErrors.tanggal_selesai?.[0],
                    jenis_izin: apiErrors.jenis_izin?.[0],
                    alasan: apiErrors.alasan?.[0],
                    bukti: apiErrors.bukti?.[0],
                });
                toast.error('Data yang diisi belum valid. Periksa kembali form.');
            } else if (err.response?.status === 403) {
                toast.error('Anda tidak punya akses untuk mengajukan izin.');
            } else {
                toast.error('Gagal mengirim pengajuan. Coba lagi.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <RouteModal
            title="Ajukan Izin"
            description="Isi form berikut untuk mengajukan permohonan izin."
            fallbackPath="/izin"
            onClose={closeModal}
            maxWidthClassName="max-w-2xl"
        >
            <>
                <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    min={todayISO()}
                                    value={form.tanggal_mulai}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        updateField('tanggal_mulai', value);
                                        if (value && form.jenis_izin === 'lahiran') {
                                            updateField('tanggal_selesai', tambahBulan(value, 3));
                                        } else if (value && DURASI_HARI[form.jenis_izin as JenisIzin]) {
                                            updateField('tanggal_selesai', tambahHari(value, DURASI_HARI[form.jenis_izin as JenisIzin]!));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                                        errors.tanggal_mulai ? 'border-red-300' : 'border-gray-200'
                                    }`}
                                />
                                {errors.tanggal_mulai && <p className="text-xs text-red-600 mt-1">{errors.tanggal_mulai}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
                                <input
                                    type="date"
                                    min={form.tanggal_mulai || todayISO()}
                                    value={form.tanggal_selesai}
                                    onChange={(e) => updateField('tanggal_selesai', e.target.value)}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                                        errors.tanggal_selesai ? 'border-red-300' : 'border-gray-200'
                                    }`}
                                />
                                {errors.tanggal_selesai && <p className="text-xs text-red-600 mt-1">{errors.tanggal_selesai}</p>}
                            </div>
                        </div>

                        {lamaIzin > 0 && (
                            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                Lama izin: <span className="font-medium text-gray-700">{lamaIzin} hari</span>
                            </p>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Izin</label>
                            <select
                                value={form.jenis_izin}
                                onChange={(e) => {
                                    const value = e.target.value as JenisIzin;
                                    updateField('jenis_izin', value);
                                    if (!form.tanggal_mulai) return;
                                    if (value === 'lahiran') {
                                        updateField('tanggal_selesai', tambahBulan(form.tanggal_mulai, 3));
                                    } else if (DURASI_HARI[value]) {
                                        updateField('tanggal_selesai', tambahHari(form.tanggal_mulai, DURASI_HARI[value]!));
                                    }
                                }}
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                                    errors.jenis_izin ? 'border-red-300' : 'border-gray-200'
                                }`}
                            >
                                <option value="" disabled>
                                    Pilih jenis izin...
                                </option>
                                {jenisOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            {errors.jenis_izin && <p className="text-xs text-red-600 mt-1">{errors.jenis_izin}</p>}
                            {form.jenis_izin === 'lahiran' && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Tanggal selesai otomatis dihitung 3 bulan dari tanggal mulai — bisa diubah manual kalau perlu.
                                </p>
                            )}
                            {DURASI_HARI[form.jenis_izin as JenisIzin] && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Tanggal selesai otomatis dihitung {DURASI_HARI[form.jenis_izin as JenisIzin]} hari dari tanggal mulai — bisa diubah manual kalau perlu.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alasan</label>
                            <textarea
                                rows={4}
                                placeholder="Jelaskan alasan pengajuan izin..."
                                value={form.alasan}
                                onChange={(e) => updateField('alasan', e.target.value)}
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                                    errors.alasan ? 'border-red-300' : 'border-gray-200'
                                }`}
                            />
                            {errors.alasan && <p className="text-xs text-red-600 mt-1">{errors.alasan}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Bukti (opsional)</label>
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-sm file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                            />
                            <p className="text-xs text-gray-400 mt-1">Format PDF, JPG, atau PNG. Maks {MAX_FILE_MB}MB.</p>
                            {errors.bukti && <p className="text-xs text-red-600 mt-1">{errors.bukti}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kontak Darurat (opsional)</label>
                            <input
                                type="text"
                                placeholder="Nomor telepon yang bisa dihubungi..."
                                value={form.kontak_darurat}
                                onChange={(e) => updateField('kontak_darurat', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={submitting}
                                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                                {submitting ? 'Mengirim...' : 'Submit'}
                            </button>
                        </div>
                </form>
            </>
        </RouteModal>
    );
}