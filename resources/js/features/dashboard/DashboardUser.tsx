import { usePage } from '@inertiajs/react';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import type { DashboardUserData } from './types';
import { DashboardSkeleton } from './widgets/_shared';
import { Panel, LedgerHeader, DiTanganmu, AktivitasRows, NotifikasiLedger, KalenderLedger } from './widgets/ledger';

// Dashboard user = halaman "home" personal -- cuma data milik si user sendiri (inventory yang dipegang,
// riwayat & kalender pemakaian, notifikasi). Sengaja TIDAK ada data organisasi-lebar; role ini tidak berhak
// melihatnya, jadi query-nya pun tidak pernah di-fetch (lihat DashboardQuery::pribadi).
// Tidak ada kartu "Menunggu Persetujuan": app ini tidak punya alur request/approve pinjam, admin serah-terima langsung.
// [F8-INERTIA] Data dari props `pribadi` (deferred; DashboardPageController -> DashboardQuery::pribadi).
export default function DashboardUser() {
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
    <div className="dv flex flex-col gap-8">
      <LedgerHeader name={user?.name} greeting="Halo" sentence={kalimat} />

      <div className="dv-cols lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-8">
          <DiTanganmu items={sedangDipegang} jumlah={sedangDipinjam} />
          <Panel title="Riwayat terbaru" subtitle="Aktivitas inventory milikmu.">
            <AktivitasRows events={aktivitasTerbaru} />
          </Panel>
        </div>

        <div className="flex flex-col gap-8">
          <Panel title="Ringkasan" subtitle="Angka milikmu sendiri.">
            <div className="dv-row" style={{ alignItems: 'center' }}>
              <span>Pernah dipinjam</span>
              <b className="dv-g text-[30px]">{totalPernahDipinjam}</b>
            </div>
            <div className="dv-row" style={{ alignItems: 'center' }}>
              <span>Laporan kerusakan dibuat</span>
              <b className="dv-g text-[30px]">{totalLaporRusak}</b>
            </div>
            <div className="dv-row" style={{ alignItems: 'center', borderBottom: '1px solid var(--dv-line)' }}>
              <span>
                Inventory tersedia
                <br />
                <span className="dv-side">Bisa kamu ajukan ke admin</span>
              </span>
              <b className="dv-g text-[30px] dv-primary">{totalTersedia}</b>
            </div>
          </Panel>
          <NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} />
        </div>
      </div>

      <KalenderLedger
        aktivitas={aktivitasKalender}
        subtitle="Titik menandai tanggal ada mutasi pada inventory milikmu. Titik merah berarti kamu membuat laporan."
      />
    </div>
  );
}
