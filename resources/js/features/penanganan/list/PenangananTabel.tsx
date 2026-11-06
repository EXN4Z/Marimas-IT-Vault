import { Wrench, Check, AlertTriangle } from 'lucide-react';
import type { InventoryPenanganan, PenangananTab } from '../types';
import {
  formatJenisKerusakan,
  formatTanggalId,
  namaPelaporPenanganan,
} from '../../inventory/inventoryHelpers';
import { formatRupiah } from '../helpers';
import { BATAS_TERLAMBAT_HARI, hariSejak } from './PenangananBoardCard';
import { pnEmpty, pnTable } from '../../../components/ui/pn';

const BATAS_BAR_HARI = 10;

const KOLOM: Record<PenangananTab, string[]> = {
  menunggu: ['Inventory', 'Unit', 'Keluhan', 'Pelapor', 'Tanggal lapor', 'Lama', ''],
  diperbaiki: ['Inventory', 'Unit', 'Keluhan', 'Pelapor', 'Diterima', 'Lama', ''],
  diperbaiki_selesai: ['Inventory', 'Unit', 'Keluhan', 'Selesai', 'Total biaya', 'No. struk', ''],
  rusak_berat: ['Inventory', 'Unit', 'Keluhan', 'Pelapor', 'Ditutup', ''],
};

const KOSONG: Record<PenangananTab, string> = {
  menunggu: 'Tidak ada laporan yang menunggu verifikasi.',
  diperbaiki: 'Tidak ada inventory yang sedang diperbaiki.',
  diperbaiki_selesai: 'Belum ada laporan yang selesai diperbaiki.',
  rusak_berat: 'Tidak ada laporan rusak berat.',
};

// Warna lingkaran ikon per status (token dashboard). Laporan terlambat selalu merah.
const WARNA_IKON: Record<PenangananTab, string> = {
  menunggu: 'var(--dd-yellow-ink)',
  diperbaiki: 'var(--dv-primary)',
  diperbaiki_selesai: 'var(--dd-green-ink)',
  rusak_berat: 'var(--dv-alert)',
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

function Lama({ hari, terlambat }: { hari: number; terlambat: boolean }) {
  return (
    <div className={`group/lama flex items-center gap-2 ${terlambat ? 'is-late' : ''}`}>
      <div className="h-[5px] w-14 overflow-hidden rounded-full bg-dv-track">
        <div className="h-full bg-dv-primary group-[.is-late]/lama:bg-dv-alert" style={{ width: `${Math.min(100, Math.round((hari / BATAS_BAR_HARI) * 100))}%` }} />
      </div>
      <span className="text-[12px] font-bold whitespace-nowrap text-dv-soft group-[.is-late]/lama:text-dv-alert">{hari} hari</span>
    </div>
  );
}

export default function PenangananTabel({ rows, tab, isAdmin, filtered, onDetail, onTerima, onSelesaikan, onPrint }: Props) {
  const aktif = tab === 'menunggu' || tab === 'diperbaiki';
  const Ikon = tab === 'diperbaiki_selesai' ? Check : tab === 'rusak_berat' ? AlertTriangle : Wrench;

  if (rows.length === 0) {
    return <div className={pnEmpty}>{filtered ? 'Tidak ada laporan yang cocok dengan filter.' : KOSONG[tab]}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={pnTable}>
        <thead>
          <tr>
            {KOLOM[tab].map((k, i) => (
              <th key={i} className={i === KOLOM[tab].length - 1 ? 'text-right' : undefined}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const hari = hariSejak(p.tanggal_lapor);
            const terlambat = aktif && hari > BATAS_TERLAMBAT_HARI;
            const total = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);

            return (
              <tr key={p.id} className={terlambat ? 'is-late' : ''}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-(--c)/16 text-(--c)" style={{ ['--c' as string]: terlambat ? 'var(--dv-alert)' : WARNA_IKON[tab] }}>
                      <Ikon size={15} />
                    </span>
                    <div>
                      <p className="leading-[1.25] font-bold text-dv-ink">{p.inventory?.kode_inventory || 'INV-UNKNOWN'}</p>
                      <p className="text-[11px] font-normal text-dv-muted">{formatJenisKerusakan(p.jenis_kerusakan)}</p>
                    </div>
                  </div>
                </td>
                <td className="font-bold text-dv-ink">{p.inventory?.nama || '-'}</td>
                <td className="max-w-60 truncate">{p.keluhan}</td>

                {(tab === 'menunggu' || tab === 'diperbaiki' || tab === 'rusak_berat') && <td>{namaPelaporPenanganan(p)}</td>}
                {tab === 'menunggu' && <td className="whitespace-nowrap">{formatTanggalId(p.tanggal_lapor)}</td>}
                {tab === 'diperbaiki' && <td className="whitespace-nowrap">{formatTanggalId(p.tanggal_diterima)}</td>}
                {tab === 'diperbaiki_selesai' && (
                  <>
                    <td className="whitespace-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>
                    <td className="font-bold text-dv-ink whitespace-nowrap">{formatRupiah(total)}</td>
                    <td className="font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[12px] whitespace-nowrap">{p.no_struk || '-'}</td>
                  </>
                )}
                {tab === 'rusak_berat' && <td className="whitespace-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>}
                {aktif && (
                  <td>
                    <Lama hari={hari} terlambat={terlambat} />
                  </td>
                )}

                <td>
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button type="button" onClick={() => onDetail(p)} className="h-[30px] rounded-full border px-3.5 text-[12px] font-bold border-dv-line bg-dd-card text-dv-ink hover:border-dv-muted">
                      Detail
                    </button>
                    {isAdmin && tab === 'menunggu' && (
                      <button type="button" onClick={() => onTerima(p)} className="h-[30px] rounded-full border px-3.5 text-[12px] font-bold border-pn-btn-bg bg-pn-btn-bg text-pn-btn-fg hover:border-pn-btn-bg hover:opacity-[.88]">
                        Terima laporan
                      </button>
                    )}
                    {isAdmin && tab === 'diperbaiki' && (
                      <button type="button" onClick={() => onSelesaikan(p)} className="h-[30px] rounded-full border px-3.5 text-[12px] font-bold border-pn-btn-bg bg-pn-btn-bg text-pn-btn-fg hover:border-pn-btn-bg hover:opacity-[.88]">
                        Selesaikan
                      </button>
                    )}
                    {tab === 'diperbaiki_selesai' && p.no_struk && (
                      <button type="button" onClick={() => onPrint(p)} className="h-[30px] rounded-full border px-3.5 text-[12px] font-bold border-pn-btn-bg bg-pn-btn-bg text-pn-btn-fg hover:border-pn-btn-bg hover:opacity-[.88]">
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
