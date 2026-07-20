import { useEffect, useState } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import { FileText, Package, Wallet } from 'lucide-react';
import api from '../api/axios';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan';
type SectionKey = 'kepegawaian' | 'inventaris' | 'keuangan';

interface TopKaryawan {
    nama: string;
    jumlah: number;
}

interface KeuanganBulanan {
    bulan: string;
    pemasukan: number;
    pengeluaran: number;
}

interface TrenPengajuan {
    bulan: string;
    pengajuan: number;
}

interface mutasiBarang {
    bulan: string;
    jumlah_masuk: number;
    jumlah_keluar: number;
}

/* ========================================================================= */
// Palet warna disamain sama sisa halaman lain di aplikasi (slate/emerald/amber/red),
// bukan gray/green/yellow generik recharts lagi.
const COLOR = {
    primary: '#0F172A', // slate-900 -- dipakai buat metrik netral/utama
    emerald: '#059669', // slate emerald-600 -- positif (masuk, pemasukan, disetujui)
    red: '#DC2626', // red-600 -- negatif (keluar, pengeluaran, ditolak)
    amber: '#D97706', // amber-600 -- pending/menunggu
    grid: '#F1F5F9', // slate-100
    axis: '#64748B', // slate-500
    tickLabel: '#334155', // slate-700
};

function formatRupiah(value: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(value);
}

function formatRupiahSingkat(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}jt`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
    return `${value}`;
}

interface StatCardProps {
    label: string;
    value: string;
    hint?: string;
    accent?: 'default' | 'green' | 'red' | 'yellow';
}

const accentStyles: Record<NonNullable<StatCardProps['accent']>, { text: string; bg: string }> = {
    default: { text: 'text-slate-900', bg: 'bg-slate-100' },
    green: { text: 'text-emerald-600', bg: 'bg-emerald-50' },
    red: { text: 'text-red-600', bg: 'bg-red-50' },
    yellow: { text: 'text-amber-600', bg: 'bg-amber-50' },
};

function StatCard({ label, value, hint, accent = 'default' }: StatCardProps) {
    const style = accentStyles[accent];
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${style.text}`}>{value}</p>
            {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
    );
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString.replace(' ', 'T')); // jaga-jaga kalau format "YYYY-MM-DD HH:mm:ss"
    if (isNaN(date.getTime())) return '-';

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam yang lalu`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} hari yang lalu`;
    const diffMonth = Math.floor(diffDay / 30);
    return `${diffMonth} bulan yang lalu`;
}

interface SectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
    return (
        <div className="mb-8">
            <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
            </div>
            {children}
        </div>
    );
}

const chartTooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: '1px solid #E2E8F0',
};

const sections: { key: SectionKey; label: string; icon: typeof FileText }[] = [
    { key: 'kepegawaian', label: 'Kepegawaian', icon: FileText },
    { key: 'inventaris', label: 'Inventaris', icon: Package },
    { key: 'keuangan', label: 'Keuangan', icon: Wallet },
];

