import { useEffect, useRef } from 'react';
import { useNotifications } from '../../notifications/NotificationsContext';
import { getEcho } from '../../../lib/echo';

// [F9-INERTIA] Notifikasi Dashboard: data & aksi (tandai-dibaca/hapus) datang dari NotificationsProvider (satu poller
// JSON bareng NotificationDropDown), bukan axios/useQuery. Yang tersisa di sini: realtime Echo, notif browser, dan
// auto-hapus 30 menit setelah dibaca.

const AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit

export function useDashboardNotifications(userId?: number) {
  const { items: notifications, markAsRead, remove, addLocal } = useNotifications();

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Realtime notifikasi via Echo/Pusher
  useEffect(() => {
    if (!userId) return;
    const echo = getEcho();
    if (!echo) return;

    const channelName = 'App.Models.User.' + userId;
    const channel = echo.private(channelName);

    channel.notification((payload: any) => {
      addLocal({
        id: payload.id,
        data: {
          message: payload.message,
          status: payload.status,
        },
        read_at: null,
        created_at: new Date().toISOString(),
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
        echo.leave(channelName);
      }
    };
  }, [userId, addLocal]);

  const handleMarkAsRead = (id: string) => {
    void markAsRead(id);
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
        void remove(n.id);
        return;
      }

      scheduledDeletes.current[n.id] = setTimeout(() => {
        void remove(n.id);
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

  return {
    notifications,
    handleMarkAsRead,
  };
}
