import { useDashboardCore } from './useDashboardData';
import { Bell, Users, Building2, CheckCircle2 } from 'lucide-react';
import {
  WelcomeHeader,
  QuickActionBar,
  KpiCard,
  DepartemenDistribusiCard,
  CalendarCard,
  NotifikasiCard,
} from './Shared';

export default function DashboardUser() {
  const {
    loading,
    error,
    user,
    notifications,
    handleMarkAsRead,
    departemen,
  } = useDashboardCore();

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Memuat dashboard...
        </div>
      </div>
    );
  }

  const totalNotifikasi = notifications.length;
  const belumDibaca = notifications.filter((n) => !n.read_at).length;
  const totalKaryawan = departemen.reduce((sum, d) => sum + d.jumlah, 0);

  return (
    <div className="space-y-3">
      <WelcomeHeader user={user} />
      <QuickActionBar role={user?.role} />

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
          hint={`${totalKaryawan} staf terhubung`}
        />
        <KpiCard
          icon={Bell}
          label="Notifikasi Baru"
          value={belumDibaca}
          tone={belumDibaca > 0 ? 'rose' : 'default'}
          badge={belumDibaca > 0 ? 'Baru' : 'Nol'}
          hint={`dari ${totalNotifikasi} notifikasi`}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Status Akun"
          value="Aktif"
          tone="emerald"
          badge="Verified"
          hint="Akses inventaris dibuka"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
        <DepartemenDistribusiCard departemen={departemen} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Calendar */}
      <div>
        <CalendarCard />
      </div>
    </div>
  );
}