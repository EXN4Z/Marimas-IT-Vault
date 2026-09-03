import { useState } from 'react';
import { FileSpreadsheet, FileText, X, FileDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { type Departemen } from '../../api/masterData/departemen';
import { printRowsAsReport } from '../../utils/printCsvReport';
import { downloadStyledExcel } from '../../utils/excelReport';
import { ButtonCancel, ButtonSubmit } from '../shared/FormControls';

type FileType = 'excel' | 'pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  data: Departemen[];
}

export default function DepartemenExportModal({ open, onClose, data }: Props) {
  const [fileType, setFileType] = useState<FileType>('excel');
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    if (data.length === 0) {
      toast.error('Tidak ada data departemen untuk diekspor.');
      return;
    }

    const printWindow = fileType === 'pdf' ? window.open('', '_blank') : null;
    if (fileType === 'pdf' && !printWindow) {
      toast.error('Popup diblokir browser. Izinkan popup untuk export PDF.');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Nama Departemen'];
      const rows = data.map((d) => [d.nama]);
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      if (fileType === 'excel') {
        await downloadStyledExcel(
          {
            title: 'Data Departemen',
            subtitle: `${data.length} data departemen`,
            headers,
            rows,
            sheetName: 'Data Departemen',
          },
          `Data Departemen - ${today}.xlsx`
        );
      } else if (printWindow) {
        printRowsAsReport(
          headers,
          rows,
          { title: 'Data Departemen', periodLabel: `Diexport ${today} — ${data.length} data departemen` },
          printWindow
        );
      }
      toast.success(`${data.length} data departemen berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data departemen.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center z-[70] p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !exporting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <FileDown size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">Export Data Departemen</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-slate-700">{data.length}</span> data departemen siap diekspor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
          {data.length === 0 && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertCircle size={16} className="shrink-0 text-amber-600" />
              <span>Tidak ada data departemen yang cocok dengan filter saat ini untuk diekspor.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Format Dokumen
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFileType('excel')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                  fileType === 'excel'
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${fileType === 'excel' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 leading-none mb-1">Excel (.xlsx)</p>
                  <p className="text-[11px] text-slate-500">Tabel data terstruktur</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFileType('pdf')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                  fileType === 'pdf'
                    ? 'border-red-600 bg-red-50/60 ring-2 ring-red-500/20 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${fileType === 'pdf' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 leading-none mb-1">PDF Cetak</p>
                  <p className="text-[11px] text-slate-500">Format siap print/arsip</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
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