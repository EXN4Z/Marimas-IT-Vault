import { usePage } from '@inertiajs/react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import type { DashboardAdminData } from './types';
import { DashboardSkeleton } from './widgets/_shared';
import {
  Panel,
  LedgerHeader,
  StatusLedger,
  PerluTindakan,
  TrenPembelian,
  DepartemenKaryawan,
  AktivitasRows,
  NotifikasiLedger,
  KalenderLedger,
} from './widgets/ledger';

// Dashboard admin, gaya "ledger" (tema & variabel warna: kelas .dv di index.css; terang/gelap otomatis).
// [F8-INERTIA] Data dari props `analitik` (deferred; DashboardPageController -> DashboardQuery::admin).
// Selama belum datang -> skeleton. Notifikasi tetap lewat hook sendiri.
export default function DashboardAdmin() {
  const navigate = useAppNavigate();
  const { auth } = useSharedProps();
  const user = auth?.user ?? null;
  const { notifications, handleMarkAsRead } = useDashboardNotifications(user?.id);
  const analitik = (usePage().props as unknown as { analitik?: DashboardAdminData | null }).analitik ?? null;

  if (!analitik) {
    return <DashboardSkeleton variant="full" />;
  }

  const { ringkasanInventory, trenPembelianInventory, inventoryPerhatian, aktivitasKalender, departemen } = analitik;

  const rusak = inventoryPerhatian?.rusak ?? 0;
  const dalamPenanganan = inventoryPerhatian?.dalamPenanganan ?? 0;
  const garansi = inventoryPerhatian?.garansiSegeraHabis ?? 0;
  const totalPerhatian = rusak + dalamPenanganan + garansi;

  const kalimat =
    totalPerhatian > 0
      ? `${totalPerhatian} aset perlu perhatian: ${rusak} rusak berat, ${dalamPenanganan} sedang ditangani, dan ${garansi} garansinya habis dalam 30 hari.`
      : 'Tidak ada aset yang perlu perhatian hari ini.';

  return (
    <div className="dv flex flex-col gap-8">
      <LedgerHeader
        name={user?.name}
        sentence={kalimat}
        actions={
          <>
            <button type="button" className="dv-btn" onClick={() => navigate('/laporan?tab=export_data')}>
              Ekspor laporan
            </button>
            <button type="button" className="dv-btn dv-btn-primary" onClick={() => navigate('/master-data?tab=inventory')}>
              Kelola inventory
            </button>
          </>
        }
      />

      <StatusLedger ringkasan={ringkasanInventory} />

      <div className="dv-cols lg:grid-cols-3">
        <PerluTindakan perhatian={inventoryPerhatian} dijual={ringkasanInventory?.dijual ?? 0} />
        <TrenPembelian data={trenPembelianInventory} />
        <DepartemenKaryawan data={departemen} />
      </div>

      <div className="dv-cols lg:grid-cols-[3fr_2fr]">
        <Panel title="Aktivitas terbaru" subtitle="Pinjam, kembali, dan laporan kerusakan.">
          <AktivitasRows events={(aktivitasKalender ?? []).slice(0, 5)} />
        </Panel>
        <NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} />
      </div>

      <KalenderLedger
        aktivitas={aktivitasKalender}
        subtitle="Titik menandai tanggal yang ada mutasi. Titik merah berarti ada laporan kerusakan. Pilih tanggal untuk melihat lognya."
      />
    </div>
  );
}
