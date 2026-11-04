import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import type { InventoryDipegang, AktivitasInventoryTerbaru, DashboardUserData } from './types';
import { Panel, EmptyNote, AktivitasRows, DashboardSkeleton, LedgerHeader, HeroBanner, NotifikasiLedger } from './DashboardShared';
import { useSharedProps } from '../../hooks/useSharedProps';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import './dashboard.css';

// PETA HALAMAN USER (dari atas ke bawah) — tiap bagian punya komentar bergaris ═══ di bawah:
//   1. HEADER + BANNER · 2. DI TANGANMU · 3. RIWAYAT TERBARU · 4. RINGKASAN · 5. KALENDER + NOTIFIKASI
//   (Panel, LedgerHeader, HeroBanner, AktivitasRows, NotifikasiLedger ada di DashboardShared.tsx)

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
      {/* ═══ 1. HEADER + BANNER (LedgerHeader & HeroBanner di DashboardShared.tsx) ═══ */}
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

      {/* ═══ BARIS TENGAH (kiri: di tanganmu + riwayat · kanan: ringkasan) ═══ */}
      <div className="dd-row2 dd-row2-user">
        <div className="flex flex-col gap-5 min-w-0">
          {/* ═══ 2. DI TANGANMU ═══ */}
          <DiTanganmu items={sedangDipegang} jumlah={sedangDipinjam} />
          {/* ═══ 3. RIWAYAT TERBARU ═══ */}
          <Panel title="Riwayat terbaru" subtitle="Aktivitas inventory milikmu.">
            <AktivitasRows events={aktivitasTerbaru} />
          </Panel>
        </div>

        {/* ═══ 4. RINGKASAN ═══ */}
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

      {/* ═══ 5. KALENDER + NOTIFIKASI (notifikasi lewat prop aside) ═══ */}
      <KalenderLedger
        aktivitas={aktivitasKalender}
        subtitle="Lingkaran menandai tanggal ada mutasi pada inventory milikmu. Kuning berarti kamu membuat laporan."
        aside={<NotifikasiLedger notifications={notifications} onMarkAsRead={handleMarkAsRead} />}
      />
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════
// 2. DI TANGANMU — inventory yang sedang dipegang user
//   (dulu: widgets/ledger/DiTanganmu.tsx)
// ════════════════════════════════════════════════════════════════════════

function lamaHari(sejak: string | null): { teks: string } | null {
  if (!sejak) return null;
  const d = new Date(sejak);
  if (isNaN(d.getTime())) return null;
  const hari = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
  return { teks: hari === 0 ? `Sejak hari ini (${tgl})` : `Sejak ${tgl}, sudah ${hari} hari` };
}

// Inventory yang sedang dipegang user. `items` datang dari props pribadi.sedangDipegang;
// kalau server lama belum mengirimnya tapi jumlahnya > 0, tampilkan ringkasan saja.
function DiTanganmu({ items, jumlah }: { items?: InventoryDipegang[]; jumlah: number }) {
  const navigate = useAppNavigate();
  const list = Array.isArray(items) ? items : [];

  return (
    <Panel title="Di tanganmu" subtitle="Diserahkan oleh admin IT.">
      {list.length > 0 ? (
        list.map((it) => {
          const lama = lamaHari(it.sejak);
          return (
            <div key={it.id} className="dd-hold">
              <div className="min-w-0">
                <div className="dv-g text-[22px] font-bold leading-tight">{it.kode_inventory ?? '-'}</div>
                <div className="text-sm mt-0.5">{it.nama ?? ''}</div>
                {lama && <div className="dv-sub" style={{ margin: '4px 0 0' }}>{lama.teks}</div>}
              </div>
              <button type="button" className="dd-btn dd-btn-sm" onClick={() => navigate('/master-data?tab=inventory')}>
                Lapor kerusakan
              </button>
            </div>
          );
        })
      ) : jumlah > 0 ? (
        <div className="dd-hold">
          <div className="text-sm">Kamu memegang {jumlah} inventory.</div>
          <button type="button" className="dd-btn dd-btn-sm" onClick={() => navigate('/master-data?tab=inventory')}>
            Lihat inventory
          </button>
        </div>
      ) : (
        <EmptyNote>Kamu belum memegang inventory. Hubungi admin IT untuk serah terima.</EmptyNote>
      )}
    </Panel>
  );
}


