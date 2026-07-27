import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { getEcho } from '../../lib/echo';
import type { User as UserType } from '../../types/user';
import { getAgendaMendatang, type AgendaItem } from '../../api/agenda';

// ============================================================================
// TYPES
// ============================================================================

export interface DepartemenDistribusi {
  departemen: string;
  jumlah: number;
  percent: number;
}

export interface KehadiranHarian {
  day: string;
  tanggal: string;
  hadir: number;
  target: number;
}

export interface BebanDepartemen {
  departemen: string;
  total: number;
  hadir: number;
  tidak_hadir: number;
  beban_percent: number;
}

export interface StatItem {
  value: number | string;
  trend: string;
}

export interface StatsCardResponse {
  kehadiran: StatItem;
  izin: StatItem;
  izinAktif: StatItem;
  ticket: StatItem;
}

export interface TopKaryawan {
  nama: string;
  jumlah: number;
}

export interface TrenPengajuan {
  bulan: string;
  pengajuan: number;
}

export interface RingkasanIzin {
  total: number;
  pending: number;
  disetujui: number;
  ditolak: number;
}

export interface NotificationItem {
  id: string;
  data: { message: string; nomor_izin?: string; status?: string; [key: string]: any };
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  unread_count: number;
}

export type AccentColor = 'violet' | 'orange' | 'amber' | 'emerald';

export interface StatCard {
  label: string;
  value: number | string;
  unit: string;
  trend: string;
  icon: any;
  accent: AccentColor;
}

// ============================================================================
// FETCHERS
// ============================================================================

export async function fetchUser(): Promise<UserType> {
  const res = await api.get<UserType>('/user');
  return res.data;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await api.get<NotificationsResponse>('/notifications');
  return res.data;
}

export async function fetchStatsCard(): Promise<StatsCardResponse> {
  const res = await api.get<StatsCardResponse>('/dashboard/stats-card');
  return res.data;
}

export async function fetchKehadiranMingguan(): Promise<KehadiranHarian[]> {
  const res = await api.get<KehadiranHarian[]>('/dashboard/kehadiran-mingguan');
  return res.data;
}

export async function fetchBebanKerja(): Promise<BebanDepartemen[]> {
  const res = await api.get<BebanDepartemen[]>('/dashboard/beban-kerja');
  return res.data;
}

export async function fetchAgenda(): Promise<AgendaItem[]> {
  return getAgendaMendatang(5);
}

export async function fetchDepartemenDistribusi(): Promise<DepartemenDistribusi[]> {
  const res = await api.get<DepartemenDistribusi[]>('/dashboard/kpd');
  return res.data;
}

// Analytics (admin) / sebagian dipakai cabang juga — lihat useDashboardAnalytics
export async function fetchRingkasanIzin(): Promise<RingkasanIzin> {
  const res = await api.get<RingkasanIzin>('/dashboard-analytics/analisis-izin');
  return res.data;
}

export async function fetchGrafikPengajuan(): Promise<TrenPengajuan[]> {
  const res = await api.get<TrenPengajuan[]>('/dashboard-analytics/grafik-pengajuan');
  return res.data;
}

export async function fetchTopKehadiran(): Promise<TopKaryawan[]> {
  const res = await api.get<TopKaryawan[]>('/dashboard-analytics/top-kehadiran');
  return res.data;
}

export async function fetchTopKaryawan(): Promise<TopKaryawan[]> {
  const res = await api.get<TopKaryawan[]>('/dashboard-analytics/top-karyawan');
  return res.data;
}

export function buildStatCards(
  stats: StatsCardResponse | undefined,
  icons: { kehadiran: any; izinAktif: any; ticket: any }
): StatCard[] {
  if (!stats) return [];
  return [
    { label: 'Kehadiran Bulan Ini', value: stats.kehadiran.value, unit: 'hari', trend: stats.kehadiran.trend, icon: icons.kehadiran, accent: 'violet' },
    { label: 'Izin Aktif', value: stats.izinAktif.value, unit: '', trend: stats.izinAktif.trend, icon: icons.izinAktif, accent: 'orange' },
    { label: 'Ticket Aktif', value: stats.ticket.value, unit: 'tiket', trend: stats.ticket.trend, icon: icons.ticket, accent: 'emerald' },
  ];
}

const AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit

