import { Trash2, Printer, Eye, ChevronDown } from 'lucide-react';
import Pagination from '../../../shared/Pagination';
import { namaPemakai } from '../../../../utils/inventoryHelpers';
import type { Inventory } from '../../../../api/masterData/inventory';
import { RIWAYAT_PEMAKAI_PER_PAGE, formatTanggalId } from './helpers';
import { handlePrintSerahTerima } from './printHelpers';

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
    <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Riwayat Pemakai & Peminjaman
        </h4>
      </div>
      {(() => {
        const semuaPemakai = detail.pemakai || [];
        const totalPemakaiPage = Math.max(1, Math.ceil(semuaPemakai.length / RIWAYAT_PEMAKAI_PER_PAGE));
        const halamanPemakai = semuaPemakai.slice(
          (pemakaiPage - 1) * RIWAYAT_PEMAKAI_PER_PAGE,
          pemakaiPage * RIWAYAT_PEMAKAI_PER_PAGE
        );
        return (
          <>
            <ul className="flex flex-col gap-2">
              {halamanPemakai.map((p) => {
                const expanded = expandedPemakaiId === p.id;
                return (
                  <li key={p.id} className="text-xs bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100">{namaPemakai(p)}</span>{' '}
                        <span className="text-slate-500 dark:text-zinc-400">
                          — {formatTanggalId(p.tanggal_penerimaan)}
                          {p.tanggal_pengembalian ? ` s/d ${formatTanggalId(p.tanggal_pengembalian)}` : ' (sedang digunakan)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isAdmin && p.no_struk_penerimaan && (
                          <button
                            type="button"
                            onClick={() => handlePrintSerahTerima([{ inventory: detail, pemakai: p }])}
                            title="Cetak struk penerimaan"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 transition"
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
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedPemakaiId(expanded ? null : p.id)}
                          title={expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 transition"
                        >
                          {expanded ? <ChevronDown size={14} className="rotate-180 transition-transform" /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                        {p.user && (
                          <p>
                            NIK: <span className="font-semibold text-slate-700 dark:text-zinc-300">{p.user.nik || '-'}</span> · Divisi:{' '}
                            <span className="font-semibold text-slate-700 dark:text-zinc-300">{p.user.departemen?.nama || '-'}</span>
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
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-2">Belum ada riwayat pemakai.</p>
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
