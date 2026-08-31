import Skeleton from './Skeleton';

// Baris skeleton buat tabel data (Inventory, Karyawan, Cabang, Kategori,
// Audit Log, dst). Dipakai selagi loading, gantiin teks "Memuat data..."
// yang lama supaya bentuknya udah mirip tabel aslinya dari awal.
//
// `columns` nentuin berapa <td> yang dibikin per baris -- samain sama
// jumlah kolom tabel asli (termasuk kolom Aksi) biar gak "loncat" pas
// data beneran datang. `widths` opsional buat ngatur lebar tiap kolom
// (misal kolom pertama/Kode biasanya lebih pendek dari kolom Nama).

interface SkeletonTableRowProps {
  columns: number;
  widths?: string[];
}

export default function SkeletonTableRow({ columns, widths }: SkeletonTableRowProps) {
  return (
    <tr className="border-b border-slate-50 last:border-0">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-3">
          <Skeleton className="h-4 rounded" style={{ width: widths?.[i] ?? '70%' }} />
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

// Sekumpulan baris sekaligus -- cukup panggil ini di dalam <tbody> pas
// loading, gak perlu manual map satu-satu tiap halaman.
export function SkeletonTable({ columns, rows = 5, widths }: SkeletonTableProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} widths={widths} />
      ))}
    </>
  );
}

// Versi mobile: card list (bukan <tr>), buat halaman yang punya layout
// kartu terpisah di layar sempit (mis. TabInventory sm:hidden).
export function SkeletonListCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 rounded w-1/2" />
            <Skeleton className="h-3 rounded w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}