import { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  CalendarDays,
  FileText,
  Ticket,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import ChatWidget from '../components/Chatwidget';
import AppLayout from '../components/AppLayout';
import api from '../api/axios';
import { echo } from '../lib/echo';
import type { User as UserType } from '../types/user';
import { getAgendaMendatang, type AgendaItem } from '../api/agenda';

// TAMBAH: warna beban kerja berdasarkan tingkat keparahan
function bebanColor(percent: number) {
  if (percent >= 70) return 'bg-rose-500';
  if (percent >= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// TAMBAH: format tanggal agenda jadi "Senin, 09:00" (real data dari backend)
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

// TAMBAH: tipe data kehadiran mingguan real
interface KehadiranHarian {
  day: string;
  tanggal: string;
  hadir: number;
  target: number;
}

// TAMBAH: tipe data beban kerja per departemen
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

// TAMBAH: fetch kehadiran 7 hari terakhir (real)
async function fetchKehadiranMingguan(): Promise<KehadiranHarian[]> {
  const res = await api.get<KehadiranHarian[]>('/dashboard/kehadiran-mingguan');
  return res.data;
}

// TAMBAH: fetch beban kerja per departemen (real, dari izin hari ini)
async function fetchBebanKerja(): Promise<BebanDepartemen[]> {
  const res = await api.get<BebanDepartemen[]>('/dashboard/beban-kerja');
  return res.data;
}

// TAMBAH: fetch agenda mendatang (real, gantiin data statis)
async function fetchAgenda(): Promise<AgendaItem[]> {
  return getAgendaMendatang(5);
}

function buildStatCards(stats?: StatsCardResponse) {
  if (!stats) return [];
  return [
    { label: 'Kehadiran Bulan Ini', value: stats.kehadiran.value, trend: stats.kehadiran.trend, icon: QrCode },
    { label: 'Izin Aktif', value: stats.izinAktif.value, trend: stats.izinAktif.trend, icon: CalendarDays },
    { label: 'Izin Pending', value: stats.izin.value, trend: stats.izin.trend, icon: FileText },
    { label: 'Ticket Aktif', value: stats.ticket.value, trend: stats.ticket.trend, icon: Ticket },
  ];
}

// TAMBAH: berapa lama (ms) notifikasi bertahan setelah dibaca sebelum auto-dihapus
const AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit
// TAMBAH: jumlah notifikasi yang kelihatan sebelum area jadi scrollable
const NOTIF_VISIBLE_COUNT = 2;

export default function Dashboard() {
  const { user: cachedUser, setUser } = useAuth();
  const [departemen, setDepartemen] = useState<departemenDistribusi[]>([]);
  const queryClient = useQueryClient();

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

  // TAMBAH: kehadiran mingguan real, refresh tiap 5 menit
  const { data: kehadiranMingguan } = useQuery({
    queryKey: ['kehadiran-mingguan'],
    queryFn: fetchKehadiranMingguan,
    staleTime: 5 * 60 * 1000,
  });

  // TAMBAH: beban kerja per departemen, refresh tiap 5 menit (berubah kalau ada izin baru disetujui)
  const { data: bebanKerja } = useQuery({
    queryKey: ['beban-kerja'],
    queryFn: fetchBebanKerja,
    staleTime: 5 * 60 * 1000,
  });

  // TAMBAH: agenda mendatang real dari backend, refresh tiap 5 menit
  const { data: agenda, isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda-mendatang'],
    queryFn: fetchAgenda,
    staleTime: 5 * 60 * 1000,
  });

  const notifications = notificationsRes?.data ?? [];

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    api
      .get('/dashboard/kpd')
      .then((res) => {
        setDepartemen(res.data);
      })
      .catch((err) => {
        console.log(err.response);
      });
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

      queryClient.invalidateQueries({ queryKey: ['stats-card'] });
      // TAMBAH: kalau ada izin baru disetujui, beban kerja & kehadiran ikut update real-time
      queryClient.invalidateQueries({ queryKey: ['beban-kerja'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-mingguan'] });
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

  // TAMBAH: hapus notifikasi (dipanggil otomatis 30 menit setelah dibaca)
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

  // TAMBAH: jadwalkan auto-delete 30 menit setelah notifikasi dibaca.
  // Kalau pas dicek ternyata udah lewat 30 menit dari read_at (misal user baru buka tab lagi), langsung dihapus.
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

    // bersihkan timer punya notifikasi yang udah nggak ada lagi (misal kehapus dari tempat lain)
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
        departemen={departemen}
        statCards={buildStatCards(statsCard)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        kehadiranMingguan={kehadiranMingguan ?? []}
        bebanKerja={bebanKerja ?? []}
        agenda={agenda ?? []}
        agendaLoading={agendaLoading}
      />
      <ChatWidget />
    </AppLayout>
  );
}

function DashboardContent({
  error,
  getGreeting,
  departemen,
  statCards,
  notifications,
  onMarkAsRead,
  kehadiranMingguan,
  bebanKerja,
  agenda,
  agendaLoading,
}: {
  error: string | null;
  getGreeting: () => string;
  departemen: departemenDistribusi[];
  statCards: ReturnType<typeof buildStatCards>;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  kehadiranMingguan: KehadiranHarian[];
  bebanKerja: BebanDepartemen[];
  agenda: AgendaItem[];
  agendaLoading: boolean;
}) {
  const { user } = useAuth();

  return (
    <>
      <p className="text-sm text-slate-500 mb-6">
        {getGreeting()}, <span className="font-semibold text-slate-800">{user?.name}</span> 👋
      </p>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-200 animate-pulse h-28"
              />
            ))
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-200">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700">
                    <Icon size={20} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-3">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> {stat.trend}
                  </p>
                </div>
              );
            })}
      </div>

      {/* ROW: Kehadiran (Area) + Distribusi Departemen (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Tren Kehadiran Mingguan</h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">7 hari terakhir</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kehadiranMingguan} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="hadir" stroke="#0f172a" strokeWidth={2} fill="url(#colorHadir)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Distribusi Karyawan per Departemen</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departemen} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="departemen" type="category" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="jumlah" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ROW: Beban Kerja per Departemen + Notifikasi + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
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

        {/* UBAH: notifikasi dibatasi tampil 4, sisanya scroll. Notif yang sudah dibaca auto-hapus 30 menit kemudian */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Notifikasi</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada notifikasi</p>
          ) : (
            <ul
              className="flex flex-col gap-3 overflow-y-auto pr-1"
              style={{ maxHeight: `${NOTIF_VISIBLE_COUNT * 68}px` }} // TAMBAH: ~68px per item, jadi 4 item kelihatan sebelum scroll
            >
              {notifications.map((n) => {
                const unread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    className="flex items-start gap-2 cursor-pointer"
                    onClick={() => unread && onMarkAsRead(n.id)}
                  >
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${unread ? 'bg-slate-900' : 'bg-slate-200'}`} />
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

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
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