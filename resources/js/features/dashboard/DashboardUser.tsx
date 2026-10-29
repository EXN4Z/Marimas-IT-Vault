import { usePage } from '@inertiajs/react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import type { DashboardUserData } from './types';
import { DashboardSkeleton } from './widgets/_shared';
import { Panel, LedgerHeader, HeroBanner, DiTanganmu, AktivitasRows, NotifikasiLedger, KalenderLedger } from './widgets/ledger';

// Dashboard user = halaman "home" personal -- cuma data milik si user sendiri (inventory yang dipegang,
// riwayat & kalender pemakaian, notifikasi). Sengaja TIDAK ada data organisasi-lebar; role ini tidak berhak
// melihatnya, jadi query-nya pun tidak pernah di-fetch (lihat DashboardQuery::pribadi).
// Tidak ada kartu "Menunggu Persetujuan": app ini tidak punya alur request/approve pinjam, admin serah-terima langsung.
// [F8-INERTIA] Data dari props `pribadi` (deferred; DashboardPageController -> DashboardQuery::pribadi).
// [DASHBOARD-V2] Tampilan kartu + banner, sama bahasa visualnya dengan dashboard admin.
export default function DashboardUser() {
  const navigate = useAppNavigate();
  const { auth } = useSharedProps();
  const user = auth?.user ?? null;
  const { notifications, handleMarkAsRead } = useDashboardNotifications(user?.id);
  const pribadi = (usePage().props as unknown as { pribadi?: DashboardUserData | null }).pribadi ?? null;

  if (!pribadi) {
    return <DashboardSkeleton variant="simple" />;
  }

  const { sedangDipinjam, sedangDipegang, totalTersedia, totalPernahDipinjam, totalLaporRusak, aktivitasTerbaru, aktivitasKalender } = pribadi;

  const kalimat =
    sedangDipinjam > 0
      ? `Kamu sedang memegang ${sedangDipinjam} inventory. Kalau ada yang bermasalah, laporkan dari sini.`
      : 'Kamu belum memegang inventory. Hubungi admin IT untuk serah terima.';

  return (
    <div className="dv dd-page">
      <LedgerHeader
        name={user?.name}
        greeting="Halo"
        sentence={kalimat}
        banner={
          <HeroBanner
            title={
              <>
                Inventory
                <br />
                di tanganmu
              </>
            }
            text="Ringkasan inventory yang kamu pegang dan yang masih tersedia."
            cta="Lihat inventory"
            onCta={() => navigate('/master-data?tab=inventory')}
            stats={[
              { value: sedangDipinjam, label: 'Dipegang' },
              { value: totalTersedia, label: 'Tersedia' },
              { value: totalLaporRusak, label: 'Lapor rusak', alert: true },
            ]}
          />
        }
      />

      <div className="dd-row2 dd-row2-user">
        <div className="flex flex-col gap-5 min-w-0">
          <DiTanganmu items={sedangDipegang} jumlah={sedangDipinjam} />
          <Panel title="Riwayat terbaru" subtitle="Aktivitas inventory milikmu.">
            <AktivitasRows events={aktivitasTerbaru} />
          </Panel>
        </div>

        <Panel title="Ringkasan" subtitle="Angka milikmu sendiri.">
          <div className="dd-stat">
            <span>Pernah dipinjam</span>
            <b className="dv-g">{totalPernahDipinjam}</b>
          </div>
          <div className="dd-stat">
            <span>Laporan kerusakan dibuat</span>
            <b className="dv-g">{totalLaporRusak}</b>
          </div>
          <div className="dd-stat">
            <span>
              Inventory tersedia
              <br />
              <span className="dv-side">Bisa kamu ajukan ke admin</span>
            </span>
            <b className="dv-g dv-primary">{totalTersedia}</b>
          </div>
        </Panel>
      </div>

      <KalenderLedger
        aktivitas={aktivitasKalender}
        subtitle="Lingkaran menandai tanggal ada mutasi pada inventory milikmu. Kuning berarti kamu membuat laporan."
        aside={<NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} />}
      />
    </div>
  );
}
