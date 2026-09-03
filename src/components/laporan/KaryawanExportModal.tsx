import { useState } from 'react';
import { FileSpreadsheet, FileText, X, CheckSquare, Square, FileDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { type Karyawan } from '../../api/karyawan';
import { formatTanggalId } from '../masterData/inventoryHelpers';
import { printRowsAsReport } from '../../utils/printCsvReport';
import { downloadStyledExcel } from '../../utils/excelReport';
import { ButtonCancel, ButtonSubmit } from '../shared/FormControls';

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
  { key: 'departemen', label: 'Departemen', defaultChecked: true, get: (k) => k.departemen?.nama || '-' },
  { key: 'lokasi_kantor', label: 'Lokasi Kantor', defaultChecked: false, get: (k) => k.lokasi_kantor?.nama || '-' },
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
      toast.error('Gak ada data user buat diexport.');
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
            title: 'Data User',
            subtitle: `${data.length} user sesuai filter saat ini`,
            headers,
            rows,
            sheetName: 'Data User',
            statusColumnIndexes: [],
          },
          `Data User - ${today}.xlsx`
        );
      } else if (printWindow) {
        printRowsAsReport(
          headers,
          rows,
          { title: 'Data User', periodLabel: `Diexport ${today} — ${data.length} user` },
          printWindow
        );
      }
      toast.success(`${data.length} user berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data user.');
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <FileDown size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">Export Data Karyawan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-slate-700">{data.length}</span> user karyawan sesuai filter aktif
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
              <span>Tidak ada data karyawan yang cocok dengan filter saat ini untuk diekspor.</span>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Pilihan Kolom Data ({checkedKeys.size}/{EXPORT_COLUMNS.length})
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-500 hover:text-slate-700 font-medium transition"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 max-h-56 overflow-y-auto">
              {EXPORT_COLUMNS.map((col) => {
                const checked = checkedKeys.has(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleKey(col.key)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition border ${
                      checked
                        ? 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                        : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100/70'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare size={16} className="text-blue-600 shrink-0" />
                    ) : (
                      <Square size={16} className="text-slate-300 shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>

            {checkedKeys.size === 0 && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">
                Pilih minimal 1 kolom data untuk diekspor.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <ButtonCancel onClick={onClose} disabled={exporting} />
          <ButtonSubmit
            onClick={handleExport}
            disabled={exporting || data.length === 0 || checkedKeys.size === 0}
            loading={exporting}
            loadingLabel="Mengekspor..."
          >
            Export {data.length} User ({fileType === 'excel' ? 'Excel' : 'PDF'})
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}