import { Upload, Download, Loader2 } from 'lucide-react';

interface PenangananHeaderProps {
  isAdmin: boolean;
  canImportExport: boolean;
  setExportModalOpen: (open: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  importLoading: boolean;
}

// [PENANGANAN-V2] Warna ikut dashboard (ungu / kuning / hijau). Gaya lewat utilitas Tailwind (token palet .pn di index.css).
export default function PenangananHeader({ isAdmin, canImportExport, setExportModalOpen, fileInputRef, handleFileSelected, importLoading }: PenangananHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-dv-ink">Penanganan Inventory</h2>
        <p className="mt-1.5 max-w-[560px] text-[13px] leading-normal text-dv-muted">
          {isAdmin
            ? 'Monitoring antrean perbaikan, verifikasi laporan kerusakan, dan riwayat penanganan unit inventory.'
            : 'Pantau status penanganan dan hasil perbaikan inventory yang Anda gunakan.'}
        </p>
      </div>

      {canImportExport && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setExportModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-transparent font-bold whitespace-nowrap shadow-dd h-[42px] px-5 text-[13px] bg-dd-card text-dv-ink hover:brightness-[.97] disabled:opacity-50 dark:border-dv-line dark:shadow-none">
            <Download size={15} />
            Export Excel
          </button>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelected} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="inline-flex items-center gap-1.5 rounded-full border border-transparent font-bold whitespace-nowrap shadow-dd h-[42px] px-5 text-[13px] bg-dd-card text-dv-ink hover:brightness-[.97] disabled:opacity-50 dark:border-dv-line dark:shadow-none">
            {importLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Import Excel
          </button>
        </div>
      )}
    </div>
  );
}
