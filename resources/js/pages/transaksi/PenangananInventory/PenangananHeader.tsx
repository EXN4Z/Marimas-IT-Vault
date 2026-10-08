import { Upload, Download, Loader2 } from 'lucide-react';

interface PenangananHeaderProps {
  isAdmin: boolean;
  canImportExport: boolean;
  setExportModalOpen: (open: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  importLoading: boolean;
}

export default function PenangananHeader({ isAdmin, canImportExport, setExportModalOpen, fileInputRef, handleFileSelected, importLoading }: PenangananHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Penanganan Inventory</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin
            ? 'Monitoring antrean perbaikan, verifikasi laporan kerusakan, dan riwayat penanganan unit aset.'
            : 'Pantau status penanganan dan hasil perbaikan inventory yang Anda gunakan.'}
        </p>
      </div>

      {canImportExport && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
          >
            <Download size={15} />
            Export Excel
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
          >
            {importLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Import Excel
          </button>
        </div>
      )}
    </div>
  );
}
