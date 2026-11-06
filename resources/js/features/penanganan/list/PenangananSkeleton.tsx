import { Skeleton, SkeletonListCard } from '../../../components/skeleton';
import { pnCard, pnTable } from '../../../components/ui/pn';

// Skeleton halaman Penanganan, meniru layout baru (utilitas yang sama dengan PenangananPage):
// judul + deskripsi -> pil peringatan -> tab status -> filter -> teks total -> kartu tabel (desktop) / daftar card (mobile).
// Halaman ini sekarang selalu tampil sebagai tabel (papan dihapus), jadi tidak ada skeleton kolom papan / KPI card lagi.
const JUMLAH_KOLOM = 6;

export default function PenangananSkeleton() {
  return (
    <div className="pn space-y-6" aria-busy="true" aria-label="Memuat penanganan inventory">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-60 max-w-full rounded-lg" />
          <Skeleton className="h-3.5 w-full max-w-[560px] rounded" />
          <Skeleton className="h-3.5 w-2/3 max-w-[380px] rounded" />
        </div>
      </div>

      {/* Pil peringatan terlambat */}
      <Skeleton className="h-7 w-64 max-w-full rounded-full" />

      {/* Tab status */}
      <div className="flex gap-2.5 overflow-hidden">
        {[132, 148, 156, 118].map((w, i) => (
          <Skeleton key={i} className="h-10 rounded-full shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Filter: search + jenis kerusakan */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Skeleton className="h-[42px] flex-1 rounded-lg" />
        <Skeleton className="h-[42px] w-full sm:w-56 rounded-lg shrink-0" />
      </div>

      {/* Teks total */}
      <Skeleton className="h-3 w-40 rounded" />

      {/* Kartu tabel */}
      <div className="space-y-4">
        <div className={pnCard}>
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className={pnTable}>
              <thead>
                <tr>
                  {Array.from({ length: JUMLAH_KOLOM }).map((_, i) => (
                    <th key={i} className={i === JUMLAH_KOLOM - 1 ? 'text-right' : undefined}>
                      <Skeleton className="h-2.5 w-14 rounded inline-block align-middle" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r}>
                    {/* Kolom pertama: lingkaran ikon + kode + jenis (pola ikon + kode + jenis di PenangananTabel) */}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="w-[34px] h-[34px] rounded-full shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-24 rounded" />
                          <Skeleton className="h-2.5 w-16 rounded" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: JUMLAH_KOLOM - 2 }).map((_, c) => (
                      <td key={c}>
                        <Skeleton className="h-3.5 rounded" style={{ width: c === 1 ? '85%' : '60%' }} />
                      </td>
                    ))}
                    <td>
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Skeleton className="h-[30px] w-20 rounded-full" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden">
            <SkeletonListCard rows={5} />
          </div>
        </div>
      </div>
    </div>
  );
}
