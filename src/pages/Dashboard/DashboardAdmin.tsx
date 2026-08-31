import { useNavigate } from 'react-router-dom';
import { useDashboardCore, useDashboardAnalytics } from './useDashboardData';
import { Boxes, Package, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  WelcomeHeader,
  KpiCard,
  RingkasanInventoryCard,
  HeroTrenPembelianInventoryChart,
  StatusInventoryDonutCard,
  TopInventoryCard,
  InventoryPerhatianCard,
  DepartemenDistribusiCard,
  RiwayatAktivitasTableCard,
  CalendarCard,
  NotifikasiCard,
  DashboardSkeleton,
} from './Shared';

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const { loading, error, user, notifications, handleMarkAsRead, departemen } = useDashboardCore();

  const {
    ringkasanInventory,
    trenPembelianInventory,
    inventoryPerhatian,
    statusInventoryDistribusi,
    inventoryPerMerek,
    aktivitasInventoryKalender,
  } = useDashboardAnalytics(true, {
    statusInventoryDistribusi: true,
    inventoryPerMerek: true,
    aktivitasInventoryTerbaru: false,
  });

  if (loading) {
    return <DashboardSkeleton variant="full" />;
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
      {/* Header + primary action (DEGO "+ Add Product" pattern) */}
      <WelcomeHeader
        user={user}
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Row 1: High-Density Bento KPIs, each with a "Lihat detail" footer link */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <KpiCard
          icon={Boxes}
          label="Total Inventory"
          value={inventoryTotal}
          tone="default"
          badge={`${tersediaPct}% Ready`}
          detailLabel={`${tersediaCount} unit siap pakai`}
          onClick={() => navigate('/master-data?tab=inventory')}
        />
        <KpiCard
          icon={Package}
          label="Sedang Dipakai"
          value={dipakaiCount}
          tone="sky"
          badge={`${dipakaiPct}% Use`}
          detailLabel={`${dipakaiPct}% dari total aset`}
          onClick={() => navigate('/master-data?tab=inventory&status=dipakai')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Butuh Perhatian"
          value={totalPerhatian}
          tone={totalPerhatian > 0 ? 'amber' : 'emerald'}
          badge={totalPerhatian > 0 ? 'Urgent' : 'Aman'}
          detailLabel={`${inventoryPerhatian?.garansiSegeraHabis ?? 0} garansi < 30 hr`}
          onClick={() => navigate('/penanganan-inventory')}
        />
        <KpiCard
          icon={ShieldAlert}
          label="Rusak Berat"
          value={rusakBeratCount}
          tone="rose"
          badge={`${rusakBeratPct}%`}
          detailLabel={`${rusakBeratPct}% aset tidak aktif`}
          onClick={() => navigate('/master-data?tab=inventory&status=rusak_berat')}
        />
      </div>

      {/* Row 2: Hero Trends & Status Breakdown (Sales Analytics + Top Cities pattern) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-3 items-stretch">
        <div className="xl:col-span-7 flex flex-col">
          <HeroTrenPembelianInventoryChart trenPembelianInventory={trenPembelianInventory} className="h-full" />
        </div>
        <div className="xl:col-span-5 flex flex-col">
          <StatusInventoryDonutCard statusInventoryDistribusi={statusInventoryDistribusi} className="h-full" />
        </div>
      </div>

      {/* Row 3: Full-width searchable/sortable/paginated table (DEGO "Information by stores" pattern) */}
      <div>
        <RiwayatAktivitasTableCard aktivitas={aktivitasInventoryKalender} />
      </div>

      {/* Row 4: 3-Column Asset Operations Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
        <RingkasanInventoryCard ringkasanInventory={ringkasanInventory} />
        <TopInventoryCard inventoryPerMerek={inventoryPerMerek} />
        <InventoryPerhatianCard inventoryPerhatian={inventoryPerhatian} />
      </div>

      {/* Row 5: Organization & Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
        <DepartemenDistribusiCard departemen={departemen} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Row 6: Operational Calendar */}
      <div>
        <CalendarCard aktivitas={aktivitasInventoryKalender} />
      </div>
    </div>
  );
}