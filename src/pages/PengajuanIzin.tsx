import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/AppLayout';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan';
type Status = 'pending' | 'disetujui' | 'ditolak' | 'revisi' | 'selesai' | 'draft';
type TabKey = 'semua' | 'pending' | 'disetujui' | 'ditolak';
type JenisIzin = 'tahunan' | 'pribadi' | 'sakit' | 'terlambat' | 'pulang_cepat' | 'dinas' | 'lahiran' | 'pendamping_lahiran' | 'duka_serumah' | 'duka_keluarga_inti' | 'lainnya';

// Backend hardcode base URL yang sama dengan axios.ts, dipakai buat link bukti izin
const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

interface Pemohon {
    id: number;
    name: string;
    email: string;
    pekerja?: {
        departemen?: { nama: string } | null;
        jabatan?: { nama: string } | null;
    } | null;
}

interface Izin {
    id: number;
    nomor_izin: string;
    karyawan: Pemohon;
    jenis_izin: JenisIzin;
    tanggal_mulai: string;
    tanggal_selesai: string;
    lama_izin: number;
    alasan: string;
    bukti_path: string | null;
    kontak_darurat: string | null;
    status: Status;
    catatan_atasan: string | null;
    reviewer: { name: string } | null;
    created_at: string;
}

interface DashboardData {
    total_pengajuan: number;
    menunggu_persetujuan: number;
    disetujui: number;
    ditolak: number;
    izin_hari_ini: number;
    riwayat_terbaru: Izin[];
}

const statusStyles: Record<Status, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    disetujui: 'bg-green-50 text-green-700',
    ditolak: 'bg-red-50 text-red-700',
    revisi: 'bg-blue-50 text-blue-700',
    selesai: 'bg-gray-100 text-gray-700',
    draft: 'bg-gray-50 text-gray-500',
};

const statusLabels: Record<Status, string> = {
    pending: 'Menunggu',
    disetujui: 'Disetujui',
    ditolak: 'Ditolak',
    revisi: 'Revisi',
    selesai: 'Selesai',
    draft: 'Draft',
};

const jenisLabels: Record<JenisIzin, string> = {
    tahunan: 'Cuti Tahunan',
    pribadi: 'Izin Pribadi',
    sakit: 'Izin Sakit',
    terlambat: 'Izin Terlambat',
    pulang_cepat: 'Izin Pulang Cepat',
    dinas: 'Izin Dinas',
    lahiran: 'Cuti Lahiran',
    pendamping_lahiran: 'Cuti Mendampingi Istri Lahiran',
    duka_serumah: 'Izin Duka (Serumah)',
    duka_keluarga_inti: 'Izin Duka (Pasangan/Anak/Orang Tua)',
    lainnya: 'Izin Lainnya',
};

const tabs: { key: TabKey; label: string }[] = [
    { key: 'semua', label: 'Semua Pengajuan' },
    { key: 'pending', label: 'Menunggu' },
    { key: 'disetujui', label: 'Disetujui' },
    { key: 'ditolak', label: 'Ditolak' },
];

