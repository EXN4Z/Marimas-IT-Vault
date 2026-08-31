import { useDashboardCore } from './useDashboardData';
import { Users, Building2, Bell, CheckCircle2 } from 'lucide-react';
import {
  WelcomeHeader,
  KpiCard,
  DepartemenDistribusiCard,
  CalendarCard,
  NotifikasiCard,
} from './Shared';

export default function DashboardCabang() {
  const { loading, error, user, notifications, handleMarkAsRead, departemen } = useDashboardCore();

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Memuat dashboard cabang...
        </div>
      </div>
    );
  }

  const totalKaryawan = departemen.reduce((sum, d) => sum + d.jumlah, 0);
  const belumDibaca = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-3">
      <WelcomeHeader user={user} />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <KpiCard
          icon={Users}
          label="Total Karyawan"
          value={totalKaryawan}
          tone="emerald"
          badge="Aktif"
          progress={100}
          hint={`${departemen.length} departemen`}
        />
        <KpiCard
          icon={Building2}
          label="Departemen"
          value={departemen.length}
          tone="default"
          badge="Divisi"
          hint={`${totalKaryawan} total staf`}
        />
        <KpiCard
          icon={Bell}
          label="Notifikasi Baru"
          value={belumDibaca}
          tone={belumDibaca > 0 ? 'rose' : 'default'}
          badge={belumDibaca > 0 ? 'Baru' : 'Nol'}
          hint={`dari ${notifications.length} notifikasi`}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Status Operasi"
          value="Normal"
          tone="emerald"
          badge="Online"
          hint="Koneksi cabang tersinkron"
        />
      </div>

      {/* Main Grid: Departemen + Notifikasi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
        <DepartemenDistribusiCard departemen={departemen} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Kalender Operasional */}
      <div>
        <CalendarCard />
      </div>
    </div>
  );
}