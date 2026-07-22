import { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  CalendarDays,
  FileText,
  Ticket,
  TrendingUp,
  Clock,
  ClipboardList,
  PackagePlus,
  PackageCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import api from '../api/axios';
import { echo } from '../lib/echo';
import type { User as UserType } from '../types/user';
import { getAgendaMendatang, type AgendaItem } from '../api/agenda';

// Role yang boleh liat bagian "Analytics" (ringkasan izin, tren pengajuan,
// top kehadiran/pengajuan, inventaris) — dulu ada di tab/halaman terpisah,
// sekarang digabung langsung ke satu halaman Dashboard, tinggal disembunyikan
// per-section kalau rolenya bukan approver.
const REVIEWER_ROLES = ['admin', 'hr', 'manajer', 'manager'];

// Palet tema dashboard: badge ikon warna solid + angka besar + bar chart
// dengan 1 bar disorot & garis rata-rata putus-putus.
const THEME = {
  violet: '#6D5DFC',
  violetDark: '#4C3FE0',
  emerald: '#12B76A',
  amber: '#F59E0B',
  rose: '#F04438',
  orange: '#FF7A50',
  grid: '#F1F5F9',
  axis: '#94A3B8',
};

const ACCENT_BADGE: Record<'violet' | 'orange' | 'amber' | 'emerald', string> = {
  violet: 'bg-[#6D5DFC]',
  orange: 'bg-[#FF7A50]',
  amber: 'bg-[#F59E0B]',
  emerald: 'bg-[#12B76A]',
};

function bebanColor(percent: number) {
  if (percent >= 70) return 'bg-rose-500';
  if (percent >= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatAgendaDate(dateString: string): string {
  const date = new Date(dateString.replace(' ', 'T'));
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleString('id-ID', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}


interface departemenDistribusi {
  departemen: string;
  jumlah: number;
  percent: number;
}

interface KehadiranHarian {
  day: string;
  tanggal: string;
  hadir: number;
  target: number;
}

interface BebanDepartemen {
  departemen: string;
  total: number;
  hadir: number;
  tidak_hadir: number;
  beban_percent: number;
}

interface StatItem {
  value: number | string;
  trend: string;
}

interface StatsCardResponse {
  kehadiran: StatItem;
  izin: StatItem;
  izinAktif: StatItem;
  ticket: StatItem;
}

interface TopKaryawan {
  nama: string;
  jumlah: number;
}

interface TrenPengajuan {
  bulan: string;
  pengajuan: number;
}

interface MutasiBulanan {
  bulan: string;
  jumlah_masuk: number;
  jumlah_keluar: number;
}

interface RingkasanIzin {
  total: number;
  pending: number;
  disetujui: number;
  ditolak: number;
}

interface TotalBarang {
  jumlah_masuk: number;
  jumlah_keluar: number;
  update_masuk: string | null;
  update_keluar: string | null;
}

async function fetchUser(): Promise<UserType> {
  const res = await api.get<UserType>('/user');
  return res.data;
}

interface NotificationItem {
  id: string;
  data: { message: string; nomor_izin?: string; status?: string; [key: string]: any };
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  unread_count: number;
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await api.get<NotificationsResponse>('/notifications');
  return res.data;
}

async function fetchStatsCard(): Promise<StatsCardResponse> {
  const res = await api.get<StatsCardResponse>('/dashboard/stats-card');
  return res.data;
}

async function fetchKehadiranMingguan(): Promise<KehadiranHarian[]> {
  const res = await api.get<KehadiranHarian[]>('/dashboard/kehadiran-mingguan');
  return res.data;
}

async function fetchBebanKerja(): Promise<BebanDepartemen[]> {
  const res = await api.get<BebanDepartemen[]>('/dashboard/beban-kerja');
  return res.data;
}

async function fetchAgenda(): Promise<AgendaItem[]> {
  return getAgendaMendatang(5);
}

async function fetchDepartemenDistribusi(): Promise<departemenDistribusi[]> {
  const res = await api.get<departemenDistribusi[]>('/dashboard/kpd');
  return res.data;
}

// Data khusus admin/hr/manajer — dulu di komponen/tab "Analytics" terpisah,
// sekarang query-nya langsung di sini, cuma diaktifkan (enabled) kalau rolenya approver.
async function fetchRingkasanIzin(): Promise<RingkasanIzin> {
  const res = await api.get<RingkasanIzin>('/dashboard-analytics/analisis-izin');
  return res.data;
}

async function fetchGrafikPengajuan(): Promise<TrenPengajuan[]> {
  const res = await api.get<TrenPengajuan[]>('/dashboard-analytics/grafik-pengajuan');
  return res.data;
}

async function fetchTopKehadiran(): Promise<TopKaryawan[]> {
  const res = await api.get<TopKaryawan[]>('/dashboard-analytics/top-kehadiran');
  return res.data;
}

async function fetchTopKaryawan(): Promise<TopKaryawan[]> {
  const res = await api.get<TopKaryawan[]>('/dashboard-analytics/top-karyawan');
  return res.data;
}

async function fetchMutasiBarang(): Promise<MutasiBulanan[]> {
  const res = await api.get<MutasiBulanan[]>('/dashboard-analytics/mutasi-barang');
  return res.data;
}

async function fetchTotalBarang(): Promise<TotalBarang> {
  const res = await api.get<TotalBarang>('/dashboard-analytics/total-barang');
  return res.data;
}

function buildStatCards(stats?: StatsCardResponse) {
  if (!stats) return [];
  return [
    { label: 'Kehadiran Bulan Ini', value: stats.kehadiran.value, unit: 'hari', trend: stats.kehadiran.trend, icon: QrCode, accent: 'violet' as const },
    { label: 'Izin Aktif', value: stats.izinAktif.value, unit: '', trend: stats.izinAktif.trend, icon: CalendarDays, accent: 'orange' as const },
    { label: 'Ticket Aktif', value: stats.ticket.value, unit: 'tiket', trend: stats.ticket.trend, icon: Ticket, accent: 'emerald' as const },
  ];
}

const AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit
const NOTIF_VISIBLE_COUNT = 2;
const cardClass = 'bg-white rounded-3xl p-5 sm:p-6 shadow-[0_2px_20px_rgba(15,23,42,0.06)] border border-slate-100';
// Padding khusus buat 4 stat card di paling atas — dibikin terpisah dari
// cardClass biar lebih pendek tanpa ikut ngubah tinggi card-card lain
// (chart, notifikasi, agenda, dll) yang masih pakai cardClass asli.
const statCardClass = 'bg-white rounded-3xl p-4 sm:p-4 shadow-[0_2px_20px_rgba(15,23,42,0.06)] border border-slate-100';

export default function Dashboard() {
  const { user: cachedUser, setUser } = useAuth();
  const [departemenLegacy, setDepartemenLegacy] = useState<departemenDistribusi[]>([]);
  const queryClient = useQueryClient();

  const isApprover = REVIEWER_ROLES.includes(cachedUser?.role ?? '');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000,
    initialData: cachedUser ?? undefined,
  });

  const { data: statsCard } = useQuery({
    queryKey: ['stats-card'],
    queryFn: fetchStatsCard,
    staleTime: 5 * 60 * 1000,
  });

  const { data: notificationsRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 60 * 1000,
  });

  const { data: kehadiranMingguan } = useQuery({
    queryKey: ['kehadiran-mingguan'],
    queryFn: fetchKehadiranMingguan,
    staleTime: 5 * 60 * 1000,
  });

  const { data: bebanKerja } = useQuery({
    queryKey: ['beban-kerja'],
    queryFn: fetchBebanKerja,
    staleTime: 5 * 60 * 1000,
  });

  const { data: agenda, isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda-mendatang'],
    queryFn: fetchAgenda,
    staleTime: 5 * 60 * 1000,
  });

  const { data: departemen } = useQuery({
    queryKey: ['departemen-distribusi'],
    queryFn: fetchDepartemenDistribusi,
    staleTime: 5 * 60 * 1000,
    initialData: departemenLegacy.length ? departemenLegacy : undefined,
  });

  // Query khusus admin/hr/manajer — cuma jalan kalau isApprover, biar gak
  // dapet 403 dari backend buat karyawan biasa.
  const { data: ringkasanIzin } = useQuery({
    queryKey: ['ringkasan-izin'],
    queryFn: fetchRingkasanIzin,
    enabled: isApprover,
    staleTime: 2 * 60 * 1000,
  });

  const { data: grafikPengajuan } = useQuery({
    queryKey: ['grafik-pengajuan'],
    queryFn: fetchGrafikPengajuan,
    enabled: isApprover,
    staleTime: 2 * 60 * 1000,
  });

  const { data: topKehadiran } = useQuery({
    queryKey: ['top-kehadiran'],
    queryFn: fetchTopKehadiran,
    enabled: isApprover,
    staleTime: 2 * 60 * 1000,
  });

  const { data: topKaryawan } = useQuery({
    queryKey: ['top-karyawan'],
    queryFn: fetchTopKaryawan,
    enabled: isApprover,
    staleTime: 2 * 60 * 1000,
  });

  const { data: mutasiBarang } = useQuery({
    queryKey: ['mutasi-barang'],
    queryFn: fetchMutasiBarang,
    enabled: isApprover,
    staleTime: 2 * 60 * 1000,
  });

  const { data: totalBarang } = useQuery({
    queryKey: ['total-barang'],
    queryFn: fetchTotalBarang,
    enabled: isApprover,
    staleTime: 2 * 60 * 1000,
  });

  const notifications = notificationsRes?.data ?? [];

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  // Fallback lama (kalau react-query belum sempat jalan) — dipertahankan
  // biar gak ada flash "kosong" pas pindah dari kode sebelumnya.
  useEffect(() => {
    api
      .get('/dashboard/kpd')
      .then((res) => setDepartemenLegacy(res.data))
      .catch((err) => console.log(err.response));
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!data?.id) return;
    if (!echo) return; // echo can be null when Pusher key not configured

    const channel = echo.private(`App.Models.User.${data.id}`);

    channel.notification((payload: any) => {
      queryClient.setQueryData<NotificationsResponse | undefined>(['notifications'], (old) => {
        const newItem: NotificationItem = {
          id: payload.id,
          data: {
            message: payload.message,
            nomor_izin: payload.nomor_izin,
            status: payload.status,
          },
          read_at: null,
          created_at: new Date().toISOString(),
        };

        return {
          data: [newItem, ...(old?.data ?? [])].slice(0, 20),
          unread_count: (old?.unread_count ?? 0) + 1,
        };
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pengajuan Izin', {
          body: payload.message,
          icon: '/logo.png', // hapus baris ini kalau belum ada file logo.png di folder public/
        });
      }

      queryClient.invalidateQueries({ queryKey: ['stats-card'] });
      queryClient.invalidateQueries({ queryKey: ['beban-kerja'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-mingguan'] });
      queryClient.invalidateQueries({ queryKey: ['ringkasan-izin'] });
      queryClient.invalidateQueries({ queryKey: ['grafik-pengajuan'] });
    });

    return () => {
      if (echo && typeof echo.leave === 'function') {
        echo.leave(`App.Models.User.${data.id}`);
      }
    };
  }, [data?.id, queryClient]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      queryClient.setQueryData<NotificationsResponse | undefined>(['notifications'], (old) => {
        if (!old) return old;
        return {
          data: old.data.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
          unread_count: Math.max(0, old.unread_count - (old.data.find((n) => n.id === id && !n.read_at) ? 1 : 0)),
        };
      });
    } catch (err) {
      console.log(err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.log(err);
    }
    queryClient.setQueryData<NotificationsResponse | undefined>(['notifications'], (old) => {
      if (!old) return old;
      return { ...old, data: old.data.filter((n) => n.id !== id) };
    });
  };

  const scheduledDeletes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    notifications.forEach((n) => {
      if (!n.read_at || scheduledDeletes.current[n.id]) return;

      const readAt = new Date(n.read_at).getTime();
      const deleteAt = readAt + AUTO_DELETE_AFTER_READ_MS;
      const delay = deleteAt - Date.now();

      if (delay <= 0) {
        deleteNotification(n.id);
        return;
      }

      scheduledDeletes.current[n.id] = setTimeout(() => {
        deleteNotification(n.id);
        delete scheduledDeletes.current[n.id];
      }, delay);
    });

    const currentIds = new Set(notifications.map((n) => n.id));
    Object.keys(scheduledDeletes.current).forEach((id) => {
      if (!currentIds.has(id)) {
        clearTimeout(scheduledDeletes.current[id]);
        delete scheduledDeletes.current[id];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  useEffect(() => {
    return () => {
      Object.values(scheduledDeletes.current).forEach(clearTimeout);
    };
  }, []);

  const loading = isLoading && !cachedUser;
  const error = isError ? 'Gagal memuat data user. Silakan login ulang.' : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <DashboardContent
        error={error}
        getGreeting={getGreeting}
        isApprover={isApprover}
        departemen={departemen ?? []}
        statCards={buildStatCards(statsCard)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        kehadiranMingguan={kehadiranMingguan ?? []}
        bebanKerja={bebanKerja ?? []}
        agenda={agenda ?? []}
        agendaLoading={agendaLoading}
        ringkasanIzin={ringkasanIzin}
        grafikPengajuan={grafikPengajuan ?? []}
        topKehadiran={topKehadiran ?? []}
        topKaryawan={topKaryawan ?? []}
        mutasiBarang={mutasiBarang ?? []}
        totalBarang={totalBarang}
      />
    </AppLayout>
  );
}

function StatBadge({ accent, children }: { accent: 'violet' | 'orange' | 'amber' | 'emerald'; children: React.ReactNode }) {
  return (
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white ${ACCENT_BADGE[accent]}`}>
      {children}
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        {label}
      </div>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function DashboardContent({
  error,
  isApprover,
  departemen,
  statCards,
  notifications,
  onMarkAsRead,
  kehadiranMingguan,
  bebanKerja,
  agenda,
  agendaLoading,
  ringkasanIzin,
  grafikPengajuan,
  topKehadiran,
  topKaryawan,
  mutasiBarang,
  totalBarang,
}: {
  error: string | null;
  getGreeting: () => string;
  isApprover: boolean;
  departemen: departemenDistribusi[];
  statCards: ReturnType<typeof buildStatCards>;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  kehadiranMingguan: KehadiranHarian[];
  bebanKerja: BebanDepartemen[];
  agenda: AgendaItem[];
  agendaLoading: boolean;
  ringkasanIzin?: RingkasanIzin;
  grafikPengajuan: TrenPengajuan[];
  topKehadiran: TopKaryawan[];
  topKaryawan: TopKaryawan[];
  mutasiBarang: MutasiBulanan[];
  totalBarang?: TotalBarang;
}) {
  useAuth();

  // ==== Hero chart "Pengajuan Izin Tahun Ini" — 1 bar disorot (nilai tertinggi)
  // + garis rata-rata putus-putus, gaya kartu fintech (bar polos vs bar disorot).
  const totalPengajuanTahunIni = grafikPengajuan.reduce((sum, d) => sum + d.pengajuan, 0);
  const maxPengajuan = grafikPengajuan.length ? Math.max(...grafikPengajuan.map((d) => d.pengajuan)) : 0;
  const avgPengajuan = grafikPengajuan.length ? totalPengajuanTahunIni / grafikPengajuan.length : 0;
  const peakIndex = maxPengajuan > 0 ? grafikPengajuan.findIndex((d) => d.pengajuan === maxPengajuan) : -1;

  const renderPeakLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (index !== peakIndex || maxPengajuan <= 0) return null;
    const cx = x + width / 2;
    const boxW = 52;
    return (
      <g>
        <rect x={cx - boxW / 2} y={y - 32} width={boxW} height={24} rx={7} fill={THEME.violet} />
        <text x={cx} y={y - 15} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
          {value}
        </text>
      </g>
    );
  };

  const izinTotal = ringkasanIzin?.total ?? 0;
  const izinDisetujui = ringkasanIzin?.disetujui ?? 0;
  const izinPending = ringkasanIzin?.pending ?? 0;
  const izinDitolak = ringkasanIzin?.ditolak ?? 0;
  const disetujuiPct = izinTotal > 0 ? (izinDisetujui / izinTotal) * 100 : 0;
  const pendingPct = izinTotal > 0 ? (izinPending / izinTotal) * 100 : 0;
  const ditolakPct = izinTotal > 0 ? (izinDitolak / izinTotal) * 100 : 0;
  const approvalRatePct = izinTotal > 0 ? Math.round((izinDisetujui / izinTotal) * 100) : null;

  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ==== KPI cards — badge ikon warna solid + angka besar ====
          Pakai statCardClass (bukan cardClass) biar lebih pendek, terpisah
          dari card-card lain di bawah yang masih pakai cardClass asli. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${statCardClass} animate-pulse h-24`} />
            ))
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={statCardClass}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                    <StatBadge accent={stat.accent}>
                      <Icon size={18} />
                    </StatBadge>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {stat.value}
                    {stat.unit && <span className="text-sm font-semibold text-slate-400 ml-1.5">{stat.unit}</span>}
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
                    <TrendingUp size={12} /> {stat.trend}
                  </div>
                </div>
              );
            })}
      </div>

      {/* ==== Hero: tren pengajuan izin (chart utama) + ringkasan status izin ==== */}
      {isApprover && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className={`${cardClass} xl:col-span-2`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm text-slate-500 font-medium">Pengajuan Izin Tahun Ini</h3>
                <p className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-1 tracking-tight">
                  {totalPengajuanTahunIni}
                  <span className="text-base font-semibold text-slate-400 ml-2">pengajuan</span>
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap">
                {new Date().getFullYear()}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-4 mb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: THEME.violet }} />
                Pengajuan Bulanan
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-0 border-t-2 border-dashed" style={{ borderColor: THEME.violet }} />
                Rata-rata
              </div>
            </div>

            <div className="h-72 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafikPengajuan} margin={{ top: 36, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <pattern id="barHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="#EEF2F7" />
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#D8DEE9" strokeWidth="2" />
                    </pattern>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={THEME.grid} />
                  <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.35, 4)]} />
                  {maxPengajuan > 0 && (
                    <ReferenceLine y={avgPengajuan} stroke={THEME.violet} strokeDasharray="5 5" strokeOpacity={0.5} />
                  )}
                  <Tooltip
                    cursor={{ fill: 'rgba(109,93,252,0.06)' }}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="pengajuan" name="Pengajuan" radius={[8, 8, 0, 0]} barSize={26} label={renderPeakLabel}>
                    {grafikPengajuan.map((_entry, idx) => (
                      <Cell key={idx} fill={idx === peakIndex ? THEME.violet : 'url(#barHatch)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#EEECFF] flex items-center justify-center text-[#6D5DFC]">
                <ClipboardList size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Ringkasan Status Izin</h3>
            </div>

            <div className="flex items-center gap-2">
              <p className="text-3xl font-extrabold text-slate-900">{izinTotal}</p>
              {approvalRatePct !== null && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {approvalRatePct}% disetujui
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total pengajuan izin</p>

            <div className="flex w-full h-2.5 rounded-full overflow-hidden mt-5 bg-slate-100">
              {izinTotal > 0 ? (
                <>
                  <div style={{ width: `${disetujuiPct}%`, background: THEME.violet }} />
                  <div style={{ width: `${pendingPct}%`, background: THEME.amber }} />
                  <div style={{ width: `${ditolakPct}%`, background: '#E2E8F0' }} />
                </>
              ) : (
                <div className="w-full h-full bg-slate-100" />
              )}
            </div>

            <div className="flex flex-col gap-3 mt-5">
              <LegendDot color={THEME.violet} label="Disetujui" value={izinDisetujui} />
              <LegendDot color={THEME.amber} label="Menunggu" value={izinPending} />
              <LegendDot color="#CBD5E1" label="Ditolak" value={izinDitolak} />
            </div>
          </div>
        </div>
      )}

      {/* ==== Tren kehadiran mingguan + distribusi karyawan per departemen ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Tren Kehadiran Mingguan</h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">7 hari terakhir</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kehadiranMingguan} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={THEME.violet} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={THEME.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="hadir" stroke={THEME.violet} strokeWidth={2.5} fill="url(#colorHadir)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Distribusi Karyawan per Departemen</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departemen} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
                <YAxis dataKey="departemen" type="category" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="jumlah" fill={THEME.violet} radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ==== Top kehadiran & top pengajuan (khusus approver) ==== */}
      {isApprover && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className={cardClass}>
            <h3 className="text-sm font-semibold text-slate-900">Karyawan Kehadiran Terbanyak</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-3">Top 5 karyawan berdasarkan jumlah absensi hadir.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topKehadiran} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={THEME.grid} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nama" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Bar dataKey="jumlah" name="Hadir" fill={THEME.emerald} radius={[0, 8, 8, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-sm font-semibold text-slate-900">Karyawan Pengajuan Izin Terbanyak</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-3">Top 5 karyawan berdasarkan jumlah pengajuan.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topKaryawan} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={THEME.grid} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nama" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Bar dataKey="jumlah" name="Pengajuan" fill={THEME.violet} radius={[0, 8, 8, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ==== Inventaris (khusus approver) ==== */}
      {isApprover && (
        <div className={`${cardClass} mt-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-base font-semibold text-slate-900">Inventaris — Barang Masuk vs Keluar</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <PackagePlus size={14} />
                Masuk {(totalBarang?.jumlah_masuk ?? 0).toLocaleString('id-ID')}
              </div>
              <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <PackageCheck size={14} />
                Keluar {(totalBarang?.jumlah_keluar ?? 0).toLocaleString('id-ID')}
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mutasiBarang} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.grid} />
                <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="jumlah_masuk" name="Barang Masuk" fill={THEME.emerald} radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="jumlah_keluar" name="Barang Keluar" fill={THEME.rose} radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ==== Beban kerja, notifikasi, agenda ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className={cardClass}>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Beban Kerja per Departemen</h3>
          <div className="flex flex-col gap-4">
            {bebanKerja.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada data departemen</p>
            ) : (
              bebanKerja.map((d) => (
                <div key={d.departemen}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{d.departemen}</span>
                    <span className="text-slate-400">
                      {d.hadir}/{d.total} hadir
                      {d.tidak_hadir > 0 && (
                        <span className="text-rose-500 font-medium"> · +{d.beban_percent}%</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bebanColor(d.beban_percent)}`}
                      style={{ width: `${Math.min(d.beban_percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Notifikasi</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada notifikasi</p>
          ) : (
            <ul
              className="flex flex-col gap-3 overflow-y-auto pr-1"
              style={{ maxHeight: `${NOTIF_VISIBLE_COUNT * 68}px` }}
            >
              {notifications.map((n) => {
                const unread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    className="flex items-start gap-2 cursor-pointer"
                    onClick={() => unread && onMarkAsRead(n.id)}
                  >
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${unread ? 'bg-[#6D5DFC]' : 'bg-slate-200'}`} />
                    <div>
                      <p className={`text-sm ${unread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                        {n.data.message}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(n.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Agenda Mendatang</h3>
          {agendaLoading ? (
            <p className="text-sm text-slate-400">Memuat agenda...</p>
          ) : !agenda || agenda.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada agenda mendatang.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {agenda.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2">
                  <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-700">{ev.title}</p>
                    <p className="text-xs text-slate-400">{formatAgendaDate(ev.start_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
