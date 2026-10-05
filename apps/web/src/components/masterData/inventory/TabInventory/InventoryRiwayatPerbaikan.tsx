import { Trash2, CheckCircle2, PlayCircle, Printer, Eye, ChevronDown } from 'lucide-react';
import Pagination from '../../../shared/Pagination';
import StatusBadge from '../../../shared/StatusBadge';
import { namaPelaporPenanganan, formatJenisKerusakan, formatDurasi } from '../../../../utils/inventoryHelpers';
import type { Inventory } from '../../../../api/masterData/inventory';
import type { InventoryPenanganan } from '../../../../api/transaksi/inventoryPenanganan';
import { RIWAYAT_PERBAIKAN_PER_PAGE, formatTanggalId, formatRupiah } from './helpers';
import { handlePrintPenanganan } from './printHelpers';

interface InventoryRiwayatPerbaikanProps {
  detail: Inventory;
  penangananPage: number;
  expandedPenangananId: number | null;
  isAdmin: boolean;
  handleTerimaPenanganan: (id: number) => void | Promise<void>;
  terimaLoadingId: number | null;
  setPenangananSelesaiTarget: React.Dispatch<React.SetStateAction<{ inventory: Inventory; penanganan: InventoryPenanganan } | null>>;
  handleDeletePenanganan: (id: number) => void | Promise<void>;
  setExpandedPenangananId: React.Dispatch<React.SetStateAction<number | null>>;
  setPenangananPage: React.Dispatch<React.SetStateAction<number>>;
}

export default function InventoryRiwayatPerbaikan({ detail, penangananPage, expandedPenangananId, isAdmin, handleTerimaPenanganan, terimaLoadingId, setPenangananSelesaiTarget, handleDeletePenanganan, setExpandedPenangananId, setPenangananPage }: InventoryRiwayatPerbaikanProps) {
  return (
    <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Riwayat Perbaikan & Kerusakan
        </h4>
      </div>
      {(() => {
        const semuaPenanganan = detail.penanganan || [];
        const totalPenangananPage = Math.max(1, Math.ceil(semuaPenanganan.length / RIWAYAT_PERBAIKAN_PER_PAGE));
        const halamanPenanganan = semuaPenanganan.slice(
          (penangananPage - 1) * RIWAYAT_PERBAIKAN_PER_PAGE,
          penangananPage * RIWAYAT_PERBAIKAN_PER_PAGE
        );
        return (
          <>
            <ul className="flex flex-col gap-2">
              {halamanPenanganan.map((p) => {
                const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
                const selesai = !!p.tanggal_selesai;
                const diterima = !!p.tanggal_diterima;
                const statusLabel = selesai ? 'Selesai' : diterima ? 'Sedang Diperbaiki' : 'Menunggu Diterima';
                const statusStyle = selesai
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : diterima
                  ? 'bg-orange-50 dark:bg-amber-950/40 text-orange-700 dark:text-amber-300'
                  : 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300';
                const namaPelapor = namaPelaporPenanganan(p);
                const expanded = expandedPenangananId === p.id;
                return (
                  <li key={p.id} className="text-xs bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <StatusBadge colorClass={statusStyle} size="xs" className="mb-1">
                          {statusLabel}
                        </StatusBadge>{' '}
                        <span className="font-semibold text-slate-900 dark:text-zinc-100">{p.keluhan}</span>{' '}
                        <span className="text-slate-500 dark:text-zinc-400">— {formatTanggalId(p.tanggal_lapor)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isAdmin && !selesai && !diterima && (
                          <button
                            type="button"
                            onClick={() => handleTerimaPenanganan(p.id)}
                            disabled={terimaLoadingId === p.id}
                            title="Terima & mulai tangani laporan ini"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition disabled:opacity-50"
                          >
                            <PlayCircle size={14} />
                          </button>
                        )}
                        {isAdmin && !selesai && diterima && (
                          <button
                            type="button"
                            onClick={() => setPenangananSelesaiTarget({ inventory: detail, penanganan: p })}
                            title="Tandai selesai"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {isAdmin && p.no_struk && (
                          <button
                            type="button"
                            onClick={() => handlePrintPenanganan(detail, p)}
                            title="Cetak struk"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 transition"
                          >
                            <Printer size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeletePenanganan(p.id)}
                            title="Hapus"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedPenangananId(expanded ? null : p.id)}
                          title={expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 transition"
                        >
                          {expanded ? <ChevronDown size={14} className="rotate-180 transition-transform" /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                        <StatusBadge colorClass="bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400" size="xs" className="mb-1 w-fit">
                          {formatJenisKerusakan(p.jenis_kerusakan)}
                        </StatusBadge>
                        {p.hasil && <p>Hasil: <span className="font-semibold text-slate-700 dark:text-zinc-300">{p.hasil}</span></p>}
                        <p>
                          Pelapor: <span className="font-semibold text-slate-700 dark:text-zinc-300">{namaPelapor}</span>
                        </p>
                        <p>Lapor: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatTanggalId(p.tanggal_lapor)}</span></p>
                        {p.tanggal_diterima && (
                          <p>Diterima: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatTanggalId(p.tanggal_diterima)}</span></p>
                        )}
                        {p.tanggal_selesai && (
                          <p>Selesai: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatTanggalId(p.tanggal_selesai)}</span></p>
                        )}
                        {p.durasi_detik != null && (
                          <p>Durasi: <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatDurasi(p.durasi_detik)}</span></p>
                        )}
                        {(p.harga_jasa != null || p.biaya_komponen != null) && (
                          <p>
                            Biaya: Komponen {formatRupiah(p.biaya_komponen)} + Jasa {formatRupiah(p.harga_jasa)} = <span className="font-bold text-slate-800 dark:text-zinc-200">{formatRupiah(totalBiaya)}</span>
                          </p>
                        )}
                        {p.no_struk && <p>Struk: {p.no_struk}</p>}
                        {p.catatan && <p>Catatan: {p.catatan}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
              {!semuaPenanganan.length && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-2">Belum ada riwayat perbaikan.</p>
              )}
            </ul>

            {semuaPenanganan.length > RIWAYAT_PERBAIKAN_PER_PAGE && (
              <Pagination
                currentPage={penangananPage}
                totalPages={totalPenangananPage}
                onPageChange={(page) => {
                  setPenangananPage(page);
                  setExpandedPenangananId(null);
                }}
                totalItems={semuaPenanganan.length}
                itemLabel="riwayat"
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
