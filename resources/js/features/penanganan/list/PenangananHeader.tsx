import { Upload, Download, Loader2 } from 'lucide-react';

interface PenangananHeaderProps {
  isAdmin: boolean;
  canImportExport: boolean;
  setExportModalOpen: (open: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  importLoading: boolean;
}

// [PENANGANAN-V2] Warna ikut dashboard (ungu / kuning / hijau). Gaya lewat kelas .pn-* & .dd-btn di index.css.
export default function PenangananHeader({ isAdmin, canImportExport, setExportModalOpen, fileInputRef, handleFileSelected, importLoading }: PenangananHeaderProps) {
  return (
    <div className="pn-head">
      <div>
        <h2 className="pn-title">Penanganan Inventory</h2>
        <p className="pn-sub">
          {isAdmin
            ? 'Monitoring antrean perbaikan, verifikasi laporan kerusakan, dan riwayat penanganan unit inventory.'
            : 'Pantau status penanganan dan hasil perbaikan inventory yang Anda gunakan.'}
        </p>
      </div>

      {canImportExport && (
        <div className="pn-head-act">
          <button type="button" onClick={() => setExportModalOpen(true)} className="dd-btn">
            <Download size={15} />
            Export Excel
          </button>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelected} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="dd-btn">
            {importLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Import Excel
          </button>
        </div>
      )}
    </div>
  );
}
