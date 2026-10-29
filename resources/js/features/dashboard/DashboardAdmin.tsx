import { usePage } from '@inertiajs/react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import type { DashboardAdminData } from './types';
import { DashboardSkeleton } from './widgets/_shared';
import {
  Panel,
  LedgerHeader,
  HeroBanner,
  StatusLedger,
  PerluTindakan,
  TrenPembelian,
  AktivitasRows,
  NotifikasiLedger,
  KalenderLedger,
} from './widgets/ledger';

// Dashboard admin [DASHBOARD-V2] (tema & variabel warna: kelas .dv / .dd-* di index.css; terang/gelap otomatis).
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

  const { ringkasanInventory, trenPembelianInventory, inventoryPerhatian, aktivitasKalender } = analitik;

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
      <LedgerHeader
        name={user?.name}
        sentence={kalimat}
        actions={
          <>
            <button type="button" className="dd-btn" onClick={() => navigate('/laporan?tab=export_data')}>
              Ekspor laporan
            </button>
            <button type="button" className="dd-btn dd-btn-primary" onClick={() => navigate('/master-data?tab=inventory')}>
              Kelola inventory
            </button>
          </>
        }
        banner={
          <HeroBanner
            title={
              totalPerhatian > 0 ? (
                <>
                  Perlu perhatian
                  <br />
                  hari ini
                </>
              ) : (
                <>
                  Semua aman
                  <br />
                  hari ini
                </>
              )
            }
            text="Inventory rusak, dalam penanganan, dan garansi yang segera berakhir."
            cta="Buka penanganan"
            onCta={() => navigate('/penanganan-inventory')}
            stats={[
              { value: rusak, label: 'Rusak berat', alert: true },
              { value: dalamPenanganan, label: 'Ditangani' },
              { value: garansi, label: 'Garansi' },
            ]}
          />
        }
      />

      <StatusLedger ringkasan={ringkasanInventory} />

      <div className="dd-row2">
        <TrenPembelian data={trenPembelianInventory} />
        <Panel
          title="Aktivitas terbaru"
          subtitle="Pinjam, kembali, dan laporan kerusakan."
          right={
            <button type="button" className="dd-pill" onClick={() => navigate('/laporan?tab=riwayat_inventory')}>
              Lihat semua
            </button>
          }
        >
          <AktivitasRows events={(aktivitasKalender ?? []).slice(0, 5)} />
        </Panel>
      </div>

      <PerluTindakan perhatian={inventoryPerhatian} dijual={ringkasanInventory?.dijual ?? 0} />

      <KalenderLedger
        aktivitas={aktivitasKalender}
        subtitle="Lingkaran menandai tanggal yang ada mutasi. Kuning berarti ada laporan kerusakan. Pilih tanggal untuk melihat lognya."
        aside={<NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} />}
      />
    </div>
  );
}
