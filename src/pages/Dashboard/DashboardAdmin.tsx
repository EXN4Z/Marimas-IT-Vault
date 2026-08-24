import { useDashboardCore, useDashboardAnalytics } from './useDashboardData';
import { Boxes, Package, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  WelcomeHeader,
  KpiCard,
  RingkasanInventoryCard,
  HeroTrenPembelianInventoryChart,
  InventoryPerhatianCard,
  CalendarCard,
  NotifikasiCard,
} from './Shared';

// Dashboard untuk role admin/hr/manajer — dapet semua section, termasuk
// hero chart "Tren Pembelian Inventory per Bulan" yang gak ditampilin di
// DashboardUser maupun DashboardCabang.
export default function DashboardAdmin() {
  const { loading, error, user, notifications, handleMarkAsRead, } = useDashboardCore();

  const { ringkasanInventory, trenPembelianInventory, inventoryPerhatian, aktivitasInventoryKalender } =
    useDashboardAnalytics(true, {
      statusInventoryDistribusi: false,
      inventoryPerMerek: false,
      aktivitasInventoryTerbaru: false,
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  const inventoryTotal = ringkasanInventory?.total ?? 0;
  const tersediaPct = inventoryTotal > 0 ? Math.round(((ringkasanInventory?.tersedia ?? 0) / inventoryTotal) * 100) : 0;
  const dipakaiPct = inventoryTotal > 0 ? Math.round(((ringkasanInventory?.dipakai ?? 0) / inventoryTotal) * 100) : 0;
  const rusakBeratPct = inventoryTotal > 0 ? Math.round(((ringkasanInventory?.rusakBerat ?? 0) / inventoryTotal) * 100) : 0;
  const totalPerhatian =
    (inventoryPerhatian?.rusak ?? 0) + (inventoryPerhatian?.dalamPenanganan ?? 0) + (inventoryPerhatian?.garansiSegeraHabis ?? 0);

  return (
    <>
      <WelcomeHeader user={user} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* KPI strip -- ringkasan angka paling penting, sekilas tanpa perlu scroll.
          Semua nilai turunan dari ringkasanInventory & inventoryPerhatian yang memang
          sudah di-fetch buat kartu-kartu di bawah, cuma disorot di atas. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Boxes} label="Total Inventory" value={inventoryTotal} tone="default" hint={`${tersediaPct}% siap pakai`} />
        <KpiCard icon={Package} label="Sedang Dipakai" value={ringkasanInventory?.dipakai ?? 0} tone="default" hint={`${dipakaiPct}% dari total inventory`} />
        <KpiCard
          icon={AlertTriangle}
          label="Butuh Perhatian"
          value={totalPerhatian}
          tone="amber"
          hint={`${inventoryPerhatian?.garansiSegeraHabis ?? 0} garansi < 30 hari`}
        />
        <KpiCard icon={ShieldAlert} label="Rusak Berat" value={ringkasanInventory?.rusakBerat ?? 0} tone="rose" hint={`${rusakBeratPct}% dari total inventory`} />
      </div>

      {/* Hero chart (2/3) + Notifikasi (1/3) -- Notifikasi ngisi slot yang
          dulu kosong di sebelah hero chart pada layar xl (hero cuma
          col-span-2 dari 3 kolom). */}
      {/* items-start -- biar tinggi kartu chart & notifikasi independen
          (default grid nyamain tinggi keduanya ke yang paling tinggi). */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <HeroTrenPembelianInventoryChart trenPembelianInventory={trenPembelianInventory} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Ringkasan Status Inventory + Inventory Butuh Perhatian -- dua kartu ringkasan
          kondisi inventory berdampingan. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RingkasanInventoryCard ringkasanInventory={ringkasanInventory} />
        <InventoryPerhatianCard inventoryPerhatian={inventoryPerhatian} />
      </div>

      {/* Kalender aktivitas inventory -- div sendiri, full width. */}
      <div className="mt-6">
        <CalendarCard aktivitas={aktivitasInventoryKalender} />
      </div>
    </>
  );
}