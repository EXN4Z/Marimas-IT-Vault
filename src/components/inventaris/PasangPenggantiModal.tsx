import { useEffect, useState } from 'react';
import { PackageSearch, PlusCircle, Search, CheckCircle2 } from 'lucide-react';
import { getAsetKelengkapan, pasangPengganti, type AsetKelengkapan } from '../../api/asetKelengkapan';
import AsetKelengkapanForm from './AsetKelengkapanForm';

// Modal "Pasang Pengganti" — dibuka dari slot kosong di detail aset induk
// (kelengkapan lama sudah dilepas otomatis lewat Lapor Rusak). Dua opsi:
// Tab 1 pilih dari stok kelengkapan yang tersedia & belum nempel ke aset
// manapun, Tab 2 tambah kelengkapan baru langsung nempel ke aset ini.

type ModalTab = 'stok' | 'baru';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void; // refresh detail aset induk setelah berhasil
  asetIndukId: number | null;
  asetIndukLabel?: string; // mis. "AST-0012 — Dell Latitude 5420"
}

export default function PasangPenggantiModal({ open, onClose, onSaved, asetIndukId, asetIndukLabel }: Props) {
  const [tab, setTab] = useState<ModalTab>('stok');

  // ---- Tab 1: pilih dari stok ----
  const [stokItems, setStokItems] = useState<AsetKelengkapan[]>([]);
  const [stokLoading, setStokLoading] = useState(false);
  const [stokError, setStokError] = useState('');
  const [stokSearch, setStokSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  const loadStok = () => {
    setStokLoading(true);
    setStokError('');
    getAsetKelengkapan()
      .then((data) => {
        // Stok yang boleh dipasang: status tersedia DAN belum nempel ke
        // aset manapun (aset_id null) -- kalau masih nempel ke aset lain
        // berarti bukan stok bebas, jangan ditawarkan di sini.
        setStokItems(data.filter((k) => k.status === 'tersedia' && k.aset_id === null));
      })
      .catch((err) => {
        console.error(err);
        setStokError('Gagal memuat daftar stok kelengkapan.');
      })
      .finally(() => setStokLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setTab('stok');
    setStokSearch('');
    setSelectedId(null);
    setAssignError('');
    loadStok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // Tab "Tambah Baru" reuse AsetKelengkapanForm APA ADANYA (form itu sudah
  // punya modal card/header/footer sendiri) -- jadi begitu tab ini aktif,
  // modal Pilih Stok di bawah diganti total sama form ini, BUKAN ditumpuk
  // jadi dua overlay bertingkat. Tombol X di form = balik nutup modal
  // Pasang Pengganti seutuhnya (konsisten sama tombol X di tab Pilih Stok).
  if (tab === 'baru') {
    return (
      <AsetKelengkapanForm
        open
        onClose={onClose}
        onSaved={() => {
          onSaved();
          onClose();
        }}
        presetAsetId={asetIndukId ?? undefined}
        presetAsetLabel={asetIndukLabel}
      />
    );
  }

  const filteredStok = stokItems.filter((k) => {
    const q = stokSearch.trim().toLowerCase();
    if (!q) return true;
    return [k.kode_kelengkapan, k.nama, k.merek].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const handleAssign = async () => {
    if (!selectedId || !asetIndukId) return;
    setAssigning(true);
    setAssignError('');
    try {
      await pasangPengganti(selectedId, asetIndukId);
      onSaved();
      onClose();
    } catch (err: any) {
      setAssignError(err.response?.data?.message || 'Gagal memasang pengganti.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !assigning) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pasang-pengganti-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Slot kosong</p>
            <h3 id="pasang-pengganti-title" className="text-lg font-semibold text-slate-900">
              Pasang Pengganti
            </h3>
            {asetIndukLabel && <p className="text-xs text-slate-400 mt-0.5">Untuk aset: {asetIndukLabel}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={assigning}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => setTab('stok')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 border-slate-900 text-slate-900 transition-colors"
          >
            <PackageSearch size={15} />
            Pilih dari Stok
          </button>
          <button
            type="button"
            onClick={() => setTab('baru')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600 transition-colors"
          >
            <PlusCircle size={15} />
            Tambah Baru
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={stokSearch}
                  onChange={(e) => setStokSearch(e.target.value)}
                  placeholder="Cari kode, nama, atau merek..."
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              {assignError && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {assignError}
                </p>
              )}
            </div>

            <div className="px-6 py-3 overflow-y-auto flex-1">
              {stokLoading && <p className="text-sm text-slate-400 text-center py-8">Memuat stok...</p>}
              {!stokLoading && stokError && <p className="text-sm text-red-500 text-center py-8">{stokError}</p>}
              {!stokLoading && !stokError && filteredStok.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <PackageSearch size={28} className="mb-2" />
                  <p className="text-sm">
                    {stokSearch
                      ? `Tidak ada hasil untuk "${stokSearch}".`
                      : 'Belum ada stok kelengkapan tersedia (tanpa induk).'}
                  </p>
                </div>
              )}
              {!stokLoading && !stokError && filteredStok.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {filteredStok.map((k) => {
                    const active = selectedId === k.id;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setSelectedId(k.id)}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          active
                            ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {k.nama || [k.merek, k.tipe].filter(Boolean).join(' ') || k.kode_kelengkapan}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {k.kode_kelengkapan}
                            {k.serial_number ? ` · S/N: ${k.serial_number}` : ''}
                          </p>
                        </div>
                        {active && <CheckCircle2 size={18} className="text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={assigning}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedId || assigning}
                className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {assigning ? 'Memasang...' : 'Pasang Pengganti'}
              </button>
            </div>
      </div>
    </div>
  );
}