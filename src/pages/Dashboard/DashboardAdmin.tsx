import { useDashboardCore, useDashboardAnalytics } from './useDashboardData';
import {
  RingkasanAsetCard,
  HeroTrenPembelianAsetChart,
  AsetPerhatianCard,
  AsetPerJenisCard,
  AktivitasAsetCard,
} from './Shared';

// Dashboard untuk role admin/hr/manajer — dapet semua section, termasuk
// hero chart "Tren Pembelian Aset per Bulan" yang gak ditampilin di
// DashboardUser maupun DashboardCabang.
export default function DashboardAdmin() {
  const { loading, error } = useDashboardCore();

  const { ringkasanAset, trenPembelianAset, asetPerhatian, asetPerJenis, aktivitasAsetTerbaru } = useDashboardAnalytics(true, {
    statusAsetDistribusi: false,
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <HeroTrenPembelianAsetChart trenPembelianAset={trenPembelianAset} />
        <RingkasanAsetCard ringkasanAset={ringkasanAset} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <AsetPerhatianCard asetPerhatian={asetPerhatian} />
        <AsetPerJenisCard asetPerJenis={asetPerJenis} />
      </div>

      {/* Aktivitas Aset Terbaru -- feed histori aset (sumber sama dengan tab
          Riwayat di Inventaris), ditaruh di dashboard biar user gak perlu
          sadar dulu ada tab Riwayat buat lihat aktivitas terkini. */}
      <div className="grid grid-cols-1 mt-6">
        <AktivitasAsetCard aktivitasAsetTerbaru={aktivitasAsetTerbaru} />
      </div>
    </>
  );
}