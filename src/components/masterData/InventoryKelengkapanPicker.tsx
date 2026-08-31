import { useEffect, useState } from 'react';
import { PackageSearch, PlusCircle, Search, X } from 'lucide-react';
import { getInventory, type Inventory } from '../../api/masterData/inventory';
import InventoryFormModal, { type KelengkapanFormValues } from './InventoryFormModal';
import { Skeleton } from '../shared/skeleton';

// Dipakai di dalam InventoryFormModal (create & edit). Beda sama modal "Pasang
// Pengganti" yang lama: di sini user bisa milih BEBERAPA kelengkapan
// sekaligus (staged), baru beneran diproses (pasangPenggantiKelengkapan /
// createInventory) pas tombol Simpan di form inventory ditekan -- lihat
// InventoryFormModal buat eksekusinya. Komponen ini cuma ngumpulin pilihan.

export type StagedKelengkapan =
  | { type: 'stok'; item: Inventory }
  | { type: 'baru'; values: KelengkapanFormValues };

interface Props {
  staged: StagedKelengkapan[];
  onChange: (staged: StagedKelengkapan[]) => void;
  // Kelengkapan yang sudah nempel beneran di backend (mode edit) -- cuma
  // ditampilin buat referensi, gak bisa dilepas dari sini (lepasnya lewat
  // Lapor Rusak di halaman lain).
  existing?: Inventory[];
  // Label inventory induk buat preset di tab "Tambah Baru", mis. "HP 14s-dq5001TU".
  inventoryLabel?: string;
  presetInventoryId?: number; // cuma keisi kalau mode edit (inventory udah punya id)
}

type PickerTab = 'stok' | 'baru';

export default function InventoryKelengkapanPicker({ staged, onChange, existing, inventoryLabel, presetInventoryId }: Props) {
  const [tab, setTab] = useState<PickerTab>('stok');
  const [stokItems, setStokItems] = useState<Inventory[]>([]);
  const [stokLoading, setStokLoading] = useState(false);
  const [stokError, setStokError] = useState('');
  const [stokSearch, setStokSearch] = useState('');
  const [showTambahBaru, setShowTambahBaru] = useState(false);

  useEffect(() => {
    setStokLoading(true);
    setStokError('');
    getInventory({ kategori: 'kelengkapan' })
      .then((data) => setStokItems(data.filter((k) => k.status === 'tersedia' && k.parent_id === null)))
      .catch(() => setStokError('Gagal memuat daftar stok kelengkapan.'))
      .finally(() => setStokLoading(false));
  }, []);

  const stagedStokIds = new Set(
    staged.filter((s): s is Extract<StagedKelengkapan, { type: 'stok' }> => s.type === 'stok').map((s) => s.item.id)
  );

  const filteredStok = stokItems.filter((k) => {
    if (stagedStokIds.has(k.id)) return false;
    const q = stokSearch.trim().toLowerCase();
    if (!q) return true;
    return [k.kode_inventory, k.nama].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  function tambahDariStok(k: Inventory) {
    onChange([...staged, { type: 'stok', item: k }]);
  }

  function hapusStaged(index: number) {
    onChange(staged.filter((_, i) => i !== index));
  }

  return (
    <div>
      {existing && existing.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-1.5">Sudah terpasang ({existing.length})</p>
          <div className="flex flex-col gap-1.5">
            {existing.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-700 font-medium truncate">
                    {k.nama || k.kode_inventory}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{k.kode_inventory}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-300 mt-1">Buat lepas kelengkapan yang sudah terpasang, pakai Lapor Rusak di detail inventory.</p>
        </div>
      )}

      {staged.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-1.5">Akan ditambahkan ({staged.length})</p>
          <div className="flex flex-col gap-1.5">
            {staged.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-800 font-medium truncate">
                    {s.type === 'stok'
                      ? s.item.nama || s.item.kode_inventory
                      : s.values.nama || 'Kelengkapan baru'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {s.type === 'stok' ? `Dari stok · ${s.item.kode_inventory}` : 'Baru'}
                  </p>
                </div>
                <button type="button" onClick={() => hapusStaged(i)} className="text-slate-400 hover:text-red-600 shrink-0 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setTab('stok')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            tab === 'stok' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <PackageSearch size={13} />
          Pilih dari Stok
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('baru');
            setShowTambahBaru(true);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            tab === 'baru' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <PlusCircle size={13} />
          Tambah Baru
        </button>
      </div>

      {tab === 'stok' && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={stokSearch}
                onChange={(e) => setStokSearch(e.target.value)}
                placeholder="Cari kode atau nama..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto p-1.5">
            {stokLoading && (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-2.5 py-2 space-y-1.5">
                    <Skeleton className="h-3 w-1/2 rounded" />
                    <Skeleton className="h-2.5 w-1/3 rounded" />
                  </div>
                ))}
              </div>
            )}
            {!stokLoading && stokError && <p className="text-xs text-red-500 text-center py-4">{stokError}</p>}
            {!stokLoading && !stokError && filteredStok.length === 0 && (
              <p className="text-xs text-slate-300 text-center py-4">
                {stokSearch ? `Tidak ada hasil untuk "${stokSearch}".` : 'Belum ada stok kelengkapan tersedia.'}
              </p>
            )}
            {!stokLoading &&
              !stokError &&
              filteredStok.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => tambahDariStok(k)}
                  className="w-full flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {k.nama || k.kode_inventory}
                    </p>
                    <p className="text-slate-400 truncate">
                      {k.kode_inventory}
                      {k.serial_number ? ` · S/N: ${k.serial_number}` : ''}
                    </p>
                  </div>
                  <PlusCircle size={15} className="text-slate-300 shrink-0" />
                </button>
              ))}
          </div>
        </div>
      )}

      {showTambahBaru && (
        <InventoryFormModal
          inventory={null}
          kategoriKode="kelengkapan"
          supplierOptions={[]}
          onClose={() => {
            setShowTambahBaru(false);
            setTab('stok');
          }}
          onSaved={() => {}}
          presetInventoryId={presetInventoryId}
          presetInventoryLabel={inventoryLabel}
          lockInventoryField
          onStage={(values) => onChange([...staged, { type: 'baru', values }])}
        />
      )}
    </div>
  );
}