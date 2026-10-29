import { ChevronDown, RotateCcw } from 'lucide-react';
import SearchInput from '../../../components/form/SearchInput';
import type { Kategori } from '../../master-data/kategori/types';

interface InventoryFilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  kategoriDropdownRef: React.RefObject<HTMLDivElement | null>;
  setKategoriDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedKategoriIds: number[];
  kategoriOptions: Kategori[];
  kategoriDropdownOpen: boolean;
  setSelectedKategoriIds: React.Dispatch<React.SetStateAction<number[]>>;
  handleToggleKategori: (id: number) => void;
}

export default function InventoryFilterBar({ search, setSearch, kategoriDropdownRef, setKategoriDropdownOpen, selectedKategoriIds, kategoriOptions, kategoriDropdownOpen, setSelectedKategoriIds, handleToggleKategori }: InventoryFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Cari nama atau kode inventory..."
        className="flex-1"
      />
      {/* Filter Kategori -- dropdown checklist dinamis dari getKategori().
          Multi-select: bisa pilih lebih dari 1 kategori sekaligus.
          Array kosong = semua kategori lolos (default). */}
      <div className="relative w-full sm:w-56 shrink-0" ref={kategoriDropdownRef}>
        <button
          type="button"
          onClick={() => setKategoriDropdownOpen((v) => !v)}
          className={`w-full flex items-center justify-between rounded-lg border bg-white dark:bg-[#222226] px-3 py-2.5 text-sm text-slate-700 dark:text-zinc-200 shadow-sm outline-none transition-all duration-150 cursor-pointer ${
            kategoriDropdownOpen
              ? 'border-slate-900 dark:border-zinc-400 hover:border-slate-900 dark:hover:border-zinc-400'
              : 'border-slate-300 dark:border-[#383842] hover:border-slate-400 dark:hover:border-zinc-500'
          }`}
        >
          <span className="truncate">
            {selectedKategoriIds.length === 0
              ? 'Semua Kategori'
              : selectedKategoriIds.length === 1
              ? (kategoriOptions.find((k) => k.id === selectedKategoriIds[0])?.nama ?? 'Kategori')
              : `${selectedKategoriIds.length} Kategori`}
          </span>
          <ChevronDown size={14} className={`ml-2 flex-shrink-0 text-slate-400 transition-transform ${kategoriDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {kategoriDropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
            {/* "Semua" shortcut — klik clear semua pilihan */}
            <button
              type="button"
              onClick={() => { setSelectedKategoriIds([]); setKategoriDropdownOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition ${selectedKategoriIds.length === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
            >
              Semua Kategori
            </button>
            {kategoriOptions.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => handleToggleKategori(k.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition"
              >
                <span
                  className={`w-4 h-4 flex-shrink-0 rounded border transition ${
                    selectedKategoriIds.includes(k.id)
                      ? 'bg-slate-900 border-slate-900'
                      : 'border-slate-300'
                  }`}
                >
                  {selectedKategoriIds.includes(k.id) && (
                    <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4"><path d="M13.5 4.5l-7 7L3 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                  )}
                </span>
                <span className="text-slate-700">{k.nama}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedKategoriIds.length > 0 && (
        <button
          type="button"
          onClick={() => setSelectedKategoriIds([])}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1.5 shrink-0 self-center"
          title="Reset filter kategori"
        >
          <RotateCcw size={13} />
          Reset Filter
        </button>
      )}
    </div>
  );
}
