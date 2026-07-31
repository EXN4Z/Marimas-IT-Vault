import { QrCode, CalendarDays, Ticket } from 'lucide-react';
import { useDashboardCore, useDashboardAnalytics, buildStatCards } from './useDashboardData';
import {
  StatCardsGrid,
  KehadiranMingguanCard,
  DepartemenDistribusiCard,
  BebanKerjaCard,
  NotifikasiCard,
  AgendaCard,
  HeroPengajuanChart,
  RingkasanIzinCard,
  TopKehadiranCard,
  TopPengajuanCard,
} from './Shared';

// Dashboard untuk role cabang — dapet analytics yang di-scope ke karyawan
// cabang tsb (termasuk sekarang "Pengajuan Izin Tahun Ini"), TAPI TIDAK
// dapet section Inventaris (itu murni buat admin/hr/manajer).
export default function DashboardCabang() {
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

  // UBAH: grafikPengajuan sekarang ikut dinyalain -- endpoint-nya sudah
  // di-scope ke cabang di backend (lihat DashboardController::grafikPengajuan).
  const { ringkasanIzin, grafikPengajuan, topKehadiran, topKaryawan } = useDashboardAnalytics(true, {
    ringkasanIzin: true,
    topKehadiran: true,
    topKaryawan: true,
    grafikPengajuan: true,
  });

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

      {/* BARU: hero chart "Pengajuan Izin Tahun Ini", sama pola kayak
          Dashboard Admin, tapi datanya sudah di-scope ke cabang ini saja. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <HeroPengajuanChart grafikPengajuan={grafikPengajuan} />
        <RingkasanIzinCard ringkasanIzin={ringkasanIzin} compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <KehadiranMingguanCard kehadiranMingguan={kehadiranMingguan} />
        <DepartemenDistribusiCard departemen={departemen} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TopKehadiranCard topKehadiran={topKehadiran} />
        <TopPengajuanCard topKaryawan={topKaryawan} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <BebanKerjaCard bebanKerja={bebanKerja} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
        <AgendaCard agenda={agenda} agendaLoading={agendaLoading} />
      </div>
    </>
  );
}