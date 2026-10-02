import { useRef, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../../../components/shared/Pagination';
import api from '../../../api/axios';
import { terimaPenangananInventory, type InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import {
  formatTanggalId,
  namaPelaporPenanganan,
  formatJenisKerusakan,
  formatDurasi,
} from '../../../utils/inventoryHelpers';
import ScrollableTabBar from '../../../components/shared/ScrollableTabBar';
import { printStruk } from '../../../utils/printStruk';
import InventoryPenangananExportModal from '../../../components/transaksi/InventoryPenangananExportModal';
import { useAuth } from '../../../context/AuthContext';
import { usePenangananData } from './usePenangananData';
import { formatRupiah, ITEMS_PER_PAGE } from './helpers';
import type { TabStatus } from './helpers';
import PenangananSkeleton from './PenangananSkeleton';
import PenangananHeader from './PenangananHeader';
import PenangananKpiCards from './PenangananKpiCards';
import PenangananFilterBar from './PenangananFilterBar';
import PenangananCardList from './PenangananCardList';
import PenangananTable from './PenangananTable';
import FormPerbaikanModal from './FormPerbaikanModal';
import DetailPenangananModal from './DetailPenangananModal';
import TerimaLaporanModal from './TerimaLaporanModal';

interface Props {
  onCount?: (count: number) => void;
}

export default function PenangananInventory({ onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { penangananList, setPenangananList, loading, error, load } = usePenangananData(onCount);
  const [activePenanganan, setActivePenanganan] = useState<InventoryPenanganan | null>(null);
  const [activeTab, setActiveTab] = useState<TabStatus>('menunggu');
  const [page, setPage] = useState(1);

  // Global search & filter
  const [search, setSearch] = useState('');
  const [filterKerusakan, setFilterKerusakan] = useState('all');

  // Modals
  const [detailModalTarget, setDetailModalTarget] = useState<InventoryPenanganan | null>(null);
  const [terimaTarget, setTerimaTarget] = useState<InventoryPenanganan | null>(null);

  // Export & Import
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canImportExport = isAdmin && (activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat');

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImportLoading(true);
    setImportMessage(null);

    try {
      const res = await api.post('/inventory-penanganan/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportMessage({ type: 'success', text: res.data.message });
      load();
    } catch (err: any) {
      setImportMessage({
        type: 'error',
        text: err.response?.data?.message || 'Gagal mengimport file',
      });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTabChange = (tab: TabStatus) => {
    setActiveTab(tab);
    setPage(1);
    setImportMessage(null);
  };

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  const handleTerima = async (p: InventoryPenanganan) => {
    setTerimaLoadingId(p.id);
    try {
      const updated = await terimaPenangananInventory(p.id);
      setPenangananList((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      toast.success('Laporan diterima, aset ditandai sedang diperbaiki.');
      setTerimaTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menerima laporan.');
    } finally {
      setTerimaLoadingId(null);
    }
  };

  const handleSelesai = (updated: InventoryPenanganan) => {
    setPenangananList((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
    );
    setActivePenanganan(null);
    toast.success('Perbaikan selesai dicatat.');
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

  // Status segmentation
  const menungguList = useMemo(
    () => penangananList.filter((p) => !p.tanggal_selesai && !p.tanggal_diterima),
    [penangananList]
  );
  const diperbaikiList = useMemo(
    () => penangananList.filter((p) => !p.tanggal_selesai && !!p.tanggal_diterima),
    [penangananList]
  );
  const diperbaikiSelesaiList = useMemo(
    () => penangananList.filter((p) => !!p.tanggal_selesai && p.hasil !== 'rusak_berat'),
    [penangananList]
  );
  const rusakBeratList = useMemo(
    () => penangananList.filter((p) => !!p.tanggal_selesai && p.hasil === 'rusak_berat'),
    [penangananList]
  );

  const tabs: { key: TabStatus; label: string; list: InventoryPenanganan[] }[] = [
    { key: 'menunggu', label: 'Menunggu Terima', list: menungguList },
    { key: 'diperbaiki', label: 'Sedang Diperbaiki', list: diperbaikiList },
    { key: 'diperbaiki_selesai', label: 'Berhasil Diperbaiki', list: diperbaikiSelesaiList },
    { key: 'rusak_berat', label: 'Rusak Berat', list: rusakBeratList },
  ];

  // Filtering by search and jenis kerusakan
  const currentTabRawList = useMemo(() => {
    switch (activeTab) {
      case 'menunggu':
        return menungguList;
      case 'diperbaiki':
        return diperbaikiList;
      case 'diperbaiki_selesai':
        return diperbaikiSelesaiList;
      case 'rusak_berat':
        return rusakBeratList;
    }
  }, [activeTab, menungguList, diperbaikiList, diperbaikiSelesaiList, rusakBeratList]);

  const displayedList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return currentTabRawList.filter((p) => {
      const matchJenis = filterKerusakan === 'all' || p.jenis_kerusakan === filterKerusakan;
      if (!matchJenis) return false;
      if (!q) return true;
      return (
        (p.inventory?.kode_inventory || '').toLowerCase().includes(q) ||
        (p.inventory?.nama || '').toLowerCase().includes(q) ||
        (p.jenis_kerusakan || '').toLowerCase().includes(q) ||
        (p.keluhan || '').toLowerCase().includes(q) ||
        namaPelaporPenanganan(p).toLowerCase().includes(q) ||
        (p.catatan || '').toLowerCase().includes(q)
      );
    });
  }, [currentTabRawList, search, filterKerusakan]);

  const totalPages = Math.max(1, Math.ceil(displayedList.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedList = displayedList.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  if (loading) return <PenangananSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PenangananHeader
        isAdmin={isAdmin}
        canImportExport={canImportExport}
        setExportModalOpen={setExportModalOpen}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        importLoading={importLoading}
      />

      {/* KPI Overview Cards */}
      <PenangananKpiCards
        handleTabChange={handleTabChange}
        activeTab={activeTab}
        menungguList={menungguList}
        diperbaikiList={diperbaikiList}
        diperbaikiSelesaiList={diperbaikiSelesaiList}
        rusakBeratList={rusakBeratList}
      />

      {importMessage && (
        <p className={`text-sm ${importMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {importMessage.text}
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Main Content Box */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        {/* Navigation Tabs */}
        <ScrollableTabBar
          className="mb-5"
          activeTab={activeTab}
          onChange={handleTabChange}
          tabs={tabs.map((t) => ({
            key: t.key,
            label: t.label,
            badge: t.list.length,
            badgeClassName: activeTab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
          }))}
        />

        {/* Filter & Search Bar */}
        <PenangananFilterBar
          search={search}
          setSearch={setSearch}
          setPage={setPage}
          filterKerusakan={filterKerusakan}
          setFilterKerusakan={setFilterKerusakan}
        />

        {/* Tab 1 & Tab 2: Work Order Cards */}
        {activeTab === 'menunggu' || activeTab === 'diperbaiki' ? (
          <PenangananCardList
            displayedList={displayedList}
            activeTab={activeTab}
            search={search}
            filterKerusakan={filterKerusakan}
            paginatedList={paginatedList}
            setDetailModalTarget={setDetailModalTarget}
            isAdmin={isAdmin}
            setTerimaTarget={setTerimaTarget}
            setActivePenanganan={setActivePenanganan}
          />
        ) : (
          /* Tab 3 & Tab 4: Clean Data Table */
          <PenangananTable
            paginatedList={paginatedList}
            handlePrintStruk={handlePrintStruk}
            setDetailModalTarget={setDetailModalTarget}
            displayedList={displayedList}
            search={search}
            filterKerusakan={filterKerusakan}
            activeTab={activeTab}
          />
        )}

        {/* Pagination */}
        {displayedList.length > ITEMS_PER_PAGE && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              totalItems={displayedList.length}
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
          onSuccess={handleSelesai}
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
          data={displayedList}
          tabLabel={tabs.find((t) => t.key === activeTab)?.label || ''}
        />
      )}
    </div>
  );
}
