import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Trash2, CheckCheck } from 'lucide-react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type AppNotification,
} from '../api/notifications';

function formatWaktu(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      setItems(res.data);
      setUnreadCount(res.unread_count);
    } catch (err) {
      console.error('Gagal memuat notifikasi.', err);
    } finally {
      setLoading(false);
    }
  };

  // polling ringan tiap 30 detik biar badge kebaruan gak stale kelamaan
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setOpen((prev) => {
      if (!prev) loadNotifications();
      return !prev;
    });
  };

  const handleMarkAsRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error('Gagal menandai notifikasi.', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error('Gagal menandai semua notifikasi.', err);
    }
  };

  const handleDelete = async (id: string) => {
    const target = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.read_at) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Gagal menghapus notifikasi.', err);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition"
              >
                <CheckCheck size={13} />
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Memuat...</p>
            )}

            {!loading && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada notifikasi.</p>
            )}

            {items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 px-4 py-3 border-b border-slate-50 last:border-0 ${
                  n.read_at ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-red-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 leading-snug">
                    {n.data?.message ?? 'Notifikasi baru.'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatWaktu(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.read_at && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      title="Tandai dibaca"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    title="Hapus"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}