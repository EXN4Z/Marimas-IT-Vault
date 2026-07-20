import { useState } from 'react';
import { FileSpreadsheet, ClipboardList, PackageSearch, Printer, Loader2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { printLaporanAbsensi, printLaporanIzin, printLaporanInventaris } from '../api/laporan';

const STAFF_ROLES = ['admin', 'hr', 'manajer', 'manager'];

const bulanOptions = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type LaporanKey = 'absensi' | 'izin' | 'inventaris';

const laporanConfig: Record<
  LaporanKey,
  {
    label: string;
    description: string;
    icon: typeof FileSpreadsheet;
    print: (b: number, t: number, w: Window) => Promise<void>;
  }
> = {
  absensi: {
    label: 'Laporan Absensi',
    description: 'Rekap jam masuk, jam pulang, dan status kehadiran seluruh karyawan per bulan.',
    icon: ClipboardList,
    print: printLaporanAbsensi,
  },
  izin: {
    label: 'Laporan Pengajuan Izin',
    description: 'Rekap pengajuan izin/cuti karyawan beserta status persetujuan per bulan.',
    icon: FileSpreadsheet,
    print: printLaporanIzin,
  },
  inventaris: {
    label: 'Laporan Mutasi Inventaris',
    description: 'Rekap mutasi barang masuk dan keluar beserta perubahan stok per bulan.',
    icon: PackageSearch,
    print: printLaporanInventaris,
  },
};

export default function Laporan() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [printingKey, setPrintingKey] = useState<LaporanKey | null>(null);
  const [error, setError] = useState('');

  const handlePrint = async (key: LaporanKey) => {
    // PENTING: window.open() harus dipanggil di sini, SEBELUM ada `await`,
    // supaya browser masih menganggapnya sebagai hasil klik langsung user
    // dan tidak memblokirnya sebagai popup.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.');
      return;
    }
    printWindow.document.write('<p style="font-family: sans-serif; padding: 24px;">Menyiapkan laporan...</p>');

    setPrintingKey(key);
    setError('');
    try {
      await laporanConfig[key].print(bulan, tahun, printWindow);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses untuk mencetak laporan ini.');
      } else {
        setError(err?.message || `Gagal mencetak ${laporanConfig[key].label.toLowerCase()}.`);
      }
    } finally {
      setPrintingKey(null);
    }
  };

  if (!isStaff) {
    return (
      <AppLayout title="Laporan">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Laporan">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-slate-500 max-w-lg">
          Cetak rekap bulanan langsung sebagai PDF yang sudah rapi.
        </p>

        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {bulanOptions.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            className="w-24 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(laporanConfig) as LaporanKey[]).map((key) => {
          const cfg = laporanConfig[key];
          const Icon = cfg.icon;
          const isPrinting = printingKey === key;
          return (
            <div key={key} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <Icon size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{cfg.label}</h3>
              <p className="text-xs text-slate-500 leading-relaxed flex-1">{cfg.description}</p>
              <button
                onClick={() => handlePrint(key)}
                disabled={isPrinting}
                className="mt-4 flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
              >
                {isPrinting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                {isPrinting ? 'Menyiapkan...' : 'Cetak PDF'}
              </button>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}