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

      {/* Hero chart (2/3) + Kalender (1/3) -- Kalender ngisi slot yang dulu
          kosong di sebelah hero chart pada layar xl (hero cuma col-span-2
          dari 3 kolom), sekalian gantiin slot "Distribusi Aset per Merek". */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <HeroTrenPembelianAsetChart trenPembelianAset={trenPembelianAset} />
        <CalendarCard />
      </div>

      {/* Ringkasan Status Aset + Aset Butuh Perhatian -- dua kartu ringkasan
          kondisi aset berdampingan. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RingkasanAsetCard ringkasanAset={ringkasanAset} />
        <AsetPerhatianCard asetPerhatian={asetPerhatian} />
      </div>

      {/* Aktivitas Aset Terbaru (2/3) + Notifikasi (1/3) -- feed histori aset
          (sumber sama dengan tab Riwayat di Inventaris) ditemenin notifikasi
          pribadi admin. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-2">
          <AktivitasAsetCard aktivitasAsetTerbaru={aktivitasAsetTerbaru} />
        </div>
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>
    </>
  );
}