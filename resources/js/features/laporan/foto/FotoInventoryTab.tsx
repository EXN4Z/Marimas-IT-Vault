import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Images, X, ChevronLeft, ChevronRight, HandCoins, Undo2, Wrench, Eye, Package, ImageOff, ZoomIn } from 'lucide-react';
import Pagination from '../../../components/table/Pagination';
import ScrollableTabBar, { type ScrollableTabItem } from '../../../components/navigation/ScrollableTabBar';
import SearchInput from '../../../components/form/SearchInput';
import Tooltip from '../../../components/feedback/Tooltip';
import type { Inventory } from '../../inventory/types/inventory';
import type { LaporanFotoProps } from '../types';
import type { FotoPemakaiEntry } from '../../inventory/types/inventoryPemakai';
import type { InventoryPenanganan } from '../../penanganan/types';
import { namaPemakai, namaPelaporPenanganan, formatTanggalWaktuId, formatJenisKerusakan } from '../../inventory/inventoryHelpers';
import FotoZoomViewer from '../../../components/media/FotoZoomViewer';
import { SkeletonTable } from '../../../components/skeleton/SkeletonTableRow';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/storage/' : '/storage/');
const PER_PAGE = 10;

interface DetailRow {
  label: string;
  // null/undefined/'' = baris disembunyikan (mis. merk belum diisi)
  value: string | null | undefined;
}

interface FotoDetail {
  judul: string;
  subjudul: string;
  photos: string[];
  rows: DetailRow[];
}

type FotoTab = 'inventory' | 'peminjaman' | 'pengembalian' | 'rusak';

const TABS: ScrollableTabItem<FotoTab>[] = [
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'peminjaman', label: 'Peminjaman', icon: HandCoins },
  { key: 'pengembalian', label: 'Pengembalian', icon: Undo2 },
  { key: 'rusak', label: 'Rusak', icon: Wrench },
];

// [F7-INERTIA] Data dari props `foto` (LaporanPageController -> FotoInventoryQuery): server cuma mengirim SATU sub-tab (yang
// aktif) per halaman, dipaginasi server. Sub-tab, pencarian, dan halaman hidup di query string (?tab=foto_inventory&sub=&search=&page=).
// Sub-tab lain tidak punya data di klien (state-nya kosong), jadi pindah sub-tab = visit baru (pencarian & halaman direset).
interface TabState<T> {
  entries: T[];
  loading: boolean;
  search: string;
  page: number;
  lastPage: number;
  total: number;
}

const kosong = <T,>(): TabState<T> => ({ entries: [], loading: false, search: '', page: 1, lastPage: 1, total: 0 });

