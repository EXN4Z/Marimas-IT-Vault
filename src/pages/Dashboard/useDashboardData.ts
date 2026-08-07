import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { getEcho } from '../../lib/echo';
import type { User as UserType } from '../../types/user';
import { getAgendaMendatang, type AgendaItem } from '../../api/agenda';
import { getAset } from '../../api/aset';

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

// Ringkasan status seluruh aset/barang inventaris — dipakai kartu
// "Ringkasan Status Aset" di dashboard (gantiin Ringkasan Status Izin).
// Catatan: status backend aset ada 6 (tersedia, dipakai, menunggu_perbaikan,
// diperbaiki, rusak_berat, dijual). Supaya kartu tetap simpel 4 kategori,
// menunggu_perbaikan & diperbaiki (aset yang lagi dalam proses penanganan)
// digabung ke bucket "dipakai" karena sama-sama belum tersedia dipinjam.
export interface RingkasanAset {
  total: number;
  tersedia: number;
  dipakai: number;
  rusakBerat: number;
  dijual: number;
}

// Distribusi jumlah aset per jenis (laptop, printer, kendaraan, dst) —
// dipakai kartu "Distribusi Aset per Jenis" di dashboard admin.
export interface AsetPerJenis {
  jenis: string;
  jumlah: number;
}

// Tren jumlah aset dibeli per bulan (6 bulan terakhir, dari tanggal_pembelian)
// — dipakai hero chart "Tren Pembelian Aset per Bulan", gantiin hero chart
// pengajuan izin di dashboard admin (inventaris-only).
export interface TrenPembelianAset {
  bulan: string;
  jumlah: number;
}

// Distribusi jumlah aset per status (tersedia/dipakai/dst) — dipakai
// donut chart "Distribusi Status Aset" di dashboard admin.
export interface StatusAsetDistribusi {
  status: string;
  jumlah: number;
}

// Ringkasan aset yang butuh perhatian: lagi rusak/proses perbaikan, atau
// garansinya bakal habis dalam 30 hari ke depan — dipakai kartu
// "Aset Butuh Perhatian" di dashboard admin.
export interface AsetPerhatian {
  rusak: number; // status rusak_berat
  dalamPenanganan: number; // status menunggu_perbaikan + diperbaiki
  garansiSegeraHabis: number; // tanggal_garansi <= 30 hari dari sekarang
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

export async function fetchRingkasanAset(): Promise<RingkasanAset> {
  const list = await getAset();
  let tersedia = 0;
  let dipakai = 0;
  let rusakBerat = 0;
  let dijual = 0;

  for (const a of list) {
    switch (a.status) {
      case 'tersedia':
        tersedia += 1;
        break;
      case 'dipakai':
      case 'menunggu_perbaikan':
      case 'diperbaiki':
        dipakai += 1;
        break;
      case 'rusak_berat':
        rusakBerat += 1;
        break;
      case 'dijual':
        dijual += 1;
        break;
    }
  }

  return { total: list.length, tersedia, dipakai, rusakBerat, dijual };
}

const GARANSI_WARNING_DAYS = 30;

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const STATUS_LABEL: Record<string, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  menunggu_perbaikan: 'Menunggu Perbaikan',
  diperbaiki: 'Diperbaiki',
  rusak_berat: 'Rusak Berat',
  dijual: 'Dijual',
};

