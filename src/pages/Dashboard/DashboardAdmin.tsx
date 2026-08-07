import { QrCode, CalendarDays, Ticket } from 'lucide-react';
import { useDashboardCore, useDashboardAnalytics, buildStatCards } from './useDashboardData';
import {
  StatCardsGrid,
  KehadiranMingguanCard,
  DepartemenDistribusiCard,
  HeroPengajuanChart,
  RingkasanAsetCard,
} from './Shared';

// Dashboard untuk role admin/hr/manajer — dapet semua section, termasuk
// hero chart "Pengajuan Izin Tahun Ini" yang gak ditampilin di DashboardUser
// maupun DashboardCabang.
// CATATAN: TopKehadiran, TopPengajuan, BebanKerja, Notifikasi, Agenda,
// AsetPerJenis, AsetPerhatian sengaja dicabut dari tampilan sementara
// (bukan dihapus dari Shared.tsx/useDashboardData.ts) -- nunggu rencana baru.
export default function DashboardAdmin() {
  const {
    loading,
    error,
    statsCard,
    kehadiranMingguan,
    departemen,
  } = useDashboardCore();

  const { ringkasanAset, grafikPengajuan } = useDashboardAnalytics(true, {
    ringkasanIzin: false,
    topKehadiran: false,
    topKaryawan: false,
    asetPerJenis: false,
    asetPerhatian: false,
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <HeroPengajuanChart grafikPengajuan={grafikPengajuan} />
        <RingkasanAsetCard ringkasanAset={ringkasanAset} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <KehadiranMingguanCard kehadiranMingguan={kehadiranMingguan} />
        <DepartemenDistribusiCard departemen={departemen} />
      </div>
    </>
  );
}