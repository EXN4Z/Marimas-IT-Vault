import { useState } from 'react';
import { FileSpreadsheet, FileText, X, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { type AsetKelengkapan, type AsetKelengkapanStatus } from '../../api/asetKelengkapan';
import { formatTanggalId, namaPemakai } from './asetHelpers';
import { printRowsAsReport } from '../../utils/printCsvReport';
import { downloadStyledExcel } from '../../utils/excelReport';

const STATUS_LABEL: Record<AsetKelengkapanStatus, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  rusak: 'Rusak',
};

// Daftar kolom yang bisa diexport, urutannya = urutan kolom di file export &
// urutan checkbox di modal. Ngikutin pola AsetExportModal.tsx /
// AsetPenangananExportModal.tsx biar konsisten across halaman Inventaris.
interface ExportColumn {
  key: string;
  label: string;
  defaultChecked: boolean;
  get: (k: AsetKelengkapan) => string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'kode_kelengkapan', label: 'Kode Kelengkapan', defaultChecked: true, get: (k) => k.kode_kelengkapan },
  { key: 'nama', label: 'Nama', defaultChecked: true, get: (k) => k.nama || '-' },
  { key: 'merek_tipe', label: 'Merek/Tipe', defaultChecked: true, get: (k) => [k.merek, k.tipe].filter(Boolean).join(' ') || '-' },
  { key: 'warna', label: 'Warna', defaultChecked: false, get: (k) => k.warna || '-' },
  { key: 'serial_number', label: 'Serial Number', defaultChecked: true, get: (k) => k.serial_number || '-' },
  { key: 'aset_induk', label: 'Aset Induk', defaultChecked: true, get: (k) => k.aset?.kode_aset || '-' },
  { key: 'lokasi_kantor', label: 'Lokasi (Tanpa Induk)', defaultChecked: false, get: (k) => k.lokasiKantor?.nama || '-' },
  { key: 'status', label: 'Status', defaultChecked: true, get: (k) => STATUS_LABEL[k.status] },
  { key: 'pemakai_saat_ini', label: 'Pemakai Saat Ini', defaultChecked: true, get: (k) => namaPemakai(k.pemakai_saat_ini) },
  { key: 'tanggal_garansi', label: 'Tanggal Garansi', defaultChecked: false, get: (k) => formatTanggalId(k.tanggal_garansi) },
  { key: 'perusahaan', label: 'Perusahaan', defaultChecked: false, get: (k) => k.perusahaan || '-' },
  { key: 'supplier', label: 'Supplier', defaultChecked: false, get: (k) => k.supplier?.nama || '-' },
  { key: 'no_surat_jalan', label: 'No. Surat Jalan', defaultChecked: false, get: (k) => k.no_surat_jalan || '-' },
  { key: 'no_good_receive', label: 'No. Good Receive', defaultChecked: false, get: (k) => k.no_good_receive || '-' },
  { key: 'tanggal_pembelian', label: 'Tanggal Pembelian', defaultChecked: true, get: (k) => formatTanggalId(k.tanggal_pembelian) },
  { key: 'keterangan', label: 'Keterangan', defaultChecked: false, get: (k) => k.keterangan || '-' },
];

type FileType = 'excel' | 'pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  /** data yang mau diexport — sudah difilter sesuai tampilan tabel saat ini */
  data: AsetKelengkapan[];
}

export default function AsetKelengkapanExportModal({ open, onClose, data }: Props) {
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
      toast.error('Gak ada data kelengkapan aset buat diexport.');
      return;
    }

    // PENTING: kalau export PDF, window.open() HARUS dipanggil di sini,
    // langsung di dalam handler klik, SEBELUM ada proses lain — supaya
    // browser tetap anggap ini popup hasil aksi user (gak keblokir).
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
      // Kalau kolom "Status" dicentang, index-nya dikirim ke builder Excel
      // biar sel status itu diwarnai badge otomatis, sama kayak export Data Aset.
      const statusColIdx = selectedColumns.findIndex((c) => c.key === 'status');

      if (fileType === 'excel') {
        await downloadStyledExcel(
          {
            title: 'Data Kelengkapan Aset',
            subtitle: `${data.length} kelengkapan sesuai filter saat ini`,
            headers,
            rows,
            sheetName: 'Kelengkapan Aset',
            statusColumnIndexes: statusColIdx >= 0 ? [statusColIdx] : [],
          },
          `Data Kelengkapan Aset - ${today}.xlsx`
        );
      } else if (printWindow) {
        printRowsAsReport(
          headers,
          rows,
          { title: 'Data Kelengkapan Aset', periodLabel: `Diexport ${today} — ${data.length} kelengkapan` },
          printWindow
        );
      }
      toast.success(`${data.length} kelengkapan aset berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data kelengkapan aset.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Export Kelengkapan Aset</h2>
            <p className="text-xs text-slate-400 mt-0.5">{data.length} kelengkapan sesuai filter saat ini akan diexport</p>
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
            {exporting ? 'Mengexport...' : `Export ${data.length} Kelengkapan`}
          </button>
        </div>
      </div>
    </div>
  );
}