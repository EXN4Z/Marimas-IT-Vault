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
  Bell,
  Users,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User as UserType } from '../../types/user';
import type {
  NotificationItem,
  DepartemenDistribusi,
  RingkasanAset,
  AsetPerMerek,
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
  sky: '#38BDF8',
  purple: '#A855F7',
  grid: '#F1F5F9',
  axis: '#94A3B8',
};

// Palet warna dipakai bar chart per-item (departemen, dst) biar tiap
// batang punya warna beda -- kesannya lebih hidup dibanding satu warna flat.
const MULTI_COLORS = [THEME.violet, THEME.orange, THEME.emerald, THEME.amber, THEME.sky, THEME.rose, THEME.purple];

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

// Header ikon kecil dipakai berulang di banyak card -- dibikin helper biar
// konsisten (ukuran, radius, warna) tanpa copy-paste className panjang.
export function CardIcon({ icon: Icon, tone = 'violet' }: { icon: LucideIcon; tone?: 'violet' | 'orange' | 'emerald' }) {
  const toneClass =
    tone === 'orange'
      ? 'bg-orange-50 text-[#FF7A50]'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-[#EEECFF] text-[#6D5DFC]';
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${toneClass}`}>
      <Icon size={18} />
    </div>
  );
}

// ==== Welcome header — semua role ====
// Sapaan personal + tanggal hari ini + badge role/departemen. Semua field
// (name, role, departemen) sudah ada di object user (AuthContext), jadi
// gak nambah fetch baru sama sekali.
const GREETING_ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  hr: 'HR',
  manajer: 'Manajer',
  karyawan: 'Karyawan',
  cabang: 'Cabang',
};

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function WelcomeHeader({ user }: { user?: UserType | null }) {
  if (!user) return null;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user.name?.split(' ')[0] ?? user.name;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {greetingWord()}, {firstName}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{today}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#6D5DFC] bg-[#EEECFF] px-3 py-1.5 rounded-full whitespace-nowrap">
          {GREETING_ROLE_LABEL[user.role] ?? user.role}
        </span>
        {user.departemen?.nama && (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap">
            {user.departemen.nama}
          </span>
        )}
      </div>
    </div>
  );
}

// ==== KPI mini card — dipakai buat strip ringkasan angka di atas dashboard ====
// Warna solid buat lingkaran ikon (bukan tint pastel) -- biar kartu kerasa
// "penuh" kayak referensi Argon Dashboard, gak cuma kotak putih kosong
// dengan ikon kecil mengambang di tengah.
const KPI_ACCENT = {
  default: { ring: 'bg-[#6D5DFC]', border: 'border-slate-100' },
  amber: { ring: 'bg-[#F59E0B]', border: 'border-amber-100' },
  rose: { ring: 'bg-[#F04438]', border: 'border-rose-100' },
  emerald: { ring: 'bg-[#12B76A]', border: 'border-emerald-100' },
} as const;

export function KpiCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
  hint,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone?: keyof typeof KPI_ACCENT;
  /** Info tambahan di bawah -- diturunkan dari data yang sama, bukan angka baru,
      dipakai buat ngisi ruang bawah kartu (mis. "12% dari total aset"). */
  hint?: string;
  className?: string;
}) {
  const t = KPI_ACCENT[tone];
  return (
    <div
      className={`bg-white ${t.border} rounded-2xl p-4 sm:p-5 border shadow-[0_2px_16px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all flex flex-col justify-between min-h-[128px] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1.5">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-full ${t.ring} text-white flex items-center justify-center flex-shrink-0 shadow-md`}>
          <Icon size={19} />
        </div>
      </div>
      {hint && <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-50">{hint}</p>}
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
        <CardIcon icon={Boxes} />
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

// ==== Notifikasi — semua role ====
export function NotifikasiCard({
  notifications,
  onMarkAsRead,
}: {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
}) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleClick = (n: NotificationItem) => {
    if (!n.read_at) onMarkAsRead(n.id);
    // Klik notif langsung arahkan ke halaman terkait (dikirim backend lewat data.url).
    // Kalau notif lama belum punya field url, diam aja -- gak ngapa-ngapain.
    if (n.data?.url) navigate(n.data.url);
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <CardIcon icon={Bell} />
          <h3 className="text-base font-semibold text-slate-900">Notifikasi</h3>
        </div>
        {unreadCount > 0 && (
          <span className="text-xs font-semibold text-white bg-[#6D5DFC] px-2.5 py-1 rounded-full">{unreadCount} baru</span>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada notifikasi</p>
      ) : (
        <ul className="flex flex-col gap-1.5 overflow-y-auto pr-1" style={{ maxHeight: `${NOTIF_VISIBLE_COUNT * 76}px` }}>
          {notifications.map((n) => {
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ${
                  unread ? 'bg-[#F7F6FF] hover:bg-[#EEECFF]' : 'hover:bg-slate-50'
                }`}
                onClick={() => handleClick(n)}
              >
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${unread ? 'bg-[#6D5DFC]' : 'bg-slate-200'}`} />
                <div className="min-w-0">
                  <p className={`text-sm ${unread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{n.data.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('id-ID')}</p>
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

  // Delta bulan terakhir vs bulan sebelumnya -- murni turunan dari data yang
  // sudah ada (trenPembelianAset), bukan fetch baru. Dipakai buat badge tren
  // kecil di header biar kartu ini kerasa lebih "hidup".
  const lastIdx = trenPembelianAset.length - 1;
  const lastVal = lastIdx >= 0 ? trenPembelianAset[lastIdx].jumlah : 0;
  const prevVal = lastIdx >= 1 ? trenPembelianAset[lastIdx - 1].jumlah : null;
  const delta = prevVal !== null ? lastVal - prevVal : null;

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
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm text-slate-500 font-medium">Tren Pembelian Aset per Bulan</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              {totalTahunIni}
              <span className="text-base font-semibold text-slate-400 ml-2">aset dibeli</span>
            </p>
            {delta !== null && delta !== 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  delta > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                }`}
              >
                {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta > 0 ? `+${delta}` : delta} bulan ini
              </span>
            )}
          </div>
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

export function AsetPerMerekCard({ asetPerMerek }: { asetPerMerek: AsetPerMerek[] }) {
  const top = asetPerMerek.length ? asetPerMerek[0] : null;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2.5">
          <CardIcon icon={Boxes} tone="orange" />
          <h3 className="text-base font-semibold text-slate-900">Distribusi Aset per Merek</h3>
        </div>
        {top && (
          <span className="hidden sm:inline-flex text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
            Terbanyak: {top.merek}
          </span>
        )}
      </div>
      {asetPerMerek.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada data aset</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={asetPerMerek} margin={{ top: 16, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={THEME.grid} />
              <XAxis dataKey="merek" tick={false} axisLine={false} tickLine={false} />
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
        <div className="flex items-center gap-2.5">
          <CardIcon icon={ShieldAlert} />
          <h3 className="text-base font-semibold text-slate-900">Aset Butuh Perhatian</h3>
        </div>
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
        <div className="flex items-center gap-2.5">
          <CardIcon icon={HandCoins} tone="emerald" />
          <h3 className="text-base font-semibold text-slate-900">Aktivitas Aset Terbaru</h3>
        </div>
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
        <ul className="flex flex-col gap-1">
          {aktivitasAsetTerbaru.map((ev, idx) => {
            const s = AKTIVITAS_ASET_STYLE[ev.type];
            const kode = ev.aset?.kode_aset || '-';
            const pelaku =
              ev.nama ?? (ev.type === 'mulai_perbaikan' || ev.type === 'selesai_perbaikan' ? 'Admin' : null);
            const isLast = idx === aktivitasAsetTerbaru.length - 1;
            return (
              <li key={`${ev.type}-${idx}`} className="relative flex items-start gap-2.5 py-1.5">
                {!isLast && <span className="absolute left-[13px] top-9 bottom-[-6px] w-px bg-slate-100" />}
                <span className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
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