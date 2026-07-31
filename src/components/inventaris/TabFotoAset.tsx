import { useEffect, useRef, useState } from 'react';
import { Images, Search, X, ChevronLeft, ChevronRight, HandCoins, Undo2 } from 'lucide-react';
import Pagination from '../shared/Pagination';
import { getFotoPemakaiAset, type FotoPemakaiEntry } from '../../api/aset';
import { namaPemakai } from './asetHelpers';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  onCount?: (count: number) => void;
}

export default function TabFotoAset({ onCount }: Props) {
  const [entries, setEntries] = useState<FotoPemakaiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const load = (targetPage = 1, targetSearch = search) => {
    setLoading(true);
    getFotoPemakaiAset(targetPage, 12, targetSearch || undefined)
      .then((res) => {
        setEntries(res.data);
        setPage(res.current_page);
        setLastPage(res.last_page);
        setTotal(res.total);
        onCount?.(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, search), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const gantiHalaman = (target: number) => {
    if (target < 1 || target > lastPage || target === page) return;
    load(target, search);
  };

  const openLightbox = (photos: string[], index: number) => setLightbox({ photos, index });
  const closeLightbox = () => setLightbox(null);
  const nextPhoto = () =>
    setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : lb));
  const prevPhoto = () =>
    setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : lb));

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode aset, merek, atau tipe..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none"
        />
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-10">Memuat foto...</p>}

      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Images size={32} className="mb-2" />
          <p className="text-sm">
            {search ? `Tidak ada hasil untuk "${search}".` : 'Belum ada foto bukti yang diunggah.'}
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="flex flex-col gap-4">
          {entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{e.aset?.kode_aset || '-'}</p>
                  <p className="text-xs text-slate-400">
                    {[e.aset?.merek, e.aset?.tipe].filter(Boolean).join(' ') || '-'} ·{' '}
                    {namaPemakai({ pekerja: e.pekerja, user: e.user } as any)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {e.foto_penerimaan && e.foto_penerimaan.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-amber-700">
                      <HandCoins size={13} />
                      Serah Terima · {formatTanggalId(e.tanggal_penerimaan)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-w-md">
                      {e.foto_penerimaan.map((foto, idx) => (
                        <button
                          key={idx}
                          onClick={() => openLightbox(e.foto_penerimaan!, idx)}
                          className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition"
                        >
                          <img src={STORAGE_BASE_URL + foto} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {e.foto_pengembalian && e.foto_pengembalian.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-emerald-700">
                      <Undo2 size={13} />
                      Pengembalian · {formatTanggalId(e.tanggal_pengembalian)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-w-md">
                      {e.foto_pengembalian.map((foto, idx) => (
                        <button
                          key={idx}
                          onClick={() => openLightbox(e.foto_pengembalian!, idx)}
                          className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition"
                        >
                          <img src={STORAGE_BASE_URL + foto} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {lastPage > 1 && (
            <Pagination
              currentPage={page}
              totalPages={lastPage}
              onPageChange={gantiHalaman}
              totalItems={total}
              itemLabel="foto"
              className="pt-2 mt-0 border-t-0"
            />
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center px-4">
          <button onClick={closeLightbox} className="absolute top-5 right-5 text-white/70 hover:text-white">
            <X size={24} />
          </button>
          {lightbox.photos.length > 1 && (
            <button onClick={prevPhoto} className="absolute left-4 text-white/70 hover:text-white p-2">
              <ChevronLeft size={28} />
            </button>
          )}
          <img
            src={STORAGE_BASE_URL + lightbox.photos[lightbox.index]}
            alt=""
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
          />
          {lightbox.photos.length > 1 && (
            <button onClick={nextPhoto} className="absolute right-4 text-white/70 hover:text-white p-2">
              <ChevronRight size={28} />
            </button>
          )}
          {lightbox.photos.length > 1 && (
            <p className="absolute bottom-6 text-white/70 text-xs">
              {lightbox.index + 1} / {lightbox.photos.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}