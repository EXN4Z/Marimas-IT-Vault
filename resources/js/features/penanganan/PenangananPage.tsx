import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import Pagination from '../../components/table/Pagination';
import type { InventoryPenanganan } from '../../api/transaksi/inventoryPenanganan';
import type { PenangananList, PenangananTab } from './types';
import {
  formatTanggalId,
  formatJenisKerusakan,
  formatDurasi,
} from '../inventory/inventoryHelpers';
import ScrollableTabBar from '../../components/navigation/ScrollableTabBar';
import { printStruk } from '../inventory/print/printStruk';
import PenangananExportModal from './export/PenangananExportModal';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah } from './helpers';
import PenangananSkeleton from './list/PenangananSkeleton';
import PenangananHeader from './list/PenangananHeader';
import PenangananKpiCards from './list/PenangananKpiCards';
import PenangananFilterBar from './list/PenangananFilterBar';
import PenangananCardList from './list/PenangananCardList';
import PenangananTable from './list/PenangananTable';
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
  const currentPage = list?.current_page ?? 1;
  const lastPage = list?.last_page ?? 1;
  const total = list?.total ?? 0;

  const [searchInput, setSearchInput] = useState<string>(serverSearch);
  const [listLoading, setListLoading] = useState(false);

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

  const canImportExport = isAdmin && (activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat');

  // ------------------------------------------------------------------ request ke server

  // Query string dari filter. Nilai default (tab menunggu, search kosong, jenis semua, halaman 1) tidak ikut di URL.
  function bangunData(f: Required<FilterBaru>): Record<string, string | number> {
    const data: Record<string, string | number> = {};
    if (f.tab !== 'menunggu') data.tab = f.tab;
    if (f.search) data.search = f.search;
    if (f.jenis && f.jenis !== 'all') data.jenis = f.jenis;
    if (f.page > 1) data.page = f.page;
    return data;
  }

  // Pindah tab / halaman / ganti filter = visit ringan ke /penanganan-inventory (partial reload cuma props.penanganan), URL ikut berubah.
  function visitList(next: FilterBaru) {
    const f: Required<FilterBaru> = {
      tab: next.tab ?? activeTab,
      search: (next.search ?? searchInput).trim(),
      jenis: next.jenis ?? filterKerusakan,
      page: next.page ?? 1,
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

  // ------------------------------------------------------------------ export / import

  // Tombol Export: ambil dulu datanya dari server (SEMUA hasil filter tab aktif), baru buka modal.
  const bukaExport = (open: boolean) => {
    if (!open) {
      setExportModalOpen(false);
      return;
    }
    router.reload({
      only: ['penangananExport'],
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

  const tabs: { key: PenangananTab; label: string }[] = (Object.keys(TAB_LABEL) as PenangananTab[]).map((key) => ({
    key,
    label: TAB_LABEL[key],
  }));

  if (!list) return <PenangananSkeleton />;

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

      {/* KPI Overview Cards */}
      <PenangananKpiCards handleTabChange={handleTabChange} activeTab={activeTab} counts={counts} />

      {importError && <p className="text-sm text-red-600">{importError}</p>}

      {/* Main Content Box */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        {/* Navigation Tabs */}
        <ScrollableTabBar className="mb-5" activeTab={activeTab} onChange={handleTabChange} tabs={tabs} />

        {/* Filter & Search Bar */}
        <PenangananFilterBar
          search={searchInput}
          setSearch={setSearchInput}
          filterKerusakan={filterKerusakan}
          setFilterKerusakan={handleJenisChange}
          onReset={handleResetFilter}
        />

        <p className="text-xs text-slate-500 mb-4">
          Total {TAB_LABEL[activeTab]}: <span className="font-semibold text-slate-900">{total}</span> laporan
        </p>

        <div className={`transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
          {/* Tab 1 & Tab 2: Work Order Cards */}
          {activeTab === 'menunggu' || activeTab === 'diperbaiki' ? (
            <PenangananCardList
              displayedList={rows}
              activeTab={activeTab}
              search={serverSearch}
              filterKerusakan={filterKerusakan}
              paginatedList={rows}
              setDetailModalTarget={setDetailModalTarget}
              isAdmin={isAdmin}
              setTerimaTarget={setTerimaTarget}
              setActivePenanganan={setActivePenanganan}
            />
          ) : (
            /* Tab 3 & Tab 4: Clean Data Table */
            <PenangananTable
              paginatedList={rows}
              handlePrintStruk={handlePrintStruk}
              setDetailModalTarget={setDetailModalTarget}
              displayedList={rows}
              search={serverSearch}
              filterKerusakan={filterKerusakan}
              activeTab={activeTab}
            />
          )}
        </div>

        {/* Pagination (server) */}
        {total > list.per_page && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Pagination
              currentPage={currentPage}
              totalPages={lastPage}
              onPageChange={(p) => visitList({ page: p })}
              totalItems={total}
              itemLabel="laporan"
            />
          </div>
        )}
      </div>

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
        <InventoryPenangananExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          data={pageProps.penangananExport ?? []}
          tabLabel={TAB_LABEL[activeTab]}
        />
      )}
    </div>
  );
}
