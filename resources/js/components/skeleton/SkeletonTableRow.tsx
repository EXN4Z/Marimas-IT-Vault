import Skeleton from './Skeleton';
import { pnCard, pnTable } from '../ui/pn';

// Baris skeleton buat tabel data gaya baru (pnTable di dalam pnCard, lihat components/ui/pn.ts). Padding sel & garis pemisah
// datang dari pnTable itu sendiri, jadi tinggi baris skeleton sama dengan baris asli dan tidak "loncat".
//
// `columns` nentuin berapa <td> yang dibikin per baris -- samain sama jumlah kolom tabel asli
// (termasuk kolom Aksi). `widths` opsional buat ngatur lebar tiap kolom.

interface SkeletonTableRowProps {
  columns: number;
  widths?: string[];
}

function SkeletonTableRow({ columns, widths }: SkeletonTableRowProps) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <Skeleton className="h-3.5 rounded" style={{ width: widths?.[i] ?? '70%' }} />
        </td>
      ))}
    </tr>
  );
}

interface SkeletonTableProps {
  columns: number;
  rows?: number;
  widths?: string[];
}

// Sekumpulan baris sekaligus -- cukup panggil ini di dalam <tbody> pas loading.
export function SkeletonTable({ columns, rows = 5, widths }: SkeletonTableProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} widths={widths} />
      ))}
    </>
  );
}

// Tabel lengkap (kepala + isi) dalam kartu pnCard, buat halaman yang seluruh tabelnya belum ada.
export function SkeletonTableCard({ headers, rows = 5 }: { headers: string[]; rows?: number }) {
  return (
    <div className={pnCard} aria-busy="true">
      <div className="overflow-x-auto">
        <table className={pnTable}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonTable columns={headers.length} rows={rows} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Versi mobile: card list (bukan <tr>), meniru baris card di InventoryTable / tabel Penanganan (kode + nama + pill status).
export function SkeletonListCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="py-3 flex items-center justify-between gap-3" style={i > 0 ? { borderTop: '1px solid var(--dv-line, #E8E5F2)' } : undefined}>
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 rounded w-1/3" />
            <Skeleton className="h-3 rounded w-1/2" />
            <Skeleton className="h-5 rounded-full w-24" />
          </div>
          <Skeleton className="h-4 w-4 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}
