import { useDashboardCore, useDashboardAnalytics } from './useDashboardData';
import { Boxes, Package, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  WelcomeHeader,
  KpiCard,
  RingkasanAsetCard,
  HeroTrenPembelianAsetChart,
  AsetPerhatianCard,
  CalendarCard,
  AktivitasAsetCard,
  NotifikasiCard,
} from './Shared';

// Dashboard untuk role admin/hr/manajer — dapet semua section, termasuk
// hero chart "Tren Pembelian Aset per Bulan" yang gak ditampilin di
// DashboardUser maupun DashboardCabang.
export default function DashboardAdmin() {
  const { loading, error, user, notifications, handleMarkAsRead, } = useDashboardCore();

  const { ringkasanAset, trenPembelianAset, asetPerhatian, aktivitasAsetTerbaru } = useDashboardAnalytics(true, {
    statusAsetDistribusi: false,
    asetPerMerek: false,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  const asetTotal = ringkasanAset?.total ?? 0;
  const tersediaPct = asetTotal > 0 ? Math.round(((ringkasanAset?.tersedia ?? 0) / asetTotal) * 100) : 0;
  const dipakaiPct = asetTotal > 0 ? Math.round(((ringkasanAset?.dipakai ?? 0) / asetTotal) * 100) : 0;
  const rusakBeratPct = asetTotal > 0 ? Math.round(((ringkasanAset?.rusakBerat ?? 0) / asetTotal) * 100) : 0;
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
        <KpiCard icon={Boxes} label="Total Aset" value={asetTotal} tone="default" hint={`${tersediaPct}% siap pakai`} />
        <KpiCard icon={Package} label="Sedang Dipakai" value={ringkasanAset?.dipakai ?? 0} tone="default" hint={`${dipakaiPct}% dari total aset`} />
        <KpiCard
          icon={AlertTriangle}
          label="Butuh Perhatian"
          value={totalPerhatian}
          tone="amber"
          hint={`${asetPerhatian?.garansiSegeraHabis ?? 0} garansi < 30 hari`}
        />
        <KpiCard icon={ShieldAlert} label="Rusak Berat" value={ringkasanAset?.rusakBerat ?? 0} tone="rose" hint={`${rusakBeratPct}% dari total aset`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <HeroTrenPembelianAsetChart trenPembelianAset={trenPembelianAset} />
      </div>

      {/* Ringkasan Status Aset + Kalender -- dua kartu ringkas berdampingan,
          gantiin slot "Distribusi Aset per Merek" yang lama. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RingkasanAsetCard ringkasanAset={ringkasanAset} />
        <CalendarCard />
      </div>

      {/* Aset Butuh Perhatian + Notifikasi -- dipasangin biar gak ada baris
          yang cuma kepakai setengah lebar (sebelumnya AsetPerhatianCard
          sendirian di baris lg:grid-cols-2). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <AsetPerhatianCard asetPerhatian={asetPerhatian} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Aktivitas Aset Terbaru -- feed histori aset (sumber sama dengan tab
          Riwayat di Inventaris), full width biar daftarnya lega dibaca. */}
      <div className="mt-6">
        <AktivitasAsetCard aktivitasAsetTerbaru={aktivitasAsetTerbaru} />
      </div>
    </>
  );
}