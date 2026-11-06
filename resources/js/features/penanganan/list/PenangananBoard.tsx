import { useState } from 'react';
import type { InventoryPenanganan, PenangananTab } from '../types';
import PenangananBoardCard from './PenangananBoardCard';

const KOLOM: { key: PenangananTab; judul: string; sub: string; kosong: string; warna: string }[] = [
  { key: 'menunggu', judul: 'Menunggu review', sub: 'belum diterima', kosong: 'Tidak ada laporan yang menunggu.', warna: 'var(--dd-yellow)' },
  { key: 'diperbaiki', judul: 'Sedang dikerjakan', sub: 'di tangan teknisi', kosong: 'Belum ada laporan di tahap ini.', warna: 'var(--dv-primary)' },
  { key: 'diperbaiki_selesai', judul: 'Selesai diperbaiki', sub: 'sudah selesai', kosong: 'Belum ada laporan yang selesai.', warna: 'var(--dd-green)' },
  { key: 'rusak_berat', judul: 'Rusak berat', sub: 'tidak bisa diperbaiki', kosong: 'Tidak ada. Semua laporan bisa diperbaiki.', warna: 'var(--dv-alert)' },
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
    <div className={`grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {KOLOM.map((k) => {
        const { total, data } = board[k.key];
        const sisa = total - data.length;
        const dropzone = isAdmin && k.key === 'diperbaiki';

        return (
          <section
            key={k.key}
            className="flex min-w-0 flex-col gap-2"
            onDragOver={dropzone ? (e) => { e.preventDefault(); setDropAktif(true); } : undefined}
            onDragLeave={dropzone ? () => setDropAktif(false) : undefined}
            onDrop={dropzone ? handleDrop : undefined}
          >
            <div className="flex items-baseline gap-2 border-b-2 border-b-(--c) pb-2.5" style={{ ['--c' as string]: k.warna }}>
              <span className="text-[28px] leading-none font-bold text-dv-ink">{total}</span>
              <h3 className="text-[13px] font-bold text-dv-ink">{k.judul}</h3>
              <span className="ml-auto text-[11px] text-dv-muted">{k.sub}</span>
            </div>

            {data.length === 0 && <div className="rounded-[14px] border border-dashed border-dv-line p-3 text-center text-[12px] text-dv-muted [&.is-on]:border-dv-muted [&.is-on]:bg-dv-surface [&.is-on]:text-dv-ink">{k.kosong}</div>}

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
              <div className={`rounded-[14px] border border-dashed border-dv-line p-3 text-center text-[12px] text-dv-muted [&.is-on]:border-dv-muted [&.is-on]:bg-dv-surface [&.is-on]:text-dv-ink ${dropAktif ? 'is-on' : ''}`}>Seret laporan ke sini untuk menerima, atau pakai tombol Terima.</div>
            )}

            {sisa > 0 && (
              <button type="button" onClick={() => onLihatSemua(k.key)} className="text-left text-[12px] font-bold text-dv-ink hover:underline">
                Lihat {sisa} laporan lainnya
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
