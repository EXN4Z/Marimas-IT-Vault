import { Boxes, X, Eye, Unlink } from 'lucide-react';
import StatusBadge from '../../../shared/StatusBadge';
import { Skeleton } from '../../../shared/skeleton';
import { useAuth } from '../../../../context/AuthContext';
import type { Inventory } from '../../../../api/masterData/inventory';
import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';
import type { InventoryPenanganan } from '../../../../api/transaksi/inventoryPenanganan';
import { STATUS_STYLE, STATUS_LABEL, formatTanggalId } from './helpers';
import InventoryDetailHero from './InventoryDetailHero';
import InventoryDetailAksi from './InventoryDetailAksi';
import InventoryRiwayatPemakai from './InventoryRiwayatPemakai';
import InventoryRiwayatPerbaikan from './InventoryRiwayatPerbaikan';

interface InventoryDetailModalProps {
  closeDetail: () => void;
  detail: Inventory | null;
  detailLoading: boolean;
  isAdmin: boolean;
  setSerahTerimaInventory: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setPengembalianTarget: React.Dispatch<React.SetStateAction<{ inventory: Inventory; pemakai: InventoryPemakai } | null>>;
  setPerbaikanInventoryTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setPasangIndukTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  openJual: (a: Inventory) => void;
  user: ReturnType<typeof useAuth>['user'];
  openDetail: (id: number) => void | Promise<void>;
  setLepasTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  pemakaiPage: number;
  expandedPemakaiId: number | null;
  handleDeletePemakai: (id: number) => void | Promise<void>;
  deletingPemakaiId: number | null;
  setExpandedPemakaiId: React.Dispatch<React.SetStateAction<number | null>>;
  setPemakaiPage: React.Dispatch<React.SetStateAction<number>>;
  historyActionError: string;
  penangananPage: number;
  expandedPenangananId: number | null;
  handleTerimaPenanganan: (id: number) => void | Promise<void>;
  terimaLoadingId: number | null;
  setPenangananSelesaiTarget: React.Dispatch<React.SetStateAction<{ inventory: Inventory; penanganan: InventoryPenanganan } | null>>;
  handleDeletePenanganan: (id: number) => void | Promise<void>;
  setExpandedPenangananId: React.Dispatch<React.SetStateAction<number | null>>;
  setPenangananPage: React.Dispatch<React.SetStateAction<number>>;
}

