import { useEffect, useState } from 'react';
import { Wallet, TrendingDown, Users, Download, Loader2, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getPayroll, exportPayrollCsv, type PayrollRow } from '../api/payroll';

const STAFF_ROLES = ['admin', 'hr'];

const bulanOptions = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    value
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [detailRow, setDetailRow] = useState<PayrollRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPayroll(bulan, tahun);
      setRows(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Anda tidak punya akses ke halaman ini.');
      } else {
        setError('Gagal memuat data payroll.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulan, tahun]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPayrollCsv(bulan, tahun);
    } catch (err) {
      console.error('Gagal mengunduh CSV payroll.', err);
    } finally {
      setExporting(false);
    }
  };

  const totalGajiBersih = rows.reduce((sum, r) => sum + r.gaji_bersih, 0);
  const totalTunjangan = rows.reduce((sum, r) => sum + r.tunjangan, 0);
  const totalPotongan = rows.reduce((sum, r) => sum + r.total_potongan, 0);

  if (!isStaff) {
    return (
      <AppLayout title="Payroll">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Payroll">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-slate-500 max-w-lg">
          Rekap gaji bulanan per karyawan: gaji pokok + tunjangan jabatan, dikurangi potongan
          telat, izin tanpa gaji, dan alpa.
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
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Gaji Bersih</p>
            <p className="text-lg font-bold text-slate-900">{formatRupiah(totalGajiBersih)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Tunjangan</p>
            <p className="text-lg font-bold text-slate-900">{formatRupiah(totalTunjangan)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
            <TrendingDown size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Potongan</p>
            <p className="text-lg font-bold text-slate-900">{formatRupiah(totalPotongan)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Jumlah Karyawan</p>
            <p className="text-lg font-bold text-slate-900">{rows.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada data payroll untuk periode ini.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Nama</th>
                  <th className="px-6 py-3 font-medium">Jabatan</th>
                  <th className="px-6 py-3 font-medium">Departemen</th>
                  <th className="px-6 py-3 font-medium text-right">Gaji Kotor</th>
                  <th className="px-6 py-3 font-medium text-center">Hadir/Kerja</th>
                  <th className="px-6 py-3 font-medium text-right">Total Potongan</th>
                  <th className="px-6 py-3 font-medium text-right">Gaji Bersih</th>
                  <th className="px-6 py-3 font-medium text-right">Rincian</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.pekerja_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3">
                      <p className="text-slate-800 font-medium whitespace-nowrap">{row.nama}</p>
                      <p className="text-xs text-slate-400">{row.nip}</p>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{row.jabatan}</td>
                    <td className="px-6 py-3 text-slate-600">{row.departemen}</td>
                    <td className="px-6 py-3 text-slate-600 text-right">{formatRupiah(row.gaji_kotor)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={row.hari_alpa > 0 ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                        {row.hari_hadir}/{row.hari_kerja}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-red-500 text-right">
                      {row.total_potongan > 0 ? `- ${formatRupiah(row.total_potongan)}` : '-'}
                    </td>
                    <td className="px-6 py-3 text-slate-900 font-semibold text-right">
                      {formatRupiah(row.gaji_bersih)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setDetailRow(row)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 transition"
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailRow && <PayrollDetailModal row={detailRow} onClose={() => setDetailRow(null)} />}
    </AppLayout>
  );
}

function DetailLine({ label, value, muted, negative }: { label: string; value: string; muted?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
      <span className={negative ? 'text-red-500 font-medium' : 'text-slate-800 font-medium'}>{value}</span>
    </div>
  );
}

function PayrollDetailModal({ row, onClose }: { row: PayrollRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{row.nama}</h3>
            <p className="text-xs text-slate-400">{row.jabatan} &middot; {row.departemen}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Kehadiran</p>
          <div className="divide-y divide-slate-50">
            <DetailLine label="Hari Kerja" value={`${row.hari_kerja} hari`} muted />
            <DetailLine label="Hari Hadir" value={`${row.hari_hadir} hari`} />
            <DetailLine label="Hari Telat" value={`${row.hari_telat} hari`} />
            <DetailLine label="Hari Izin (Dibayar)" value={`${row.hari_izin} hari`} />
            <DetailLine label="Hari Izin Tanpa Gaji" value={`${row.hari_izin_tanpa_gaji} hari`} />
            <DetailLine label="Hari Alpa" value={`${row.hari_alpa} hari`} />
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-1">Pendapatan</p>
          <div className="divide-y divide-slate-50">
            <DetailLine label="Gaji Pokok" value={formatRupiah(row.gaji_pokok)} />
            <DetailLine label="Tunjangan" value={formatRupiah(row.tunjangan)} />
            <DetailLine label="Gaji Kotor" value={formatRupiah(row.gaji_kotor)} />
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-1">Potongan</p>
          <div className="divide-y divide-slate-50">
            <DetailLine label="Potongan Telat" value={`- ${formatRupiah(row.potongan_telat)}`} negative />
            <DetailLine label="Potongan Izin Tanpa Gaji" value={`- ${formatRupiah(row.potongan_izin_tanpa_gaji)}`} negative />
            <DetailLine label="Potongan Alpa" value={`- ${formatRupiah(row.potongan_alpa)}`} negative />
            <DetailLine label="Total Potongan" value={`- ${formatRupiah(row.total_potongan)}`} negative />
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Gaji Bersih</span>
            <span className="text-lg font-bold text-slate-900">{formatRupiah(row.gaji_bersih)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
