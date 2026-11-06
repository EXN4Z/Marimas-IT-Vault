import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Dipanggil waktu modal ditutup (tombol X atau Esc; klik di luar modal tidak menutup). */
  onClose: () => void;
  maxWidthClassName?: string;
}

/**
 * Modal overlay biasa (state dikontrol parent lewat onClose). Dipakai tab Cabang & Perusahaan.
 * Tidak bergantung ke react-router, jadi aman dirender di halaman Inertia.
 * Create/Detail/Edit Karyawan sekarang halaman Inertia sendiri (lihat PageCard.tsx).
 */
export default function Modal({
  title,
  description,
  children,
  onClose,
  maxWidthClassName = 'max-w-xl',
}: ModalProps) {
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

  return (
    <div
      className="route-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
    >
      <div
        className={`route-modal-panel w-full ${maxWidthClassName} bg-surface rounded-xl shadow-2xl my-auto`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-gray-100 sticky top-0 bg-surface rounded-t-xl z-10">
          <div>
            <h2 className="text-base font-semibold text-tone-gray-900">{title}</h2>
            {description && <p className="text-xs text-tone-gray-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={handleClose}
            className="text-tone-gray-400 hover:text-tone-gray-700 p-1.5 rounded-lg hover:bg-tint-gray-hover-100 transition"
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