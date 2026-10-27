import { Trash2, CheckCircle2, PlayCircle, Printer, Eye, ChevronDown } from 'lucide-react';
import Pagination from '../../../components/table/Pagination';
import { namaPelaporPenanganan, formatJenisKerusakan, formatDurasi, formatTanggalId, formatRupiah } from '../inventoryHelpers';
import type { Inventory } from '../types/inventory';
import type { InventoryPenanganan } from '../../penanganan/types';
import { handlePrintPenanganan } from '../print/printHelpers';
import { STATUS_BAR_CLASS } from '../list/helpers';
import { SectionHead, StatusDot } from './detailUi';

const RIWAYAT_PERBAIKAN_PER_PAGE = 3;

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
    <div>
      <SectionHead title="Riwayat perbaikan & kerusakan" meta={(detail.penanganan?.length ?? 0) > 0 ? `${detail.penanganan!.length} catatan` : undefined} />
      {(() => {
        const semuaPenanganan = detail.penanganan || [];
        const totalPenangananPage = Math.max(1, Math.ceil(semuaPenanganan.length / RIWAYAT_PERBAIKAN_PER_PAGE));
        const halamanPenanganan = semuaPenanganan.slice(
          (penangananPage - 1) * RIWAYAT_PERBAIKAN_PER_PAGE,
          penangananPage * RIWAYAT_PERBAIKAN_PER_PAGE
        );
        return (
          <>
            <ul>
              {halamanPenanganan.map((p) => {
                const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
                const selesai = !!p.tanggal_selesai;
                const diterima = !!p.tanggal_diterima;
                const statusLabel = selesai ? 'Selesai' : diterima ? 'Sedang Diperbaiki' : 'Menunggu Diterima';
                const statusDot = selesai ? STATUS_BAR_CLASS.tersedia : diterima ? STATUS_BAR_CLASS.diperbaiki : STATUS_BAR_CLASS.menunggu_perbaikan;
                const namaPelapor = namaPelaporPenanganan(p);
                const expanded = expandedPenangananId === p.id;
                return (
                  <li key={p.id} className="dv-item">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b>{p.keluhan}</b>{' '}
                        <span className="dv-muted dv-g">— {formatTanggalId(p.tanggal_lapor)}</span>
                        <span className="mt-0.5 flex items-center text-xs dv-soft">
                          <StatusDot className={statusDot} />
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isAdmin && !selesai && !diterima && (
                          <button
                            type="button"
                            onClick={() => handleTerimaPenanganan(p.id)}
                            disabled={terimaLoadingId === p.id}
                            title="Terima & mulai tangani laporan ini"
                            className="dv-icon-btn is-primary disabled:opacity-50"
                          >
                            <PlayCircle size={14} />
                          </button>
                        )}
                        {isAdmin && !selesai && diterima && (
                          <button
                            type="button"
                            onClick={() => setPenangananSelesaiTarget({ inventory: detail, penanganan: p })}
                            title="Tandai selesai"
                            className="dv-icon-btn is-primary"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {isAdmin && p.no_struk && (
                          <button
                            type="button"
                            onClick={() => handlePrintPenanganan(detail, p)}
                            title="Cetak struk"
                            className="dv-icon-btn"
                          >
                            <Printer size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeletePenanganan(p.id)}
                            title="Hapus"
                            className="dv-icon-btn is-alert"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedPenangananId(expanded ? null : p.id)}
                          title={expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                          className="dv-icon-btn"
                        >
                          {expanded ? <ChevronDown size={14} className="rotate-180 transition-transform" /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-2 text-xs dv-muted space-y-1">
                        <span className="dv-tag">{formatJenisKerusakan(p.jenis_kerusakan)}</span>
                        {p.hasil && <p>Hasil: <span className="font-semibold dv-soft">{p.hasil}</span></p>}
                        <p>
                          Pelapor: <span className="font-semibold dv-soft">{namaPelapor}</span>
                        </p>
                        <p>Lapor: <span className="font-semibold dv-soft">{formatTanggalId(p.tanggal_lapor)}</span></p>
                        {p.tanggal_diterima && (
                          <p>Diterima: <span className="font-semibold dv-soft">{formatTanggalId(p.tanggal_diterima)}</span></p>
                        )}
                        {p.tanggal_selesai && (
                          <p>Selesai: <span className="font-semibold dv-soft">{formatTanggalId(p.tanggal_selesai)}</span></p>
                        )}
                        {p.durasi_detik != null && (
                          <p>Durasi: <span className="font-semibold dv-soft">{formatDurasi(p.durasi_detik)}</span></p>
                        )}
                        {(p.harga_jasa != null || p.biaya_komponen != null) && (
                          <p>
                            Biaya: Komponen {formatRupiah(p.biaya_komponen)} + Jasa {formatRupiah(p.harga_jasa)} = <span className="font-bold dv-ink">{formatRupiah(totalBiaya)}</span>
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
                <p className="dv-item text-xs dv-muted italic">Belum ada riwayat perbaikan.</p>
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
