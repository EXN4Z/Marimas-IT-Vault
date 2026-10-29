import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { InventoryPenanganan, PenangananTab } from '../types';
import {
  formatJenisKerusakan,
  formatTanggalId,
  formatTanggalWaktuId,
  formatDurasi,
  namaPelaporPenanganan,
} from '../../inventory/inventoryHelpers';
import { formatRupiah, todayIso } from '../helpers';

export const BATAS_TERLAMBAT_HARI = 7;
const BATAS_BAR_HARI = 10;

// Selisih hari kalender (tanggal lokal) antara tanggal lapor dan hari ini.
export function hariSejak(iso: string | null | undefined): number {
  if (!iso) return 0;
  const a = new Date(iso.slice(0, 10)).getTime();
  const b = new Date(todayIso()).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

interface Props {
  p: InventoryPenanganan;
  status: PenangananTab;
  isAdmin: boolean;
  onDetail: (p: InventoryPenanganan) => void;
  onTerima: (p: InventoryPenanganan) => void;
  onSelesaikan: (p: InventoryPenanganan) => void;
  onPrint: (p: InventoryPenanganan) => void;
}

function Baris({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="pn-brow">
      <span>{label}</span>
      <span className={bold ? 'pn-strong' : ''}>{value}</span>
    </div>
  );
}

export default function PenangananBoardCard({ p, status, isAdmin, onDetail, onTerima, onSelesaikan, onPrint }: Props) {
  const [open, setOpen] = useState(false);

  const aktif = status === 'menunggu' || status === 'diperbaiki';
  const hari = hariSejak(p.tanggal_lapor);
  const terlambat = aktif && hari > BATAS_TERLAMBAT_HARI;
  const rusakBerat = status === 'rusak_berat';
  const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
  const draggable = isAdmin && status === 'menunggu';

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/penanganan-id', String(p.id))}
      className={`pn-bcard ${terlambat ? 'is-late' : ''} ${draggable ? 'is-drag' : ''}`}
    >
      <div className="pn-bcard-in">
        <div className="pn-bcard-top">
          <p className="pn-kode pn-trunc-s">
            {p.inventory?.kode_inventory || 'INV-UNKNOWN'}
            <span className="pn-jenis"> · {formatJenisKerusakan(p.jenis_kerusakan)}</span>
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Ciutkan' : 'Lebarkan'}
            className="pn-chev"
          >
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <p className="pn-strong pn-trunc-s">{p.inventory?.nama || 'Nama unit tidak tertera'}</p>
        <p className="pn-trunc-s">{p.keluhan}</p>

        <div className="pn-bcard-foot">
          {aktif ? (
            <div className={`pn-lama ${terlambat ? 'is-late' : ''}`}>
              <div className="pn-lama-t">
                <div className="pn-lama-f" style={{ width: `${Math.min(100, Math.round((hari / BATAS_BAR_HARI) * 100))}%` }} />
              </div>
              <span className="pn-lama-n">{hari} hari</span>
            </div>
          ) : (
            // Nominal sengaja tidak tampil di card tertutup; muncul di dropdown.
            <span className="pn-jenis">Selesai {formatTanggalId(p.tanggal_selesai)}</span>
          )}

          {isAdmin && status === 'menunggu' && (
            <button type="button" onClick={() => onTerima(p)} className="pn-link">
              Terima laporan
            </button>
          )}
          {isAdmin && status === 'diperbaiki' && (
            <button type="button" onClick={() => onSelesaikan(p)} className="pn-link">
              Selesaikan
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="pn-bcard-x">
          <Baris label="Pelapor" value={namaPelaporPenanganan(p)} />
          <Baris label="Tanggal lapor" value={formatTanggalWaktuId(p.lapor_at, p.tanggal_lapor)} />
          {p.tanggal_diterima && (
            <Baris label="Diterima teknisi" value={formatTanggalWaktuId(p.diterima_at ?? null, p.tanggal_diterima)} />
          )}
          {p.tanggal_selesai && <Baris label="Tanggal selesai" value={formatTanggalId(p.tanggal_selesai)} />}
          {p.durasi_detik != null && <Baris label="Durasi" value={formatDurasi(p.durasi_detik)} />}
          {!rusakBerat && totalBiaya > 0 && (
            <>
              <Baris label="Biaya jasa" value={formatRupiah(p.harga_jasa)} />
              <Baris label="Biaya komponen" value={formatRupiah(p.biaya_komponen)} />
              <Baris label="Total biaya" value={formatRupiah(totalBiaya)} bold />
            </>
          )}
          {p.no_struk && <Baris label="No. struk" value={p.no_struk} />}

          <div className="pn-act">
            {p.no_struk && (
              <button type="button" onClick={() => onPrint(p)} className="pn-btn">
                Cetak struk
              </button>
            )}
            <button type="button" onClick={() => onDetail(p)} className="pn-btn pn-btn-primary">
              Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
