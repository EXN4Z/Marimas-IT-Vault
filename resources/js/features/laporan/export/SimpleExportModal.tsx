import { useState } from 'react';
import { FileSpreadsheet, FileText, X, FileDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { printRowsAsReport } from '../../../lib/export/printCsvReport';
import { downloadStyledExcel } from '../../../lib/export/excelReport';
import { ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';

type FileType = 'excel' | 'pdf';

/**
 * Modal export generik (Excel/PDF) buat laporan Master Data sederhana yang
 * cuma butuh daftar kolom flat (mis. Cabang, Perusahaan, Role, Supplier) --
 * dipisah dari DepartemenExportModal/KategoriExportModal (yang isinya
 * copy-paste persis, cuma beda title/headers) supaya modul baru gak perlu
 * bikin file terpisah lagi tiap ada tab Master Data baru yang butuh export.
 */
interface Props<T> {
  open: boolean;
  onClose: () => void;
  data: T[];
  /** Judul laporan, mis. "Data Cabang" */
  title: string;
  /** Label item huruf kecil buat pesan toast/kosong, mis. "cabang" */
  itemLabel: string;
  headers: string[];
  toRow: (item: T) => (string | number)[];
}

export default function SimpleExportModal<T>({ open, onClose, data, title, itemLabel, headers, toRow }: Props<T>) {
  const [fileType, setFileType] = useState<FileType>('excel');
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    if (data.length === 0) {
      toast.error(`Tidak ada data ${itemLabel} untuk diekspor.`);
      return;
    }

    const printWindow = fileType === 'pdf' ? window.open('', '_blank') : null;
    if (fileType === 'pdf' && !printWindow) {
      toast.error('Popup diblokir browser. Izinkan popup untuk export PDF.');
      return;
    }

    setExporting(true);
    try {
      const rows = data.map(toRow);
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      if (fileType === 'excel') {
        await downloadStyledExcel(
          {
            title,
            subtitle: `${data.length} data ${itemLabel}`,
            headers,
            rows,
            sheetName: title,
          },
          `${title} - ${today}.xlsx`
        );
        } else if (printWindow) {
          const printRows = rows.map((row) => row.map((cell) => String(cell)));
          printRowsAsReport(
            headers,
            printRows,
            { title, periodLabel: `Diexport ${today} — ${data.length} data ${itemLabel}` },
            printWindow
          );
        }
      toast.success(`${data.length} data ${itemLabel} berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(`Gagal export data ${itemLabel}.`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-line-200-a80 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-line-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tint-blue-50 border border-edge-blue-100 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <FileDown size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-900 leading-tight">Export {title}</h2>
              <p className="text-xs text-ink-500 mt-0.5">
                <span className="font-semibold text-ink-700">{data.length}</span> data {itemLabel} siap diekspor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-hover-100 transition disabled:opacity-40"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
          {data.length === 0 && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-tint-amber-50 border border-edge-amber-200 text-tone-amber-800 text-xs">
              <AlertCircle size={16} className="shrink-0 text-tone-amber-600" />
              <span>Tidak ada data {itemLabel} yang cocok dengan filter saat ini untuk diekspor.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-2">
              Format Dokumen
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFileType('excel')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                  fileType === 'excel'
                    ? 'border-emerald-600 bg-tint-emerald-50-a60 ring-2 ring-glow-emerald-500-a20 shadow-sm'
                    : 'border-line-200 bg-surface hover:border-line-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${fileType === 'excel' ? 'bg-emerald-600 text-white' : 'bg-surface-100 text-ink-600'}`}>
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900 leading-none mb-1">Excel (.xlsx)</p>
                  <p className="text-[11px] text-ink-500">Tabel data terstruktur</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFileType('pdf')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                  fileType === 'pdf'
                    ? 'border-red-600 bg-tint-red-50-a60 ring-2 ring-glow-red-500-a20 shadow-sm'
                    : 'border-line-200 bg-surface hover:border-line-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${fileType === 'pdf' ? 'bg-red-600 text-white' : 'bg-surface-100 text-ink-600'}`}>
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900 leading-none mb-1">PDF Cetak</p>
                  <p className="text-[11px] text-ink-500">Format siap print/arsip</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line-100 bg-surface-50-a60 shrink-0">
          <ButtonCancel onClick={onClose} disabled={exporting} />
          <ButtonSubmit
            onClick={handleExport}
            disabled={exporting || data.length === 0}
            loading={exporting}
            loadingLabel="Mengekspor..."
          >
            Export {data.length} Data ({fileType === 'excel' ? 'Excel' : 'PDF'})
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}