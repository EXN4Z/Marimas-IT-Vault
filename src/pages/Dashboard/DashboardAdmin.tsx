import { useDashboardCore, useDashboardAnalytics } from './useDashboardData';
import { Boxes, Package, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  WelcomeHeader,
  KpiCard,
  RingkasanAsetCard,
  HeroTrenPembelianAsetChart,
  PerluTindakanCard,
  AsetPerhatianCard,
  AsetPerMerekCard,
  AktivitasAsetCard,
  DepartemenDistribusiCard,
  NotifikasiCard,
} from './Shared';

// Dashboard untuk role admin/hr/manajer — dapet semua section, termasuk
// hero chart "Tren Pembelian Aset per Bulan" yang gak ditampilin di
// DashboardUser maupun DashboardCabang.
export default function DashboardAdmin() {
  const { loading, error, user, notifications, handleMarkAsRead, departemen } = useDashboardCore();

  const { ringkasanAset, trenPembelianAset, asetPerhatian, asetPerMerek, aktivitasAsetTerbaru } = useDashboardAnalytics(true, {
    statusAsetDistribusi: false,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  const totalPerhatian =
    (asetPerhatian?.rusak ?? 0) + (asetPerhatian?.dalamPenanganan ?? 0) + (asetPerhatian?.garansiSegeraHabis ?? 0);

  return (
    <>
      <WelcomeHeader user={user} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* KPI strip -- ringkasan angka paling penting, sekilas tanpa perlu scroll.
          Semua nilai turunan dari ringkasanAset & asetPerhatian yang memang
          sudah di-fetch buat kartu-kartu di bawah, cuma disorot di atas. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Boxes} label="Total Aset" value={ringkasanAset?.total ?? 0} tone="default" />
        <KpiCard icon={Package} label="Sedang Dipakai" value={ringkasanAset?.dipakai ?? 0} tone="default" />
        <KpiCard icon={AlertTriangle} label="Butuh Perhatian" value={totalPerhatian} tone="amber" />
        <KpiCard icon={ShieldAlert} label="Rusak Berat" value={ringkasanAset?.rusakBerat ?? 0} tone="rose" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <HeroTrenPembelianAsetChart trenPembelianAset={trenPembelianAset} />
        <PerluTindakanCard asetPerhatian={asetPerhatian} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RingkasanAsetCard ringkasanAset={ringkasanAset} />
        <AsetPerMerekCard asetPerMerek={asetPerMerek} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <AsetPerhatianCard asetPerhatian={asetPerhatian} />
        <DepartemenDistribusiCard departemen={departemen} />
      </div>

      {/* Aktivitas Aset Terbaru + Notifikasi -- feed histori aset (sumber sama
          dengan tab Riwayat di Inventaris) ditemenin notifikasi pribadi admin,
          biar dashboard gak cuma soal angka tapi juga "apa yang baru terjadi". */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-2">
          <AktivitasAsetCard aktivitasAsetTerbaru={aktivitasAsetTerbaru} />
        </div>
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>
    </>
  );
}
