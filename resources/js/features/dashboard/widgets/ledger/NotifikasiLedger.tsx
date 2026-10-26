import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { NotificationItem } from '../../types';
import { formatWaktuSingkat } from '../aktivitas/aktivitas';
import { Panel, EmptyNote } from './primitives';

export function NotifikasiLedger({
  notifications = [],
  onMarkAsRead,
}: {
  notifications?: NotificationItem[];
  onMarkAsRead: (id: string) => void;
}) {
  const navigate = useAppNavigate();
  const list = (Array.isArray(notifications) ? notifications : []).slice(0, 5);
  const unread = list.filter((n) => !n?.read_at);

  const open = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <Panel title="Notifikasi" subtitle={unread.length > 0 ? `${unread.length} belum dibaca.` : 'Semua sudah dibaca.'}>
      {list.length === 0 ? (
        <EmptyNote>Belum ada notifikasi.</EmptyNote>
      ) : (
        list.map((n) => (
          <button key={n.id} type="button" className="dv-row" onClick={() => open(n)}>
            <span>
              {!n.read_at && <i className="dv-unread" aria-label="Belum dibaca" />}
              {!n.read_at ? <b>{n.data?.message}</b> : n.data?.message}
            </span>
            <span className="dv-side">{formatWaktuSingkat(n.created_at)}</span>
          </button>
        ))
      )}
      {unread.length > 0 && (
        <div style={{ paddingTop: 12, borderTop: '1px solid var(--dv-line)' }}>
          <button type="button" className="dv-link" onClick={() => unread.forEach((n) => onMarkAsRead(n.id))}>
            Tandai semua dibaca
          </button>
        </div>
      )}
    </Panel>
  );
}
