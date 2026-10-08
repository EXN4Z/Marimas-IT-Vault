import { RotateCcw } from 'lucide-react';
import Select from '../../../components/shared/Select';
import { JENIS_KERUSAKAN_OPTIONS } from '../../../utils/inventoryHelpers';
import SearchInput from '../../../components/shared/SearchInput';

interface PenangananFilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  filterKerusakan: string;
  setFilterKerusakan: (value: string) => void;
}

export default function PenangananFilterBar({ search, setSearch, setPage, filterKerusakan, setFilterKerusakan }: PenangananFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <SearchInput
        value={search}
        onChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        placeholder="Cari kode inventory, nama barang, keluhan, pelapor..."
        className="flex-1"
      />

      <div className="w-full sm:w-56 shrink-0">
        <Select
          value={filterKerusakan}
          onChange={(val) => {
            setFilterKerusakan(val);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Semua Jenis Kerusakan' },
            ...JENIS_KERUSAKAN_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />
      </div>

      {(search || filterKerusakan !== 'all') && (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setFilterKerusakan('all');
            setPage(1);
          }}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1.5 shrink-0 self-center"
        >
          <RotateCcw size={13} />
          Reset Filter
        </button>
      )}
    </div>
  );
}
