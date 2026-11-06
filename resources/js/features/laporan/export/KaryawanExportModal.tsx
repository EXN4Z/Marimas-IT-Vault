import { useState } from 'react';
import { FileSpreadsheet, FileText, X, CheckSquare, Square, FileDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { type Karyawan } from '../../karyawan/types';
import { formatTanggalId } from '../../inventory/inventoryHelpers';
import { printRowsAsReport } from '../../../lib/export/printCsvReport';
import { downloadStyledExcel } from '../../../lib/export/excelReport';
import { ButtonCancel, ButtonSubmit, InlineError } from '../../../components/form/FormControls';

const ROLE_LABEL: Record<string | number, string> = {
  1: 'User',
  2: 'Cabang',
  3: 'Admin',
};

const STATUS_LABEL: Record<string, string> = {
  aktif: 'Aktif',
  nonaktif: 'Nonaktif',
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
  { key: 'cabang', label: 'Lokasi Kantor', defaultChecked: false, get: (k) => k.cabang?.nama || '-' },
  {
    key: 'tanggal_masuk',
    label: 'Tanggal Masuk',
    defaultChecked: true,
    get: (k) => (k.tanggal_masuk ? formatTanggalId(k.tanggal_masuk) : '-'),
  },
  { key: 'role_id', label: 'Role', defaultChecked: true, get: (k) => ROLE_LABEL[k.role_id] ?? String(k.role_id ?? '-') },
  {
    key: 'status',
    label: 'Status',
    defaultChecked: true,
    get: (k) => (k.status ? STATUS_LABEL[k.status] ?? k.status : '-'),
  },
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-line-200-a80 w-full max-w-lg max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-line-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tint-blue-50 border border-edge-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <FileDown size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-900 leading-tight">Export Data Karyawan</h2>
              <p className="text-xs text-ink-500 mt-0.5">
                <span className="font-semibold text-ink-700">{data.length}</span> user karyawan sesuai filter aktif
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
              <span>Tidak ada data karyawan yang cocok dengan filter saat ini untuk diekspor.</span>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider">
                Pilihan Kolom Data ({checkedKeys.size}/{EXPORT_COLUMNS.length})
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium transition"
                >
                  Pilih Semua
                </button>
                <span className="text-ink-300">·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-ink-500 hover:text-ink-700 font-medium transition"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border border-line-200-a80 rounded-xl p-3 bg-surface-50-a50 max-h-56 overflow-y-auto">
              {EXPORT_COLUMNS.map((col) => {
                const checked = checkedKeys.has(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleKey(col.key)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition border ${
                      checked
                        ? 'bg-surface border-line-200 text-ink-900 shadow-2xs'
                        : 'bg-transparent border-transparent text-ink-500 hover:bg-hover-100-a70'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <Square size={16} className="text-ink-300 shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>

            {checkedKeys.size === 0 && (
              <InlineError>
                Pilih minimal 1 kolom data untuk diekspor.
              </InlineError>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line-100 bg-surface-50-a60 shrink-0">
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