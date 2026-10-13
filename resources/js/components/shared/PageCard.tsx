import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Dipanggil waktu tombol "Kembali" diklik. */
  onClose: () => void;
  maxWidthClassName?: string;
}

/**
 * Kartu halaman penuh (di dalam layout Inertia) untuk form/detail. Pengganti RouteModal di
 * halaman Karyawan: sekarang create/detail/edit adalah halaman beneran, bukan overlay di atas
 * halaman sebelumnya. Sengaja TIDAK ada tutup-pakai-Esc supaya form yang lagi diisi (atau modal
 * kecil di dalamnya, mis. set password) tidak ikut kebuang.
 */
export default function PageCard({
  title,
  description,
  children,
  onClose,
  maxWidthClassName = 'max-w-xl',
}: PageCardProps) {
  return (
    <div className={'mx-auto w-full ' + maxWidthClassName}>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
