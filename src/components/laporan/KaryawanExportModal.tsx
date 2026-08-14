import { useState } from 'react';
import { FileSpreadsheet, FileText, X, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { type Karyawan } from '../../api/karyawan';
import { formatTanggalId } from '../inventaris/asetHelpers';
import { printRowsAsReport } from '../../utils/printCsvReport';
import { downloadStyledExcel } from '../../utils/excelReport';

const ROLE_LABEL: Record<string, string> = {
  guest: 'Guest',
  karyawan: 'Karyawan',
  cabang: 'Cabang',
  manajer: 'Manajer',
  hr: 'HR',
  admin: 'Admin',
};

// Sama pola dengan AsetExportModal — daftar kolom yang bisa diexport,
// urutan di sini = urutan checkbox & urutan kolom di file hasil export.
interface ExportColumn {
  key: string;
  label: string;
  defaultChecked: boolean;
  get: (k: Karyawan) => string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'nik', label: 'NIK', defaultChecked: true, get: (k) => k.nik || '-' },
  { key: 'name', label: 'Nama', defaultChecked: true, get: (k) => k.name },
  { key: 'email', label: 'Email', defaultChecked: true, get: (k) => k.email },
  { key: 'phone', label: 'Telepon', defaultChecked: false, get: (k) => k.phone || '-' },
  { key: 'departemen', label: 'Departemen', defaultChecked: true, get: (k) => k.departemen || '-' },
  { key: 'lokasi_kantor', label: 'Lokasi Kantor', defaultChecked: false, get: (k) => k.lokasi_kantor || '-' },
    {
    key: 'tanggal_masuk',
    label: 'Tanggal Masuk',
    defaultChecked: true,
    get: (k) => (k.tanggal_masuk ? formatTanggalId(k.tanggal_masuk) : '-'),
    },
  { key: 'role', label: 'Role', defaultChecked: true, get: (k) => ROLE_LABEL[k.role] || k.role },
];

type FileType = 'excel' | 'pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  /** data yang mau diexport — sudah difilter sesuai tampilan tabel saat ini (search/departemen/dll) */
  data: Karyawan[];
}

export default function KaryawanExportModal({ open, onClose, data }: Props) {
  const [fileType, setFileType] = useState<FileType>('excel');
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(
    () => new Set(EXPORT_COLUMNS.filter((c) => c.defaultChecked).map((c) => c.key))
  );
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const toggleKey = (key: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setCheckedKeys(new Set(EXPORT_COLUMNS.map((c) => c.key)));
  const clearAll = () => setCheckedKeys(new Set());

  const selectedColumns = EXPORT_COLUMNS.filter((c) => checkedKeys.has(c.key));

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Pilih minimal 1 kolom data buat diexport.');
      return;
    }
    if (data.length === 0) {
      toast.error('Gak ada data karyawan buat diexport.');
      return;
    }

    // Sama seperti AsetExportModal: window.open() untuk PDF harus dipanggil
    // di sini, langsung di handler klik, sebelum proses lain — biar gak
    // keblokir popup blocker browser.
    const printWindow = fileType === 'pdf' ? window.open('', '_blank') : null;
    if (fileType === 'pdf' && !printWindow) {
      toast.error('Popup diblokir browser. Izinkan popup buat export PDF.');
      return;
    }

    setExporting(true);
    try {
      const headers = selectedColumns.map((c) => c.label);
      const rows = data.map((k) => selectedColumns.map((c) => c.get(k)));
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      if (fileType === 'excel') {
        await downloadStyledExcel(
          {
            title: 'Data Karyawan',
            subtitle: `${data.length} karyawan sesuai filter saat ini`,
            headers,
            rows,
            sheetName: 'Data Karyawan',
            statusColumnIndexes: [],
          },
          `Data Karyawan - ${today}.xlsx`
        );
      } else if (printWindow) {
        printRowsAsReport(
          headers,
          rows,
          { title: 'Data Karyawan', periodLabel: `Diexport ${today} — ${data.length} karyawan` },
          printWindow
        );
      }
      toast.success(`${data.length} karyawan berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data karyawan.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Export Data Karyawan</h2>
            <p className="text-xs text-slate-400 mt-0.5">{data.length} karyawan sesuai filter saat ini akan diexport</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tipe File</p>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
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

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Data yang Diexport ({checkedKeys.size}/{EXPORT_COLUMNS.length})
            </p>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={selectAll} className="text-slate-600 hover:text-slate-900 font-medium">
                Pilih Semua
              </button>
              <button type="button" onClick={clearAll} className="text-slate-400 hover:text-slate-600 font-medium">
                Kosongkan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 border border-slate-100 rounded-xl p-3 bg-slate-50/60">
            {EXPORT_COLUMNS.map((col) => {
              const checked = checkedKeys.has(col.key);
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => toggleKey(col.key)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white text-left transition"
                >
                  {checked ? (
                    <CheckSquare size={16} className="text-slate-900 flex-shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-300 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${checked ? 'text-slate-800' : 'text-slate-400'}`}>{col.label}</span>
                </button>
              );
            })}
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
            {exporting ? 'Mengexport...' : `Export ${data.length} Karyawan`}
          </button>
        </div>
      </div>
    </div>
  );
}