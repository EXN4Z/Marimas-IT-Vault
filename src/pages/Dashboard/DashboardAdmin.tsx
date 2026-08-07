import { QrCode, CalendarDays, Ticket } from 'lucide-react';
import { useDashboardCore, useDashboardAnalytics, buildStatCards } from './useDashboardData';
import {
  StatCardsGrid,
  RingkasanAsetCard,
  HeroTrenPembelianAsetChart,
  AsetPerhatianCard,
  AsetPerJenisCard,
} from './Shared';

// Dashboard untuk role admin/hr/manajer — dapet semua section, termasuk
// hero chart "Tren Pembelian Aset per Bulan" yang gak ditampilin di
// DashboardUser maupun DashboardCabang.
// CATATAN: TopKehadiran, TopPengajuan, BebanKerja, Notifikasi, Agenda
// sengaja dicabut dari tampilan sementara (bukan dihapus dari
// Shared.tsx/useDashboardData.ts) -- nunggu rencana baru.
// Hero pengajuan izin, kehadiran mingguan, & distribusi departemen sudah
// diganti data inventaris (tren pembelian aset, aset butuh perhatian,
// jenis aset) -- section ini murni inventaris jadi gak relevan lagi
// buat admin. Distribusi Status Aset (donut) dicabut karena tumpang
// tindih sama RingkasanAsetCard -- diganti Aset Butuh Perhatian yang
// lebih actionable (rusak berat / dalam penanganan / garansi mau habis).
export default function DashboardAdmin() {
  const { loading, error, statsCard } = useDashboardCore();

  const { ringkasanAset, trenPembelianAset, asetPerhatian, asetPerJenis } = useDashboardAnalytics(true, {
    ringkasanIzin: false,
    grafikPengajuan: false,
    topKehadiran: false,
    topKaryawan: false,
    statusAsetDistribusi: false,
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
        <HeroTrenPembelianAsetChart trenPembelianAset={trenPembelianAset} />
        <RingkasanAsetCard ringkasanAset={ringkasanAset} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <AsetPerhatianCard asetPerhatian={asetPerhatian} />
        <AsetPerJenisCard asetPerJenis={asetPerJenis} />
      </div>
    </>
  );
}