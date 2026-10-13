import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface RouteModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Dipanggil waktu modal ditutup (tombol X, klik backdrop, atau Esc). */
  onClose: () => void;
  maxWidthClassName?: string;
}

/**
 * Modal overlay biasa (state dikontrol parent lewat onClose). Dipakai tab Cabang & Perusahaan.
 * Tidak bergantung ke react-router, jadi aman dirender di halaman Inertia.
 * Create/Detail/Edit Karyawan sekarang halaman Inertia sendiri (lihat PageCard.tsx).
 */
export default function RouteModal({
  title,
  description,
  children,
  onClose,
  maxWidthClassName = 'max-w-xl',
}: RouteModalProps) {
  // BARU: fix bug "drag-select teks lalu kepeleset ke backdrop = modal ketutup".
  // Klik dianggap "nutup modal" cuma kalau mousedown DAN mouseup dua-duanya
  // kena backdrop-nya sendiri (bukan hasil drag yang start-nya dari dalam panel).
  const mouseDownOnBackdrop = useRef(false);

  function handleClose() {
    onClose();
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

  function handleBackdropMouseDown(e: MouseEvent<HTMLDivElement>) {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  }

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (mouseDownOnBackdrop.current && e.target === e.currentTarget) {
      handleClose();
    }
    mouseDownOnBackdrop.current = false;
  }

  return (
    <div
      className="route-modal-backdrop fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-[2px] px-4 py-6 overflow-y-auto"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
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