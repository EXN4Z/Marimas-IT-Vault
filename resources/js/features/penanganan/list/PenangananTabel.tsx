import type { InventoryPenanganan, PenangananTab } from '../types';
import {
  formatJenisKerusakan,
  formatTanggalId,
  namaPelaporPenanganan,
} from '../../inventory/inventoryHelpers';
import { formatRupiah } from '../helpers';
import { BATAS_TERLAMBAT_HARI, hariSejak } from './PenangananBoardCard';

const BATAS_BAR_HARI = 10;

const KOLOM: Record<PenangananTab, string[]> = {
  menunggu: ['Aset', 'Unit', 'Keluhan', 'Pelapor', 'Tanggal lapor', 'Lama', ''],
  diperbaiki: ['Aset', 'Unit', 'Keluhan', 'Pelapor', 'Diterima', 'Lama', ''],
  diperbaiki_selesai: ['Aset', 'Unit', 'Keluhan', 'Selesai', 'Total biaya', 'No. struk', ''],
  rusak_berat: ['Aset', 'Unit', 'Keluhan', 'Pelapor', 'Ditutup', ''],
};

const KOSONG: Record<PenangananTab, string> = {
  menunggu: 'Tidak ada laporan yang menunggu verifikasi.',
  diperbaiki: 'Tidak ada inventory yang sedang diperbaiki.',
  diperbaiki_selesai: 'Belum ada laporan yang selesai diperbaiki.',
  rusak_berat: 'Tidak ada laporan rusak berat.',
};

interface Props {
  rows: InventoryPenanganan[];
  tab: PenangananTab;
  isAdmin: boolean;
  filtered: boolean;
  onDetail: (p: InventoryPenanganan) => void;
  onTerima: (p: InventoryPenanganan) => void;
  onSelesaikan: (p: InventoryPenanganan) => void;
  onPrint: (p: InventoryPenanganan) => void;
}

const btnOutline = 'h-7 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition';
const btnPrimary = 'h-7 px-2.5 rounded-md bg-[#0b3a9a] text-xs font-semibold text-white hover:bg-[#082c75] transition';

function Lama({ hari, terlambat }: { hari: number; terlambat: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-[5px] rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full ${terlambat ? 'bg-[#b53a12]' : 'bg-[#0b3a9a]'}`}
          style={{ width: `${Math.min(100, Math.round((hari / BATAS_BAR_HARI) * 100))}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${terlambat ? 'text-[#b53a12]' : 'text-slate-700'}`}>{hari} hari</span>
    </div>
  );
}

export default function PenangananTabel({ rows, tab, isAdmin, filtered, onDetail, onTerima, onSelesaikan, onPrint }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl text-sm text-slate-500">
        {filtered ? 'Tidak ada laporan yang cocok dengan filter.' : KOSONG[tab]}
      </div>
    );
  }

  const aktif = tab === 'menunggu' || tab === 'diperbaiki';

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-900">
            {KOLOM[tab].map((k, i) => (
              <th key={i} className="text-left text-[11px] font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const hari = hariSejak(p.tanggal_lapor);
            const terlambat = aktif && hari > BATAS_TERLAMBAT_HARI;
            const total = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);

            return (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className={`px-3 py-2.5 ${terlambat ? 'shadow-[inset_3px_0_0_#b53a12]' : ''}`}>
                  <p className="font-bold text-slate-900">{p.inventory?.kode_inventory || 'INV-UNKNOWN'}</p>
                  <p className="text-xs text-slate-500">{formatJenisKerusakan(p.jenis_kerusakan)}</p>
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-900">{p.inventory?.nama || '-'}</td>
                <td className="px-3 py-2.5 text-slate-700 max-w-[240px] truncate">{p.keluhan}</td>

                {(tab === 'menunggu' || tab === 'diperbaiki' || tab === 'rusak_berat') && (
                  <td className="px-3 py-2.5 text-slate-700">{namaPelaporPenanganan(p)}</td>
                )}
                {tab === 'menunggu' && <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatTanggalId(p.tanggal_lapor)}</td>}
                {tab === 'diperbaiki' && <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatTanggalId(p.tanggal_diterima)}</td>}
                {tab === 'diperbaiki_selesai' && (
                  <>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{formatRupiah(total)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{p.no_struk || '-'}</td>
                  </>
                )}
                {tab === 'rusak_berat' && <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>}
                {aktif && (
                  <td className="px-3 py-2.5">
                    <Lama hari={hari} terlambat={terlambat} />
                  </td>
                )}

                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button type="button" onClick={() => onDetail(p)} className={btnOutline}>
                      Detail
                    </button>
                    {isAdmin && tab === 'menunggu' && (
                      <button type="button" onClick={() => onTerima(p)} className={btnPrimary}>
                        Terima laporan
                      </button>
                    )}
                    {isAdmin && tab === 'diperbaiki' && (
                      <button type="button" onClick={() => onSelesaikan(p)} className={btnPrimary}>
                        Selesaikan
                      </button>
                    )}
                    {tab === 'diperbaiki_selesai' && p.no_struk && (
                      <button type="button" onClick={() => onPrint(p)} className={btnOutline}>
                        Cetak struk
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
