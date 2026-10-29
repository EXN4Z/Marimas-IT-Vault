import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { NotificationItem } from '../../types';
import { formatWaktuSingkat } from '../aktivitas/aktivitas';
import { Panel, EmptyNote } from './primitives';

const PAGE_SIZE = 3;
const SWIPE_MIN = 40; // px

// Notifikasi dengan paginasi: tinggi kartu tetap (3 item per halaman), jadi tidak melar ke bawah
// kalau notifikasinya banyak. Geser lewat panah, titik halaman, atau swipe di layar sentuh.
export function NotifikasiLedger({
  notifications = [],
  onMarkAsRead,
}: {
  notifications?: NotificationItem[];
  onMarkAsRead: (id: string) => void;
}) {
  const navigate = useAppNavigate();
  const all = Array.isArray(notifications) ? notifications : [];
  const unread = all.filter((n) => !n?.read_at);

  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const cur = Math.min(page, pageCount - 1); // aman kalau notifikasi berkurang (auto-hapus / dibaca)
  const list = all.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

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

  const pager =
    pageCount > 1 ? (
      <div className="dd-pg">
        <button type="button" className="dd-pa" aria-label="Halaman sebelumnya" disabled={cur === 0} onClick={() => go(cur - 1)}>
          <ChevronLeft size={15} />
        </button>
        <b aria-live="polite">
          {cur + 1} / {pageCount}
        </b>
        <button type="button" className="dd-pa" aria-label="Halaman berikutnya" disabled={cur >= pageCount - 1} onClick={() => go(cur + 1)}>
          <ChevronRight size={15} />
        </button>
      </div>
    ) : null;

  return (
    <Panel
      className="flex-1"
      title="Notifikasi"
      subtitle={`${unread.length > 0 ? `${unread.length} belum dibaca` : 'Semua sudah dibaca'} \u00b7 ${all.length} total`}
      right={pager}
    >
      <div
        className="dd-nlist"
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

      <div className="dd-nfoot">
        {pageCount > 1 && pageCount <= 7 ? (
          <span className="dd-dots" role="tablist" aria-label="Halaman notifikasi">
            {Array.from({ length: pageCount }, (_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === cur} aria-label={`Halaman ${i + 1}`} className={i === cur ? 'on' : ''} onClick={() => go(i)} />
            ))}
          </span>
        ) : (
          <span />
        )}
        {unread.length > 0 && (
          <button type="button" className="dd-link" onClick={() => unread.forEach((n) => onMarkAsRead(n.id))}>
            Tandai semua dibaca
          </button>
        )}
      </div>
    </Panel>
  );
}
