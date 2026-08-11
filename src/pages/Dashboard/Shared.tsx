import type { JSX } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Boxes,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  HandCoins,
  Undo2,
  PlayCircle,
  Banknote,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type {
  NotificationItem,
  DepartemenDistribusi,
  RingkasanAset,
  AsetPerJenis,
  AsetPerhatian,
  TrenPembelianAset,
  StatusAsetDistribusi,
  AktivitasAsetTerbaru,
} from './useDashboardData';

export const THEME = {
  violet: '#6D5DFC',
  violetDark: '#4C3FE0',
  emerald: '#12B76A',
  amber: '#F59E0B',
  rose: '#F04438',
  orange: '#FF7A50',
  grid: '#F1F5F9',
  axis: '#94A3B8',
};

export const cardClass =
  'bg-white rounded-3xl p-5 sm:p-6 shadow-[0_2px_20px_rgba(15,23,42,0.06)] border border-slate-100';

export const NOTIF_VISIBLE_COUNT = 2;

export function LegendDot({ color, label, value }: { color: string; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        {label}
      </div>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

// ==== Ringkasan Status Aset — dipakai Admin ====
// Mencatat semua status barang di Inventaris: Tersedia, Dipakai, Rusak Berat,
// Dijual. Persentase badge dihitung dari proporsi aset yang "Tersedia".
export function RingkasanAsetCard({
  ringkasanAset,
  compact,
}: {
  ringkasanAset?: RingkasanAset;
  /** true kalau tampil sendirian (tanpa hero chart di sebelahnya), misal dashboard cabang */
  compact?: boolean;
}) {
  const asetTotal = ringkasanAset?.total ?? 0;
  const asetTersedia = ringkasanAset?.tersedia ?? 0;
  const asetDipakai = ringkasanAset?.dipakai ?? 0;
  const asetRusakBerat = ringkasanAset?.rusakBerat ?? 0;
  const asetDijual = ringkasanAset?.dijual ?? 0;
  const tersediaPct = asetTotal > 0 ? (asetTersedia / asetTotal) * 100 : 0;
  const dipakaiPct = asetTotal > 0 ? (asetDipakai / asetTotal) * 100 : 0;
  const rusakBeratPct = asetTotal > 0 ? (asetRusakBerat / asetTotal) * 100 : 0;
  const dijualPct = asetTotal > 0 ? (asetDijual / asetTotal) * 100 : 0;
  const tersediaRatePct = asetTotal > 0 ? Math.round((asetTersedia / asetTotal) * 100) : null;

  return (
    <div className={`${cardClass} ${compact ? 'lg:max-w-md' : ''}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#EEECFF] flex items-center justify-center text-[#6D5DFC]">
          <Boxes size={18} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Ringkasan Status Aset</h3>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-3xl font-extrabold text-slate-900">{asetTotal}</p>
        {tersediaRatePct !== null && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {tersediaRatePct}% tersedia
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1">Total aset tercatat</p>

      <div className="flex w-full h-2.5 rounded-full overflow-hidden mt-5 bg-slate-100">
        {asetTotal > 0 ? (
          <>
            <div style={{ width: `${tersediaPct}%`, background: THEME.violet }} />
            <div style={{ width: `${dipakaiPct}%`, background: THEME.amber }} />
            <div style={{ width: `${rusakBeratPct}%`, background: THEME.rose }} />
            <div style={{ width: `${dijualPct}%`, background: '#E2E8F0' }} />
          </>
        ) : (
          <div className="w-full h-full bg-slate-100" />
        )}
      </div>

      <div className="flex flex-col gap-3 mt-5">
        <LegendDot color={THEME.violet} label="Tersedia" value={asetTersedia} />
        <LegendDot color={THEME.amber} label="Dipakai" value={asetDipakai} />
        <LegendDot color={THEME.rose} label="Rusak Berat" value={asetRusakBerat} />
        <LegendDot color="#CBD5E1" label="Dijual" value={asetDijual} />
      </div>
    </div>
  );
}

// ==== Distribusi karyawan per departemen — semua role ====
export function DepartemenDistribusiCard({ departemen }: { departemen: DepartemenDistribusi[] }) {
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Distribusi Karyawan per Departemen</h3>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={departemen} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
            <YAxis dataKey="departemen" type="category" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={70} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Bar dataKey="jumlah" fill={THEME.violet} radius={[0, 8, 8, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==== Notifikasi — semua role ====
export function NotifikasiCard({
  notifications,
  onMarkAsRead,
}: {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
}) {
  const navigate = useNavigate();

  const handleClick = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    // Klik notif langsung arahkan ke halaman terkait (dikirim backend lewat data.url).
    // Kalau notif lama belum punya field url, diam aja -- gak ngapa-ngapain.
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Notifikasi</h3>
      {notifications.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada notifikasi</p>
      ) : (
        <ul className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: `${NOTIF_VISIBLE_COUNT * 68}px` }}>
          {notifications.map((n) => {
            const unread = !n.read_at;
            return (
              <li key={n.id} className="flex items-start gap-2 cursor-pointer" onClick={() => handleClick(n)}>
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${unread ? 'bg-[#6D5DFC]' : 'bg-slate-200'}`} />
                <div>
                  <p className={`text-sm ${unread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{n.data.message}</p>
                  <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString('id-ID')}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ==== Hero chart "Tren Pembelian Aset per Bulan" — khusus admin (inventaris) ====
export function HeroTrenPembelianAsetChart({ trenPembelianAset }: { trenPembelianAset: TrenPembelianAset[] }) {
  const totalTahunIni = trenPembelianAset.reduce((sum, d) => sum + d.jumlah, 0);
  const maxJumlah = trenPembelianAset.length ? Math.max(...trenPembelianAset.map((d) => d.jumlah)) : 0;
  const avgJumlah = trenPembelianAset.length ? totalTahunIni / trenPembelianAset.length : 0;
  const peakIndex = maxJumlah > 0 ? trenPembelianAset.findIndex((d) => d.jumlah === maxJumlah) : -1;

  const renderPeakLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (index !== peakIndex || maxJumlah <= 0) return null;
    const cx = x + width / 2;
    const boxW = 52;
    return (
      <g>
        <rect x={cx - boxW / 2} y={y - 32} width={boxW} height={24} rx={7} fill={THEME.orange} />
        <text x={cx} y={y - 15} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
          {value}
        </text>
      </g>
    );
  };

  return (
    <div className={`${cardClass} xl:col-span-2`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm text-slate-500 font-medium">Tren Pembelian Aset per Bulan</h3>
          <p className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-1 tracking-tight">
            {totalTahunIni}
            <span className="text-base font-semibold text-slate-400 ml-2">aset dibeli</span>
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap">
          6 bulan terakhir
        </span>
      </div>

      <div className="flex items-center gap-4 mt-4 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full" style={{ background: THEME.orange }} />
          Aset Dibeli
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2.5 h-0 border-t-2 border-dashed" style={{ borderColor: THEME.orange }} />
          Rata-rata
        </div>
      </div>

      <div className="h-72 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trenPembelianAset} margin={{ top: 36, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={THEME.grid} />
            <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.35, 4)]} />
            {maxJumlah > 0 && (
              <ReferenceLine y={avgJumlah} stroke={THEME.orange} strokeDasharray="5 5" strokeOpacity={0.5} />
            )}
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Bar dataKey="jumlah" name="Aset Dibeli" fill={THEME.orange} radius={[8, 8, 0, 0]} barSize={28} label={renderPeakLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==== Distribusi status aset (donut) — khusus admin (inventaris) ====
const STATUS_ASET_COLOR: Record<string, string> = {
  Tersedia: THEME.emerald,
  Dipakai: THEME.violet,
  'Menunggu Perbaikan': THEME.amber,
  Diperbaiki: '#38BDF8',
  'Rusak Berat': THEME.rose,
  Dijual: THEME.axis,
};

export function StatusAsetDonutCard({ statusAsetDistribusi }: { statusAsetDistribusi: StatusAsetDistribusi[] }) {
  const total = statusAsetDistribusi.reduce((sum, d) => sum + d.jumlah, 0);

  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Distribusi Status Aset</h3>
      {total === 0 ? (
        <p className="text-sm text-slate-400">Belum ada data aset</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="h-56 w-full sm:w-1/2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusAsetDistribusi}
                  dataKey="jumlah"
                  nameKey="status"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {statusAsetDistribusi.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_ASET_COLOR[entry.status] ?? THEME.axis} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-slate-900">{total}</span>
              <span className="text-xs text-slate-400">total aset</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 w-full sm:w-1/2">
            {statusAsetDistribusi.map((d) => (
              <LegendDot
                key={d.status}
                color={STATUS_ASET_COLOR[d.status] ?? THEME.axis}
                label={d.status}
                value={d.jumlah}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AsetPerJenisCard({ asetPerJenis }: { asetPerJenis: AsetPerJenis[] }) {
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Distribusi Aset per Jenis</h3>
      {asetPerJenis.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada data aset</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={asetPerJenis} margin={{ top: 16, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={THEME.grid} />
              <XAxis dataKey="jenis" tick={false} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="jumlah" fill={THEME.orange} radius={[8, 8, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ==== Aset butuh perhatian — khusus admin (inventaris) ====
// Donut chart (bukan cuma daftar) biar area kartu ini gak keliatan kosong
// sebelah kanan seperti sebelumnya -- pola visualnya disamain dengan
// StatusAsetDonutCard di atas. Daftar angka tetap ditampilkan di bawah
// donut, karena tiap baris bisa jadi actionable checklist buat admin.
const ASET_PERHATIAN_COLOR: Record<string, string> = {
  'Rusak Berat': THEME.rose,
  'Dalam Penanganan': THEME.amber,
  'Garansi < 30 Hari': THEME.orange,
};

export function AsetPerhatianCard({ asetPerhatian }: { asetPerhatian?: AsetPerhatian }) {
  const rusak = asetPerhatian?.rusak ?? 0;
  const dalamPenanganan = asetPerhatian?.dalamPenanganan ?? 0;
  const garansiSegeraHabis = asetPerhatian?.garansiSegeraHabis ?? 0;
  const totalPerhatian = rusak + dalamPenanganan + garansiSegeraHabis;

  const rows = [
    { label: 'Rusak Berat', value: rusak, icon: AlertTriangle, color: 'text-rose-500 bg-rose-50' },
    { label: 'Dalam Penanganan', value: dalamPenanganan, icon: Wrench, color: 'text-amber-500 bg-amber-50' },
    { label: 'Garansi < 30 Hari', value: garansiSegeraHabis, icon: ShieldAlert, color: 'text-orange-500 bg-orange-50' },
  ];

  // Data buat donut -- cuma masukin baris yang jumlahnya > 0, sama kayak
  // pola StatusAsetDistribusi (biar slice kosong gak nongol di chart).
  const donutData = rows.filter((r) => r.value > 0).map((r) => ({ label: r.label, jumlah: r.value }));

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Aset Butuh Perhatian</h3>
        {totalPerhatian > 0 && (
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
            {totalPerhatian} aset
          </span>
        )}
      </div>

      {totalPerhatian === 0 ? (
        <p className="text-sm text-slate-400">Semua aset dalam kondisi aman.</p>
      ) : (
        <>
          <div className="h-48 relative mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="jumlah"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.label} fill={ASET_PERHATIAN_COLOR[entry.label] ?? THEME.axis} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-slate-900">{totalPerhatian}</span>
              <span className="text-xs text-slate-400">butuh perhatian</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${r.color}`}>
                    <r.icon size={16} />
                  </div>
                  <span className="text-sm text-slate-700 font-medium">{r.label}</span>
                </div>
                <span className="text-lg font-bold text-slate-900">{r.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Waktu relatif singkat, sama persis logikanya dengan formatWaktu() di
// pages/Inventaris.tsx (tab Riwayat) -- disamain biar "3 jam lalu" di
// widget dashboard dan di tab Riwayat konsisten, gak beda kalkulasi.
function formatWaktuSingkat(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

const AKTIVITAS_ASET_STYLE: Record<
  AktivitasAsetTerbaru['type'],
  { bg: string; icon: JSX.Element; label: string }
> = {
  pinjam: { bg: 'bg-amber-50 text-amber-600', icon: <HandCoins size={15} />, label: 'menerima' },
  kembali: { bg: 'bg-emerald-50 text-emerald-600', icon: <Undo2 size={15} />, label: 'mengembalikan' },
  lapor_rusak: { bg: 'bg-red-50 text-red-600', icon: <AlertTriangle size={15} />, label: 'melaporkan kerusakan' },
  mulai_perbaikan: { bg: 'bg-orange-50 text-orange-600', icon: <PlayCircle size={15} />, label: 'mulai memperbaiki' },
  selesai_perbaikan: { bg: 'bg-sky-50 text-sky-600', icon: <Wrench size={15} />, label: 'selesai memperbaiki' },
  dijual: { bg: 'bg-purple-50 text-purple-600', icon: <Banknote size={15} />, label: 'menjual' },
};

// ==== Aktivitas aset terbaru — khusus admin (inventaris) ====
// Ringkasan 5 event teraktual dari feed yang sama dengan tab "Riwayat Aset"
// di halaman Inventaris. Ditaruh di dashboard (halaman pertama yang dibuka
// user) supaya histori aset kelihatan tanpa harus sadar dulu ada tab
// Riwayat yang harus diklik manual. Klik "Lihat semua" -> lempar ke tab
// Riwayat di Inventaris buat detail lengkap + filter/search/pagination.
export function AktivitasAsetCard({ aktivitasAsetTerbaru }: { aktivitasAsetTerbaru: AktivitasAsetTerbaru[] }) {
  const navigate = useNavigate();

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Aktivitas Aset Terbaru</h3>
        <button
          onClick={() => navigate('/inventaris?tab=aset')}
          className="flex items-center gap-1 text-xs font-semibold text-[#6D5DFC] hover:text-[#4C3FE0] whitespace-nowrap"
        >
          Lihat semua <ArrowRight size={13} />
        </button>
      </div>

      {aktivitasAsetTerbaru.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada aktivitas aset.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {aktivitasAsetTerbaru.map((ev, idx) => {
            const s = AKTIVITAS_ASET_STYLE[ev.type];
            const kode = ev.aset?.kode_aset || '-';
            const pelaku =
              ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
            return (
              <li key={`${ev.type}-${idx}`} className="flex items-start gap-2.5">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">
                    {pelaku && <span className="font-medium text-slate-800">{pelaku} </span>}
                    {s.label} <span className="font-medium text-slate-800">{kode}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatWaktuSingkat(ev.waktu)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}