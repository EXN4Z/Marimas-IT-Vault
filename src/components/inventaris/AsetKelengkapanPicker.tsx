import { useEffect, useState } from 'react';
import { PackageSearch, PlusCircle, Search, X } from 'lucide-react';
import { getAsetKelengkapan, type AsetKelengkapan, type AsetKelengkapanFormValues } from '../../api/asetKelengkapan';
import AsetKelengkapanForm from './AsetKelengkapanForm';

// Dipakai di dalam AsetFormModal (create & edit). Beda sama modal "Pasang
// Pengganti" yang lama: di sini user bisa milih BEBERAPA kelengkapan
// sekaligus (staged), baru beneran diproses (pasangPengganti /
// createAsetKelengkapan) pas tombol Simpan di form aset ditekan -- lihat
// AsetFormModal buat eksekusinya. Komponen ini cuma ngumpulin pilihan.

export type StagedKelengkapan =
  | { type: 'stok'; item: AsetKelengkapan }
  | { type: 'baru'; values: AsetKelengkapanFormValues };

interface Props {
  staged: StagedKelengkapan[];
  onChange: (staged: StagedKelengkapan[]) => void;
  // Kelengkapan yang sudah nempel beneran di backend (mode edit) -- cuma
  // ditampilin buat referensi, gak bisa dilepas dari sini (lepasnya lewat
  // Lapor Rusak di halaman lain).
  existing?: AsetKelengkapan[];
  // Label aset induk buat preset di tab "Tambah Baru", mis. "HP 14s-dq5001TU".
  asetLabel?: string;
  presetAsetId?: number; // cuma keisi kalau mode edit (aset udah punya id)
}

type PickerTab = 'stok' | 'baru';

export default function AsetKelengkapanPicker({ staged, onChange, existing, asetLabel, presetAsetId }: Props) {
  const [tab, setTab] = useState<PickerTab>('stok');
  const [stokItems, setStokItems] = useState<AsetKelengkapan[]>([]);
  const [stokLoading, setStokLoading] = useState(false);
  const [stokError, setStokError] = useState('');
  const [stokSearch, setStokSearch] = useState('');
  const [showTambahBaru, setShowTambahBaru] = useState(false);

  useEffect(() => {
    setStokLoading(true);
    setStokError('');
    getAsetKelengkapan()
      .then((data) => setStokItems(data.filter((k) => k.status === 'tersedia' && k.aset_id === null)))
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
    return [k.kode_kelengkapan, k.nama, k.merek].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  function tambahDariStok(k: AsetKelengkapan) {
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
                    {k.nama || [k.merek, k.tipe].filter(Boolean).join(' ') || k.kode_kelengkapan}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{k.kode_kelengkapan}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-300 mt-1">Buat lepas kelengkapan yang sudah terpasang, pakai Lapor Rusak di detail aset.</p>
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
                      ? s.item.nama || [s.item.merek, s.item.tipe].filter(Boolean).join(' ') || s.item.kode_kelengkapan
                      : s.values.nama || s.values.merek || 'Kelengkapan baru'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {s.type === 'stok' ? `Dari stok · ${s.item.kode_kelengkapan}` : 'Baru'}
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
                placeholder="Cari kode, nama, atau merek..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto p-1.5">
            {stokLoading && <p className="text-xs text-slate-400 text-center py-4">Memuat stok...</p>}
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
                      {k.nama || [k.merek, k.tipe].filter(Boolean).join(' ') || k.kode_kelengkapan}
                    </p>
                    <p className="text-slate-400 truncate">
                      {k.kode_kelengkapan}
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
        <AsetKelengkapanForm
          open
          onClose={() => {
            setShowTambahBaru(false);
            setTab('stok');
          }}
          onSaved={() => {}}
          presetAsetId={presetAsetId}
          presetAsetLabel={asetLabel}
          lockAsetField
          onStage={(values) => onChange([...staged, { type: 'baru', values }])}
        />
      )}
    </div>
  );
}