// ============================================================================
// CORE HOOK — dipakai oleh DashboardUser, DashboardAdmin, DashboardCabang.
// Berisi semua data & section yang tampil di SEMUA role: user, stats-card,
// notifikasi (+ realtime & auto-delete), kehadiran mingguan, beban kerja,
// agenda, distribusi departemen, plus guard redirect ke /login.
// ============================================================================
export function useDashboardCore() {
  const { user: cachedUser, isLoading: authLoading, setUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const sessionReady = !authLoading && !!cachedUser;

  useEffect(() => {
    if (!authLoading && !cachedUser) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, cachedUser, navigate]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000,
    initialData: cachedUser ?? undefined,
    enabled: sessionReady,
  });

  const { data: statsCard } = useQuery({
    queryKey: ['stats-card'],
    queryFn: fetchStatsCard,
    staleTime: 5 * 60 * 1000,
    enabled: sessionReady,
  });

  const { data: notificationsRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 60 * 1000,
    enabled: sessionReady,
  });

  const { data: kehadiranMingguan } = useQuery({
    queryKey: ['kehadiran-mingguan'],
    queryFn: fetchKehadiranMingguan,
    staleTime: 5 * 60 * 1000,
    enabled: sessionReady,
  });

  const { data: bebanKerja } = useQuery({
    queryKey: ['beban-kerja'],
    queryFn: fetchBebanKerja,
    staleTime: 5 * 60 * 1000,
    enabled: sessionReady,
  });

  const { data: agenda, isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda-mendatang'],
    queryFn: fetchAgenda,
    staleTime: 5 * 60 * 1000,
    enabled: sessionReady,
  });

  const { data: departemen } = useQuery({
    queryKey: ['departemen-distribusi'],
    queryFn: fetchDepartemenDistribusi,
    staleTime: 5 * 60 * 1000,
    enabled: sessionReady,
  });

  const notifications = notificationsRes?.data ?? [];

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Realtime notifikasi via Echo/Pusher
  useEffect(() => {
    if (!data?.id) return;
    const echo = getEcho();
    if (!echo) return;

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
          icon: '/logo.png',
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

  // Auto-hapus notifikasi 30 menit setelah dibaca
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

  return {
    user: data,
    loading,
    error,
    statsCard,
    notifications,
    handleMarkAsRead,
    kehadiranMingguan: kehadiranMingguan ?? [],
    bebanKerja: bebanKerja ?? [],
    agenda: agenda ?? [],
    agendaLoading,
    departemen: departemen ?? [],
  };
}

// ============================================================================
// ANALYTICS HOOK — dipakai DashboardAdmin (semua flag true) & DashboardCabang
// (cuma sebagian). `enabled` jadi gate utama, per query masih bisa
// dimatikan lewat opsi `include`.
// ============================================================================
export function useDashboardAnalytics(
  enabled: boolean,
  include: {
    ringkasanIzin?: boolean;
    grafikPengajuan?: boolean;
    topKehadiran?: boolean;
    topKaryawan?: boolean;
  } = {}
) {
  const {
    ringkasanIzin: wantRingkasan = true,
    grafikPengajuan: wantGrafik = true,
    topKehadiran: wantTopKehadiran = true,
    topKaryawan: wantTopKaryawan = true,
  } = include;

  const { data: ringkasanIzin } = useQuery({
    queryKey: ['ringkasan-izin'],
    queryFn: fetchRingkasanIzin,
    enabled: enabled && wantRingkasan,
    staleTime: 2 * 60 * 1000,
  });

  const { data: grafikPengajuan } = useQuery({
    queryKey: ['grafik-pengajuan'],
    queryFn: fetchGrafikPengajuan,
    enabled: enabled && wantGrafik,
    staleTime: 2 * 60 * 1000,
  });

  const { data: topKehadiran } = useQuery({
    queryKey: ['top-kehadiran'],
    queryFn: fetchTopKehadiran,
    enabled: enabled && wantTopKehadiran,
    staleTime: 2 * 60 * 1000,
  });

  const { data: topKaryawan } = useQuery({
    queryKey: ['top-karyawan'],
    queryFn: fetchTopKaryawan,
    enabled: enabled && wantTopKaryawan,
    staleTime: 2 * 60 * 1000,
  });

  return {
    ringkasanIzin,
    grafikPengajuan: grafikPengajuan ?? [],
    topKehadiran: topKehadiran ?? [],
    topKaryawan: topKaryawan ?? [],
  };
}