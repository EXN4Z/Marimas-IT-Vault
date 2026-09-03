import {
  useDashboardCore,
  useDashboardAnalytics,
  usePersonalInventoryActivity,
  usePersonalActivitySummary,
} from './useDashboardData';
import { Package, History, AlertTriangle, Boxes } from 'lucide-react';
import {
  WelcomeHeader,
  KpiCard,
  AktivitasInventoryCard,
  CalendarCard,
  NotifikasiCard,
  DashboardSkeleton,
} from './Shared';

// Dashboard user = halaman "home" personal -- cuma nampilin data milik si
// user sendiri (inventory yang lagi dia pinjam, riwayat & kalender pemakaian
// dia, notifikasi dia). Sengaja TIDAK ada data organisasi-lebar (total
// karyawan, distribusi departemen, dst) -- role ini gak berhak lihat itu,
// jadi useDashboardCore dipanggil dengan includeDepartemen: false biar
// query-nya juga gak pernah di-fetch, bukan cuma disembunyiin di UI.
//
// Semua 4 KPI di sini murni angka personal/faktual & real (gak ada kartu
// "Menunggu Persetujuan" -- app ini gak punya alur request/approve buat
// pinjam inventory, admin serah-terima langsung -- dan gak ada kartu status
// akun statis kayak "Verified" yang isinya bukan data beneran).
export default function DashboardUser() {
  const {
    loading,
    error,
    user,
    notifications,
    handleMarkAsRead,
  } = useDashboardCore({ includeDepartemen: false });

  const { sedangDipinjam, totalTersedia } = usePersonalInventoryActivity(user?.id);
  const { totalPernahDipinjam, totalLaporRusak } = usePersonalActivitySummary(!!user);

  // aktivitasInventoryTerbaru/Kalender sumbernya /inventory-pemakai/riwayat,
  // yang backend-nya SUDAH self-scoping buat role non-admin (cuma balikin
  // riwayat milik user ini sendiri) -- lihat InventoryPemakaiController::riwayat().
  // Widget analitik lain (ringkasan/tren/status/per-merek inventory) dimatikan
  // karena itu gambaran lintas-perusahaan, bukan konten personal.
  const { aktivitasInventoryTerbaru, aktivitasInventoryKalender } = useDashboardAnalytics(!!user, {
    ringkasanInventory: false,
    inventoryPerMerek: false,
    inventoryPerhatian: false,
    trenPembelianInventory: false,
    statusInventoryDistribusi: false,
    aktivitasInventoryTerbaru: true,
    aktivitasInventoryKalender: true,
  });

  if (loading) {
    return <DashboardSkeleton variant="simple" />;
  }

  return (
    <div className="space-y-3">
      <WelcomeHeader user={user} />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* KPI Cards -- semuanya personal & real, gak ada angka lintas-organisasi */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <KpiCard
          icon={Package}
          label="Sedang Dipinjam"
          value={sedangDipinjam}
          tone={sedangDipinjam > 0 ? 'emerald' : 'default'}
          badge={sedangDipinjam > 0 ? 'Aktif' : 'Kosong'}
          hint="Inventory di tangan kamu"
        />
        <KpiCard
          icon={History}
          label="Total Pernah Dipinjam"
          value={totalPernahDipinjam}
          tone="sky"
          badge="Riwayat"
          hint="Sepanjang waktu"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Laporan Kerusakan"
          value={totalLaporRusak}
          tone={totalLaporRusak > 0 ? 'amber' : 'default'}
          badge={totalLaporRusak > 0 ? 'Pernah Lapor' : 'Nol'}
          hint="Yang pernah kamu buat"
        />
        <KpiCard
          icon={Boxes}
          label="Total Inventory Tersedia"
          value={totalTersedia}
          tone="default"
          badge="Siap Pinjam"
          hint="Bisa kamu ajukan pinjam"
        />
      </div>

      {/* Main Grid: aktivitas & notifikasi milik sendiri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
        <AktivitasInventoryCard aktivitasInventoryTerbaru={aktivitasInventoryTerbaru} />
        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      {/* Kalender aktivitas pemakaian inventory milik sendiri */}
      <div>
        <CalendarCard aktivitas={aktivitasInventoryKalender} />
      </div>
    </div>
  );
}