import { Wrench, Check, AlertTriangle } from 'lucide-react';
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
    <div className={`pn-lama ${terlambat ? 'is-late' : ''}`}>
      <div className="pn-lama-t">
        <div className="pn-lama-f" style={{ width: `${Math.min(100, Math.round((hari / BATAS_BAR_HARI) * 100))}%` }} />
      </div>
      <span className="pn-lama-n">{hari} hari</span>
    </div>
  );
}

export default function PenangananTabel({ rows, tab, isAdmin, filtered, onDetail, onTerima, onSelesaikan, onPrint }: Props) {
  const aktif = tab === 'menunggu' || tab === 'diperbaiki';
  const Ikon = tab === 'diperbaiki_selesai' ? Check : tab === 'rusak_berat' ? AlertTriangle : Wrench;

  if (rows.length === 0) {
    return <div className="pn-empty">{filtered ? 'Tidak ada laporan yang cocok dengan filter.' : KOSONG[tab]}</div>;
  }

  return (
    <div className="pn-scroll">
      <table className="pn-table">
        <thead>
          <tr>
            {KOLOM[tab].map((k, i) => (
              <th key={i} className={i === KOLOM[tab].length - 1 ? 'pn-r' : undefined}>{k}</th>
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
                  <div className="pn-aset">
                    <span className="pn-ico" style={{ ['--c' as string]: terlambat ? 'var(--dv-alert)' : WARNA_IKON[tab] }}>
                      <Ikon size={15} />
                    </span>
                    <div>
                      <p className="pn-kode">{p.inventory?.kode_inventory || 'INV-UNKNOWN'}</p>
                      <p className="pn-jenis">{formatJenisKerusakan(p.jenis_kerusakan)}</p>
                    </div>
                  </div>
                </td>
                <td className="pn-strong">{p.inventory?.nama || '-'}</td>
                <td className="pn-trunc">{p.keluhan}</td>

                {(tab === 'menunggu' || tab === 'diperbaiki' || tab === 'rusak_berat') && <td>{namaPelaporPenanganan(p)}</td>}
                {tab === 'menunggu' && <td className="pn-nowrap">{formatTanggalId(p.tanggal_lapor)}</td>}
                {tab === 'diperbaiki' && <td className="pn-nowrap">{formatTanggalId(p.tanggal_diterima)}</td>}
                {tab === 'diperbaiki_selesai' && (
                  <>
                    <td className="pn-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>
                    <td className="pn-strong pn-nowrap">{formatRupiah(total)}</td>
                    <td className="pn-mono">{p.no_struk || '-'}</td>
                  </>
                )}
                {tab === 'rusak_berat' && <td className="pn-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>}
                {aktif && (
                  <td>
                    <Lama hari={hari} terlambat={terlambat} />
                  </td>
                )}

                <td>
                  <div className="pn-act">
                    <button type="button" onClick={() => onDetail(p)} className="pn-btn">
                      Detail
                    </button>
                    {isAdmin && tab === 'menunggu' && (
                      <button type="button" onClick={() => onTerima(p)} className="pn-btn pn-btn-primary">
                        Terima laporan
                      </button>
                    )}
                    {isAdmin && tab === 'diperbaiki' && (
                      <button type="button" onClick={() => onSelesaikan(p)} className="pn-btn pn-btn-primary">
                        Selesaikan
                      </button>
                    )}
                    {tab === 'diperbaiki_selesai' && p.no_struk && (
                      <button type="button" onClick={() => onPrint(p)} className="pn-btn pn-btn-primary">
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
