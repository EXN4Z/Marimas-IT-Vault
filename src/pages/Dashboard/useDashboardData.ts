import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { getEcho } from '../../lib/echo';
import type { User as UserType } from '../../types/user';
import { getInventory } from '../../api/masterData/inventory';
import { getRiwayatInventory, type RiwayatInventoryEvent } from '../../api/transaksi/inventoryPemakai';

// ============================================================================
// TYPES
// ============================================================================

export interface DepartemenDistribusi {
  departemen: string;
  jumlah: number;
  percent: number;
}

// Ringkasan status seluruh inventory/barang inventaris — dipakai kartu
// "Ringkasan Status Inventory" di dashboard.
// Catatan: status backend inventory ada 6 (tersedia, dipakai, menunggu_perbaikan,
// diperbaiki, rusak_berat, dijual). Supaya kartu tetap simpel 4 kategori,
// menunggu_perbaikan & diperbaiki (inventory yang lagi dalam proses penanganan)
// digabung ke bucket "dipakai" karena sama-sama belum tersedia dipinjam.
export interface RingkasanInventory {
  total: number;
  tersedia: number;
  dipakai: number;
  rusakBerat: number;
  dijual: number;
}

// Distribusi jumlah inventory per nama (Laptop Lenovo, Mouse Logitech, dst)
// — dulu per `merek`+`jenis_id`, tapi kedua kolom itu udah dihapus dari
// tabel inventory (merek/tipe sekarang digabung jadi satu kolom `nama`),
// jadi sumbernya sekarang kolom `nama` langsung.
// NB: widget "Distribusi Inventory per Merek" ini disabled di semua
// dashboard yang ada saat ini (lihat inventoryPerMerek: false di
// DashboardAdmin.tsx) — gak ada card yang benar-benar render datanya.
export interface InventoryPerMerek {
  nama: string;
  jumlah: number;
}

// Tren jumlah inventory dibeli per bulan (6 bulan terakhir, dari tanggal_pembelian)
// — dipakai hero chart "Tren Pembelian Inventory per Bulan" di dashboard admin.
export interface TrenPembelianInventory {
  bulan: string;
  jumlah: number;
}

// Distribusi jumlah inventory per status (tersedia/dipakai/dst) — dipakai
// donut chart "Distribusi Status Inventory" di dashboard admin.
export interface StatusInventoryDistribusi {
  status: string;
  jumlah: number;
}

// Ringkasan inventory yang butuh perhatian: lagi rusak/proses perbaikan, atau
// garansinya bakal habis dalam 30 hari ke depan — dipakai kartu
// "Inventory Butuh Perhatian" di dashboard admin.
export interface InventoryPerhatian {
  rusak: number; // status rusak_berat
  dalamPenanganan: number; // status menunggu_perbaikan + diperbaiki
  garansiSegeraHabis: number; // tanggal_garansi <= 30 hari dari sekarang
}

// 5 aktivitas inventory terbaru (pinjam/kembali/lapor rusak/dst) — dipakai
// widget "Aktivitas Inventory Terbaru" di dashboard admin, biar histori inventory
// gak cuma keliatan kalau user sadar buka tab Riwayat di dalam Inventaris.
export type AktivitasInventoryTerbaru = RiwayatInventoryEvent;

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

