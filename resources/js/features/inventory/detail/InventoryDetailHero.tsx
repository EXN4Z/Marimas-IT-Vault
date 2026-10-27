import { ImageOff, Link2 } from 'lucide-react';
import { namaPemakai } from '../inventoryHelpers';
import type { Inventory } from '../types/inventory';
import { STORAGE_BASE_URL } from '../list/helpers';
import { formatTanggalId } from '../inventoryHelpers';

interface InventoryDetailHeroProps {
  detail: Inventory;
}

// Ringkasan: foto + spesifikasi inti (baris ledger), lalu blok "sedang dipinjam" kalau status dipakai.
export default function InventoryDetailHero({ detail }: InventoryDetailHeroProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        <div>
          <div
            className="w-24 h-24 rounded-md overflow-hidden grid place-items-center"
            style={{ border: '1px solid var(--dv-line)', background: 'var(--dv-surface)' }}
          >
            {detail.foto ? (
              <img src={STORAGE_BASE_URL + detail.foto} alt={detail.kode_inventory} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 dv-muted">
                <ImageOff size={20} />
                <span className="text-xs">Tanpa Foto</span>
              </div>
            )}
          </div>

          {detail.parent_id && detail.parent && (
            <p className="mt-2.5 text-xs dv-muted inline-flex items-center gap-1.5">
              <Link2 size={13} className="shrink-0" />
              <span className="truncate">Menempel ke {detail.parent.kode_inventory}</span>
            </p>
          )}
        </div>

        <div className="min-w-0 [&>.dv-row:first-child]:border-t-0 [&>.dv-row:first-child]:pt-0">
          <div className="dv-row">
            <span>Merk &amp; Tipe</span>
            <b className="text-right">
              {detail.merk || '-'}
              {detail.type ? ` · ${detail.type}` : ''}
            </b>
          </div>
          <div className="dv-row">
            <span>Serial Number</span>
            <b className="dv-g text-right break-all">{detail.serial_number || '-'}</b>
          </div>
          <div className="dv-row">
            <span>Warna &amp; Unit</span>
            <b className="text-right">
              {detail.warna || '-'} · {detail.jumlah ?? 1} unit
            </b>
          </div>
          <div className="dv-row">
            <span>Garansi berakhir</span>
            <b className="dv-g text-right">{formatTanggalId(detail.tanggal_garansi)}</b>
          </div>
        </div>
      </div>

      {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
        <div className="dv-band flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="dv-band-label">Sedang dipinjam oleh</p>
            <p className="dv-g text-lg font-semibold mt-0.5 truncate">{namaPemakai(detail.pemakai_saat_ini)}</p>
            {detail.pemakai_saat_ini.user && (
              <p className="text-xs dv-band-sub">
                NIK {detail.pemakai_saat_ini.user.nik || '-'} · {detail.pemakai_saat_ini.user.departemen?.nama || '-'}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] dv-band-sub">Sejak</p>
            <p className="dv-g text-base font-semibold mt-0.5">{formatTanggalId(detail.pemakai_saat_ini.tanggal_penerimaan)}</p>
          </div>
        </div>
      )}
    </>
  );
}