export default function FotoInventoryTab() {
  const foto = (usePage().props as unknown as { foto?: LaporanFotoProps | null }).foto ?? null;
  const activeTab: FotoTab = foto?.sub ?? 'inventory';
  const appliedSearch = foto?.filters.search ?? '';

  const [searchInput, setSearchInput] = useState(appliedSearch);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<FotoDetail | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const aktif = <T,>(): TabState<T> => ({
    entries: (foto?.data ?? []) as unknown as T[],
    loading,
    search: appliedSearch,
    page: foto?.current_page ?? 1,
    lastPage: foto?.last_page ?? 1,
    total: foto?.total ?? 0,
  });

  const inventory = activeTab === 'inventory' ? aktif<Inventory>() : kosong<Inventory>();
  const peminjaman = activeTab === 'peminjaman' ? aktif<FotoPemakaiEntry>() : kosong<FotoPemakaiEntry>();
  const pengembalian = activeTab === 'pengembalian' ? aktif<FotoPemakaiEntry>() : kosong<FotoPemakaiEntry>();
  const rusak = activeTab === 'rusak' ? aktif<InventoryPenanganan>() : kosong<InventoryPenanganan>();

  const kunjungi = (params: { sub: FotoTab; search?: string; page?: number }, replace = true) => {
    const data: Record<string, string | number> = { tab: 'foto_inventory' };
    if (params.sub !== 'inventory') data.sub = params.sub;
    if (params.search) data.search = params.search;
    if (params.page && params.page > 1) data.page = params.page;
    router.get('/laporan', data, {
      preserveState: true,
      preserveScroll: true,
      replace,
      onStart: () => setLoading(true),
      onFinish: () => setLoading(false),
    });
  };

  const setActiveTab = (tab: FotoTab) => {
    if (tab === activeTab) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    kunjungi({ sub: tab });
  };

  const currentSearch = searchInput;

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => kunjungi({ sub: activeTab, search: value }), 400);
  };

  const gantiHalaman = (target: number) => {
    const s = aktif<unknown>();
    if (target < 1 || target > s.lastPage || target === s.page) return;
    kunjungi({ sub: activeTab, search: appliedSearch, page: target }, false);
  };

  const bukaDetail = (d: FotoDetail) => setDetail(d);

  const tombolDetail = (onClick: () => void) => (
    <button
      onClick={onClick}
      title="Detail"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
    >
      <Eye size={14} />
      Detail
    </button>
  );

  // 1 baris: kode saja. Nama unit, merk, dll dipindah ke modal Detail.
  const inventoryLabel = (inventory?: { kode_inventory: string } | null) => (
    <p className="font-medium text-slate-800">{inventory?.kode_inventory || '-'}</p>
  );

  const renderTable = () => {
    // ==== Tab Inventory (foto dasar barang, diupload pas tambah/edit di
    // Master Data) — beda dari 3 tab lain yang isinya foto TRANSAKSI ====
    if (activeTab === 'inventory') {
      if (inventory.loading) {
        return (
          <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <tbody>
                  <SkeletonTable columns={4} rows={5} />
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      if (inventory.entries.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Images size={32} className="mb-2" />
            <p className="text-sm">
              {inventory.search ? `Tidak ada hasil untuk "${inventory.search}".` : 'Belum ada foto barang yang diunggah.'}
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
                  <th className="px-4 py-3 font-medium text-left">Inventory</th>
                  <th className="px-4 py-3 font-medium text-left">Kategori</th>
                  <th className="px-4 py-3 font-medium text-left">Tgl Input</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {inventory.entries.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 whitespace-nowrap">{inventoryLabel(item)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.kategori?.nama || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalWaktuId(null, item.tanggal_input)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {tombolDetail(() =>
                          bukaDetail({
                            judul: item.kode_inventory,
                            subjudul: 'Foto Inventory',
                            photos: item.foto ? [item.foto] : [],
                            rows: [
                              { label: 'Nama', value: item.nama || '-' },
                              { label: 'Kategori', value: item.kategori?.nama },
                              { label: 'Merk', value: item.merk },
                              { label: 'Type', value: item.type },
                              { label: 'Warna', value: item.warna },
                              { label: 'Serial Number', value: item.serial_number },
                              { label: 'Tgl Input', value: formatTanggalWaktuId(null, item.tanggal_input) },
                              { label: 'Keterangan', value: item.keterangan },
                            ],
                          })
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
    }

    if (activeTab === 'peminjaman' || activeTab === 'pengembalian') {
      const state = activeTab === 'peminjaman' ? peminjaman : pengembalian;
      const tanggalKey = activeTab === 'peminjaman' ? 'tanggal_penerimaan' : 'tanggal_pengembalian';
      const waktuAkuratKey = activeTab === 'peminjaman' ? 'diterima_at' : 'dikembalikan_at';
      const fotoKey = activeTab === 'peminjaman' ? 'foto_penerimaan' : 'foto_pengembalian';
      const tanggalLabel = activeTab === 'peminjaman' ? 'Tgl Serah Terima' : 'Tgl Pengembalian';

      if (state.loading) {
        return (
          <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <tbody>
                  <SkeletonTable columns={5} rows={5} />
                </tbody>
              </table>
            </div>
          </div>
        );
      }

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
                  <th className="px-4 py-3 font-medium text-left">Inventory</th>
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
                      <td className="px-4 py-3 whitespace-nowrap">{inventoryLabel(e.inventory)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="max-w-[160px]">
                          <Tooltip content={namaPemakai({ user: e.user })}>
                            <p className="truncate">{namaPemakai({ user: e.user })}</p>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalWaktuId(waktuAkurat, tanggal)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{foto?.length ?? 0} foto</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {tombolDetail(() =>
                            bukaDetail({
                              judul: e.inventory?.kode_inventory || '-',
                              subjudul: activeTab === 'peminjaman' ? 'Foto Peminjaman' : 'Foto Pengembalian',
                              photos: foto ?? [],
                              rows: [
                                { label: 'Nama', value: e.inventory?.nama || '-' },
                                { label: 'Merk', value: e.inventory?.merk },
                                { label: 'Type', value: e.inventory?.type },
                                { label: 'Pemakai', value: namaPemakai({ user: e.user }) },
                                { label: tanggalLabel, value: formatTanggalWaktuId(waktuAkurat, tanggal) },
                                { label: 'Jumlah Foto', value: `${foto?.length ?? 0} foto` },
                              ],
                            })
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
    if (rusak.loading) {
      return (
        <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <tbody>
                <SkeletonTable columns={5} rows={5} />
              </tbody>
            </table>
          </div>
        </div>
      );
    }

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
      <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium text-left">Inventory</th>
                <th className="px-4 py-3 font-medium text-left">Pelapor</th>
                <th className="px-4 py-3 font-medium text-left">Kerusakan</th>
                <th className="px-4 py-3 font-medium text-left">Tgl Lapor</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rusak.entries.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 whitespace-nowrap">{inventoryLabel(p.inventory)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="max-w-[160px]">
                      <Tooltip content={namaPelaporPenanganan(p)}>
                        <p className="truncate">{namaPelaporPenanganan(p)}</p>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">
                    {formatJenisKerusakan(p.jenis_kerusakan)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalWaktuId(p.lapor_at, p.tanggal_lapor)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      {tombolDetail(() =>
                        bukaDetail({
                          judul: p.inventory?.kode_inventory || '-',
                          subjudul: 'Foto Kerusakan',
                          photos: p.foto ? [p.foto] : [],
                          rows: [
                            { label: 'Nama', value: p.inventory?.nama || '-' },
                            { label: 'Merk', value: p.inventory?.merk },
                            { label: 'Type', value: p.inventory?.type },
                            { label: 'Pelapor', value: namaPelaporPenanganan(p) },
                            { label: 'Kerusakan', value: formatJenisKerusakan(p.jenis_kerusakan) },
                            { label: 'Keluhan', value: p.keluhan },
                            { label: 'Tgl Lapor', value: formatTanggalWaktuId(p.lapor_at, p.tanggal_lapor) },
                          ],
                        })
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

  const activeState = activeTab === 'inventory' ? inventory : activeTab === 'peminjaman' ? peminjaman : activeTab === 'pengembalian' ? pengembalian : rusak;

  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'Foto';

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <ScrollableTabBar className="mb-4" tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <SearchInput
        value={currentSearch}
        onChange={handleSearchChange}
        placeholder="Cari kode inventory atau nama..."
        className="mb-4"
      />

      <p className="text-xs text-slate-500 mb-4">
        Total {activeTabLabel}: <span className="font-semibold text-slate-900">{activeState.total}</span> foto
      </p>

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

      {detail && <FotoDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// Modal detail: slider foto (panah kiri/kanan + titik indikator + counter)
// di atas, keterangan lengkap di bawah. Keyboard: Esc tutup, panah geser foto.
function FotoDetailModal({ detail, onClose }: { detail: FotoDetail; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const total = detail.photos.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (total > 1 && e.key === 'ArrowLeft') setIndex((i) => (i - 1 + total) % total);
      else if (total > 1 && e.key === 'ArrowRight') setIndex((i) => (i + 1) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  const rows = detail.rows.filter((r) => r.value != null && String(r.value).trim() !== '');

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-zinc-800 w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate">{detail.judul}</h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500">{detail.subjudul}</p>
          </div>
          <button
            onClick={onClose}
            title="Tutup"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Slider foto */}
        <div className="relative bg-slate-100 dark:bg-zinc-900 h-64 sm:h-80 flex items-center justify-center">
          {total > 0 ? (
            <button
              type="button"
              onClick={() => setZoomSrc(STORAGE_BASE_URL + detail.photos[index])}
              aria-label="Perbesar foto"
              className="group relative h-full w-full flex items-center justify-center cursor-zoom-in"
            >
              <img
                key={detail.photos[index]}
                src={STORAGE_BASE_URL + detail.photos[index]}
                alt={`Foto ${index + 1}`}
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white group-hover:bg-black/70">
                <ZoomIn size={12} />
                Perbesar
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center text-slate-400 dark:text-zinc-500">
              <ImageOff size={28} className="mb-1.5" />
              <p className="text-xs">Tidak ada foto</p>
            </div>
          )}

          {total > 1 && (
            <>
              <button
                onClick={() => setIndex((i) => (i - 1 + total) % total)}
                title="Foto sebelumnya"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % total)}
                title="Foto berikutnya"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
              >
                <ChevronRight size={20} />
              </button>
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[11px]">
                {index + 1} / {total}
              </span>
            </>
          )}
        </div>

        {/* Titik indikator */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-3">
            {detail.photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Foto ke-${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? 'w-4 bg-slate-800 dark:bg-zinc-100'
                    : 'w-1.5 bg-slate-300 dark:bg-zinc-600 hover:bg-slate-400 dark:hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>
        )}

        {/* Keterangan */}
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 px-5 py-4 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-xs text-slate-400 dark:text-zinc-500 pt-0.5">{r.label}</dt>
              <dd className="font-medium text-slate-800 dark:text-zinc-200 break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {zoomSrc && (
        // stopPropagation: klik di viewer tidak boleh ikut menutup modal detail (root modal ini menutup lewat onClick).
        <div onClick={(e) => e.stopPropagation()}>
          <FotoZoomViewer src={zoomSrc} alt="Foto inventory" onClose={() => setZoomSrc(null)} />
        </div>
      )}
    </div>
  );
}