import { QrCode, CalendarDays, Ticket } from 'lucide-react';
import { useDashboardCore, buildStatCards } from './useDashboardData';
import {
  StatCardsGrid,
  KehadiranMingguanCard,
  DepartemenDistribusiCard,
  BebanKerjaCard,
  NotifikasiCard,
  AgendaCard,
} from './Shared';

// Dashboard untuk role karyawan/user biasa — cuma section umum,
// tanpa analytics (ringkasan izin, top kehadiran/pengajuan, inventaris)
// yang khusus buat admin/hr/manajer/cabang.
export default function DashboardUser() {
  const {
    loading,
    error,
    statsCard,
    notifications,
    handleMarkAsRead,
    kehadiranMingguan,
    bebanKerja,
    agenda,
    agendaLoading,
    departemen,
  } = useDashboardCore();

  const statCards = buildStatCards(statsCard, {
    kehadiran: QrCode,
    izinAktif: CalendarDays,
    ticket: Ticket,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <StatCardsGrid statCards={statCards} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <KehadiranMingguanCard kehadiranMingguan={kehadiranMingguan} />
        <DepartemenDistribusiCard departemen={departemen} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <BebanKerjaCard bebanKerja={bebanKerja} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
        <AgendaCard agenda={agenda} agendaLoading={agendaLoading} />
      </div>
    </>
  );
}