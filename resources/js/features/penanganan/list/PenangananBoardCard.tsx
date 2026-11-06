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
    <div className="flex items-center justify-between gap-3 border-b border-dv-line pb-1 [&>span:first-child]:text-dv-muted [&>span:last-child]:text-right">
      <span>{label}</span>
      <span className={bold ? 'font-bold text-dv-ink' : ''}>{value}</span>
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
      className={`rounded-[14px] border border-dv-line bg-dd-card text-[12px] text-dv-soft shadow-dd dark:shadow-none [&.is-late]:border-dv-alert [&.is-drag]:cursor-grab ${terlambat ? 'is-late' : ''} ${draggable ? 'is-drag' : ''}`}
    >
      <div className="flex flex-col gap-[3px] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="leading-[1.25] font-bold text-dv-ink min-w-0 truncate">
            {p.inventory?.kode_inventory || 'INV-UNKNOWN'}
            <span className="text-[11px] font-normal text-dv-muted"> · {formatJenisKerusakan(p.jenis_kerusakan)}</span>
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Ciutkan' : 'Lebarkan'}
            className="grid size-6 shrink-0 place-items-center rounded-lg border border-dv-line text-dv-soft hover:bg-dv-surface"
          >
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <p className="font-bold text-dv-ink min-w-0 truncate">{p.inventory?.nama || 'Nama unit tidak tertera'}</p>
        <p className="min-w-0 truncate">{p.keluhan}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          {aktif ? (
            <div className={`group/lama flex items-center gap-2 ${terlambat ? 'is-late' : ''}`}>
              <div className="h-[5px] w-14 overflow-hidden rounded-full bg-dv-track">
                <div className="h-full bg-dv-primary group-[.is-late]/lama:bg-dv-alert" style={{ width: `${Math.min(100, Math.round((hari / BATAS_BAR_HARI) * 100))}%` }} />
              </div>
              <span className="text-[12px] font-bold whitespace-nowrap text-dv-soft group-[.is-late]/lama:text-dv-alert">{hari} hari</span>
            </div>
          ) : (
            // Nominal sengaja tidak tampil di card tertutup; muncul di dropdown.
            <span className="text-[11px] font-normal text-dv-muted">Selesai {formatTanggalId(p.tanggal_selesai)}</span>
          )}

          {isAdmin && status === 'menunggu' && (
            <button type="button" onClick={() => onTerima(p)} className="text-left text-[12px] font-bold text-dv-ink hover:underline">
              Terima laporan
            </button>
          )}
          {isAdmin && status === 'diperbaiki' && (
            <button type="button" onClick={() => onSelesaikan(p)} className="text-left text-[12px] font-bold text-dv-ink hover:underline">
              Selesaikan
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1.5 border-t border-dv-line px-3 py-2.5">
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

          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {p.no_struk && (
              <button type="button" onClick={() => onPrint(p)} className="h-[30px] rounded-full border px-3.5 text-[12px] font-bold border-dv-line bg-dd-card text-dv-ink hover:border-dv-muted">
                Cetak struk
              </button>
            )}
            <button type="button" onClick={() => onDetail(p)} className="h-[30px] rounded-full border px-3.5 text-[12px] font-bold border-pn-btn-bg bg-pn-btn-bg text-pn-btn-fg hover:border-pn-btn-bg hover:opacity-[.88]">
              Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
