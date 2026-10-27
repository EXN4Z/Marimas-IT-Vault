import { Trash2, Printer, Eye, ChevronDown } from 'lucide-react';
import Pagination from '../../../components/table/Pagination';
import { namaPemakai } from '../inventoryHelpers';
import type { Inventory } from '../types/inventory';
import { formatTanggalId } from '../inventoryHelpers';
import { handlePrintSerahTerima } from '../print/printHelpers';
import { SectionHead } from './detailUi';

const RIWAYAT_PEMAKAI_PER_PAGE = 3;

interface InventoryRiwayatPemakaiProps {
  detail: Inventory;
  pemakaiPage: number;
  expandedPemakaiId: number | null;
  isAdmin: boolean;
  handleDeletePemakai: (id: number) => void | Promise<void>;
  deletingPemakaiId: number | null;
  setExpandedPemakaiId: React.Dispatch<React.SetStateAction<number | null>>;
  setPemakaiPage: React.Dispatch<React.SetStateAction<number>>;
}

export default function InventoryRiwayatPemakai({ detail, pemakaiPage, expandedPemakaiId, isAdmin, handleDeletePemakai, deletingPemakaiId, setExpandedPemakaiId, setPemakaiPage }: InventoryRiwayatPemakaiProps) {
  return (
    <div>
      <SectionHead title="Riwayat pemakai & peminjaman" meta={(detail.pemakai?.length ?? 0) > 0 ? `${detail.pemakai!.length} catatan` : undefined} />
      {(() => {
        const semuaPemakai = detail.pemakai || [];
        const totalPemakaiPage = Math.max(1, Math.ceil(semuaPemakai.length / RIWAYAT_PEMAKAI_PER_PAGE));
        const halamanPemakai = semuaPemakai.slice(
          (pemakaiPage - 1) * RIWAYAT_PEMAKAI_PER_PAGE,
          pemakaiPage * RIWAYAT_PEMAKAI_PER_PAGE
        );
        return (
          <>
            <ul>
              {halamanPemakai.map((p) => {
                const expanded = expandedPemakaiId === p.id;
                return (
                  <li key={p.id} className="dv-item">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b>{namaPemakai(p)}</b>{' '}
                        <span className="dv-muted dv-g">
                          — {formatTanggalId(p.tanggal_penerimaan)}
                          {p.tanggal_pengembalian ? ` s/d ${formatTanggalId(p.tanggal_pengembalian)}` : ' (sedang digunakan)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isAdmin && p.no_struk_penerimaan && (
                          <button
                            type="button"
                            onClick={() => handlePrintSerahTerima([{ inventory: detail, pemakai: p }])}
                            title="Cetak struk penerimaan"
                            className="dv-icon-btn"
                          >
                            <Printer size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeletePemakai(p.id)}
                            disabled={deletingPemakaiId === p.id}
                            title="Hapus riwayat"
                            className="dv-icon-btn is-alert disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedPemakaiId(expanded ? null : p.id)}
                          title={expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                          className="dv-icon-btn"
                        >
                          {expanded ? <ChevronDown size={14} className="rotate-180 transition-transform" /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-2 text-xs dv-muted space-y-1">
                        {p.user && (
                          <p>
                            NIK: <span className="font-semibold dv-soft">{p.user.nik || '-'}</span> · Divisi:{' '}
                            <span className="font-semibold dv-soft">{p.user.departemen?.nama || '-'}</span>
                          </p>
                        )}
                        {p.catatan_penerimaan && <p>Catatan terima: {p.catatan_penerimaan}</p>}
                        {p.catatan_pengembalian && <p>Catatan kembali: {p.catatan_pengembalian}</p>}
                        {p.no_struk_penerimaan && <p>Struk terima: {p.no_struk_penerimaan}</p>}
                        {p.no_struk_pengembalian && <p>Struk kembali: {p.no_struk_pengembalian}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
              {!semuaPemakai.length && (
                <p className="dv-item text-xs dv-muted italic">Belum ada riwayat pemakai.</p>
              )}
            </ul>

            {semuaPemakai.length > RIWAYAT_PEMAKAI_PER_PAGE && (
              <Pagination
                currentPage={pemakaiPage}
                totalPages={totalPemakaiPage}
                onPageChange={(page) => {
                  setPemakaiPage(page);
                  setExpandedPemakaiId(null);
                }}
                totalItems={semuaPemakai.length}
                itemLabel="riwayat"
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
