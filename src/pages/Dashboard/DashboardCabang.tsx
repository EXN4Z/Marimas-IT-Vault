import { QrCode, CalendarDays, Ticket } from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import { useDashboardCore, useDashboardAnalytics, buildStatCards } from './useDashboardData';
import {
  StatCardsGrid,
  KehadiranMingguanCard,
  DepartemenDistribusiCard,
  BebanKerjaCard,
  NotifikasiCard,
  AgendaCard,
  RingkasanIzinCard,
  TopKehadiranCard,
  TopPengajuanCard,
} from './Shared';

// Dashboard untuk role cabang — dapet sebagian analytics (ringkasan izin,
// top kehadiran, top pengajuan) yang di-scope ke karyawan cabang tsb, TAPI
// TIDAK dapet hero chart "Pengajuan Izin Tahun Ini"
// (itu murni buat admin/hr/manajer).
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

  // Cuma nyalain ringkasan izin, top kehadiran, top karyawan — grafik
  // pengajuan tahunan gak dipakai di dashboard cabang.
  const { ringkasanIzin, topKehadiran, topKaryawan } = useDashboardAnalytics(true, {
    ringkasanIzin: true,
    topKehadiran: true,
    topKaryawan: true,
    grafikPengajuan: false,
  });

  const statCards = buildStatCards(statsCard, {
    kehadiran: QrCode,
    izinAktif: CalendarDays,
    ticket: Ticket,
  });

  // ⚠️ "Kehadiran Bulan Ini" masih 0 buat akun cabang.
  // Nilainya datang dari statsCard.kehadiran.value, yaitu field `kehadiran`
  // dari response GET /dashboard/stats-card. Endpoint ini SAMA persis yang
  // dipakai admin — jadi query di backend harus dibikin scoped: kalau
  // auth()->user()->role === 'cabang', hitung total kehadiran bulan berjalan
  // dari SEMUA karyawan yang cabang_id-nya sama dengan cabang_id user login,
  // bukan cuma kehadiran user itu sendiri. Ini gak bisa diperbaiki dari sisi
  // frontend karena frontend cuma nampilin apa yang endpoint balikin — kirim
  // controller/query yang menangani /dashboard/stats-card biar bisa dibetulin
  // filter cabang_id-nya.

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <AppLayout title="Dashboard">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <StatCardsGrid statCards={statCards} />

      <div className="grid grid-cols-1 gap-6 mt-6">
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
    </AppLayout>
  );
}