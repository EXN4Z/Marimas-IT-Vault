import { useEffect, useRef, useState } from 'react';
import { Wrench, MapPin } from 'lucide-react';
import Pagination from '../shared/Pagination';
import SearchInput from '../shared/SearchInput';
import StatusBadge from '../shared/StatusBadge';
import { getRusak, type AsetKelengkapan } from '../../api/asetKelengkapan';
import { formatTanggalId } from './asetHelpers';

// Arsip kelengkapan yang udah dilaporkan rusak (status='rusak', aset_id
// selalu null krn otomatis lepas dari induk pas dilaporkan). Mirror
// struktur TabFotoAset.tsx (table + search + pagination), tapi cuma satu
// list -- gak ada sub-tab kayak Peminjaman/Pengembalian/Rusak di sana.

const PER_PAGE = 10;

interface Props {
  onCount?: (n: number) => void;
}

export default function TabKelengkapanRusak({ onCount }: Props) {
  const [entries, setEntries] = useState<AsetKelengkapan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = (targetPage: number, targetSearch: string) => {
    setLoading(true);
    setError('');
    getRusak({ page: targetPage, per_page: PER_PAGE, search: targetSearch || undefined })
      .then((res) => {
        setEntries(res.data);
        setPage(res.current_page);
        setLastPage(res.last_page);
        setTotal(res.total);
        onCount?.(res.total);
      })
      .catch((err) => {
        console.error(err);
        setError('Gagal memuat data kelengkapan rusak.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, value), 400);
  };

  const gantiHalaman = (target: number) => {
    if (target < 1 || target > lastPage || target === page) return;
    load(target, search);
  };

  const asalLabel = (item: AsetKelengkapan) => {
    // Selalu null pas rusak (otomatis lepas dari induk), tapi lokasi
    // kantor tetap bisa keisi kalau kelengkapan aslinya berdiri sendiri --
    // dipakai buat konteks "ini dulu dari cabang mana" di arsip.
    if (item.lokasiKantor) {
      return (
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <MapPin size={13} className="text-slate-300 shrink-0" />
          {item.lokasiKantor.nama}
        </span>
      );
    }
    return <span className="text-slate-300">-</span>;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-slate-500">
          Arsip kelengkapan yang sudah dilaporkan rusak — dilepas otomatis dari aset induk, tidak
          dihapus, dan tidak bisa dikembalikan ke status semula.
        </p>
      </div>

      <SearchInput
        value={search}
        onChange={handleSearchChange}
        placeholder="Cari kode, nama, atau merek..."
        className="mb-4"
      />

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}
        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Wrench size={32} className="mb-2" />
            <p className="text-sm">
              {search ? `Tidak ada hasil untuk "${search}".` : 'Belum ada kelengkapan yang dilaporkan rusak.'}
            </p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Kode</th>
                  <th className="px-6 py-3 font-medium">Nama / Merek</th>
                  <th className="px-6 py-3 font-medium">Asal Lokasi</th>
                  <th className="px-6 py-3 font-medium">Tanggal Rusak</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{item.kode_kelengkapan}</td>
                    <td className="px-6 py-3 text-slate-600">
                      {item.nama || '-'} · {[item.merek, item.tipe].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-6 py-3">{asalLabel(item)}</td>
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{formatTanggalId(item.tanggal_rusak)}</td>
                    <td className="px-6 py-3">
                      <StatusBadge colorClass="bg-red-100 text-red-800">Rusak</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && entries.length > 0 && lastPage > 1 && (
          <div className="px-6 py-3 border-t border-slate-100">
            <Pagination
              currentPage={page}
              totalPages={lastPage}
              onPageChange={gantiHalaman}
              totalItems={total}
              itemLabel="kelengkapan rusak"
              className="pt-0 mt-0 border-t-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}