import { useRef, useState } from 'react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { NotificationItem } from '../../types';
import { formatWaktuSingkat } from '../aktivitas/aktivitas';
import { Pager } from './Pager';
import { Panel, EmptyNote } from './primitives';

const PAGE_SIZE = 3; // default (DashboardUser); admin memakai pageSize lebih besar + fill
const SWIPE_MIN = 40; // px

// Notifikasi dengan paginasi: item per halaman tetap, jadi kartu tidak melar ke bawah kalau notifikasinya banyak.
// Geser lewat Pager atau swipe di layar sentuh.
//  - fill: daftar mengisi sisa tinggi kartu (dipakai dashboard admin supaya bawahnya sejajar dengan kolom kiri).
export function NotifikasiLedger({
  notifications = [],
  onMarkAsRead,
  pageSize = PAGE_SIZE,
  fill = false,
}: {
  notifications?: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  pageSize?: number;
  fill?: boolean;
}) {
  const navigate = useAppNavigate();
  const all = Array.isArray(notifications) ? notifications : [];
  const unread = all.filter((n) => !n?.read_at);

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const cur = Math.min(page, pageCount - 1); // aman kalau notifikasi berkurang (auto-hapus / dibaca)
  const list = all.slice(cur * pageSize, cur * pageSize + pageSize);

  const touchX = useRef<number | null>(null);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(pageCount - 1, n));
    if (next === cur) return;
    setDir(next > cur ? 1 : -1);
    setPage(next);
  };

  const open = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <Panel
      className="flex-1"
      title="Notifikasi"
      subtitle={`${unread.length > 0 ? `${unread.length} belum dibaca` : 'Semua sudah dibaca'} \u00b7 ${all.length} total`}
      right={
        unread.length > 0 ? (
          <button type="button" className="dd-link" onClick={() => unread.forEach((n) => onMarkAsRead(n.id))}>
            Tandai semua dibaca
          </button>
        ) : undefined
      }
    >
      <div
        className={`dd-nlist ${fill ? 'is-fill' : ''}`}
        style={fill ? undefined : { height: pageSize * 66 }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) >= SWIPE_MIN) go(dx < 0 ? cur + 1 : cur - 1);
        }}
      >
        {list.length === 0 ? (
          <EmptyNote>Belum ada notifikasi.</EmptyNote>
        ) : (
          <div key={cur} className={dir === 1 ? 'dd-slide-r' : 'dd-slide-l'}>
            {list.map((n) => (
              <button key={n.id} type="button" className="dd-nt" onClick={() => open(n)}>
                <span className="dd-nt-m">
                  {!n.read_at && <i className="dd-un" aria-label="Belum dibaca" />}
                  {!n.read_at ? <b>{n.data?.message}</b> : n.data?.message}
                </span>
                <span className="dd-nt-d">{formatWaktuSingkat(n.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Pager total={all.length} perPage={pageSize} page={cur + 1} onPage={(p) => go(p - 1)} />
    </Panel>
  );
}
