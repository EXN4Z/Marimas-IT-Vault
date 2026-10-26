import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import type { InventoryPenanganan } from './types';
import type { PenangananList, PenangananTab } from './types';
import {
  formatTanggalId,
  formatJenisKerusakan,
  formatDurasi,
} from '../inventory/inventoryHelpers';
import { printStruk } from '../inventory/print/printStruk';
import PenangananExportModal from './export/PenangananExportModal';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah } from './helpers';
import Pagination from '../../components/table/Pagination';
import ScrollableTabBar from '../../components/navigation/ScrollableTabBar';
import PenangananTabel from './list/PenangananTabel';
import PenangananSkeleton from './list/PenangananSkeleton';
import PenangananHeader from './list/PenangananHeader';
import PenangananProgressBar from './list/PenangananProgressBar';
import PenangananBoard from './list/PenangananBoard';
import { BATAS_TERLAMBAT_HARI, hariSejak } from './list/PenangananBoardCard';
import PenangananFilterBar from './list/PenangananFilterBar';
import FormPerbaikanModal from './modals/FormPerbaikanModal';
import DetailPenangananModal from './modals/DetailPenangananModal';
import TerimaLaporanModal from './modals/TerimaLaporanModal';

// [F6-INERTIA] Halaman Penanganan Inventory (tadinya usePenangananData: axios + polling + filter/pagination di klien). Sekarang:
//  - data dari props server (PenangananInventoryPageController -> props.penanganan);
//  - tab status, pencarian, filter jenis kerusakan, dan pagination dijalankan server lewat router.get (query string = sumber kebenaran);
//  - Terima / Selesai / Detail = modal overlay dengan state lokal; mutasi lewat router.* ke /penanganan-inventory*, hasilnya toast dari
//    flash server (FlashToaster);
//  - Export = partial reload props.penangananExport (SEMUA hasil filter tab aktif) tiap tombol Export diklik;
//  - auto-refresh 10 detik = partial reload async (props.penanganan).
interface PageProps {
  penanganan?: PenangananList;
  penangananExport?: InventoryPenanganan[];
}

interface FilterBaru {
  tab?: PenangananTab;
  search?: string;
  jenis?: string;
  page?: number;
  semua?: string;
}

const TAB_LABEL: Record<PenangananTab, string> = {
  menunggu: 'Menunggu Terima',
  diperbaiki: 'Sedang Diperbaiki',
  diperbaiki_selesai: 'Berhasil Diperbaiki',
  rusak_berat: 'Rusak Berat',
};

const COUNTS_KOSONG: Record<PenangananTab, number> = { menunggu: 0, diperbaiki: 0, diperbaiki_selesai: 0, rusak_berat: 0 };

