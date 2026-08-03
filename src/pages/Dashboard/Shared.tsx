import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { ClipboardList, Clock, TrendingUp, Boxes } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type {
  AccentColor,
  StatCard,
  NotificationItem,
  KehadiranHarian,
  DepartemenDistribusi,
  BebanDepartemen,
  RingkasanIzin,
  RingkasanAset,
  TrenPengajuan,
  TopKaryawan,
} from './useDashboardData';
import type { AgendaItem } from '../../api/agenda';

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

export const ACCENT_BADGE: Record<AccentColor, string> = {
  violet: 'bg-[#6D5DFC]',
  orange: 'bg-[#FF7A50]',
  amber: 'bg-[#F59E0B]',
  emerald: 'bg-[#12B76A]',
};

export const cardClass =
  'bg-white rounded-3xl p-5 sm:p-6 shadow-[0_2px_20px_rgba(15,23,42,0.06)] border border-slate-100';
export const statCardClass =
  'bg-white rounded-3xl p-4 sm:p-4 shadow-[0_2px_20px_rgba(15,23,42,0.06)] border border-slate-100';

export const NOTIF_VISIBLE_COUNT = 2;

export function bebanColor(percent: number) {
  if (percent >= 70) return 'bg-rose-500';
  if (percent >= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function formatAgendaDate(dateString: string): string {
  const date = new Date(dateString.replace(' ', 'T'));
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleString('id-ID', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StatBadge({ accent, children }: { accent: AccentColor; children: React.ReactNode }) {
  return (
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white ${ACCENT_BADGE[accent]}`}>
      {children}
    </div>
  );
}

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

// ==== KPI stat cards (Kehadiran Bulan Ini / Izin Aktif / Ticket Aktif) ====
export function StatCardsGrid({ statCards }: { statCards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {statCards.length === 0
        ? Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${statCardClass} animate-pulse h-24`} />)
        : statCards.map((stat, index) => {
            const Icon = stat.icon;
            const isLastOdd = statCards.length % 2 !== 0 && index === statCards.length - 1;
            return (
              <div
                key={stat.label}
                className={`${statCardClass} ${isLastOdd ? 'col-span-2 lg:col-span-1' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                  <StatBadge accent={stat.accent}>
                    <Icon size={18} />
                  </StatBadge>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {stat.value}
                  {stat.unit && <span className="text-sm font-semibold text-slate-400 ml-1.5">{stat.unit}</span>}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
                  <TrendingUp size={12} /> {stat.trend}
                </div>
              </div>
            );
          })}
    </div>
  );
}

// ==== Hero chart "Pengajuan Izin Tahun Ini" — khusus admin ====
export function HeroPengajuanChart({ grafikPengajuan }: { grafikPengajuan: TrenPengajuan[] }) {
  const totalPengajuanTahunIni = grafikPengajuan.reduce((sum, d) => sum + d.pengajuan, 0);
  const maxPengajuan = grafikPengajuan.length ? Math.max(...grafikPengajuan.map((d) => d.pengajuan)) : 0;
  const avgPengajuan = grafikPengajuan.length ? totalPengajuanTahunIni / grafikPengajuan.length : 0;
  const peakIndex = maxPengajuan > 0 ? grafikPengajuan.findIndex((d) => d.pengajuan === maxPengajuan) : -1;

  const renderPeakLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (index !== peakIndex || maxPengajuan <= 0) return null;
    const cx = x + width / 2;
    const boxW = 52;
    return (
      <g>
        <rect x={cx - boxW / 2} y={y - 32} width={boxW} height={24} rx={7} fill={THEME.violet} />
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
          <h3 className="text-sm text-slate-500 font-medium">Pengajuan Izin Tahun Ini</h3>
          <p className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-1 tracking-tight">
            {totalPengajuanTahunIni}
            <span className="text-base font-semibold text-slate-400 ml-2">pengajuan</span>
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap">
          {new Date().getFullYear()}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-4 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full" style={{ background: THEME.violet }} />
          Pengajuan Bulanan
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2.5 h-0 border-t-2 border-dashed" style={{ borderColor: THEME.violet }} />
          Rata-rata
        </div>
      </div>

      <div className="h-72 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={grafikPengajuan} margin={{ top: 36, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <pattern id="barHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#EEF2F7" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#D8DEE9" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={THEME.grid} />
            <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax * 1.35, 4)]} />
            {maxPengajuan > 0 && (
              <ReferenceLine y={avgPengajuan} stroke={THEME.violet} strokeDasharray="5 5" strokeOpacity={0.5} />
            )}
            <Tooltip
              cursor={{ fill: 'rgba(109,93,252,0.06)' }}
              contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
            />
            <Bar dataKey="pengajuan" name="Pengajuan" radius={[8, 8, 0, 0]} barSize={26} label={renderPeakLabel}>
              {grafikPengajuan.map((_entry, idx) => (
                <Cell key={idx} fill={idx === peakIndex ? THEME.violet : 'url(#barHatch)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==== Ringkasan Status Izin — dipakai Cabang ====
export function RingkasanIzinCard({
  ringkasanIzin,
  compact,
}: {
  ringkasanIzin?: RingkasanIzin;
  /** true kalau tampil sendirian (tanpa hero chart di sebelahnya), misal dashboard cabang */
  compact?: boolean;
}) {
  const izinTotal = ringkasanIzin?.total ?? 0;
  const izinDisetujui = ringkasanIzin?.disetujui ?? 0;
  const izinPending = ringkasanIzin?.pending ?? 0;
  const izinDitolak = ringkasanIzin?.ditolak ?? 0;
  const disetujuiPct = izinTotal > 0 ? (izinDisetujui / izinTotal) * 100 : 0;
  const pendingPct = izinTotal > 0 ? (izinPending / izinTotal) * 100 : 0;
  const ditolakPct = izinTotal > 0 ? (izinDitolak / izinTotal) * 100 : 0;
  const approvalRatePct = izinTotal > 0 ? Math.round((izinDisetujui / izinTotal) * 100) : null;

  return (
    <div className={`${cardClass} ${compact ? 'lg:max-w-md' : ''}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#EEECFF] flex items-center justify-center text-[#6D5DFC]">
          <ClipboardList size={18} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Ringkasan Status Izin</h3>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-3xl font-extrabold text-slate-900">{izinTotal}</p>
        {approvalRatePct !== null && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {approvalRatePct}% disetujui
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1">Total pengajuan izin</p>

      <div className="flex w-full h-2.5 rounded-full overflow-hidden mt-5 bg-slate-100">
        {izinTotal > 0 ? (
          <>
            <div style={{ width: `${disetujuiPct}%`, background: THEME.violet }} />
            <div style={{ width: `${pendingPct}%`, background: THEME.amber }} />
            <div style={{ width: `${ditolakPct}%`, background: '#E2E8F0' }} />
          </>
        ) : (
          <div className="w-full h-full bg-slate-100" />
        )}
      </div>

      <div className="flex flex-col gap-3 mt-5">
        <LegendDot color={THEME.violet} label="Disetujui" value={izinDisetujui} />
        <LegendDot color={THEME.amber} label="Menunggu" value={izinPending} />
        <LegendDot color="#CBD5E1" label="Ditolak" value={izinDitolak} />
      </div>
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

// ==== Tren kehadiran mingguan — semua role ====
export function KehadiranMingguanCard({ kehadiranMingguan }: { kehadiranMingguan: KehadiranHarian[] }) {
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">Tren Kehadiran Mingguan</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">7 hari terakhir</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={kehadiranMingguan} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={THEME.violet} stopOpacity={0.35} />
                <stop offset="95%" stopColor={THEME.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Area type="monotone" dataKey="hadir" stroke={THEME.violet} strokeWidth={2.5} fill="url(#colorHadir)" />
          </AreaChart>
        </ResponsiveContainer>
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

// ==== Top kehadiran & top pengajuan izin — Admin & Cabang ====
export function TopKehadiranCard({ topKehadiran }: { topKehadiran: TopKaryawan[] }) {
  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900">Karyawan Kehadiran Terbanyak</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-3">Top 5 karyawan berdasarkan jumlah absensi hadir.</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topKehadiran} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={THEME.grid} />
            <XAxis type="number" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="nama" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} width={110} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Bar dataKey="jumlah" name="Hadir" fill={THEME.emerald} radius={[0, 8, 8, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TopPengajuanCard({ topKaryawan }: { topKaryawan: TopKaryawan[] }) {
  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900">Karyawan Pengajuan Izin Terbanyak</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-3">Top 5 karyawan berdasarkan jumlah pengajuan.</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topKaryawan} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={THEME.grid} />
            <XAxis type="number" tick={{ fontSize: 12, fill: THEME.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="nama" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} width={110} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Bar dataKey="jumlah" name="Pengajuan" fill={THEME.violet} radius={[0, 8, 8, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==== Beban kerja per departemen — semua role ====
export function BebanKerjaCard({ bebanKerja }: { bebanKerja: BebanDepartemen[] }) {
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Beban Kerja per Departemen</h3>
      <div className="flex flex-col gap-4">
        {bebanKerja.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada data departemen</p>
        ) : (
          bebanKerja.map((d) => (
            <div key={d.departemen}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium">{d.departemen}</span>
                <span className="text-slate-400">
                  {d.hadir}/{d.total} hadir
                  {d.tidak_hadir > 0 && <span className="text-rose-500 font-medium"> · +{d.beban_percent}%</span>}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${bebanColor(d.beban_percent)}`} style={{ width: `${Math.min(d.beban_percent, 100)}%` }} />
              </div>
            </div>
          ))
        )}
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

// ==== Agenda mendatang — semua role ====
export function AgendaCard({ agenda, agendaLoading }: { agenda: AgendaItem[]; agendaLoading: boolean }) {
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">Agenda Mendatang</h3>
      {agendaLoading ? (
        <p className="text-sm text-slate-400">Memuat agenda...</p>
      ) : !agenda || agenda.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada agenda mendatang.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {agenda.map((ev) => (
            <li key={ev.id} className="flex items-start gap-2">
              <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-700">{ev.title}</p>
                <p className="text-xs text-slate-400">{formatAgendaDate(ev.start_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}