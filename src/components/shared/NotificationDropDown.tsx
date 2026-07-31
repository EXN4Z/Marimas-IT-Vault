import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Trash2, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type AppNotification,
  type NotificationResponse,
} from '../../api/notifications';

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Sama-sama pake query key ['notifications'] kayak Dashboard.tsx, biar satu
  // sumber data. Sebelum ini komponen punya state lokal sendiri + polling
  // 30 detik sendiri, gak nyambung ke cache Dashboard -- jadi badge/notif baru
  // yang masuk lewat push Echo di Dashboard gak pernah nyampe ke bell ini,
  // dan tandai-dibaca di satu tempat gak sinkron ke tempat lain.
  const { data, isLoading } = useQuery<NotificationResponse>({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const items = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  // GANTI: dulu notif baru cuma nongol lewat push Pusher (Echo) di Dashboard.tsx,
  // gagal kalau Pusher gak konek di production. Sekarang polling (di atas) yang
  // jadi satu-satunya sumber, dan tiap ketemu notif ID baru yang belum pernah
  // kelihatan sebelumnya, langsung munculin toast alert -- gak butuh Pusher sama sekali.
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;

    const currentIds = new Set(items.map((n) => n.id));

    if (seenIdsRef.current) {
      const belumPernahMuncul = items.filter(
        (n) => !seenIdsRef.current!.has(n.id) && !n.read_at
      );

      belumPernahMuncul.forEach((n) => {
        toast(n.data?.message ?? 'Notifikasi baru.', { icon: '🔔' });
      });
    }

    seenIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => setOpen((prev) => !prev);

  const handleMarkAsRead = async (id: string) => {
    queryClient.setQueryData<NotificationResponse | undefined>(['notifications'], (old) => {
      if (!old) return old;
      return {
        data: old.data.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
        unread_count: Math.max(0, old.unread_count - 1),
      };
    });
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error('Gagal menandai notifikasi.', err);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const handleMarkAllAsRead = async () => {
    queryClient.setQueryData<NotificationResponse | undefined>(['notifications'], (old) => {
      if (!old) return old;
      return {
        data: old.data.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
        unread_count: 0,
      };
    });
    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error('Gagal menandai semua notifikasi.', err);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const handleDelete = async (id: string) => {
    const target = items.find((n) => n.id === id);
    queryClient.setQueryData<NotificationResponse | undefined>(['notifications'], (old) => {
      if (!old) return old;
      return {
        data: old.data.filter((n) => n.id !== id),
        unread_count: target && !target.read_at ? Math.max(0, old.unread_count - 1) : old.unread_count,
      };
    });
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Gagal menghapus notifikasi.', err);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  // Klik notif (bukan tombol tandai-dibaca/hapus di kanannya) -> tandai dibaca
  // kalau masih belum dibaca, tutup dropdown, terus arahkan ke halaman yang
  // dituju sesuai field data.url yang dikirim backend (lihat app/Notifications/*.php).
  // Notif lama yang belum punya field url (dibuat sebelum fitur ini) dibiarkan
  // gak ngapa-ngapain -- gak error, cuma gak pindah halaman.
  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read_at) handleMarkAsRead(n.id);
    setOpen(false);
    if (n.data?.url) navigate(n.data.url);
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
        // PENAMBAHAN: dulu "absolute right-0" -- posisinya dihitung relatif ke
        // tombol bell, padahal bell bukan elemen paling kanan di header (masih
        // ada avatar+nama di sebelah kanannya). Akibatnya di device yang lebih
        // sempit / rasio beda dari iPhone yang dites, titik jangkarnya jadi
        // gak selalu di ujung layar, dan panel selebar w-80 yang melebar ke
        // kiri bisa kepotong tepi layar. Sekarang di mobile (di bawah "sm")
        // dropdown pakai "fixed" yang nempel langsung ke tepi LAYAR
        // (left-4 right-4), jadi posisinya selalu aman & center apapun posisi
        // tombolnya. Di "sm" ke atas balik ke perilaku lama (absolute nempel
        // ke tombol, lebar tetap w-80).
        <div className="fixed left-4 right-4 top-[4.5rem] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-[90vw] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[75vh] sm:max-h-none">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
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

          <div className="overflow-y-auto max-h-[60vh] sm:max-h-80">
            {isLoading && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Memuat...</p>
            )}

            {!isLoading && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada notifikasi.</p>
            )}

            {items.map((n: AppNotification) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-2 px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition ${
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(n.id);
                      }}
                      title="Tandai dibaca"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(n.id);
                    }}
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