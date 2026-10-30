import { usePage } from '@inertiajs/react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import type { DashboardAdminData } from './types';
import { DashboardSkeleton } from './widgets/_shared';
import { HeroInventory, KpiDots, AktivitasKalender, TerbanyakDipegang, NotifikasiLedger } from './widgets/ledger';

// Dashboard admin [DASHBOARD-V3] (tema & variabel warna: kelas .dv / .dd-* di index.css; terang/gelap otomatis lewat html.dark).
// Tata letak dua kolom:
//   kiri  = hero (ringkasan + chart pembelian) -> 4 kartu angka -> aktivitas terbaru + kalender
//   kanan = barang terbanyak di pegang -> notifikasi
// Kartu terakhir tiap kolom mengisi sisa tinggi, jadi sisi bawah kedua kolom sejajar.
// [F8-INERTIA] Data dari props `analitik` (deferred; DashboardController -> DashboardQuery::admin). Selama belum datang -> skeleton.
export default function DashboardAdmin() {
  const navigate = useAppNavigate();
  const { auth } = useSharedProps();
  const user = auth?.user ?? null;
  const { notifications, handleMarkAsRead } = useDashboardNotifications(user?.id);
  const analitik = (usePage().props as unknown as { analitik?: DashboardAdminData | null }).analitik ?? null;

  if (!analitik) {
    return <DashboardSkeleton variant="full" />;
  }

  const { ringkasanInventory, trenPembelianInventory, inventoryPerhatian, inventoryPerMerek, aktivitasKalender, terbanyakDipegang } = analitik;

  const rusak = inventoryPerhatian?.rusak ?? 0;
  const dalamPenanganan = inventoryPerhatian?.dalamPenanganan ?? 0;
  const garansi = inventoryPerhatian?.garansiSegeraHabis ?? 0;
  const totalPerhatian = rusak + dalamPenanganan + garansi;

  const kalimat =
    totalPerhatian > 0
      ? `${totalPerhatian} inventory perlu perhatian: ${rusak} rusak berat, ${dalamPenanganan} sedang ditangani, dan ${garansi} garansinya habis dalam 30 hari.`
      : 'Tidak ada inventory yang perlu perhatian hari ini.';

  return (
    <div className="dv dd-page">
      <div className="dd-main">
        <div className="dd-mcol">
          <HeroInventory
            total={ringkasanInventory?.total ?? 0}
            tren={trenPembelianInventory}
            perMerek={inventoryPerMerek}
            kalimat={kalimat}
            actions={
              <>
              </>
            }
          />
          <KpiDots ringkasan={ringkasanInventory} perhatian={inventoryPerhatian} />
          <AktivitasKalender aktivitas={aktivitasKalender} onLihatSemua={() => navigate('/laporan?tab=riwayat_inventory')} />
        </div>

        <div className="dd-mcol">
          <TerbanyakDipegang data={terbanyakDipegang} />
          <NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} pageSize={5} fill />
        </div>
      </div>
    </div>
  );
}