// ════════════════════════════════════════════════════════════════════════
// 5. KALENDER + NOTIFIKASI — kalender mutasi milik user (+ slot aside untuk notifikasi)
//   (dulu: widgets/ledger/KalenderLedger.tsx)
// ════════════════════════════════════════════════════════════════════════

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Grid bulan, minggu mulai hari Senin.
function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const inMonthDays = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  for (let d = 1; d <= inMonthDays; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, next++), inMonth: false });
  return cells;
}

// `aside` = kartu tambahan di bawah log harian (kolom kanan), mis. notifikasi.
function KalenderLedger({
  aktivitas = [],
  subtitle,
  aside,
}: {
  aktivitas?: AktivitasInventoryTerbaru[];
  subtitle: string;
  aside?: ReactNode;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(() => buildGrid(view.getFullYear(), view.getMonth()), [view]);

  const perTanggal = useMemo(() => {
    const map = new Map<string, AktivitasInventoryTerbaru[]>();
    for (const ev of Array.isArray(aktivitas) ? aktivitas : []) {
      const d = new Date(ev.waktu);
      if (isNaN(d.getTime())) continue;
      const k = keyOf(d);
      const list = map.get(k);
      if (list) list.push(ev);
      else map.set(k, [ev]);
    }
    return map;
  }, [aktivitas]);

  const log = useMemo(
    () => [...(perTanggal.get(keyOf(selected)) ?? [])].sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime()),
    [perTanggal, selected],
  );

  const geser = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const kembaliKeHariIni = () => {
    setView(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };
  const judulLog = selected.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="dd-split">
      <Panel title="Kalender operasional" subtitle={subtitle} className="dd-calcard">
        <div className="dd-cal-head">
          <button type="button" className="dd-pa is-back" aria-label="Bulan sebelumnya" onClick={() => geser(-1)}>
            <ChevronLeft size={16} />
          </button>
          <b className="dv-g dd-cal-mn" aria-live="polite">
            {BULAN[view.getMonth()]} {view.getFullYear()}
          </b>
          <button type="button" className="dd-pa" aria-label="Bulan berikutnya" onClick={() => geser(1)}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="dd-btn dd-btn-sm" onClick={kembaliKeHariIni}>
            Hari ini
          </button>
        </div>

        <div className="dd-dow" aria-hidden="true">
          {HARI.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="dd-days" role="group" aria-label={`Kalender ${BULAN[view.getMonth()]} ${view.getFullYear()}`}>
          {cells.map(({ date, inMonth }) => {
            const events = perTanggal.get(keyOf(date)) ?? [];
            const adaLapor = events.some((e) => e.type === 'lapor_rusak');
            const isToday = sameDay(date, today);
            const isSel = sameDay(date, selected);
            const cls = [
              'dd-cell',
              !inMonth && 'is-out',
              events.length > 0 && 'is-ev',
              adaLapor && 'is-al',
              isToday && 'is-today',
              isSel && 'is-sel',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={keyOf(date)}
                type="button"
                className={cls}
                aria-pressed={isSel}
                aria-label={`${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, ${events.length} mutasi${adaLapor ? ', ada laporan kerusakan' : ''}`}
                onClick={() => setSelected(date)}
              >
                <span className="dv-g">{String(date.getDate()).padStart(2, '0')}</span>
              </button>
            );
          })}
        </div>
        <div className="dd-legend">
          <span>
            <i className="lg-today" />
            Hari ini
          </span>
          <span>
            <i className="lg-ev" />
            Ada mutasi
          </span>
          <span>
            <i className="lg-al" />
            Ada laporan rusak
          </span>
        </div>
      </Panel>

      <div className="dd-aside">
        <Panel title={judulLog} subtitle={log.length > 0 ? `${log.length} mutasi pada tanggal ini` : 'Pilih tanggal untuk melihat lognya.'}>
          <div className="dd-logscroll">
            <AktivitasRows
              events={log}
              variant="ikon"
              kosong="Tidak ada mutasi pada tanggal ini."
              timeFormatter={(w) => new Date(w).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            />
          </div>
        </Panel>
        {aside}
      </div>
    </div>
  );
}
