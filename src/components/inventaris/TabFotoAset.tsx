import { useEffect, useRef, useState } from 'react';
import { Images, Search, X, ChevronLeft, ChevronRight, HandCoins, Undo2, Wrench, Eye } from 'lucide-react';
import Pagination from '../shared/Pagination';
import ScrollableTabBar, { type ScrollableTabItem } from '../shared/ScrollableTabBar';
import { getFotoPemakaiAset, type FotoPemakaiEntry } from '../../api/aset';
import { getFotoKerusakanAset, type AsetPenanganan } from '../../api/asetPenanganan';
import { namaPemakai, formatTanggalWaktuId } from './asetHelpers';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';
const PER_PAGE = 10;

type FotoTab = 'peminjaman' | 'pengembalian' | 'rusak';

const TABS: ScrollableTabItem<FotoTab>[] = [
  { key: 'peminjaman', label: 'Peminjaman', icon: HandCoins },
  { key: 'pengembalian', label: 'Pengembalian', icon: Undo2 },
  { key: 'rusak', label: 'Rusak', icon: Wrench },
];

interface Props {}

// State generik yang sama bentuknya buat ketiga tab (entries beda tipe,
// tapi search/page/lastPage/total/loading semuanya sama pola), jadi
// masing-masing tab punya pagination & pencarian sendiri-sendiri --
// pindah tab gak reset tab lain.
interface TabState<T> {
  entries: T[];
  loading: boolean;
  // true begitu fetch pertama kali kelar (sukses ATAUPUN gagal) — dipakai
  // buat nentuin kapan badge angka boleh ditampilkan, biar gak sempet
  // kelip nunjukin "0" dulu sebelum data aslinya kebaca dari server.
  loaded: boolean;
  search: string;
  page: number;
  lastPage: number;
  total: number;
}

const initialTabState = <T,>(): TabState<T> => ({
  entries: [],
  loading: true,
  loaded: false,
  search: '',
  page: 1,
  lastPage: 1,
  total: 0,
});

