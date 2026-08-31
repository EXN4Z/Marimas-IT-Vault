import { useState } from 'react';
import { FileSpreadsheet, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { type Kategori } from '../../api/masterData/kategori';
import { printRowsAsReport } from '../../utils/printCsvReport';
import { downloadStyledExcel } from '../../utils/excelReport';

type FileType = 'excel' | 'pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  data: Kategori[];
}

export default function KategoriExportModal({ open, onClose, data }: Props) {
  const [fileType, setFileType] = useState<FileType>('excel');
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    if (data.length === 0) {
      toast.error('Gak ada data kategori buat diexport.');
      return;
    }

    // sama kayak modal export lain: window.open() HARUS di sini, sebelum
    // proses async lain, biar gak keblokir popup blocker browser.
    const printWindow = fileType === 'pdf' ? window.open('', '_blank') : null;
    if (fileType === 'pdf' && !printWindow) {
      toast.error('Popup diblokir browser. Izinkan popup buat export PDF.');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Nama Kategori'];
      const rows = data.map((k) => [k.nama]);
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      if (fileType === 'excel') {
        await downloadStyledExcel(
          {
            title: 'Data Kategori',
            subtitle: `${data.length} data kategori`,
            headers,
            rows,
            sheetName: 'Data Kategori',
          },
          `Data Kategori - ${today}.xlsx`
        );
      } else if (printWindow) {
        printRowsAsReport(
          headers,
          rows,
          { title: 'Data Kategori', periodLabel: `Diexport ${today} — ${data.length} data kategori` },
          printWindow
        );
      }
      toast.success(`${data.length} data kategori berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data kategori.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Export Data Kategori</h2>
            <p className="text-xs text-slate-400 mt-0.5">{data.length} data kategori akan diexport</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tipe File</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFileType('excel')}
              className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-sm font-medium transition ${
                fileType === 'excel'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <FileSpreadsheet size={18} />
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => setFileType('pdf')}
              className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-sm font-medium transition ${
                fileType === 'pdf'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <FileText size={18} />
              PDF
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition"
          >
            Batal
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            {exporting ? 'Mengexport...' : `Export ${data.length} Data Kategori`}
          </button>
        </div>
      </div>
    </div>
  );
}