export async function fetchAsetPerJenis(): Promise<AsetPerJenis[]> {
  const list = await getAset();
  const counts = new Map<string, number>();

  for (const a of list) {
    const nama = a.jenis?.nama ?? 'Tanpa Jenis';
    counts.set(nama, (counts.get(nama) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([jenis, jumlah]) => ({ jenis, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);
}

// 6 bulan terakhir, jumlah aset yang tanggal_pembelian-nya jatuh di bulan itu.
export async function fetchTrenPembelianAset(): Promise<TrenPembelianAset[]> {
  const list = await getAset();
  const now = new Date();

  const bulanKeys: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bulanKeys.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: BULAN_ID[d.getMonth()] });
  }

  const counts = new Map(bulanKeys.map((b) => [b.key, 0]));

  for (const a of list) {
    if (!a.tanggal_pembelian) continue;
    const d = new Date(a.tanggal_pembelian);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return bulanKeys.map((b) => ({ bulan: b.label, jumlah: counts.get(b.key) ?? 0 }));
}

export async function fetchStatusAsetDistribusi(): Promise<StatusAsetDistribusi[]> {
  const list = await getAset();
  const counts = new Map<string, number>();

  for (const a of list) {
    const label = STATUS_LABEL[a.status] ?? a.status;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Object.values(STATUS_LABEL)
    .map((label) => ({ status: label, jumlah: counts.get(label) ?? 0 }))
    .filter((s) => s.jumlah > 0);
}

export async function fetchAsetPerhatian(): Promise<AsetPerhatian> {
  const list = await getAset();
  const now = Date.now();
  const warningMs = GARANSI_WARNING_DAYS * 24 * 60 * 60 * 1000;

  let rusak = 0;
  let dalamPenanganan = 0;
  let garansiSegeraHabis = 0;

  for (const a of list) {
    if (a.status === 'rusak_berat') rusak += 1;
    if (a.status === 'menunggu_perbaikan' || a.status === 'diperbaiki') dalamPenanganan += 1;

    if (a.tanggal_garansi) {
      const garansiTime = new Date(a.tanggal_garansi).getTime();
      if (!isNaN(garansiTime)) {
        const sisaMs = garansiTime - now;
        if (sisaMs >= 0 && sisaMs <= warningMs) garansiSegeraHabis += 1;
      }
    }
  }

  return { rusak, dalamPenanganan, garansiSegeraHabis };
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
    ringkasanAset?: boolean;
    grafikPengajuan?: boolean;
    topKehadiran?: boolean;
    topKaryawan?: boolean;
    asetPerJenis?: boolean;
    asetPerhatian?: boolean;
    trenPembelianAset?: boolean;
    statusAsetDistribusi?: boolean;
  } = {}
) {
  const {
    ringkasanIzin: wantRingkasan = true,
    ringkasanAset: wantRingkasanAset = true,
    grafikPengajuan: wantGrafik = true,
    topKehadiran: wantTopKehadiran = true,
    topKaryawan: wantTopKaryawan = true,
    asetPerJenis: wantAsetPerJenis = true,
    asetPerhatian: wantAsetPerhatian = true,
    trenPembelianAset: wantTrenPembelianAset = true,
    statusAsetDistribusi: wantStatusAsetDistribusi = true,
  } = include;

  const { data: ringkasanIzin } = useQuery({
    queryKey: ['ringkasan-izin'],
    queryFn: fetchRingkasanIzin,
    enabled: enabled && wantRingkasan,
    staleTime: 2 * 60 * 1000,
  });

  const { data: ringkasanAset } = useQuery({
    queryKey: ['ringkasan-aset'],
    queryFn: fetchRingkasanAset,
    enabled: enabled && wantRingkasanAset,
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

  const { data: asetPerJenis } = useQuery({
    queryKey: ['aset-per-jenis'],
    queryFn: fetchAsetPerJenis,
    enabled: enabled && wantAsetPerJenis,
    staleTime: 2 * 60 * 1000,
  });

  const { data: asetPerhatian } = useQuery({
    queryKey: ['aset-perhatian'],
    queryFn: fetchAsetPerhatian,
    enabled: enabled && wantAsetPerhatian,
    staleTime: 2 * 60 * 1000,
  });

  const { data: trenPembelianAset } = useQuery({
    queryKey: ['tren-pembelian-aset'],
    queryFn: fetchTrenPembelianAset,
    enabled: enabled && wantTrenPembelianAset,
    staleTime: 2 * 60 * 1000,
  });

  const { data: statusAsetDistribusi } = useQuery({
    queryKey: ['status-aset-distribusi'],
    queryFn: fetchStatusAsetDistribusi,
    enabled: enabled && wantStatusAsetDistribusi,
    staleTime: 2 * 60 * 1000,
  });

  return {
    ringkasanIzin,
    ringkasanAset,
    grafikPengajuan: grafikPengajuan ?? [],
    topKehadiran: topKehadiran ?? [],
    topKaryawan: topKaryawan ?? [],
    asetPerJenis: asetPerJenis ?? [],
    asetPerhatian,
    trenPembelianAset: trenPembelianAset ?? [],
    statusAsetDistribusi: statusAsetDistribusi ?? [],
  };
}