export default function TabFotoAset({}: Props) {
  const [activeTab, setActiveTab] = useState<FotoTab>('peminjaman');

  const [peminjaman, setPeminjaman] = useState<TabState<FotoPemakaiEntry>>(initialTabState);
  const [pengembalian, setPengembalian] = useState<TabState<FotoPemakaiEntry>>(initialTabState);
  const [rusak, setRusak] = useState<TabState<AsetPenanganan>>(initialTabState);

  const [modalPhotos, setModalPhotos] = useState<{ photos: string[]; index: number } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPeminjaman = (targetPage: number, targetSearch: string) => {
    setPeminjaman((s) => ({ ...s, loading: true }));
    getFotoPemakaiAset(targetPage, PER_PAGE, targetSearch || undefined, 'peminjaman')
      .then((res) =>
        setPeminjaman((s) => ({ ...s, entries: res.data, page: res.current_page, lastPage: res.last_page, total: res.total, loading: false, loaded: true }))
      )
      .catch((err) => {
        console.error(err);
        setPeminjaman((s) => ({ ...s, loading: false, loaded: true }));
      });
  };

  const loadPengembalian = (targetPage: number, targetSearch: string) => {
    setPengembalian((s) => ({ ...s, loading: true }));
    getFotoPemakaiAset(targetPage, PER_PAGE, targetSearch || undefined, 'pengembalian')
      .then((res) =>
        setPengembalian((s) => ({ ...s, entries: res.data, page: res.current_page, lastPage: res.last_page, total: res.total, loading: false, loaded: true }))
      )
      .catch((err) => {
        console.error(err);
        setPengembalian((s) => ({ ...s, loading: false, loaded: true }));
      });
  };

  const loadRusak = (targetPage: number, targetSearch: string) => {
    setRusak((s) => ({ ...s, loading: true }));
    getFotoKerusakanAset(targetPage, PER_PAGE, targetSearch || undefined)
      .then((res) =>
        setRusak((s) => ({ ...s, entries: res.data, page: res.current_page, lastPage: res.last_page, total: res.total, loading: false, loaded: true }))
      )
      .catch((err) => {
        console.error(err);
        setRusak((s) => ({ ...s, loading: false, loaded: true }));
      });
  };

  // load awal buat ketiga tab sekalian (biar badge count di masing-masing
  // sub-tab langsung kebaca meski user belum pindah-pindah tab)
  useEffect(() => {
    loadPeminjaman(1, '');
    loadPengembalian(1, '');
    loadRusak(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSearch =
    activeTab === 'peminjaman' ? peminjaman.search : activeTab === 'pengembalian' ? pengembalian.search : rusak.search;

  const handleSearchChange = (value: string) => {
    if (activeTab === 'peminjaman') setPeminjaman((s) => ({ ...s, search: value }));
    else if (activeTab === 'pengembalian') setPengembalian((s) => ({ ...s, search: value }));
    else setRusak((s) => ({ ...s, search: value }));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (activeTab === 'peminjaman') loadPeminjaman(1, value);
      else if (activeTab === 'pengembalian') loadPengembalian(1, value);
      else loadRusak(1, value);
    }, 400);
  };

  const gantiHalaman = (target: number) => {
    if (activeTab === 'peminjaman') {
      if (target < 1 || target > peminjaman.lastPage || target === peminjaman.page) return;
      loadPeminjaman(target, peminjaman.search);
    } else if (activeTab === 'pengembalian') {
      if (target < 1 || target > pengembalian.lastPage || target === pengembalian.page) return;
      loadPengembalian(target, pengembalian.search);
    } else {
      if (target < 1 || target > rusak.lastPage || target === rusak.page) return;
      loadRusak(target, rusak.search);
    }
  };

  const openModal = (photos: string[], index = 0) => setModalPhotos({ photos, index });
  const closeModal = () => setModalPhotos(null);
  const nextPhoto = () =>
    setModalPhotos((m) => (m ? { ...m, index: (m.index + 1) % m.photos.length } : m));
  const prevPhoto = () =>
    setModalPhotos((m) => (m ? { ...m, index: (m.index - 1 + m.photos.length) % m.photos.length } : m));

  const asetLabel = (aset?: { kode_aset: string; merek: string | null; tipe: string | null } | null) => (
    <>
      <p className="font-medium text-slate-800">{aset?.kode_aset || '-'}</p>
      <p className="text-xs text-slate-400 truncate max-w-[160px]">
        {[aset?.merek, aset?.tipe].filter(Boolean).join(' ') || '-'}
      </p>
    </>
  );

  const renderTable = () => {
    if (activeTab === 'peminjaman' || activeTab === 'pengembalian') {
      const state = activeTab === 'peminjaman' ? peminjaman : pengembalian;
      const tanggalKey = activeTab === 'peminjaman' ? 'tanggal_penerimaan' : 'tanggal_pengembalian';
      const waktuAkuratKey = activeTab === 'peminjaman' ? 'diterima_at' : 'dikembalikan_at';
      const fotoKey = activeTab === 'peminjaman' ? 'foto_penerimaan' : 'foto_pengembalian';
      const tanggalLabel = activeTab === 'peminjaman' ? 'Tgl Serah Terima' : 'Tgl Pengembalian';

      if (state.loading) return <p className="text-sm text-slate-400 text-center py-10">Memuat foto...</p>;

      if (state.entries.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Images size={32} className="mb-2" />
            <p className="text-sm">
              {state.search ? `Tidak ada hasil untuk "${state.search}".` : 'Belum ada foto bukti yang diunggah.'}
            </p>
          </div>
        );
      }

      return (
        <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium text-left">Aset</th>
                  <th className="px-4 py-3 font-medium text-left">Pemakai</th>
                  <th className="px-4 py-3 font-medium text-left">{tanggalLabel}</th>
                  <th className="px-4 py-3 font-medium text-left">Jumlah Foto</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.map((e) => {
                  const foto = e[fotoKey] as string[] | null;
                  const tanggal = e[tanggalKey] as string | null;
                  const waktuAkurat = e[waktuAkuratKey] as string | null;
                  return (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 whitespace-nowrap">{asetLabel(e.aset)}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                        <p className="truncate" title={namaPemakai({ pekerja: e.pekerja, user: e.user })}>
                          {namaPemakai({ pekerja: e.pekerja, user: e.user })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalWaktuId(waktuAkurat, tanggal)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{foto?.length ?? 0} foto</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {foto && foto.length > 0 ? (
                            <button
                              onClick={() => openModal(foto, 0)}
                              title="Lihat Foto"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Eye size={14} />
                              Lihat Foto
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ==== Tab Rusak ====
    if (rusak.loading) return <p className="text-sm text-slate-400 text-center py-10">Memuat foto...</p>;

    if (rusak.entries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Images size={32} className="mb-2" />
          <p className="text-sm">
            {rusak.search ? `Tidak ada hasil untuk "${rusak.search}".` : 'Belum ada foto laporan kerusakan.'}
          </p>
        </div>
      );
    }

    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium text-left">Aset</th>
                <th className="px-4 py-3 font-medium text-left">Pelapor</th>
                <th className="px-4 py-3 font-medium text-left">Kerusakan</th>
                <th className="px-4 py-3 font-medium text-left">Tgl Lapor</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rusak.entries.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 whitespace-nowrap">{asetLabel(p.aset)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                    <p className="truncate" title={namaPemakai(p.pemakai)}>{namaPemakai(p.pemakai)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                    <p className="font-medium text-slate-800 truncate">{p.jenis_kerusakan}</p>
                    <p className="text-xs text-slate-400 truncate">{p.keluhan}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalWaktuId(p.lapor_at, p.tanggal_lapor)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      {p.foto ? (
                        <button
                          onClick={() => openModal([p.foto as string], 0)}
                          title="Lihat Foto"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Eye size={14} />
                          Lihat Foto
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const activeState = activeTab === 'peminjaman' ? peminjaman : activeTab === 'pengembalian' ? pengembalian : rusak;

  // Badge muncul cuma abis fetch pertama kelar (loaded=true), biar gak
  // sempet kelip nunjukin "0" dulu sebelum totalnya beneran kebaca.
  const tabsWithBadge: ScrollableTabItem<FotoTab>[] = TABS.map((t) => {
    const state = t.key === 'peminjaman' ? peminjaman : t.key === 'pengembalian' ? pengembalian : rusak;
    return { ...t, badge: state.loaded ? state.total : null };
  });

  return (
    <div className="flex flex-col gap-6">
      <ScrollableTabBar tabs={tabsWithBadge} activeTab={activeTab} onChange={setActiveTab} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={currentSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Cari kode aset, merek, atau tipe..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none"
        />
      </div>

      {renderTable()}

      {activeState.lastPage > 1 && (
        <Pagination
          currentPage={activeState.page}
          totalPages={activeState.lastPage}
          onPageChange={gantiHalaman}
          totalItems={activeState.total}
          itemLabel="data"
          className="pt-2 mt-0 border-t-0"
        />
      )}

      {/* ==== Modal lihat foto — fixed di tengah layar, terpisah dari
           halaman list di belakangnya ==== */}
      {modalPhotos && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center px-4">
          <button onClick={closeModal} className="absolute top-5 right-5 text-white/70 hover:text-white">
            <X size={24} />
          </button>
          {modalPhotos.photos.length > 1 && (
            <button onClick={prevPhoto} className="absolute left-4 text-white/70 hover:text-white p-2">
              <ChevronLeft size={28} />
            </button>
          )}
          <img
            src={STORAGE_BASE_URL + modalPhotos.photos[modalPhotos.index]}
            alt=""
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
          />
          {modalPhotos.photos.length > 1 && (
            <button onClick={nextPhoto} className="absolute right-4 text-white/70 hover:text-white p-2">
              <ChevronRight size={28} />
            </button>
          )}
          {modalPhotos.photos.length > 1 && (
            <p className="absolute bottom-6 text-white/70 text-xs">
              {modalPhotos.index + 1} / {modalPhotos.photos.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}