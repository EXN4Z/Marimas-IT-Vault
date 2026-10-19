import { RotateCcw } from 'lucide-react';
import Select from '../../../components/form/Select';
import { JENIS_KERUSAKAN_OPTIONS } from '../../inventory/inventoryHelpers';
import SearchInput from '../../../components/form/SearchInput';

// [F6-INERTIA] Filter dijalankan server: `search` = input lokal (debounce -> visit di halaman), `setFilterKerusakan` & `onReset`
// = visit ke /penanganan-inventory. Pindah ke halaman 1 diurus halaman (visitList), jadi tidak ada setPage di sini lagi.
interface PenangananFilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  filterKerusakan: string;
  setFilterKerusakan: (value: string) => void;
  onReset: () => void;
}

export default function PenangananFilterBar({ search, setSearch, filterKerusakan, setFilterKerusakan, onReset }: PenangananFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Cari kode inventory, nama barang, keluhan, pelapor..."
        className="flex-1"
      />

      <div className="w-full sm:w-56 shrink-0">
        <Select
          value={filterKerusakan}
          onChange={setFilterKerusakan}
          options={[
            { value: 'all', label: 'Semua Jenis Kerusakan' },
            ...JENIS_KERUSAKAN_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />
      </div>

      {(search || filterKerusakan !== 'all') && (
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1.5 shrink-0 self-center"
        >
          <RotateCcw size={13} />
          Reset Filter
        </button>
      )}
    </div>
  );
}
