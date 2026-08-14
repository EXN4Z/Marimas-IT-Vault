import { useState } from 'react';
import { FileSpreadsheet, FileText, X, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { type AsetPenanganan } from '../../api/aset';
import { formatTanggalId, namaPemakai, formatRupiah } from './asetHelpers';
import { printRowsAsReport } from '../../utils/printCsvReport';
import { downloadStyledExcel } from '../../utils/excelReport';

// Cuma dipakai buat 2 tab yang sudah "final": Berhasil Diperbaiki & Rusak
// Berat (keduanya punya tanggal_selesai terisi) -- tab "Menunggu Terima" &
// "Sedang Diperbaiki" sengaja gak dikasih export/import karena datanya
// masih berubah-ubah, belum jadi catatan final.
const HASIL_LABEL: Record<string, string> = {
  diperbaiki: 'Berhasil Diperbaiki',
  rusak_berat: 'Rusak Berat',
};

// Daftar kolom yang bisa diexport, urutannya = urutan kolom di file export &
// urutan checkbox di modal. Sengaja ngikutin pola AsetExportModal.tsx biar
// konsisten across halaman Inventaris.
interface ExportColumn {
  key: string;
  label: string;
  defaultChecked: boolean;
  get: (p: AsetPenanganan) => string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'kode_aset', label: 'Kode Aset', defaultChecked: true, get: (p) => p.aset?.kode_aset || '-' },
  {
    key: 'jenis_kerusakan',
    label: 'Jenis Kerusakan',
    defaultChecked: true,
    get: (p) => (p.jenis_kerusakan === 'hardware' ? 'Hardware' : 'Software'),
  },
  { key: 'keluhan', label: 'Keluhan', defaultChecked: true, get: (p) => p.keluhan || '-' },
  { key: 'pelapor', label: 'Pelapor', defaultChecked: true, get: (p) => namaPemakai(p.pemakai) },
  { key: 'tanggal_lapor', label: 'Tanggal Lapor', defaultChecked: true, get: (p) => formatTanggalId(p.tanggal_lapor) },
  { key: 'tanggal_diterima', label: 'Tanggal Diterima', defaultChecked: false, get: (p) => formatTanggalId(p.tanggal_diterima) },
  { key: 'tanggal_selesai', label: 'Tanggal Selesai', defaultChecked: true, get: (p) => formatTanggalId(p.tanggal_selesai) },
  { key: 'durasi_hari', label: 'Durasi (hari)', defaultChecked: false, get: (p) => (p.durasi_hari != null ? String(p.durasi_hari) : '-') },
  { key: 'hasil', label: 'Hasil', defaultChecked: true, get: (p) => HASIL_LABEL[p.hasil || ''] || p.hasil || '-' },
  { key: 'biaya_komponen', label: 'Biaya Komponen', defaultChecked: false, get: (p) => formatRupiah(p.biaya_komponen) },
  { key: 'harga_jasa', label: 'Biaya Jasa', defaultChecked: false, get: (p) => formatRupiah(p.harga_jasa) },
  { key: 'total_biaya', label: 'Total Biaya', defaultChecked: true, get: (p) => formatRupiah(p.total_biaya ?? null) },
  { key: 'no_struk', label: 'No. Struk', defaultChecked: false, get: (p) => p.no_struk || '-' },
  { key: 'catatan', label: 'Catatan', defaultChecked: false, get: (p) => p.catatan || '-' },
];

type FileType = 'excel' | 'pdf';

interface Props {
  open: boolean;
  onClose: () => void;
  /** data yang mau diexport — sudah difilter sesuai tab & search yang aktif saat ini */
  data: AsetPenanganan[];
  /** dipakai buat judul & nama file, mis. "Berhasil Diperbaiki" / "Rusak Berat" */
  tabLabel: string;
}

export default function AsetPenangananExportModal({ open, onClose, data, tabLabel }: Props) {
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
      toast.error('Gak ada data buat diexport.');
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
      const rows = data.map((p) => selectedColumns.map((c) => c.get(p)));
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      // Kalau kolom "Hasil" dicentang, index-nya dikirim ke builder Excel
      // biar sel-nya diwarnai badge (hijau/merah) otomatis, sama kayak
      // export Data Aset.
      const hasilColIdx = selectedColumns.findIndex((c) => c.key === 'hasil');
      const judul = `Penanganan Aset - ${tabLabel}`;

      if (fileType === 'excel') {
        await downloadStyledExcel(
          {
            title: judul,
            subtitle: `${data.length} laporan sesuai filter saat ini`,
            headers,
            rows,
            sheetName: tabLabel,
            statusColumnIndexes: hasilColIdx >= 0 ? [hasilColIdx] : [],
          },
          `${judul} - ${today}.xlsx`
        );
      } else if (printWindow) {
        printRowsAsReport(
          headers,
          rows,
          { title: judul, periodLabel: `Diexport ${today} — ${data.length} laporan` },
          printWindow
        );
      }
      toast.success(`${data.length} laporan berhasil diexport.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Gagal export data penanganan aset.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Export Penanganan Aset — {tabLabel}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{data.length} laporan sesuai filter saat ini akan diexport</p>
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
            {exporting ? 'Mengexport...' : `Export ${data.length} Laporan`}
          </button>
        </div>
      </div>
    </div>
  );
}