import { Skeleton } from '../../../../components/skeleton';

// ==== Skeleton loading buat Dashboard, meniru layout baru tiap varian (kelas .dv / .dd-* sama dengan halaman asli)
// supaya tidak "loncat" pas data beneran datang. Dipakai selagi props deferred (analitik / pribadi) belum datang.
// - 'full'   = DashboardAdmin (v4): hero + 4 kartu angka + aktivitas/kalender di kiri; terbanyak dipegang + notifikasi di kanan
// - 'simple' = DashboardUser: header + banner, dua kolom kartu, lalu kalender + notifikasi ====

// Baris daftar generik: teks dua baris di kiri, angka kecil di kanan (aktivitas, notifikasi, terbanyak dipegang).
function BarisSkeleton({ jumlah, kanan = true }: { jumlah: number; kanan?: boolean }) {
  return (
    <div>
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2.5" style={i > 0 ? { borderTop: '1px solid var(--dv-line)' } : undefined}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 rounded w-3/5" />
            <Skeleton className="h-2.5 rounded w-2/5" />
          </div>
          {kanan && <Skeleton className="h-3 rounded w-12 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// Kepala kartu: judul di kiri, tautan kecil di kanan.
function KepalaKartu({ lebarJudul = 'w-32', tautan = true }: { lebarJudul?: string; tautan?: boolean }) {
  return (
    <div className="dd-ch">
      <Skeleton className={`h-3.5 rounded ${lebarJudul}`} />
      {tautan && <Skeleton className="h-3 rounded w-14" />}
    </div>
  );
}

// Kalender: kepala bulan + nama hari + 5 minggu.
function KalenderSkeleton({ besar = false }: { besar?: boolean }) {
  const cell = besar ? 'h-9 w-9 rounded-full' : 'h-6 w-6 rounded-lg';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="flex gap-1">
          <Skeleton className="h-[22px] w-[22px] rounded-md" />
          <Skeleton className="h-[22px] w-[22px] rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 rounded mx-auto w-4" />
        ))}
      </div>
      <div className={`grid grid-cols-7 ${besar ? 'gap-y-2.5' : 'gap-1'}`}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="grid place-items-center" style={{ height: besar ? 40 : 30 }}>
            <Skeleton className={cell} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardAdminSkeleton() {
  return (
    <div className="dv dd-page dd-v4" aria-busy="true" aria-label="Memuat dashboard">
      <div className="dd-main">
        {/* Kolom kiri */}
        <div className="dd-mcol">
          {/* Hero: ringkasan angka + chart pembelian */}
          <section className="dd-card">
            <div className="dd-hv">
              <div className="dd-hv-l">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-9 w-24 rounded mt-3.5" />
                <Skeleton className="h-4 w-32 rounded mt-2.5" />
                <div className="dd-hv-two">
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
              </div>
              <div className="dd-hv-r">
                <div className="dd-rng">
                  <Skeleton className="h-5 w-10 rounded-md" />
                  <Skeleton className="h-5 w-10 rounded-md" />
                  <Skeleton className="h-5 w-10 rounded-md" />
                </div>
                <div className="flex items-end justify-between gap-2" style={{ height: 190 }}>
                  {[55, 70, 45, 85, 60, 95, 50, 75, 65, 90, 58, 72].map((h, i) => (
                    <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4 kartu angka */}
          <div className="dd-kp">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dd-kc" style={{ cursor: 'default' }}>
                <div className="dd-kc-h">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-[26px] w-[26px] rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-14 rounded" />
                  <Skeleton className="h-2.5 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Aktivitas terbaru + kalender */}
          <div className="dd-pair">
            <section className="dd-card">
              <KepalaKartu lebarJudul="w-36" />
              <BarisSkeleton jumlah={6} />
            </section>
            <section className="dd-card">
              <KalenderSkeleton />
            </section>
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="dd-mcol">
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-40" />
            <BarisSkeleton jumlah={5} />
          </section>
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-24" tautan={false} />
            <BarisSkeleton jumlah={5} />
          </section>
        </div>
      </div>
    </div>
  );
}

function DashboardUserSkeleton() {
  return (
    <div className="dv dd-page" aria-busy="true" aria-label="Memuat dashboard">
      {/* Header: tanggal + sapaan + kalimat, banner di kanan */}
      <header className="dd-hero has-banner">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3.5 w-44 rounded" />
          <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
          <div className="space-y-2 pt-1">
            <Skeleton className="h-3.5 w-full max-w-[540px] rounded" />
            <Skeleton className="h-3.5 w-2/3 max-w-[360px] rounded" />
          </div>
        </div>
        <Skeleton className="w-full rounded-[22px]" style={{ minHeight: 176 }} />
      </header>

      {/* Dua kolom: di tanganmu + riwayat | ringkasan */}
      <div className="dd-row2 dd-row2-user">
        <div className="flex flex-col gap-5 min-w-0">
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-32" />
            <BarisSkeleton jumlah={2} />
          </section>
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-36" tautan={false} />
            <BarisSkeleton jumlah={4} />
          </section>
        </div>
        <section className="dd-card">
          <KepalaKartu lebarJudul="w-24" tautan={false} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dd-stat">
              <Skeleton className="h-3.5 w-36 rounded" />
              <Skeleton className="h-8 w-10 rounded" />
            </div>
          ))}
        </section>
      </div>

      {/* Kalender + notifikasi */}
      <div className="dd-split">
        <section className="dd-card dd-calcard">
          <KepalaKartu lebarJudul="w-40" tautan={false} />
          <KalenderSkeleton besar />
        </section>
        <div className="dd-aside">
          <section className="dd-card">
            <KepalaKartu lebarJudul="w-28" tautan={false} />
            <BarisSkeleton jumlah={4} kanan={false} />
          </section>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ variant = 'simple' }: { variant?: 'simple' | 'full' }) {
  return variant === 'full' ? <DashboardAdminSkeleton /> : <DashboardUserSkeleton />;
}
