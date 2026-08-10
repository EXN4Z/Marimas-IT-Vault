import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { getEcho } from '../../lib/echo';
import type { User as UserType } from '../../types/user';
import { getAset, getRiwayatAset, type RiwayatAsetEvent } from '../../api/aset';

// ============================================================================
// TYPES
// ============================================================================

export interface DepartemenDistribusi {
  departemen: string;
  jumlah: number;
  percent: number;
}

// Ringkasan status seluruh aset/barang inventaris — dipakai kartu
// "Ringkasan Status Aset" di dashboard.
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
// — dipakai hero chart "Tren Pembelian Aset per Bulan" di dashboard admin.
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

// 5 aktivitas aset terbaru (pinjam/kembali/lapor rusak/dst) — dipakai
// widget "Aktivitas Aset Terbaru" di dashboard admin, biar histori aset
// gak cuma keliatan kalau user sadar buka tab Riwayat di dalam Inventaris.
export type AktivitasAsetTerbaru = RiwayatAsetEvent;

export interface NotificationItem {
  id: string;
  data: { message: string; [key: string]: any };
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  unread_count: number;
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

export async function fetchDepartemenDistribusi(): Promise<DepartemenDistribusi[]> {
  const res = await api.get<DepartemenDistribusi[]>('/dashboard/kpd');
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

// 5 event teratas dari endpoint riwayat aset yang sudah ada (halaman 1,
// tanpa filter type/search) — sumber sama persis dengan tab "Riwayat Aset"
// di Inventaris, cuma dipotong ke 5 item terbaru buat widget dashboard.
export async function fetchAktivitasAsetTerbaru(): Promise<AktivitasAsetTerbaru[]> {
  const res = await getRiwayatAset(1, 10);
  return res.data.slice(0, 5);
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

const AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit

// ============================================================================
// CORE HOOK — dipakai oleh DashboardUser, DashboardAdmin, DashboardCabang.
// Berisi semua data & section yang tampil di SEMUA role: user, notifikasi
// (+ realtime & auto-delete), distribusi departemen, plus guard redirect
// ke /login.
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

  const { data: notificationsRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 60 * 1000,
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
        new Notification('Notifikasi Baru', {
          body: payload.message,
          icon: '/logo.png',
        });
      }
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
    notifications,
    handleMarkAsRead,
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
    ringkasanAset?: boolean;
    asetPerJenis?: boolean;
    asetPerhatian?: boolean;
    trenPembelianAset?: boolean;
    statusAsetDistribusi?: boolean;
    aktivitasAsetTerbaru?: boolean;
  } = {}
) {
  const {
    ringkasanAset: wantRingkasanAset = true,
    asetPerJenis: wantAsetPerJenis = true,
    asetPerhatian: wantAsetPerhatian = true,
    trenPembelianAset: wantTrenPembelianAset = true,
    statusAsetDistribusi: wantStatusAsetDistribusi = true,
    aktivitasAsetTerbaru: wantAktivitasAsetTerbaru = true,
  } = include;

  const { data: ringkasanAset } = useQuery({
    queryKey: ['ringkasan-aset'],
    queryFn: fetchRingkasanAset,
    enabled: enabled && wantRingkasanAset,
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

  // staleTime pendek (30 detik) -- ini feed aktivitas, harus lebih "segar"
  // dibanding kartu ringkasan/statistik lain yang wajar agak nge-lag.
  const { data: aktivitasAsetTerbaru } = useQuery({
    queryKey: ['aktivitas-aset-terbaru'],
    queryFn: fetchAktivitasAsetTerbaru,
    enabled: enabled && wantAktivitasAsetTerbaru,
    staleTime: 30 * 1000,
  });

  return {
    ringkasanAset,
    asetPerJenis: asetPerJenis ?? [],
    asetPerhatian,
    trenPembelianAset: trenPembelianAset ?? [],
    statusAsetDistribusi: statusAsetDistribusi ?? [],
    aktivitasAsetTerbaru: aktivitasAsetTerbaru ?? [],
  };
}