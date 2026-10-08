import { ImageOff, Link2 } from 'lucide-react';
import { namaPemakai } from '../../../../utils/inventoryHelpers';
import type { Inventory } from '../../../../api/masterData/inventory';
import { STORAGE_BASE_URL, formatTanggalId } from './helpers';

interface InventoryDetailHeroProps {
  detail: Inventory;
}

export default function InventoryDetailHero({ detail }: InventoryDetailHeroProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-5 p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800">
      {/* Photo thumbnail */}
      <div className="w-full sm:w-36 flex-shrink-0 flex flex-col items-center">
        <div className="w-full aspect-square rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 overflow-hidden flex items-center justify-center shadow-xs">
          {detail.foto ? (
            <img src={STORAGE_BASE_URL + detail.foto} alt={detail.kode_inventory} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <ImageOff size={28} className="text-slate-300 dark:text-zinc-600 mb-1" />
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Tanpa Foto</span>
            </div>
          )}
        </div>

        {detail.parent_id && detail.parent && (
          <div className="w-full mt-2 flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-lg p-2 text-[11px] font-medium border border-sky-200 dark:border-sky-800/60">
            <Link2 size={13} className="shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="truncate">Menempel ke: {detail.parent.kode_inventory}</span>
          </div>
        )}
      </div>

      {/* Core specifications */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/70 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Merk & Tipe</span>
            <p className="font-semibold text-slate-800 dark:text-zinc-100 mt-0.5 truncate">
              {detail.merk || '-'} {detail.type ? `· ${detail.type}` : ''}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/70 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Serial Number (S/N)</span>
            <p className="font-mono font-medium text-slate-800 dark:text-zinc-100 mt-0.5 truncate">
              {detail.serial_number || '-'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/70 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Warna & Unit</span>
            <p className="font-semibold text-slate-800 dark:text-zinc-100 mt-0.5">
              {detail.warna || '-'} · {detail.jumlah ?? 1} Unit
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/70 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Garansi Resmi</span>
            <p className="font-semibold text-slate-800 dark:text-zinc-100 mt-0.5">
              {formatTanggalId(detail.tanggal_garansi)}
            </p>
          </div>
        </div>

        {/* Borrowed card banner */}
        {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Sedang Dipinjam Oleh</p>
              <p className="font-semibold text-sm truncate mt-0.5">
                {namaPemakai(detail.pemakai_saat_ini)}
              </p>
              {detail.pemakai_saat_ini.user && (
                <p className="text-xs text-amber-700 dark:text-amber-300/80">
                  NIK: {detail.pemakai_saat_ini.user.nik || '-'} · {detail.pemakai_saat_ini.user.departemen?.nama || '-'}
                </p>
              )}
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-semibold shrink-0">
              {formatTanggalId(detail.pemakai_saat_ini.tanggal_penerimaan)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
