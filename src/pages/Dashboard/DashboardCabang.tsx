import { QrCode, CalendarDays, Ticket } from 'lucide-react';
import { useDashboardCore, useDashboardAnalytics, buildStatCards } from './useDashboardData';
import {
  StatCardsGrid,
  KehadiranMingguanCard,
  DepartemenDistribusiCard,
  HeroPengajuanChart,
  RingkasanIzinCard,
} from './Shared';

// Dashboard untuk role cabang — dapet analytics yang di-scope ke karyawan
// cabang tsb (termasuk "Pengajuan Izin Tahun Ini"), TAPI TIDAK dapet
// section Inventaris (itu murni buat admin/hr/manajer).
// CATATAN: TopKehadiran, TopPengajuan, BebanKerja, Notifikasi, Agenda
// sengaja dicabut dari tampilan sementara (bukan dihapus dari
// Shared.tsx/useDashboardData.ts) -- nunggu rencana baru.
export default function DashboardCabang() {
  const {
    loading,
    error,
    statsCard,
    kehadiranMingguan,
    departemen,
  } = useDashboardCore();

  const { ringkasanIzin, grafikPengajuan } = useDashboardAnalytics(true, {
    ringkasanIzin: true,
    ringkasanAset: false,
    topKehadiran: false,
    topKaryawan: false,
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <HeroPengajuanChart grafikPengajuan={grafikPengajuan} />
        <RingkasanIzinCard ringkasanIzin={ringkasanIzin} compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <KehadiranMingguanCard kehadiranMingguan={kehadiranMingguan} />
        <DepartemenDistribusiCard departemen={departemen} />
      </div>
    </>
  );
}