export async function fetchRingkasanInventory(): Promise<RingkasanInventory> {
  // BARU: gak difilter kategori lagi -- sebelumnya cuma hitung 'barang_utama',
  // sekarang Kelengkapan (charger, adaptor, dll) ikut dihitung juga biar
  // "Total Inventory" di dashboard sinkron sama total data sebenarnya.
  const list = await getInventory();
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

// 5 event teratas dari endpoint riwayat inventory yang sudah ada (halaman 1,
// tanpa filter type/search) — sumber sama persis dengan tab "Riwayat Inventory"
// di Inventaris, cuma dipotong ke 5 item terbaru buat widget dashboard.
export async function fetchAktivitasInventoryTerbaru(): Promise<AktivitasInventoryTerbaru[]> {
  const res = await getRiwayatInventory(1, 10);
  return res.data.slice(0, 5);
}

// Aktivitas inventory dalam jumlah lebih banyak (bukan cuma 5 teratas) -- dipakai
// widget Kalender di dashboard biar penanda titik & daftar aktivitas per
// tanggal gak cuma nyakup aktivitas paling baru, tapi punya cakupan
// beberapa bulan ke belakang. Tetap satu panggilan API aja (bukan loop per
// tanggal), sumbernya sama persis dengan tab Riwayat Inventory di Inventaris.
export async function fetchAktivitasInventoryKalender(): Promise<AktivitasInventoryTerbaru[]> {
  const res = await getRiwayatInventory(1, 200);
  return res.data;
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

export async function fetchInventoryPerMerek(): Promise<InventoryPerMerek[]> {
  // BARU: ikut hitung Kelengkapan juga (lihat catatan di fetchRingkasanInventory).
  const list = await getInventory();
  const counts = new Map<string, number>();

  for (const a of list) {
    const nama = a.nama?.trim() || 'Tanpa Nama';
    counts.set(nama, (counts.get(nama) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);
}

// 6 bulan terakhir, jumlah inventory yang tanggal_pembelian-nya jatuh di bulan itu.
// BARU: ikut hitung Kelengkapan juga (lihat catatan di fetchRingkasanInventory).
export async function fetchTrenPembelianInventory(): Promise<TrenPembelianInventory[]> {
  const list = await getInventory();
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

export async function fetchStatusInventoryDistribusi(): Promise<StatusInventoryDistribusi[]> {
  // BARU: ikut hitung Kelengkapan juga (lihat catatan di fetchRingkasanInventory).
  const list = await getInventory();
  const counts = new Map<string, number>();

  for (const a of list) {
    const label = STATUS_LABEL[a.status] ?? a.status;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Object.values(STATUS_LABEL)
    .map((label) => ({ status: label, jumlah: counts.get(label) ?? 0 }))
    .filter((s) => s.jumlah > 0);
}

export async function fetchInventoryPerhatian(): Promise<InventoryPerhatian> {
  // BARU: ikut hitung Kelengkapan juga (lihat catatan di fetchRingkasanInventory).
  const list = await getInventory();
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
    ringkasanInventory?: boolean;
    inventoryPerMerek?: boolean;
    inventoryPerhatian?: boolean;
    trenPembelianInventory?: boolean;
    statusInventoryDistribusi?: boolean;
    aktivitasInventoryTerbaru?: boolean;
    aktivitasInventoryKalender?: boolean;
  } = {}
) {
  const {
    ringkasanInventory: wantRingkasanInventory = true,
    inventoryPerMerek: wantInventoryPerMerek = true,
    inventoryPerhatian: wantInventoryPerhatian = true,
    trenPembelianInventory: wantTrenPembelianInventory = true,
    statusInventoryDistribusi: wantStatusInventoryDistribusi = true,
    aktivitasInventoryTerbaru: wantAktivitasInventoryTerbaru = true,
    aktivitasInventoryKalender: wantAktivitasInventoryKalender = true,
  } = include;

  const { data: ringkasanInventory } = useQuery({
    queryKey: ['ringkasan-inventory'],
    queryFn: fetchRingkasanInventory,
    enabled: enabled && wantRingkasanInventory,
    staleTime: 2 * 60 * 1000,
  });

  const { data: inventoryPerMerek } = useQuery({
    queryKey: ['inventory-per-merek'],
    queryFn: fetchInventoryPerMerek,
    enabled: enabled && wantInventoryPerMerek,
    staleTime: 2 * 60 * 1000,
  });

  const { data: inventoryPerhatian } = useQuery({
    queryKey: ['inventory-perhatian'],
    queryFn: fetchInventoryPerhatian,
    enabled: enabled && wantInventoryPerhatian,
    staleTime: 2 * 60 * 1000,
  });

  const { data: trenPembelianInventory } = useQuery({
    queryKey: ['tren-pembelian-inventory'],
    queryFn: fetchTrenPembelianInventory,
    enabled: enabled && wantTrenPembelianInventory,
    staleTime: 2 * 60 * 1000,
  });

  const { data: statusInventoryDistribusi } = useQuery({
    queryKey: ['status-inventory-distribusi'],
    queryFn: fetchStatusInventoryDistribusi,
    enabled: enabled && wantStatusInventoryDistribusi,
    staleTime: 2 * 60 * 1000,
  });

  // staleTime pendek (30 detik) -- ini feed aktivitas, harus lebih "segar"
  // dibanding kartu ringkasan/statistik lain yang wajar agak nge-lag.
  const { data: aktivitasInventoryTerbaru } = useQuery({
    queryKey: ['aktivitas-inventory-terbaru'],
    queryFn: fetchAktivitasInventoryTerbaru,
    enabled: enabled && wantAktivitasInventoryTerbaru,
    staleTime: 30 * 1000,
  });

  // Sama staleTime-nya dengan feed "terbaru" -- ini juga feed aktivitas,
  // cuma dipotong lebih banyak buat kebutuhan widget Kalender.
  const { data: aktivitasInventoryKalender } = useQuery({
    queryKey: ['aktivitas-inventory-kalender'],
    queryFn: fetchAktivitasInventoryKalender,
    enabled: enabled && wantAktivitasInventoryKalender,
    staleTime: 30 * 1000,
  });

  return {
    ringkasanInventory,
    inventoryPerMerek: inventoryPerMerek ?? [],
    inventoryPerhatian,
    trenPembelianInventory: trenPembelianInventory ?? [],
    statusInventoryDistribusi: statusInventoryDistribusi ?? [],
    aktivitasInventoryTerbaru: aktivitasInventoryTerbaru ?? [],
    aktivitasInventoryKalender: aktivitasInventoryKalender ?? [],
  };
}