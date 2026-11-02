import { X } from 'lucide-react';
import { Skeleton } from '../../../components/skeleton';
import { useAuth } from '../../../context/AuthContext';
import type { Inventory } from '../types/inventory';
import type { InventoryPemakai } from '../types/inventoryPemakai';
import type { InventoryPenanganan } from '../../penanganan/types';
import InventoryStatusPill from '../list/InventoryStatusPill';
import { formatTanggalId } from '../inventoryHelpers';
import InventoryDetailHero from './InventoryDetailHero';
import InventoryDetailAksi from './InventoryDetailAksi';
import InventoryRiwayatPemakai from './InventoryRiwayatPemakai';
import InventoryRiwayatPerbaikan from './InventoryRiwayatPerbaikan';
import InventoryRelasiRow from './InventoryRelasiRow';
import { SectionHead } from './detailUi';

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeDetail();
      }}
    >
      <div className="dv dv-modal w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-3.5 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--dv-line)' }}>
          <div className="min-w-0">
            <p className="dv-label !tracking-[.06em]">
              {detail?.kode_inventory || '-'}
              {detail?.kategori?.nama ? ` · ${detail.kategori.nama}` : ''}
            </p>
            <h3 className="dv-g text-xl leading-[1.1] font-bold mt-0.5 mb-1.5 truncate">
              {detail?.nama || detail?.kode_inventory || 'Detail Inventory'}
            </h3>
            {detail?.status && <InventoryStatusPill status={detail.status} />}
          </div>
          <button
            type="button"
            onClick={closeDetail}
            aria-label="Tutup"
            className="dv-btn !w-9 !px-0 inline-grid place-items-center shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-3.5 overflow-y-auto space-y-3.5">
          {detailLoading && (
            // Skeleton meniru isi modal: foto + 4 baris spesifikasi, tombol aksi, lalu bagian "Pengadaan & lokasi" & riwayat.
            <div className="space-y-3.5" aria-busy="true" aria-label="Memuat detail inventory">
              <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
                <Skeleton className="w-24 h-24 rounded-md" />
                <div className="min-w-0 [&>.dv-row:first-child]:border-t-0 [&>.dv-row:first-child]:pt-0">
                  {[['w-20', 'w-28'], ['w-24', 'w-36'], ['w-20', 'w-24'], ['w-28', 'w-20']].map(([l, r], i) => (
                    <div key={i} className="dv-row !items-center">
                      <Skeleton className={`h-3 rounded ${l}`} />
                      <Skeleton className={`h-3.5 rounded ${r}`} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Skeleton className="h-9 w-32 rounded-md" />
                <Skeleton className="h-9 w-36 rounded-md" />
              </div>

              <div>
                <Skeleton className="h-3 w-32 rounded mb-2.5" />
                <div className="grid md:grid-cols-2 md:gap-x-8 [&>.dv-row:first-child]:border-t-0 md:[&>.dv-row:nth-child(2)]:border-t-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="dv-row !items-center">
                      <Skeleton className="h-3 w-24 rounded" />
                      <Skeleton className="h-3.5 w-28 rounded" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Skeleton className="h-3 w-28 rounded mb-2.5" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="dv-row !items-center">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-2/5 rounded" />
                      <Skeleton className="h-2.5 w-1/4 rounded" />
                    </div>
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!detailLoading && detail && (
            <>
              {/* Ringkasan + blok sedang dipinjam */}
              <InventoryDetailHero detail={detail} />

              {/* Aksi */}
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

              <div className="space-y-4 min-w-0">
              <div className="space-y-4 min-w-0">
              {/* Pengadaan & lokasi */}
              <div>
                <SectionHead title="Pengadaan & lokasi" />
                <div className="grid md:grid-cols-2 md:gap-x-8 [&>.dv-row:first-child]:border-t-0 md:[&>.dv-row:nth-child(2)]:border-t-0">
                  <div className="dv-row">
                    <span>Perusahaan</span>
                    <b className="text-right">{detail.perusahaan?.nama || '-'}</b>
                  </div>
                  <div className="dv-row">
                    <span>Supplier</span>
                    <b className="text-right">{detail.supplier?.nama || '-'}</b>
                  </div>
                  <div className="dv-row">
                    <span>Surat Jalan / GR</span>
                    <b className="dv-g text-right">
                      {detail.no_surat_jalan || '-'} / {detail.no_good_receive || '-'}
                    </b>
                  </div>
                  <div className="dv-row">
                    <span>Tanggal pembelian</span>
                    <b className="dv-g text-right">{formatTanggalId(detail.tanggal_invoice)}</b>
                  </div>
                  <div className="dv-row">
                    <span>Tanggal input</span>
                    <b className="dv-g text-right">{formatTanggalId(detail.tanggal_input)}</b>
                  </div>
                  {detail.keterangan && (
                    <div className="dv-row">
                      <span>Catatan</span>
                      <b className="text-right font-medium">{detail.keterangan}</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Terpasang pada induk: item ini menempel ke induk (bentuk baris sama dengan "Kelengkapan terpasang") */}
              {detail.parent_id && detail.parent && (
                <div>
                  <SectionHead title="Terpasang pada induk" meta="1 induk" />
                  <InventoryRelasiRow item={detail.parent} onDetail={openDetail} onLepas={isAdmin ? () => setLepasTarget(detail) : undefined} />
                </div>
              )}

              {/* Kelengkapan terpasang: item lain yang menempel ke item ini */}
              {detail.children && detail.children.length > 0 && (
                <div>
                  <SectionHead title="Kelengkapan terpasang" meta={`${detail.children.length} item`} />
                  {detail.children.map((k: Inventory) => (
                    <InventoryRelasiRow key={k.id} item={k} onDetail={openDetail} onLepas={isAdmin ? () => setLepasTarget(k) : undefined} />
                  ))}
                </div>
              )}

              </div>

              <div className="space-y-4 min-w-0">
              {/* Riwayat pemakai / peminjaman */}
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
                <p className="text-xs dv-alert rounded-md px-3 py-2" style={{ border: '1px solid var(--dv-alert)' }}>
                  {historyActionError}
                </p>
              )}

              {/* Riwayat perbaikan / penanganan */}
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
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-5 py-2 shrink-0"
          style={{ borderTop: '1px solid var(--dv-line)', background: 'var(--dv-surface)' }}
        >
          <button type="button" onClick={closeDetail} className="dv-btn">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