export default function InventoryDetailModal({ closeDetail, detail, detailLoading, isAdmin, setSerahTerimaInventory, setPengembalianTarget, setPerbaikanInventoryTarget, setPasangIndukTarget, openJual, user, openDetail, setLepasTarget, pemakaiPage, expandedPemakaiId, handleDeletePemakai, deletingPemakaiId, setExpandedPemakaiId, setPemakaiPage, historyActionError, penangananPage, expandedPenangananId, handleTerimaPenanganan, terimaLoadingId, setPenangananSelesaiTarget, handleDeletePenanganan, setExpandedPenangananId, setPenangananPage }: InventoryDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeDetail();
      }}
    >
      <div className="bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-zinc-800 w-full max-w-3xl max-h-[92vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white dark:bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <Boxes size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 leading-tight truncate">
                  {detail?.nama || detail?.kode_inventory || 'Detail Inventory'}
                </h3>
                {detail?.status && (
                  <StatusBadge colorClass={STATUS_STYLE[detail.status]}>
                    {STATUS_LABEL[detail.status]}
                  </StatusBadge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
                <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-[11px]">
                  {detail?.kode_inventory || '-'}
                </span>
                {detail?.kategori?.nama && (
                  <>
                    <span className="text-slate-300 dark:text-zinc-600">·</span>
                    <span className="text-slate-600 dark:text-zinc-400">{detail.kategori.nama}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDetail}
            aria-label="Tutup"
            className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6">
        {detailLoading && (
          <div className="flex flex-col gap-5 py-4">
            <div className="flex gap-4">
              <Skeleton className="w-28 h-28 rounded-xl flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!detailLoading && detail && (
          <div className="space-y-6">
            {/* TOP HERO & SPECS */}
            <InventoryDetailHero detail={detail} />

            {/* AKSI CEPAT / QUICK ACTIONS */}
            <InventoryDetailAksi
              isAdmin={isAdmin}
              detail={detail}
              setSerahTerimaInventory={setSerahTerimaInventory}
              setPengembalianTarget={setPengembalianTarget}
              setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
              setPasangIndukTarget={setPasangIndukTarget}
              openJual={openJual}
              user={user}
            />

            {/* DETAIL SPESIFIKASI & PENGADAAN */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2.5">
                Informasi Pengadaan & Lokasi
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Perusahaan Pemilik</p>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 mt-1">{detail.perusahaan?.nama || '-'}</p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Supplier / Vendor</p>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 mt-1">{detail.supplier?.nama || '-'}</p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">No. Surat Jalan / GR</p>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 mt-1">
                    {detail.no_surat_jalan || '-'} / {detail.no_good_receive || '-'}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Tanggal Pembelian</p>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 mt-1">{formatTanggalId(detail.tanggal_invoice)}</p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Tanggal Input Sistem</p>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 mt-1">{formatTanggalId(detail.tanggal_input)}</p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Garansi Berakhir</p>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 mt-1">{formatTanggalId(detail.tanggal_garansi)}</p>
                </div>
              </div>

              {detail.keterangan && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 text-xs">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase mb-1">Catatan Tambahan</p>
                  <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">{detail.keterangan}</p>
                </div>
              )}
            </div>

            {/* KELENGKAPAN / CHILDREN */}
            {detail.children && detail.children.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2.5">
                  Kelengkapan Terpasang ({detail.children.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detail.children.map((k: Inventory) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-slate-900 dark:text-zinc-100 font-semibold truncate">
                          {k.nama || k.kode_inventory}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate font-mono mt-0.5">
                          {k.kode_inventory} {k.serial_number ? `· S/N: ${k.serial_number}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge colorClass={STATUS_STYLE[k.status] || 'bg-slate-100 text-slate-600'}>
                          {STATUS_LABEL[k.status] || k.status}
                        </StatusBadge>
                        <button
                          type="button"
                          onClick={() => openDetail(k.id)}
                          title="Lihat Detail"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                        >
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setLepasTarget(k)}
                            title="Lepas dari Induk"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                          >
                            <Unlink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RIWAYAT PEMAKAI / PEMINJAMAN */}
            <InventoryRiwayatPemakai
              detail={detail}
              pemakaiPage={pemakaiPage}
              expandedPemakaiId={expandedPemakaiId}
              isAdmin={isAdmin}
              handleDeletePemakai={handleDeletePemakai}
              deletingPemakaiId={deletingPemakaiId}
              setExpandedPemakaiId={setExpandedPemakaiId}
              setPemakaiPage={setPemakaiPage}
            />

            {historyActionError && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 rounded-xl px-3 py-2">
                {historyActionError}
              </p>
            )}

            {/* RIWAYAT PERBAIKAN / PENANGANAN */}
            <InventoryRiwayatPerbaikan
              detail={detail}
              penangananPage={penangananPage}
              expandedPenangananId={expandedPenangananId}
              isAdmin={isAdmin}
              handleTerimaPenanganan={handleTerimaPenanganan}
              terimaLoadingId={terimaLoadingId}
              setPenangananSelesaiTarget={setPenangananSelesaiTarget}
              handleDeletePenanganan={handleDeletePenanganan}
              setExpandedPenangananId={setExpandedPenangananId}
              setPenangananPage={setPenangananPage}
            />
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 dark:border-zinc-800 shrink-0 bg-slate-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={closeDetail}
            className="text-xs font-semibold px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
