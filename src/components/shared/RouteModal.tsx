import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface RouteModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Custom close handler. Default-nya balik ke halaman sebelumnya (navigate(-1)). */
  onClose?: () => void;
  /** Fallback path kalau modal ini diakses langsung (refresh / buka link) tanpa background page. */
  fallbackPath?: string;
  maxWidthClassName?: string;
}

/**
 * Overlay untuk route "child" (create/edit) yang dipasangkan sama App.tsx
 * lewat pola background-location (lihat App.tsx). Halaman di belakangnya
 * TETAP mounted & terlihat — bukan di-unmount/loading ulang — persis
 * seperti ScanQrModal, tapi ini terikat ke route-nya sendiri jadi bisa
 * diakses/di-refresh lewat URL (/karyawan/create, /karyawan/1/edit, dst).
 */
export default function RouteModal({
  title,
  description,
  children,
  onClose,
  fallbackPath = '/',
  maxWidthClassName = 'max-w-xl',
}: RouteModalProps) {
  const navigate = useNavigate();

  function handleClose() {
    if (onClose) return onClose();
    // Kalau ada history dari dalam app (background location), mundur satu langkah
    // supaya balik ke halaman sebelumnya tanpa reload. Kalau tidak ada (akses langsung),
    // fallback ke path induknya.
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="route-modal-backdrop fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-[2px] px-4 py-6 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className={`route-modal-panel w-full ${maxWidthClassName} bg-white rounded-xl shadow-2xl my-auto`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
