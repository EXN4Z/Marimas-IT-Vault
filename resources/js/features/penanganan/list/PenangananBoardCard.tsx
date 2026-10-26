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
    <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${bold ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{value}</span>
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
      className={`bg-white rounded-md border text-xs ${terlambat ? 'border-[#b53a12]' : 'border-slate-200'} ${draggable ? 'cursor-grab' : ''}`}
    >
      <div className="px-2.5 py-2 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-slate-900 truncate">
            {p.inventory?.kode_inventory || 'INV-UNKNOWN'}
            <span className="font-normal text-slate-500"> · {formatJenisKerusakan(p.jenis_kerusakan)}</span>
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Ciutkan' : 'Lebarkan'}
            className="w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <p className="text-sm font-semibold text-slate-900 truncate">{p.inventory?.nama || 'Nama unit tidak tertera'}</p>
        <p className="text-slate-600 truncate">{p.keluhan}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          {aktif ? (
            <div className="flex items-center gap-2">
              <div className="w-16 h-[5px] rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full ${terlambat ? 'bg-[#b53a12]' : 'bg-[#0b3a9a]'}`}
                  style={{ width: `${Math.min(100, Math.round((hari / BATAS_BAR_HARI) * 100))}%` }}
                />
              </div>
              <span className={`font-semibold ${terlambat ? 'text-[#b53a12]' : 'text-slate-700'}`}>{hari} hari</span>
            </div>
          ) : (
            // Nominal sengaja tidak tampil di card tertutup; muncul di dropdown.
            <span className="text-slate-500">Selesai {formatTanggalId(p.tanggal_selesai)}</span>
          )}

          {isAdmin && status === 'menunggu' && (
            <button type="button" onClick={() => onTerima(p)} className="font-semibold text-[#0b3a9a] underline">
              Terima laporan
            </button>
          )}
          {isAdmin && status === 'diperbaiki' && (
            <button type="button" onClick={() => onSelesaikan(p)} className="font-semibold text-[#0b3a9a] underline">
              Selesaikan
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 px-2.5 py-2 space-y-1.5">
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

          <div className="flex justify-end gap-2 pt-1">
            {p.no_struk && (
              <button
                type="button"
                onClick={() => onPrint(p)}
                className="h-7 px-3 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50 transition"
              >
                Cetak struk
              </button>
            )}
            <button
              type="button"
              onClick={() => onDetail(p)}
              className="h-7 px-3 rounded-md bg-[#0b3a9a] text-white font-semibold hover:bg-[#082c75] transition"
            >
              Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
