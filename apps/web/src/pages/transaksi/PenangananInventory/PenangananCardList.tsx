import { Wrench, PlayCircle, Eye, CheckCircle2, Check } from 'lucide-react';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import { formatTanggalId, namaPelaporPenanganan, formatJenisKerusakan } from '../../../utils/inventoryHelpers';
import StatusBadge from '../../../components/shared/StatusBadge';
import { initials } from './helpers';
import type { TabStatus } from './helpers';

interface PenangananCardListProps {
  displayedList: InventoryPenanganan[];
  activeTab: TabStatus;
  search: string;
  filterKerusakan: string;
  paginatedList: InventoryPenanganan[];
  setDetailModalTarget: (p: InventoryPenanganan) => void;
  isAdmin: boolean;
  setTerimaTarget: (p: InventoryPenanganan) => void;
  setActivePenanganan: (p: InventoryPenanganan) => void;
}

export default function PenangananCardList({ displayedList, activeTab, search, filterKerusakan, paginatedList, setDetailModalTarget, isAdmin, setTerimaTarget, setActivePenanganan }: PenangananCardListProps) {
  return (
    <div>
      {displayedList.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            {activeTab === 'menunggu' ? <CheckCircle2 size={24} /> : <Wrench size={24} />}
          </div>
          <h4 className="text-sm font-semibold text-slate-800">
            {search || filterKerusakan !== 'all'
              ? 'Tidak ada laporan yang cocok dengan filter'
              : activeTab === 'menunggu'
                ? 'Tidak ada laporan yang menunggu verifikasi'
                : 'Tidak ada inventory yang sedang diperbaiki'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'menunggu'
              ? 'Semua laporan kerusakan yang masuk telah diverifikasi dan diproses oleh tim teknisi.'
              : 'Semua unit yang dalam penanganan telah selesai atau belum ada pekerjaan aktif.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedList.map((p) => {
            const diterima = !!p.tanggal_diterima;
            return (
              <div
                key={p.id}
                className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between bg-slate-50/30"
              >
                <div>
                  {/* Header card */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {p.inventory?.kode_inventory || 'INV-UNKNOWN'}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {formatJenisKerusakan(p.jenis_kerusakan)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {p.inventory?.nama || 'Nama unit tidak tertera'}
                      </h4>
                    </div>

                    <StatusBadge
                      colorClass={diterima ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                      size="xs"
                    >
                      {diterima ? 'Dalam Pengerjaan' : 'Menunggu Terima'}
                    </StatusBadge>
                  </div>

                  {/* Pelapor Info */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {initials(namaPelaporPenanganan(p))}
                    </div>
                    <span>
                      Oleh <strong className="font-semibold text-slate-700">{namaPelaporPenanganan(p)}</strong>
                    </span>
                    <span>·</span>
                    <span>Lapor: {formatTanggalId(p.tanggal_lapor)}</span>
                  </div>

                  {/* Issue description box */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 mb-3">
                    <span className="font-semibold text-slate-900 block mb-0.5">Keluhan:</span>
                    <p className="line-clamp-2 leading-relaxed text-slate-600">{p.keluhan}</p>
                  </div>

                  {/* Catatan if ongoing */}
                  {diterima && p.catatan && (
                    <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-blue-900 mb-3">
                      <span className="font-semibold block mb-0.5">Catatan Teknisi:</span>
                      <p className="line-clamp-2">{p.catatan}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailModalTarget(p)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1.5"
                  >
                    <Eye size={14} />
                    Lihat Detail
                  </button>

                  {isAdmin && (
                    <div>
                      {!diterima ? (
                        <button
                          type="button"
                          onClick={() => setTerimaTarget(p)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                        >
                          <PlayCircle size={14} />
                          Terima Laporan
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePenanganan(p)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Check size={14} />
                          Selesaikan Perbaikan
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
