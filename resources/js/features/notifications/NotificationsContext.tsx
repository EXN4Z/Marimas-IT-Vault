import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { useAuth } from '../../context/AuthContext';
import { HttpError, requestJson } from '../../lib/http';
import type { AppNotification, NotificationResponse } from './types';
import toast from 'react-hot-toast';

// [F9-INERTIA] Satu sumber data notifikasi untuk bell (NotificationDropDown) dan kartu Notifikasi di Dashboard,
// menggantikan react-query ['notifications'].
// Keputusan: SENGAJA tetap JSON (bukan props Inertia):
//  - dipoll tiap 5 detik dan dipasang di SEMUA halaman. Polling lewat router.reload akan menjalankan ulang controller
//    halaman aktif tiap 5 detik dan bisa membatalkan visit/submit form yang sedang berjalan;
//  - tandai-dibaca/hapus dikerjakan optimistic dari state lokal dan tidak mengubah props halaman manapun.
// Endpoint: GET /notifications, POST /notifications/{id}/read, POST /notifications/read-all, DELETE /notifications/{id}
// (route web, controller NotificationController yang sama dengan route /api lama).

const POLL_INTERVAL_MS = 5000;
const MAX_ITEMS = 20;

interface NotificationsContextType {
  items: AppNotification[];
  unreadCount: number;
  loaded: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Tambah notif dari luar polling (realtime Echo di Dashboard). */
  addLocal: (item: AppNotification) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [feed, setFeed] = useState<NotificationResponse | null>(null);
  const version = useRef(0); // naik tiap perubahan lokal; hasil polling yang mulai sebelum perubahan dibuang
  const inFlight = useRef(false);
  const lastJson = useRef<string | null>(null); // skip setState kalau isi polling sama (hindari render ulang Dashboard)

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const startedAt = version.current;

    try {
      const res = await requestJson<NotificationResponse>('GET', '/notifications');
      if (version.current !== startedAt) return;

      const json = JSON.stringify(res);
      if (json !== lastJson.current) {
        lastJson.current = json;
        setFeed(res);
      }
    } catch (err) {
      // Sesi habis -> balik ke login (sama seperti interceptor 401 axios dulu). Error lain: coba lagi di tick berikutnya.
      if (err instanceof HttpError && err.status === 401 && !window.location.pathname.startsWith('/login')) {
        router.visit('/login');
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [userId, refresh]);

  const mutate = useCallback((fn: (old: NotificationResponse) => NotificationResponse) => {
    version.current += 1;
    lastJson.current = null;
    setFeed((old) => (old ? fn(old) : old));
  }, []);

  const markAsRead = useCallback(
    async (id: string) => {
      mutate((old) => {
        const target = old.data.find((n) => n.id === id);
        if (!target || target.read_at) return old;
        return {
          data: old.data.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
          unread_count: Math.max(0, old.unread_count - 1),
        };
      });

      try {
        await requestJson('POST', '/notifications/' + encodeURIComponent(id) + '/read');
      } catch {
        toast.error('Gagal memperbarui notifikasi. Coba lagi.', { id: 'notif-action' });
        void refresh(); // gagal -> sinkron ulang dari server
      }
    },
    [mutate, refresh],
  );

  const markAllAsRead = useCallback(async () => {
    mutate((old) => ({
      data: old.data.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      unread_count: 0,
    }));

    try {
      await requestJson('POST', '/notifications/read-all');
    } catch {
      toast.error('Gagal memperbarui notifikasi. Coba lagi.', { id: 'notif-action' });
      void refresh();
    }
  }, [mutate, refresh]);

  const remove = useCallback(
    async (id: string) => {
      mutate((old) => {
        const target = old.data.find((n) => n.id === id);
        return {
          data: old.data.filter((n) => n.id !== id),
          unread_count: target && !target.read_at ? Math.max(0, old.unread_count - 1) : old.unread_count,
        };
      });

      try {
        await requestJson('DELETE', '/notifications/' + encodeURIComponent(id));
      } catch {
        toast.error('Gagal memperbarui notifikasi. Coba lagi.', { id: 'notif-action' });
        void refresh();
      }
    },
    [mutate, refresh],
  );

  const addLocal = useCallback((item: AppNotification) => {
    version.current += 1;
    lastJson.current = null;
    setFeed((old) => {
      const base = old ?? { data: [], unread_count: 0 };
      if (base.data.some((n) => n.id === item.id)) return base;
      return {
        data: [item, ...base.data].slice(0, MAX_ITEMS),
        unread_count: base.unread_count + (item.read_at ? 0 : 1),
      };
    });
  }, []);

  const items = useMemo(() => feed?.data ?? [], [feed]);

  const value = useMemo<NotificationsContextType>(
    () => ({
      items,
      unreadCount: feed?.unread_count ?? 0,
      loaded: feed !== null,
      markAsRead,
      markAllAsRead,
      remove,
      addLocal,
    }),
    [items, feed, markAsRead, markAllAsRead, remove, addLocal],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}
