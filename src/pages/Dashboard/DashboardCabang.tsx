import { useDashboardCore } from './useDashboardData';
import { Users, Building2, Bell } from 'lucide-react';
import { WelcomeHeader, KpiCard, DepartemenDistribusiCard, NotifikasiCard } from './Shared';

// Dashboard untuk role cabang — TIDAK dapet section Inventaris (itu murni
// buat admin/hr/manajer).
export default function DashboardCabang() {
  const { loading, error, user, notifications, handleMarkAsRead, departemen } = useDashboardCore();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  const totalKaryawan = departemen.reduce((sum, d) => sum + d.jumlah, 0);
  const belumDibaca = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <WelcomeHeader user={user} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={Users} label="Total Karyawan" value={totalKaryawan} tone="emerald" />
        <KpiCard icon={Building2} label="Jumlah Departemen" value={departemen.length} tone="default" />
        <KpiCard
          icon={Bell}
          label="Notifikasi Baru"
          value={belumDibaca}
          tone={belumDibaca > 0 ? 'rose' : 'default'}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepartemenDistribusiCard departemen={departemen} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>
    </>
  );
}
