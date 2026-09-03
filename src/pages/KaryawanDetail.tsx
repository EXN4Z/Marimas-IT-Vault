import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import RouteModal from '../components/shared/RouteModal';
import { Skeleton } from '../components/shared/skeleton';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan' | 'guest' | 'cabang';

interface User {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    role: Role;
    nik: string | null;
    departemen: { id: number; nama: string } | null;
    lokasi_kantor: { id: number; nama: string } | null;
    tanggal_masuk: string | null;
    created_at?: string | null;
}

const roleLabels: Record<Role, string> = {
    admin: 'Admin',
    hr: 'HR',
    manajer: 'Manajer',
    karyawan: 'Karyawan',
    guest: 'Guest',
    cabang: 'Cabang',
};

const roleStyles: Record<Role, string> = {
    admin: 'bg-red-50 text-red-700',
    hr: 'bg-pink-50 text-pink-700',
    manajer: 'bg-purple-50 text-purple-700',
    karyawan: 'bg-teal-50 text-teal-700',
    guest: 'bg-gray-50 text-gray-700',
    cabang: 'bg-blue-50 text-blue-700',
};

function initials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function formatTanggal(value: string | null): string {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return value;
    }
}

// BARU: halaman detail karyawan (read-only) -- dibuka dari tombol "Detail"
// di tab Data User (TabKaryawan.tsx). Pola modalnya sama kayak
// KaryawanEdit/KaryawanCreate (RouteModal + backgroundLocation), cuma
// isinya read-only, gak ada form submit.
export default function KaryawanDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string>('');

    useEffect(() => {
        setLoading(true);
        setErrorMsg('');
        api
            .get<User>(`/karyawan/${id}`)
            .then((res) => setUser(res.data))
            .catch((err) => {
                if (err.response?.status === 403) {
                    setErrorMsg('Anda tidak punya akses untuk melihat data ini.');
                } else if (err.response?.status === 404) {
                    setErrorMsg('User tidak ditemukan.');
                } else {
                    setErrorMsg('Gagal memuat data user.');
                    toast.error('Gagal memuat data user.');
                }
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

    if (loading) {
        return (
            <RouteModal title="Detail Karyawan" fallbackPath="/karyawan" onClose={closeModal}>
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="space-y-1.5">
                            <Skeleton className="h-3 w-24 rounded" />
                            <Skeleton className="h-4 w-full rounded" />
                        </div>
                    ))}
                </div>
            </RouteModal>
        );
    }

    if (errorMsg || !user) {
        return (
            <RouteModal title="Detail Karyawan" fallbackPath="/karyawan" onClose={closeModal}>
                <p className="text-sm text-gray-500 text-center py-6">{errorMsg || 'User tidak ditemukan.'}</p>
            </RouteModal>
        );
    }

    return (
        <RouteModal
            title="Detail Karyawan"
            description="Informasi lengkap data user ini."
            fallbackPath="/karyawan"
            onClose={closeModal}
        >
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700 flex-shrink-0">
                        {initials(user.name)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full ${roleStyles[user.role]}`}>
                            {roleLabels[user.role]}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem label="Email" value={user.email || '-'} />
                    <DetailItem label="Nomor Telepon" value={user.phone || '-'} />
                    {user.role !== 'cabang' && <DetailItem label="NIK" value={user.nik || '-'} />}
                    {user.role !== 'cabang' && (
                        <DetailItem label="Departemen" value={user.departemen?.nama || '-'} />
                    )}
                    <DetailItem label="Cabang" value={user.lokasi_kantor?.nama || '-'} />
                    {user.role !== 'cabang' && (
                        <DetailItem label="Tanggal Masuk" value={formatTanggal(user.tanggal_masuk)} />
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={closeModal}
                        className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/karyawan/${user.id}/edit`, { state: { backgroundLocation: location } , replace: true})}
                        className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
                    >
                        Edit
                    </button>
                </div>
            </div>
        </RouteModal>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
            <p className="text-sm text-gray-900 break-words">{value}</p>
        </div>
    );
}