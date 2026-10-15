import Tooltip from '../../../components/shared/Tooltip';
import { Printer, Eye } from 'lucide-react';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import { formatTanggalId, namaPelaporPenanganan, formatJenisKerusakan } from '../../../utils/inventoryHelpers';
import StatusBadge from '../../../components/shared/StatusBadge';
import { formatRupiah } from './helpers';
import type { TabStatus } from './helpers';

interface PenangananTableProps {
  paginatedList: InventoryPenanganan[];
  handlePrintStruk: (p: InventoryPenanganan) => void;
  setDetailModalTarget: (p: InventoryPenanganan) => void;
  displayedList: InventoryPenanganan[];
  search: string;
  filterKerusakan: string;
  activeTab: TabStatus;
}

export default function PenangananTable({ paginatedList, handlePrintStruk, setDetailModalTarget, displayedList, search, filterKerusakan, activeTab }: PenangananTableProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/50">
              <th className="px-6 py-3.5 font-medium whitespace-nowrap">Inventory</th>
              <th className="px-6 py-3.5 font-medium whitespace-nowrap">Kerusakan</th>
              <th className="px-6 py-3.5 font-medium whitespace-nowrap">Pelapor</th>
              <th className="px-6 py-3.5 font-medium whitespace-nowrap">Tanggal Selesai</th>
              <th className="px-6 py-3.5 font-medium whitespace-nowrap">Biaya Penanganan</th>
              <th className="px-6 py-3.5 font-medium whitespace-nowrap">Hasil</th>
              <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((p) => {
              const rusakBerat = p.hasil === 'rusak_berat';
              const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);

              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3.5 text-slate-800 font-medium whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{p.inventory?.kode_inventory || '-'}</span>
                  </td>

                  <td className="px-6 py-3.5 text-slate-800 font-medium text-xs whitespace-nowrap">
                    {formatJenisKerusakan(p.jenis_kerusakan)}
                  </td>

                  <td className="px-6 py-3.5 text-slate-800 font-medium text-xs">
                    <div className="max-w-[150px]">
                      <Tooltip content={namaPelaporPenanganan(p)}>
                        <p className="truncate">{namaPelaporPenanganan(p)}</p>
                      </Tooltip>
                    </div>
                  </td>

                  <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                    <p className="text-xs text-slate-700 font-medium">{formatTanggalId(p.tanggal_selesai)}</p>
                  </td>

                  <td className="px-6 py-3.5 whitespace-nowrap text-slate-700">
                    {rusakBerat ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : (
                      <p className="font-semibold text-xs text-slate-900">{formatRupiah(totalBiaya)}</p>
                    )}
                  </td>

                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <StatusBadge
                      colorClass={rusakBerat ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
                      size="xs"
                    >
                      {rusakBerat ? 'Rusak Berat' : 'Selesai'}
                    </StatusBadge>
                  </td>

                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {p.no_struk && (
                        <button
                          type="button"
                          onClick={() => handlePrintStruk(p)}
                          title="Cetak Struk Penanganan"
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetailModalTarget(p)}
                        title="Lihat Detail Lengkap"
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayedList.length === 0 && (
        <div className="text-center py-12 px-4">
          <p className="text-sm font-medium text-slate-700">Tidak ada data penanganan</p>
          <p className="text-xs text-slate-400 mt-1">
            {search || filterKerusakan !== 'all'
              ? 'Tidak ditemukan riwayat yang sesuai kriteria pencarian.'
              : activeTab === 'diperbaiki_selesai'
                ? 'Belum ada aset yang selesai diperbaiki.'
                : 'Belum ada aset yang dinyatakan rusak berat.'}
          </p>
        </div>
      )}
    </div>
  );
}