function initials(name: string): string {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatTanggal(tanggal: string): string {
    return new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PengajuanIzinPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [izinList, setIzinList] = useState<Izin[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [currentRole, setCurrentRole] = useState<Role | null>(null);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    const [search, setSearch] = useState<string>('');
    const [activeTab, setActiveTab] = useState<TabKey>('semua');

    const [detailId, setDetailId] = useState<number | null>(null);
    const [detailData, setDetailData] = useState<Izin | null>(null);
    const [detailLoading, setDetailLoading] = useState<boolean>(false);
    const [detailProcessing, setDetailProcessing] = useState<boolean>(false);
    const [catatan, setCatatan] = useState<string>('');

    const [confirmTarget, setConfirmTarget] = useState<{ izin: Izin; action: 'batalkan' } | null>(null);
    const [processing, setProcessing] = useState<boolean>(false);

    const fetchList = useCallback(() => {
        setLoading(true);
        setErrorMsg('');
        api
            .get('/izin', {
                params: {
                    status: activeTab === 'semua' ? undefined : activeTab,
                    search: search || undefined,
                    per_page: 50,
                },
            })
            .then((res) => setIzinList(res.data.data ?? res.data))
            .catch((err) => {
                if (err.response?.status === 403) {
                    setErrorMsg('Anda tidak punya akses ke halaman ini.');
                } else {
                    setErrorMsg('Gagal memuat data. Coba lagi.');
                }
            })
            .finally(() => setLoading(false));
    }, [activeTab, search]);

    useEffect(() => {
        api
            .get<{ id: number; role: Role }>('/user')
            .then((res) => {
                setCurrentRole(res.data.role);
                setCurrentUserId(res.data.id);
            })
            .catch(() => {});

        api
            .get<DashboardData>('/izin/dashboard')
            .then((res) => setDashboard(res.data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const isApprover = currentRole === 'admin' || currentRole === 'hr' || currentRole === 'manajer';

    const filtered = useMemo<Izin[]>(() => {
        const q = search.toLowerCase().trim();
        if (!q) return izinList;
        return izinList.filter(
            (i) =>
                i.nomor_izin.toLowerCase().includes(q) ||
                (i.karyawan?.name ?? '').toLowerCase().includes(q) ||
                i.alasan.toLowerCase().includes(q)
        );
    }, [izinList, search]);

    function openDetail(id: number) {
        setDetailId(id);
        setDetailLoading(true);
        setCatatan('');
        api
            .get<Izin>(`/izin/${id}`)
            .then((res) => setDetailData(res.data))
            .catch(() => setErrorMsg('Gagal memuat detail pengajuan.'))
            .finally(() => setDetailLoading(false));
    }

    function closeDetail() {
        setDetailId(null);
        setDetailData(null);
        setCatatan('');
    }

    async function handleStatusUpdate(status: 'disetujui' | 'ditolak') {
        if (!detailData) return;
        setDetailProcessing(true);
        try {
            await api.patch(`/izin/${detailData.id}/status`, { status, catatan_atasan: catatan || undefined });
            closeDetail();
            fetchList();
            api.get<DashboardData>('/izin/dashboard').then((res) => setDashboard(res.data)).catch(() => {});
        } catch (err: any) {
            setErrorMsg(err.response?.status === 403 ? 'Anda tidak punya akses untuk melakukan aksi ini.' : 'Gagal memproses pengajuan.');
        } finally {
            setDetailProcessing(false);
        }
    }

    async function handleBatalkan() {
        if (!confirmTarget) return;
        setProcessing(true);
        try {
            await api.delete(`/izin/${confirmTarget.izin.id}`);
            setConfirmTarget(null);
            closeDetail();
            fetchList();
        } catch {
            setErrorMsg('Gagal membatalkan pengajuan.');
        } finally {
            setProcessing(false);
        }
    }

    return (
        <AppLayout title="Pengajuan Izin">
            <div className="max-w-6xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Pengajuan Izin</h1>
                        <p className="text-sm text-gray-500 mt-1">Kelola dan pantau seluruh pengajuan izin karyawan.</p>
                    </div>
                    <button
                        onClick={() => navigate('/izin/create', { state: { backgroundLocation: location } })}
                        className="flex items-center justify-center gap-2 bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 whitespace-nowrap"
                    >
                        + Ajukan Izin
                    </button>
                </div>

                {dashboard && <DashboardCards data={dashboard} />}

                <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
                    <nav className="mb-4">
                        <ul className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto">
                            {tabs.map((tab) => (
                                <li key={tab.key}>
                                    <button
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                            activeTab === tab.key
                                                ? 'border-black text-black font-medium'
                                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="relative mb-4">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Cari nomor izin, nama, atau alasan..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                        Total ada <span className="font-semibold text-gray-900">{filtered.length}</span> pengajuan
                    </p>

                    {loading && <p className="text-center text-sm text-gray-400 py-8">Memuat data...</p>}
                    {!loading && errorMsg && <p className="text-center text-sm text-gray-400 py-8">{errorMsg}</p>}
                    {!loading && !errorMsg && filtered.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-8">Tidak ada pengajuan yang cocok.</p>
                    )}

                    {!loading && !errorMsg && filtered.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                        <th className="py-2 pr-3 font-medium">Nomor Izin</th>
                                        <th className="py-2 pr-3 font-medium">Karyawan</th>
                                        <th className="py-2 pr-3 font-medium">Tanggal</th>
                                        <th className="py-2 pr-3 font-medium">Jenis</th>
                                        <th className="py-2 pr-3 font-medium">Status</th>
                                        <th className="py-2 pr-3 font-medium text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((izin) => (
                                        <tr key={izin.id}>
                                            <td className="py-3 pr-3 font-medium text-gray-900">{izin.nomor_izin}</td>
                                            <td className="py-3 pr-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-700">
                                                        {initials(izin.karyawan?.name ?? '?')}
                                                    </div>
                                                    <span className="text-gray-800">{izin.karyawan?.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 text-gray-600">{formatTanggal(izin.tanggal_mulai)}</td>
                                            <td className="py-3 pr-3 text-gray-600">{jenisLabels[izin.jenis_izin]}</td>
                                            <td className="py-3 pr-3">
                                                <span className={`text-xs px-3 py-1 rounded-full ${statusStyles[izin.status]}`}>
                                                    {statusLabels[izin.status]}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 text-right">
                                                <button
                                                    onClick={() => openDetail(izin.id)}
                                                    className="text-xs text-gray-600 hover:text-black border border-gray-200 rounded-lg px-3 py-1"
                                                >
                                                    Detail
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {detailId !== null && (
                <DetailModal
                    data={detailData}
                    loading={detailLoading}
                    processing={detailProcessing}
                    isApprover={isApprover}
                    isOwner={detailData?.karyawan?.id === currentUserId}
                    catatan={catatan}
                    onCatatanChange={setCatatan}
                    onClose={closeDetail}
                    onSetujui={() => handleStatusUpdate('disetujui')}
                    onTolak={() => handleStatusUpdate('ditolak')}
                    onBatalkan={() => detailData && setConfirmTarget({ izin: detailData, action: 'batalkan' })}
                />
            )}

            {confirmTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
                    <div className="bg-white rounded-xl w-full max-w-sm p-5">
                        <h2 className="text-base font-semibold text-gray-900 mb-1">Batalkan pengajuan izin?</h2>
                        <p className="text-sm text-gray-500 mb-5">
                            Pengajuan <span className="font-medium text-gray-700">{confirmTarget.izin.nomor_izin}</span> akan dibatalkan dan tidak bisa dikembalikan.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmTarget(null)}
                                disabled={processing}
                                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBatalkan}
                                disabled={processing}
                                className="text-sm px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                            >
                                {processing ? 'Memproses...' : 'Ya, batalkan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

function DashboardCards({ data }: { data: DashboardData }) {
    const cards: { label: string; value: number; className: string }[] = [
        { label: 'Total Pengajuan', value: data.total_pengajuan, className: 'text-gray-900' },
        { label: 'Menunggu Persetujuan', value: data.menunggu_persetujuan, className: 'text-yellow-700' },
        { label: 'Disetujui', value: data.disetujui, className: 'text-green-700' },
        { label: 'Ditolak', value: data.ditolak, className: 'text-red-700' },
        { label: 'Izin Hari Ini', value: data.izin_hari_ini, className: 'text-blue-700' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((c) => (
                <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.className}`}>{c.value}</p>
                </div>
            ))}
        </div>
    );
}

interface DetailModalProps {
    data: Izin | null;
    loading: boolean;
    processing: boolean;
    isApprover: boolean;
    isOwner: boolean;
    catatan: string;
    onCatatanChange: (v: string) => void;
    onClose: () => void;
    onSetujui: () => void;
    onTolak: () => void;
    onBatalkan: () => void;
}

function DetailModal({ data, loading, processing, isApprover, isOwner, catatan, onCatatanChange, onClose, onSetujui, onTolak, onBatalkan }: DetailModalProps) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Detail Pengajuan Izin</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {loading && <p className="text-sm text-gray-400 py-6 text-center">Memuat detail...</p>}

                {!loading && data && (
                    <>
                        <div className="space-y-3 mb-5">
                            <Row label="Nomor Pengajuan" value={data.nomor_izin} />
                            <Row label="Nama Karyawan" value={data.karyawan?.name} />
                            <Row label="Divisi" value={data.karyawan?.pekerja?.departemen?.nama ?? '-'} />
                            <Row label="Jabatan" value={data.karyawan?.pekerja?.jabatan?.nama ?? '-'} />
                            <Row label="Tanggal Pengajuan" value={formatTanggal(data.created_at)} />
                            <Row label="Jenis Izin" value={jenisLabels[data.jenis_izin]} />
                            <Row
                                label="Periode"
                                value={`${formatTanggal(data.tanggal_mulai)} - ${formatTanggal(data.tanggal_selesai)}`}
                            />
                            <Row label="Lama Izin" value={`${data.lama_izin} hari`} />
                            {data.kontak_darurat && <Row label="Kontak Darurat" value={data.kontak_darurat} />}
                            <div>
                                <span className="text-xs text-gray-500">Alasan</span>
                                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">
                                    {data.alasan}
                                </p>
                            </div>
                            {data.bukti_path && (
                                <div>
                                    <span className="text-xs text-gray-500">Bukti Lampiran</span>
                                    <a
                                        href={`${STORAGE_BASE_URL}${data.bukti_path}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block text-sm text-blue-600 hover:underline mt-1"
                                    >
                                        Lihat lampiran
                                    </a>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Status</span>
                                <span className={`text-xs px-3 py-1 rounded-full ${statusStyles[data.status]}`}>
                                    {statusLabels[data.status]}
                                </span>
                            </div>
                            {data.catatan_atasan && (
                                <div>
                                    <span className="text-xs text-gray-500">Catatan Atasan {data.reviewer ? `(${data.reviewer.name})` : ''}</span>
                                    <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">
                                        {data.catatan_atasan}
                                    </p>
                                </div>
                            )}
                        </div>

                        {isApprover && data.status === 'pending' && (
                            <div className="mb-4">
                                <label className="block text-xs text-gray-500 mb-1">Berikan Catatan (opsional)</label>
                                <textarea
                                    rows={2}
                                    value={catatan}
                                    onChange={(e) => onCatatanChange(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                                    placeholder="Catatan untuk karyawan..."
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={onClose}
                                disabled={processing}
                                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Tutup
                            </button>
                            {isOwner && data.status === 'pending' && (
                                <button
                                    onClick={onBatalkan}
                                    disabled={processing}
                                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Batalkan
                                </button>
                            )}
                            {isApprover && data.status === 'pending' && (
                                <>
                                    <button
                                        onClick={onTolak}
                                        disabled={processing}
                                        className="text-sm px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {processing ? 'Memproses...' : '❌ Reject'}
                                    </button>
                                    <button
                                        onClick={onSetujui}
                                        disabled={processing}
                                        className="text-sm px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {processing ? 'Memproses...' : '✅ Approve'}
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value?: string | null }): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-500 shrink-0">{label}</span>
            <span className="text-sm text-gray-900 text-right">{value ?? '-'}</span>
        </div>
    );
}