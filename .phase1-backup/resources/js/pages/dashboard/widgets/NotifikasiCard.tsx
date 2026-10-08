import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../useDashboardData';
import { cardClass } from './theme';
import { SectionHeader } from './primitives';

// ==== Notifikasi Card ====
export function NotifikasiCard({
  notifications = [],
  onMarkAsRead,
  className = '',
}: {
  notifications?: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !n?.read_at).length;

  const handleClick = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <div className={`${cardClass} ${className}`}>
      <SectionHeader
        icon={Bell}
        tone="violet"
        title="Notifikasi Sistem"
        subtitle="Pemberitahuan & pengingat"
        right={
          unreadCount > 0 ? (
            <span className="text-[10px] font-bold text-white bg-[#F2453D] px-2.5 py-1 rounded-lg">
              {unreadCount} Baru
            </span>
          ) : (
            <span className="text-[10px] font-medium text-[#A9A9C6]">Semua dibaca</span>
          )
        }
      />

      {safeNotifications.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-[#A9A9C6]">Belum ada notifikasi</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto pr-0.5 my-auto max-h-[190px]">
          {safeNotifications.slice(0, 5).map((n) => {
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-colors ${
                  unread ? 'bg-[#EFEAFF]/60 hover:bg-[#EFEAFF]' : 'bg-[#F7F8FC] hover:bg-[#F0F1F7]'
                }`}
                onClick={() => handleClick(n)}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${unread ? 'bg-[#5A32FA]' : 'bg-[#D5D5E8]'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${unread ? 'text-[#171633] font-semibold' : 'text-[#666687]'}`}>{n.data?.message || 'Notifikasi baru'}</p>
                  <p className="text-[10px] text-[#A9A9C6] mt-1">{n.created_at ? new Date(n.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-3 border-t border-[#F0F1F7] flex items-center justify-between text-[10px] text-[#A9A9C6]">
        <span>{safeNotifications.length} notifikasi tersimpan</span>
        <span>Auto-sync Pusher</span>
      </div>
    </div>
  );
}
