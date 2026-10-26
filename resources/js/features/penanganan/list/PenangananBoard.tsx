import { useState } from 'react';
import type { InventoryPenanganan, PenangananTab } from '../types';
import PenangananBoardCard from './PenangananBoardCard';

const KOLOM: { key: PenangananTab; judul: string; sub: string; kosong: string }[] = [
  { key: 'menunggu', judul: 'Menunggu review', sub: 'belum diterima', kosong: 'Tidak ada laporan yang menunggu.' },
  { key: 'diperbaiki', judul: 'Sedang dikerjakan', sub: 'di tangan teknisi', kosong: 'Belum ada laporan di tahap ini.' },
  { key: 'diperbaiki_selesai', judul: 'Selesai diperbaiki', sub: 'sudah selesai', kosong: 'Belum ada laporan yang selesai.' },
  { key: 'rusak_berat', judul: 'Rusak berat', sub: 'tidak bisa diperbaiki', kosong: 'Tidak ada. Semua laporan bisa diperbaiki.' },
];

interface Props {
  board: Record<PenangananTab, { total: number; data: InventoryPenanganan[] }>;
  isAdmin: boolean;
  loading: boolean;
  onDetail: (p: InventoryPenanganan) => void;
  onTerima: (p: InventoryPenanganan) => void;
  onSelesaikan: (p: InventoryPenanganan) => void;
  onPrint: (p: InventoryPenanganan) => void;
  onLihatSemua: (kolom: PenangananTab) => void;
}

export default function PenangananBoard({ board, isAdmin, loading, onDetail, onTerima, onSelesaikan, onPrint, onLihatSemua }: Props) {
  const [dropAktif, setDropAktif] = useState(false);

  // Seret kartu dari "Menunggu" ke "Sedang dikerjakan" = buka konfirmasi Terima (modal yang sama dengan tombolnya).
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropAktif(false);
    const id = Number(e.dataTransfer.getData('text/penanganan-id'));
    const p = board.menunggu.data.find((x) => x.id === id);
    if (p) onTerima(p);
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {KOLOM.map((k) => {
        const { total, data } = board[k.key];
        const sisa = total - data.length;
        const dropzone = isAdmin && k.key === 'diperbaiki';

        return (
          <section
            key={k.key}
            className="space-y-2 min-w-0"
            onDragOver={dropzone ? (e) => { e.preventDefault(); setDropAktif(true); } : undefined}
            onDragLeave={dropzone ? () => setDropAktif(false) : undefined}
            onDrop={dropzone ? handleDrop : undefined}
          >
            <div className="flex items-baseline gap-2 pb-2 border-b-2 border-slate-900">
              <span className="text-3xl font-bold leading-none text-slate-900">{total}</span>
              <h3 className="text-sm font-bold text-slate-900">{k.judul}</h3>
              <span className="ml-auto text-xs text-slate-500">{k.sub}</span>
            </div>

            {data.length === 0 && (
              <div className="border border-dashed border-slate-300 rounded-md p-4 text-center text-xs text-slate-500">{k.kosong}</div>
            )}

            {data.map((p) => (
              <PenangananBoardCard
                key={p.id}
                p={p}
                status={k.key}
                isAdmin={isAdmin}
                onDetail={onDetail}
                onTerima={onTerima}
                onSelesaikan={onSelesaikan}
                onPrint={onPrint}
              />
            ))}

            {dropzone && (
              <div
                className={`border border-dashed rounded-md p-3 text-center text-xs ${dropAktif ? 'border-[#0b3a9a] bg-blue-50 text-[#0b3a9a]' : 'border-slate-300 text-slate-500'}`}
              >
                Seret laporan ke sini untuk menerima, atau pakai tombol Terima.
              </div>
            )}

            {sisa > 0 && (
              <button type="button" onClick={() => onLihatSemua(k.key)} className="text-xs font-semibold text-[#0b3a9a] underline">
                Lihat {sisa} laporan lainnya
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