// Isi tab "Analytics" di halaman Dashboard (bukan halaman/route sendiri lagi).
// UBAH: sebelumnya semua kartu & chart ditumpuk vertikal jadi satu wall-of-cards.
// Sekarang dipecah jadi sub-tab (Kepegawaian / Inventaris / Keuangan) biar tiap
// section fokus & gak numpuk, dan palet warnanya disamain sama halaman lain
// (slate/emerald/amber/red) -- lihat konstanta COLOR di atas.
export default function DashboardAnalyticsTab() {
    const [currentRole, setCurrentRole] = useState<Role | null>(null);
    const [checkingAccess, setCheckingAccess] = useState<boolean>(true);
    const [activeSection, setActiveSection] = useState<SectionKey>('kepegawaian');
    const [mutasi, setMutasi] = useState<mutasiBarang[]>([]);
    const [ringkasanIzin, setRingkasanIzin] = useState({
        total: 0,
        pending: 0,
        disetujui: 0,
        ditolak: 0,
    });
    const [totalBarang, setTotalBarang] = useState({
        jumlah_masuk: 0,
        jumlah_keluar: 0,
        update_masuk: null as string | null,
        update_keluar: null as string | null,
    });
    const [topKaryawan, setTopKaryawan] = useState<TopKaryawan[]>([]);
    const [topKehadiran, setTopKehadiran] = useState<TopKaryawan[]>([]);
    const [grafikP, setGrafikP] = useState<TrenPengajuan[]>([]);
    // UBAH: sekarang array per-bulan (6 bulan terakhir), bukan objek total tunggal
    const [keuangan, setKeuangan] = useState<KeuanganBulanan[]>([]);

    // re-render tiap 30 detik biar teks "X menit yang lalu" ikut jalan tanpa refresh manual
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        api.get('/dashboard-analytics/top-karyawan')
           .then((res) => setTopKaryawan(res.data))
           .catch((err) => {
            console.error(err)
           });
        api.get('/dashboard-analytics/top-kehadiran')
           .then((res) => setTopKehadiran(res.data))
           .catch((err) => {
            console.error(err)
           });
        api.get('/dashboard-analytics/analisis-izin')
           .then((res) => {
            setRingkasanIzin(res.data);
           })
           .catch((err) => {
                console.error(err);
           })
        api.get('/dashboard-analytics/mutasi-barang')
           .then((res) => {
            setMutasi(res.data); // UBAH: backend sekarang balikin array 6 bulan langsung
           })
           .catch((err) => {
            console.error(err)
           })
        api.get('/dashboard-analytics/total-barang')
           .then((res) => {
            setTotalBarang(res.data);
           })
           .catch((err) => {
            console.error(err)
           })
        api.get('/dashboard-analytics/grafik-pengajuan')
           .then((res) => {
            setGrafikP(res.data);
           })
           .catch((err) => {
            console.error(err)
           })
        api.get('/dashboard-analytics/total-keuangan')
           .then((res) => {
            setKeuangan(res.data)
           })
           .catch((err) => {
            console.error(err);
           })
        api
            .get<{ role: Role }>('/user')
            .then((res) => setCurrentRole(res.data.role))
            .catch(() => setCurrentRole(null))
            .finally(() => setCheckingAccess(false));
    }, []);

    const isApprover = currentRole === 'admin' || currentRole === 'hr' || currentRole === 'manajer';

    if (checkingAccess) {
        return <p className="text-center text-sm text-slate-400 py-16">Memuat...</p>;
    }

    if (!isApprover) {
        // Defense-in-depth: seharusnya tab ini sudah disembunyikan dari Dashboard.tsx
        // buat role karyawan, tapi tetap dicek ulang di sini kalau-kalau tab dibuka manual.
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <h1 className="text-base font-semibold text-slate-900 mb-1">Akses terbatas</h1>
                <p className="text-sm text-slate-500">
                    Halaman ini hanya bisa diakses oleh admin, HR, atau manajer.
                </p>
            </div>
        );
    }

    // UBAH: total pemasukan/pengeluaran dijumlah dari data 6 bulan, bukan dummy lagi
    const totalPemasukan = keuangan.reduce((sum, k) => sum + k.pemasukan, 0);
    const totalPengeluaran = keuangan.reduce((sum, k) => sum + k.pengeluaran, 0);
    const saldoBersih = totalPemasukan - totalPengeluaran;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Sub-nav section, gaya sama kayak tab di halaman Karyawan / Master Data */}
            <nav className="mb-6">
                <ul className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
                    {sections.map(({ key, label, icon: Icon }) => (
                        <li key={key}>
                            <button
                                onClick={() => setActiveSection(key)}
                                className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                    activeSection === key
                                        ? 'border-slate-900 text-slate-900 font-medium'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Icon size={16} />
                                {label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {activeSection === 'kepegawaian' && (
                <>
                    <Section title="Ringkasan Izin">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatCard label="Total Pengajuan" value={`${ringkasanIzin.total}`} />
                            <StatCard label="Menunggu" value={`${ringkasanIzin.pending}`} accent="yellow" />
                            <StatCard label="Disetujui" value={`${ringkasanIzin.disetujui}`} accent="green" />
                            <StatCard label="Ditolak" value={`${ringkasanIzin.ditolak}`} accent="red" />
                        </div>
                    </Section>

                    <Section title="Tren Pengajuan Izin" description="Jumlah pengajuan izin per bulan, 6 bulan terakhir.">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={grafikP} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pengajuanGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={COLOR.primary} stopOpacity={0.18} />
                                            <stop offset="100%" stopColor={COLOR.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLOR.grid} />
                                    <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={chartTooltipStyle} />
                                    <Area type="monotone" dataKey="pengajuan" name="Pengajuan" stroke={COLOR.primary} strokeWidth={2} fill="url(#pengajuanGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <div className="mb-3">
                                <h2 className="text-sm font-semibold text-slate-900">Karyawan Kehadiran Terbanyak</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Top 5 karyawan berdasarkan jumlah absensi hadir.</p>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart
                                        data={topKehadiran}
                                        layout="vertical"
                                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLOR.grid} />
                                        <XAxis type="number" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="nama"
                                            tick={{ fontSize: 12, fill: COLOR.tickLabel }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={110}
                                        />
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="jumlah" name="Hadir" fill={COLOR.emerald} radius={[0, 4, 4, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div>
                            <div className="mb-3">
                                <h2 className="text-sm font-semibold text-slate-900">Karyawan Pengajuan Izin Terbanyak</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Top 5 karyawan berdasarkan jumlah pengajuan.</p>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart
                                        data={topKaryawan}
                                        layout="vertical"
                                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLOR.grid} />
                                        <XAxis type="number" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="nama"
                                            tick={{ fontSize: 12, fill: COLOR.tickLabel }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={110}
                                        />
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="jumlah" name="Pengajuan" fill={COLOR.primary} radius={[0, 4, 4, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeSection === 'inventaris' && (
                <>
                    <Section title="Ringkasan Inventaris">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                label="Total Barang Masuk"
                                value={`${totalBarang.jumlah_masuk.toLocaleString('id-ID')}`}
                                hint={totalBarang.update_masuk ? `Update ${formatRelativeTime(totalBarang.update_masuk)}` : '6 bulan terakhir'}
                                accent="green"
                            />
                            <StatCard
                                label="Total Barang Keluar"
                                value={`${totalBarang.jumlah_keluar.toLocaleString('id-ID')}`}
                                hint={totalBarang.update_keluar ? `Update ${formatRelativeTime(totalBarang.update_keluar)}` : '6 bulan terakhir'}
                                accent="red"
                            />
                        </div>
                    </Section>

                    <Section title="Barang Masuk vs Keluar" description="Perbandingan jumlah barang masuk dan keluar per bulan.">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={mutasi} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLOR.grid} />
                                    <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={chartTooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="jumlah_masuk" name="Barang Masuk" fill={COLOR.emerald} radius={[4, 4, 0, 0]} barSize={18} />
                                    <Bar dataKey="jumlah_keluar" name="Barang Keluar" fill={COLOR.red} radius={[4, 4, 0, 0]} barSize={18} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>
                </>
            )}

            {activeSection === 'keuangan' && (
                <>
                    <Section title="Ringkasan Keuangan">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatCard label="Total Pemasukan" value={formatRupiah(totalPemasukan)} hint="6 bulan terakhir" accent="green" />
                            <StatCard label="Total Pengeluaran" value={formatRupiah(totalPengeluaran)} hint="6 bulan terakhir" accent="red" />
                            <StatCard
                                label="Saldo Bersih"
                                value={formatRupiah(saldoBersih)}
                                hint="6 bulan terakhir"
                                accent={saldoBersih >= 0 ? 'green' : 'red'}
                            />
                        </div>
                    </Section>

                    <Section title="Pemasukan vs Pengeluaran" description="Arus keuangan per bulan, 6 bulan terakhir.">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={keuangan} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLOR.grid} />
                                    <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: COLOR.axis }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v: number) => formatRupiahSingkat(v)}
                                        width={48}
                                    />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatRupiah(Number(value ?? 0))} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Line type="monotone" dataKey="pemasukan" name="Pemasukan" stroke={COLOR.emerald} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke={COLOR.red} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
}
