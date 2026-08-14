import { useDashboardCore } from './useDashboardData';
import { Bell, Users } from 'lucide-react';
import { WelcomeHeader, KpiCard, DepartemenDistribusiCard, NotifikasiCard } from './Shared';

// Dashboard untuk role karyawan/user biasa — cuma section umum,
// tanpa analytics (inventaris) yang khusus buat admin/hr/manajer/cabang.
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  const totalNotifikasi = notifications.length;
  const belumDibaca = notifications.filter((n) => !n.read_at).length;
  const totalKaryawan = departemen.reduce((sum, d) => sum + d.jumlah, 0);

  return (
    <>
      <WelcomeHeader user={user} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Ringkasan angka singkat -- semuanya turunan dari data yang sudah
          di-fetch useDashboardCore (notifikasi & distribusi departemen),
          gak ada fetch tambahan. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={Bell} label="Total Notifikasi" value={totalNotifikasi} tone="default" />
        <KpiCard
          icon={Bell}
          label="Belum Dibaca"
          value={belumDibaca}
          tone={belumDibaca > 0 ? 'rose' : 'default'}
        />
        <KpiCard icon={Users} label="Total Karyawan" value={totalKaryawan} tone="emerald" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepartemenDistribusiCard departemen={departemen} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>
    </>
  );
}
