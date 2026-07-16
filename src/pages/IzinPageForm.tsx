import { useMemo, useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/AppLayout';

type JenisIzin = 'tahunan' | 'pribadi' | 'sakit' | 'terlambat' | 'pulang_cepat' | 'dinas' | 'lainnya';

const jenisOptions: { value: JenisIzin; label: string }[] = [
    { value: 'tahunan', label: 'Cuti Tahunan' },
    { value: 'pribadi', label: 'Izin Pribadi' },
    { value: 'sakit', label: 'Izin Sakit' },
    { value: 'terlambat', label: 'Izin Terlambat' },
    { value: 'pulang_cepat', label: 'Izin Pulang Cepat' },
    { value: 'dinas', label: 'Izin Dinas' },
    { value: 'lainnya', label: 'Izin Lainnya' },
];

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
    const [serverError, setServerError] = useState<string>('');

    const lamaIzin = useMemo(() => hitungLamaIzin(form.tanggal_mulai, form.tanggal_selesai), [form.tanggal_mulai, form.tanggal_selesai]);

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
        return Object.keys(next).length === 0;
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setServerError('');

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
            } else if (err.response?.status === 403) {
                setServerError('Anda tidak punya akses untuk mengajukan izin.');
            } else {
                setServerError('Gagal mengirim pengajuan. Coba lagi.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AppLayout title="Ajukan Izin">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-gray-900">Ajukan Izin</h1>
                    <p className="text-sm text-gray-500 mt-1">Isi form berikut untuk mengajukan permohonan izin.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                    {serverError && (
                        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {serverError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    min={todayISO()}
                                    value={form.tanggal_mulai}
                                    onChange={(e) => updateField('tanggal_mulai', e.target.value)}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 ${
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
                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 ${
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
                                onChange={(e) => updateField('jenis_izin', e.target.value as JenisIzin)}
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 bg-white ${
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
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alasan</label>
                            <textarea
                                rows={4}
                                placeholder="Jelaskan alasan pengajuan izin..."
                                value={form.alasan}
                                onChange={(e) => updateField('alasan', e.target.value)}
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 resize-none ${
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
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/izin')}
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
                </div>
            </div>
        </AppLayout>
    );
}