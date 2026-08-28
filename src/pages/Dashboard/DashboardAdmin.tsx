import { useDashboardCore, useDashboardAnalytics } from './useDashboardData';
import { Boxes, Package, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  WelcomeHeader,
  QuickActionBar,
  KpiCard,
  RingkasanInventoryCard,
  HeroTrenPembelianInventoryChart,
  StatusInventoryDonutCard,
  TopInventoryCard,
  InventoryPerhatianCard,
  DepartemenDistribusiCard,
  AktivitasInventoryCard,
  CalendarCard,
  NotifikasiCard,
} from './Shared';

export default function DashboardAdmin() {
  const { loading, error, user, notifications, handleMarkAsRead, departemen } = useDashboardCore();

  const {
    ringkasanInventory,
    trenPembelianInventory,
    inventoryPerhatian,
    statusInventoryDistribusi,
    inventoryPerMerek,
    aktivitasInventoryTerbaru,
    aktivitasInventoryKalender,
  } = useDashboardAnalytics(true, {
    statusInventoryDistribusi: true,
    inventoryPerMerek: true,
    aktivitasInventoryTerbaru: true,
  });

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Memuat data operasional dashboard...
        </div>
      </div>
    );
  }

  const inventoryTotal = ringkasanInventory?.total ?? 0;
  const tersediaCount = ringkasanInventory?.tersedia ?? 0;
  const dipakaiCount = ringkasanInventory?.dipakai ?? 0;
  const rusakBeratCount = ringkasanInventory?.rusakBerat ?? 0;

  const tersediaPct = inventoryTotal > 0 ? Math.round((tersediaCount / inventoryTotal) * 100) : 0;
  const dipakaiPct = inventoryTotal > 0 ? Math.round((dipakaiCount / inventoryTotal) * 100) : 0;
  const rusakBeratPct = inventoryTotal > 0 ? Math.round((rusakBeratCount / inventoryTotal) * 100) : 0;

  const totalPerhatian =
    (inventoryPerhatian?.rusak ?? 0) +
    (inventoryPerhatian?.dalamPenanganan ?? 0) +
    (inventoryPerhatian?.garansiSegeraHabis ?? 0);

  return (
    <div className="space-y-3">
      {/* Header & Quick Action Hub */}
      <WelcomeHeader user={user} />
      <QuickActionBar role={user?.role} />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Row 1: High-Density Bento KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <KpiCard
          icon={Boxes}
          label="Total Inventory"
          value={inventoryTotal}
          tone="default"
          badge={`${tersediaPct}% Ready`}
          progress={tersediaPct}
          hint={`${tersediaCount} unit siap pakai`}
        />
        <KpiCard
          icon={Package}
          label="Sedang Dipakai"
          value={dipakaiCount}
          tone="sky"
          badge={`${dipakaiPct}% Use`}
          progress={dipakaiPct}
          hint={`${dipakaiPct}% dari total aset`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Butuh Perhatian"
          value={totalPerhatian}
          tone={totalPerhatian > 0 ? 'amber' : 'emerald'}
          badge={totalPerhatian > 0 ? 'Urgent' : 'Aman'}
          progress={inventoryTotal > 0 ? Math.round((totalPerhatian / inventoryTotal) * 100) : 0}
          hint={`${inventoryPerhatian?.garansiSegeraHabis ?? 0} garansi < 30 hr`}
        />
        <KpiCard
          icon={ShieldAlert}
          label="Rusak Berat"
          value={rusakBeratCount}
          tone="rose"
          badge={`${rusakBeratPct}%`}
          progress={rusakBeratPct}
          hint={`${rusakBeratPct}% aset tidak aktif`}
        />
      </div>

      {/* Row 2: Hero Trends & Status Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-3 items-stretch">
        <div className="xl:col-span-7 flex flex-col">
          <HeroTrenPembelianInventoryChart trenPembelianInventory={trenPembelianInventory} className="h-full" />
        </div>
        <div className="xl:col-span-5 flex flex-col">
          <StatusInventoryDonutCard statusInventoryDistribusi={statusInventoryDistribusi} className="h-full" />
        </div>
      </div>

      {/* Row 3: 3-Column Asset Operations Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
        <RingkasanInventoryCard ringkasanInventory={ringkasanInventory} />
        <TopInventoryCard inventoryPerMerek={inventoryPerMerek} />
        <InventoryPerhatianCard inventoryPerhatian={inventoryPerhatian} />
      </div>

      {/* Row 4: Organization, Activity Stream & Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
        <DepartemenDistribusiCard departemen={departemen} />
        <AktivitasInventoryCard aktivitasInventoryTerbaru={aktivitasInventoryTerbaru} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Row 5: Operational Calendar */}
      <div>
        <CalendarCard aktivitas={aktivitasInventoryKalender} />
      </div>
    </div>
  );
}