export default function PenangananInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const pageProps = usePage().props as unknown as PageProps;
  const list = pageProps.penanganan;
  const rows = list?.data ?? [];
  const counts = list?.counts ?? COUNTS_KOSONG;
  const activeTab: PenangananTab = list?.filters.tab ?? 'menunggu';
  const serverSearch = list?.filters.search ?? '';
  const filterKerusakan = list?.filters.jenis ?? 'all';
  const board = list?.board;
  const currentPage = list?.current_page ?? 1;
  const lastPage = list?.last_page ?? 1;
  const total = list?.total ?? 0;

  const [searchInput, setSearchInput] = useState<string>(serverSearch);
  const [listLoading, setListLoading] = useState(false);

  // Tampilan: tabel (4 halaman/tab, default) atau papan (4 kolom). Pilihan diingat di browser (aman kalau storage diblokir).
  const [view, setView] = useState<'papan' | 'tabel'>(() => {
    try {
      return localStorage.getItem('penanganan-view') === 'papan' ? 'papan' : 'tabel';
    } catch {
      return 'tabel';
    }
  });
  const gantiView = (v: 'papan' | 'tabel') => {
    setView(v);
    try {
      localStorage.setItem('penanganan-view', v);
    } catch {
      /* abaikan */
    }
  };
  // Export: di tabel Selesai / Rusak berat = tab itu; selain itu = laporan yang selesai diperbaiki.
  const exportTab: PenangananTab =
    view === 'tabel' && (activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat') ? activeTab : 'diperbaiki_selesai';
  // Kolom papan yang dibuka penuh (?semua=<status>); '' = semua kolom tampil ringkas.
  const [semuaKolom, setSemuaKolom] = useState<string>('');

  // Modals
  const [activePenanganan, setActivePenanganan] = useState<InventoryPenanganan | null>(null);
  const [detailModalTarget, setDetailModalTarget] = useState<InventoryPenanganan | null>(null);
  const [terimaTarget, setTerimaTarget] = useState<InventoryPenanganan | null>(null);
  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  // Export & Import
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Papan menampilkan 4 kolom sekaligus; Export/Import tetap untuk admin (Export = laporan yang selesai diperbaiki).
  const canImportExport = isAdmin;

  // ------------------------------------------------------------------ request ke server

  // Query string dari filter. Tab selalu ikut di URL (termasuk ?tab=menunggu); default lain (search kosong, jenis semua, halaman 1) tidak.
  function bangunData(f: Required<FilterBaru>): Record<string, string | number> {
    const data: Record<string, string | number> = { tab: f.tab };
    if (f.search) data.search = f.search;
    if (f.jenis && f.jenis !== 'all') data.jenis = f.jenis;
    if (f.page > 1) data.page = f.page;
    if (f.semua) data.semua = f.semua;
    return data;
  }

  // Pindah tab / halaman / ganti filter = visit ringan ke /penanganan-inventory (partial reload cuma props.penanganan), URL ikut berubah.
  function visitList(next: FilterBaru) {
    const f: Required<FilterBaru> = {
      tab: next.tab ?? activeTab,
      search: (next.search ?? searchInput).trim(),
      jenis: next.jenis ?? filterKerusakan,
      page: next.page ?? 1,
      semua: next.semua ?? semuaKolom,
    };

    setListLoading(true);
    router.get('/penanganan-inventory', bangunData(f), {
      only: ['penanganan'],
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onFinish: () => setListLoading(false),
    });
  }

  // Auto-refresh 10 detik (async, tanpa progress bar). Memuat ulang URL yang sedang aktif, jadi filter tetap terjaga.
  // Dilewati kalau tab browser lagi disembunyikan.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      router.reload({ only: ['penanganan'], async: true, showProgress: false });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Pencarian: tunggu user berhenti mengetik sebentar sebelum minta data ke server.
  useEffect(() => {
    if (searchInput.trim() === serverSearch) return;
    const timer = setTimeout(() => visitList({ search: searchInput, page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Adapter ke komponen filter: pencarian = state lokal (debounce di atas), jenis & reset = visit ke server.
  const handleJenisChange = (v: string) => visitList({ jenis: v, page: 1 });
  const handleResetFilter = () => {
    setSearchInput('');
    visitList({ search: '', jenis: 'all', page: 1 });
  };

  const handleTabChange = (tab: PenangananTab) => {
    setImportError('');
    visitList({ tab, page: 1 });
  };

  const handleLihatSemua = (kolom: PenangananTab) => {
    setSemuaKolom(kolom);
    visitList({ semua: kolom });
  };

  // ------------------------------------------------------------------ export / import

  // Tombol Export: ambil dulu datanya dari server (SEMUA hasil filter tab aktif), baru buka modal.
  const bukaExport = (open: boolean) => {
    if (!open) {
      setExportModalOpen(false);
      return;
    }
    router.reload({
      only: ['penangananExport'],
      data: { tab: exportTab },
      onSuccess: () => setExportModalOpen(true),
      onError: () => toast.error('Gagal menyiapkan data export. Coba lagi.'),
    });
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    // Sukses -> toast dari flash server. Gagal -> pesan error inline (key "file").
    router.post('/penanganan-inventory/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => setImportError(String(errors.file || 'Gagal mengimport file')),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  // ------------------------------------------------------------------ mutasi (Inertia)

  const handleTerima = (p: InventoryPenanganan) => {
    setTerimaLoadingId(p.id);
    router.post(`/penanganan-inventory/${p.id}/terima`, {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setTerimaTarget(null),
      onError: (errors) => toast.error(errors.terima || String(Object.values(errors)[0] || 'Gagal menerima laporan.')),
      onFinish: () => setTerimaLoadingId(null),
    });
  };

  const handlePrintStruk = (p: InventoryPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
      printStruk({
        judul: 'Bukti Penanganan Inventory',
        noStruk: p.no_struk,
        tanggal: formatTanggalId(p.tanggal_selesai),
        rows: [
          { label: 'Hasil', value: 'Rusak Berat (tidak bisa diperbaiki)' },
          { label: 'Durasi', value: formatDurasi(p.durasi_detik) },
        ],
        catatan: p.catatan,
      });
      return;
    }

    const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
    printStruk({
      judul: 'Bukti Penanganan Inventory',
      noStruk: p.no_struk,
      tanggal: formatTanggalId(p.tanggal_selesai),
      rows: [
        { label: 'Inventory', value: p.inventory?.kode_inventory || '-' },
        { label: 'Jenis Kerusakan', value: formatJenisKerusakan(p.jenis_kerusakan) },
        { label: 'Keluhan', value: p.keluhan },
        { label: 'Hasil', value: p.hasil || '-' },
        { label: 'Tanggal Lapor', value: formatTanggalId(p.tanggal_lapor) },
        { label: 'Durasi', value: formatDurasi(p.durasi_detik) },
        { label: 'Biaya Komponen', value: formatRupiah(p.biaya_komponen) },
        { label: 'Biaya Jasa', value: formatRupiah(p.harga_jasa) },
      ],
      totalLabel: 'Total Biaya',
      totalValue: formatRupiah(totalBiaya),
      catatan: p.catatan,
    });
  };

  if (!list || !board) return <PenangananSkeleton />;

  const tabs: { key: PenangananTab; label: string }[] = (Object.keys(TAB_LABEL) as PenangananTab[]).map((key) => ({
    key,
    label: `${TAB_LABEL[key]} (${counts[key]})`,
  }));

  // Laporan aktif (menunggu / dikerjakan) yang sudah lewat batas hari -- dihitung dari baris yang tampil di papan.
  const terlambat = [...board.menunggu.data, ...board.diperbaiki.data].filter((p) => hariSejak(p.tanggal_lapor) > BATAS_TERLAMBAT_HARI).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PenangananHeader
        isAdmin={isAdmin}
        canImportExport={canImportExport}
        setExportModalOpen={bukaExport}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        importLoading={importLoading}
      />

      <p className="text-sm text-slate-500 -mt-3">
        {terlambat > 0
          ? `${terlambat} laporan sudah lewat ${BATAS_TERLAMBAT_HARI} hari dan belum selesai.`
          : `Tidak ada laporan yang lewat ${BATAS_TERLAMBAT_HARI} hari.`}
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">{view === 'papan' && <PenangananProgressBar counts={counts} />}</div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white" role="group" aria-label="Tampilan">
          {(['papan', 'tabel'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => gantiView(v)}
              aria-pressed={view === v}
              className={`h-9 px-4 text-sm font-semibold capitalize transition ${view === v ? 'bg-[#0b3a9a] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {importError && <p className="text-sm text-red-600">{importError}</p>}

      {view === 'tabel' && <ScrollableTabBar activeTab={activeTab} onChange={handleTabChange} tabs={tabs} />}

      {/* Filter & Search Bar */}
      <PenangananFilterBar
        search={searchInput}
        setSearch={setSearchInput}
        filterKerusakan={filterKerusakan}
        setFilterKerusakan={handleJenisChange}
        onReset={handleResetFilter}
      />

      {view === 'papan' ? (
        <PenangananBoard
          board={board}
          isAdmin={isAdmin}
          loading={listLoading}
          onDetail={setDetailModalTarget}
          onTerima={setTerimaTarget}
          onSelesaikan={setActivePenanganan}
          onPrint={handlePrintStruk}
          onLihatSemua={handleLihatSemua}
        />
      ) : (
        <div className={`space-y-4 transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
          <PenangananTabel
            rows={rows}
            tab={activeTab}
            isAdmin={isAdmin}
            filtered={!!serverSearch || filterKerusakan !== 'all'}
            onDetail={setDetailModalTarget}
            onTerima={setTerimaTarget}
            onSelesaikan={setActivePenanganan}
            onPrint={handlePrintStruk}
          />
          {total > list.per_page && (
            <Pagination
              currentPage={currentPage}
              totalPages={lastPage}
              onPageChange={(pg) => visitList({ page: pg })}
              totalItems={total}
              itemLabel="laporan"
            />
          )}
        </div>
      )}

      {/* Modals */}
      {activePenanganan && (
        <FormPerbaikanModal
          penanganan={activePenanganan}
          onClose={() => setActivePenanganan(null)}
          onSuccess={() => setActivePenanganan(null)}
        />
      )}

      {detailModalTarget && (
        <DetailPenangananModal
          penanganan={detailModalTarget}
          onClose={() => setDetailModalTarget(null)}
          onPrint={handlePrintStruk}
        />
      )}

      {terimaTarget && (
        <TerimaLaporanModal
          penanganan={terimaTarget}
          loading={terimaLoadingId === terimaTarget.id}
          onClose={() => setTerimaTarget(null)}
          onConfirm={() => handleTerima(terimaTarget)}
        />
      )}

      {canImportExport && (
        <PenangananExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          data={pageProps.penangananExport ?? []}
          tabLabel={TAB_LABEL[exportTab]}
        />
      )}
    </div>
  );
}