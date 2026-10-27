import { X, Eye, Unlink } from 'lucide-react';
import { Skeleton } from '../../../components/skeleton';
import { useAuth } from '../../../context/AuthContext';
import type { Inventory } from '../types/inventory';
import type { InventoryPemakai } from '../types/inventoryPemakai';
import type { InventoryPenanganan } from '../../penanganan/types';
import { STATUS_LABEL, STATUS_BAR_CLASS } from '../list/helpers';
import InventoryStatusPill from '../list/InventoryStatusPill';
import { formatTanggalId } from '../inventoryHelpers';
import InventoryDetailHero from './InventoryDetailHero';
import InventoryDetailAksi from './InventoryDetailAksi';
import InventoryRiwayatPemakai from './InventoryRiwayatPemakai';
import InventoryRiwayatPerbaikan from './InventoryRiwayatPerbaikan';
import { SectionHead, StatusDot } from './detailUi';

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
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
            <div className="flex flex-col gap-4 py-2">
              <div className="flex gap-6">
                <Skeleton className="w-24 h-24 rounded-md flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-3 pt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
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

              {/* Kelengkapan terpasang */}
              {detail.children && detail.children.length > 0 && (
                <div>
                  <SectionHead title="Kelengkapan terpasang" meta={`${detail.children.length} item`} />
                  {detail.children.map((k: Inventory) => (
                    <div key={k.id} className="dv-row !items-center">
                      <span className="min-w-0 truncate">
                        <b>{k.nama || k.kode_inventory}</b>
                        <span className="dv-muted">
                          {' '}· {k.kode_inventory}
                          {k.serial_number ? ` · S/N ${k.serial_number}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="inline-flex items-center text-xs mr-2">
                          <StatusDot className={STATUS_BAR_CLASS[k.status]} />
                          {STATUS_LABEL[k.status] || k.status}
                        </span>
                        <button type="button" onClick={() => openDetail(k.id)} title="Lihat detail" aria-label="Lihat detail" className="dv-icon-btn">
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <button type="button" onClick={() => setLepasTarget(k)} title="Lepas dari induk" aria-label="Lepas dari induk" className="dv-icon-btn is-alert">
                            <Unlink size={14} />
                          </button>
                        )}
                      </span>
                    </div>
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
