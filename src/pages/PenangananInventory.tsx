import { useEffect, useRef, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Tooltip from '../components/shared/Tooltip';
import {
  X,
  Wrench,
  Printer,
  PlayCircle,
  Eye,
  ImageOff,
  Upload,
  Download,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';
import Pagination from '../components/shared/Pagination';
import Select from '../components/shared/Select';
import api from '../api/axios';
import {
  terimaPenangananInventory,
  selesaikanPenangananInventory,
  getInventoryPenanganan,
  type InventoryPenanganan,
} from '../api/transaksi/inventoryPenanganan';
import {
  formatTanggalId,
  formatTanggalWaktuId,
  namaPelaporPenanganan,
  formatJenisKerusakan,
  JENIS_KERUSAKAN_OPTIONS,
  formatDurasi,
} from '../components/masterData/inventoryHelpers';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import SearchInput from '../components/shared/SearchInput';
import StatusBadge from '../components/shared/StatusBadge';
import { printStruk } from '../utils/printStruk';
import InventoryPenangananExportModal from '../components/transaksi/InventoryPenangananExportModal';
import { useAuth } from '../context/AuthContext';
import { Skeleton, SkeletonListCard } from '../components/shared/skeleton';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

interface Props {
  onCount?: (count: number) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatRupiah(n?: number | string | null) {
  if (n == null) return '-';
  // harga_jasa/biaya_komponen dikirim backend sebagai string decimal
  // ("50000.00"), jadi dinormalisasi ke number dulu biar kebaca "Rp 50.000".
  return `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type TabStatus = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';

const ITEMS_PER_PAGE = 8;

export default function PenangananInventory({ onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [penangananList, setPenangananList] = useState<InventoryPenanganan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const load = () => {
    setLoading(true);
    setError('');
    getInventoryPenanganan()
      .then(setPenangananList)
      .catch((err) => {
        setError('Gagal memuat laporan penanganan aset.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  const loadSilent = () => {
    getInventoryPenanganan()
      .then(setPenangananList)
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(loadSilent, 10000);
    return () => clearInterval(interval);
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return;
    const belumDitangani = penangananList.filter((p) => !p.tanggal_selesai).length;
    if (lastCount.current !== belumDitangani) {
      lastCount.current = belumDitangani;
      onCount?.(belumDitangani);
    }
  }, [penangananList, loading, onCount]);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <Skeleton className="h-3 w-28 rounded mb-3" />
              <Skeleton className="h-8 w-16 rounded mb-2" />
              <Skeleton className="h-3 w-36 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <SkeletonListCard rows={5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Penanganan Inventory</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Monitoring antrean perbaikan, verifikasi laporan kerusakan, dan riwayat penanganan unit aset.'
              : 'Pantau status penanganan dan hasil perbaikan inventory yang Anda gunakan.'}
          </p>
        </div>

        {canImportExport && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <Download size={15} />
              Export Excel
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
            >
              {importLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Import Excel
            </button>
          </div>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => handleTabChange('menunggu')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'menunggu'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Menunggu Review</span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{menungguList.length}</div>
          <p className="text-xs text-slate-500 mt-1">Laporan perlu verifikasi</p>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('diperbaiki')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'diperbaiki'
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sedang Dikerjakan</span>
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Wrench size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{diperbaikiList.length}</div>
          <p className="text-xs text-slate-500 mt-1">Dalam proses teknisi</p>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('diperbaiki_selesai')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'diperbaiki_selesai'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selesai Normal</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{diperbaikiSelesaiList.length}</div>
          <p className="text-xs text-slate-500 mt-1">Siap pakai kembali</p>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('rusak_berat')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'rusak_berat'
              ? 'bg-red-50/70 border-red-300 ring-2 ring-red-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rusak Berat</span>
            <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{rusakBeratList.length}</div>
          <p className="text-xs text-slate-500 mt-1">Afkir / write-off aset</p>
        </button>
      </div>

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
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Cari kode inventory, nama barang, keluhan, pelapor..."
            className="flex-1"
          />

          <div className="w-full sm:w-56 shrink-0">
            <Select
              value={filterKerusakan}
              onChange={(val) => {
                setFilterKerusakan(val);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Semua Jenis Kerusakan' },
                ...JENIS_KERUSAKAN_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              ]}
            />
          </div>

          {(search || filterKerusakan !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterKerusakan('all');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1.5 shrink-0 self-center"
            >
              <RotateCcw size={13} />
              Reset Filter
            </button>
          )}
        </div>

        {/* Tab 1 & Tab 2: Work Order Cards */}
        {activeTab === 'menunggu' || activeTab === 'diperbaiki' ? (
          <div>
            {displayedList.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  {activeTab === 'menunggu' ? <CheckCircle2 size={24} /> : <Wrench size={24} />}
                </div>
                <h4 className="text-sm font-semibold text-slate-800">
                  {search || filterKerusakan !== 'all'
                    ? 'Tidak ada laporan yang cocok dengan filter'
                    : activeTab === 'menunggu'
                      ? 'Tidak ada laporan yang menunggu verifikasi'
                      : 'Tidak ada inventory yang sedang diperbaiki'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {activeTab === 'menunggu'
                    ? 'Semua laporan kerusakan yang masuk telah diverifikasi dan diproses oleh tim teknisi.'
                    : 'Semua unit yang dalam penanganan telah selesai atau belum ada pekerjaan aktif.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedList.map((p) => {
                  const diterima = !!p.tanggal_diterima;
                  return (
                    <div
                      key={p.id}
                      className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between bg-slate-50/30"
                    >
                      <div>
                        {/* Header card */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                {p.inventory?.kode_inventory || 'INV-UNKNOWN'}
                              </span>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {formatJenisKerusakan(p.jenis_kerusakan)}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {p.inventory?.nama || 'Nama unit tidak tertera'}
                            </h4>
                          </div>

                          <StatusBadge
                            colorClass={diterima ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                            size="xs"
                          >
                            {diterima ? 'Dalam Pengerjaan' : 'Menunggu Terima'}
                          </StatusBadge>
                        </div>

                        {/* Pelapor Info */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {initials(namaPelaporPenanganan(p))}
                          </div>
                          <span>
                            Oleh <strong className="font-semibold text-slate-700">{namaPelaporPenanganan(p)}</strong>
                          </span>
                          <span>·</span>
                          <span>Lapor: {formatTanggalId(p.tanggal_lapor)}</span>
                        </div>

                        {/* Issue description box */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 mb-3">
                          <span className="font-semibold text-slate-900 block mb-0.5">Keluhan:</span>
                          <p className="line-clamp-2 leading-relaxed text-slate-600">{p.keluhan}</p>
                        </div>

                        {/* Catatan if ongoing */}
                        {diterima && p.catatan && (
                          <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-blue-900 mb-3">
                            <span className="font-semibold block mb-0.5">Catatan Teknisi:</span>
                            <p className="line-clamp-2">{p.catatan}</p>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailModalTarget(p)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1.5"
                        >
                          <Eye size={14} />
                          Lihat Detail
                        </button>

                        {isAdmin && (
                          <div>
                            {!diterima ? (
                              <button
                                type="button"
                                onClick={() => setTerimaTarget(p)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                              >
                                <PlayCircle size={14} />
                                Terima Laporan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActivePenanganan(p)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                              >
                                <Check size={14} />
                                Selesaikan Perbaikan
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Tab 3 & Tab 4: Clean Data Table */
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/50">
                    <th className="px-6 py-3.5 font-medium whitespace-nowrap">Inventory</th>
                    <th className="px-6 py-3.5 font-medium whitespace-nowrap">Kerusakan</th>
                    <th className="px-6 py-3.5 font-medium whitespace-nowrap">Pelapor</th>
                    <th className="px-6 py-3.5 font-medium whitespace-nowrap">Tanggal Selesai</th>
                    <th className="px-6 py-3.5 font-medium whitespace-nowrap">Biaya Penanganan</th>
                    <th className="px-6 py-3.5 font-medium whitespace-nowrap">Hasil</th>
                    <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((p) => {
                    const rusakBerat = p.hasil === 'rusak_berat';
                    const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);

                    return (
                      <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                        <td className="px-6 py-3.5 text-slate-800 font-medium whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{p.inventory?.kode_inventory || '-'}</span>
                        </td>

                        <td className="px-6 py-3.5 text-slate-800 font-medium text-xs whitespace-nowrap">
                          {formatJenisKerusakan(p.jenis_kerusakan)}
                        </td>

                        <td className="px-6 py-3.5 text-slate-800 font-medium text-xs">
                          <div className="max-w-[150px]">
                            <Tooltip content={namaPelaporPenanganan(p)}>
                              <p className="truncate">{namaPelaporPenanganan(p)}</p>
                            </Tooltip>
                          </div>
                        </td>

                        <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                          <p className="text-xs text-slate-700 font-medium">{formatTanggalId(p.tanggal_selesai)}</p>
                        </td>

                        <td className="px-6 py-3.5 whitespace-nowrap text-slate-700">
                          {rusakBerat ? (
                            <span className="text-xs text-slate-400">-</span>
                          ) : (
                            <p className="font-semibold text-xs text-slate-900">{formatRupiah(totalBiaya)}</p>
                          )}
                        </td>

                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <StatusBadge
                            colorClass={rusakBerat ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
                            size="xs"
                          >
                            {rusakBerat ? 'Rusak Berat' : 'Selesai'}
                          </StatusBadge>
                        </td>

                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {p.no_struk && (
                              <button
                                type="button"
                                onClick={() => handlePrintStruk(p)}
                                title="Cetak Struk Penanganan"
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Printer size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetailModalTarget(p)}
                              title="Lihat Detail Lengkap"
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {displayedList.length === 0 && (
              <div className="text-center py-12 px-4">
                <p className="text-sm font-medium text-slate-700">Tidak ada data penanganan</p>
                <p className="text-xs text-slate-400 mt-1">
                  {search || filterKerusakan !== 'all'
                    ? 'Tidak ditemukan riwayat yang sesuai kriteria pencarian.'
                    : activeTab === 'diperbaiki_selesai'
                      ? 'Belum ada aset yang selesai diperbaiki.'
                      : 'Belum ada aset yang dinyatakan rusak berat.'}
                </p>
              </div>
            )}
          </div>
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

// Modal Review Sebelum Terima Laporan
function TerimaLaporanModal({
  penanganan,
  loading,
  onClose,
  onConfirm,
}: {
  penanganan: InventoryPenanganan;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <PlayCircle size={18} className="text-amber-600" />
              Terima Laporan Kerusakan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div className="w-full h-44 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
            {(penanganan as any).foto ? (
              <img
                src={STORAGE_BASE_URL + (penanganan as any).foto}
                alt="Foto kerusakan"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400">
                <ImageOff size={24} />
                <span className="text-xs">Tidak ada lampiran foto</span>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2.5 text-slate-600">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Kode Inventory</span>
              <span className="font-semibold text-slate-900 font-mono">{penanganan.inventory?.kode_inventory || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Nama Barang</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]">{penanganan.inventory?.nama || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Jenis Kerusakan</span>
              <span className="font-medium text-slate-800">{formatJenisKerusakan(penanganan.jenis_kerusakan)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Pelapor</span>
              <span className="font-medium text-slate-800">{namaPelaporPenanganan(penanganan)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Tanggal Lapor</span>
              <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.lapor_at, penanganan.tanggal_lapor)}</span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 block mb-1">Rincian Keluhan:</span>
              <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                {penanganan.keluhan}
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            Menerima laporan ini akan mengubah status inventaris menjadi <span className="font-semibold">"Sedang Diperbaiki"</span> dan mencatat teknisi yang menangani.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-xs"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
            {loading ? 'Memproses...' : 'Ya, Terima'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Detail Penanganan
function DetailPenangananModal({
  penanganan,
  onClose,
  onPrint,
}: {
  penanganan: InventoryPenanganan;
  onClose: () => void;
  onPrint: (p: InventoryPenanganan) => void;
}) {
  const rusakBerat = penanganan.hasil === 'rusak_berat';
  const totalBiaya = (Number(penanganan.harga_jasa) || 0) + (Number(penanganan.biaya_komponen) || 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Wrench size={18} className={rusakBerat ? 'text-red-600' : 'text-emerald-600'} />
              {rusakBerat ? 'Detail Rusak Berat' : 'Detail Penanganan Inventory'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div className="w-full h-44 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
            {(penanganan as any).foto ? (
              <img
                src={STORAGE_BASE_URL + (penanganan as any).foto}
                alt="Foto kerusakan"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400">
                <ImageOff size={24} />
                <span className="text-xs">Tidak ada lampiran foto</span>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2.5 text-slate-600">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Kode Inventory</span>
              <span className="font-semibold text-slate-900 font-mono">{penanganan.inventory?.kode_inventory || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Nama Unit</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]">{penanganan.inventory?.nama || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Jenis Kerusakan</span>
              <span className="font-medium text-slate-800">{formatJenisKerusakan(penanganan.jenis_kerusakan)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Pelapor</span>
              <span className="font-medium text-slate-800">{namaPelaporPenanganan(penanganan)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
              <span className="text-slate-500">Tanggal Lapor</span>
              <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.lapor_at, penanganan.tanggal_lapor)}</span>
            </div>

            {penanganan.tanggal_diterima && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">Diterima Teknisi</span>
                <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.diterima_at ?? null, penanganan.tanggal_diterima)}</span>
              </div>
            )}

            {penanganan.tanggal_selesai && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">Tanggal Selesai</span>
                <span className="font-medium text-slate-800">{formatTanggalWaktuId(penanganan.selesai_at ?? null, penanganan.tanggal_selesai)}</span>
              </div>
            )}

            {penanganan.durasi_detik != null && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">Durasi Pengerjaan</span>
                <span className="font-medium text-slate-800">{formatDurasi(penanganan.durasi_detik)}</span>
              </div>
            )}

            {!rusakBerat && totalBiaya > 0 && (
              <>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                  <span className="text-slate-500">Biaya Komponen</span>
                  <span className="font-medium text-slate-800">{formatRupiah(penanganan.biaya_komponen)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                  <span className="text-slate-500">Biaya Jasa</span>
                  <span className="font-medium text-slate-800">{formatRupiah(penanganan.harga_jasa)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                  <span className="font-bold text-slate-900">Total Biaya</span>
                  <span className="font-bold text-slate-900">{formatRupiah(totalBiaya)}</span>
                </div>
              </>
            )}

            {penanganan.no_struk && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                <span className="text-slate-500">No. Struk</span>
                <span className="font-mono font-medium text-slate-800">{penanganan.no_struk}</span>
              </div>
            )}

            <div className="pt-1">
              <span className="text-slate-500 block mb-1">Rincian Keluhan:</span>
              <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                {penanganan.keluhan}
              </p>
            </div>

            {penanganan.catatan && (
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Catatan Pengerjaan:</span>
                <p className="font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {penanganan.catatan}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          {penanganan.no_struk && (
            <button
              type="button"
              onClick={() => onPrint(penanganan)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <Printer size={15} />
              Cetak Struk
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Form Selesai Perbaikan
function FormPerbaikanModal({
  penanganan,
  onClose,
  onSuccess,
}: {
  penanganan: InventoryPenanganan;
  onClose: () => void;
  onSuccess: (updated: InventoryPenanganan) => void;
}) {
  const [tanggalSelesai, setTanggalSelesai] = useState(todayIso());
  const [hasil, setHasil] = useState<'diperbaiki' | 'rusak_berat'>('diperbaiki');
  const [biayaKomponen, setBiayaKomponen] = useState('');
  const [hargaJasa, setHargaJasa] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isRusakBerat = hasil === 'rusak_berat';

  const handleHasilChange = (value: 'diperbaiki' | 'rusak_berat') => {
    setHasil(value);
    if (value === 'rusak_berat') {
      setBiayaKomponen('');
      setHargaJasa('');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await selesaikanPenangananInventory(penanganan.id, {
        tanggal_selesai: tanggalSelesai,
        biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
        harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
        hasil,
        catatan: catatan.trim() || null,
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(
        err.response?.data?.errors?.biaya_komponen?.[0] ||
        err.response?.data?.errors?.harga_jasa?.[0] ||
        err.response?.data?.message ||
        'Gagal menyimpan perbaikan.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-sm max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Wrench size={18} className="text-emerald-600" />
              Form Perbaikan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hasil Penanganan</label>
              <Select
                value={hasil}
                onChange={(v) => handleHasilChange(v as 'diperbaiki' | 'rusak_berat')}
                options={[
                  { value: 'diperbaiki', label: 'Diperbaiki (Kembali Normal)' },
                  { value: 'rusak_berat', label: 'Rusak Berat (Tidak Bisa Diperbaiki)' },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Komponen</label>
                <input
                  type="number"
                  min={0}
                  value={biayaKomponen}
                  onChange={(e) => setBiayaKomponen(e.target.value)}
                  placeholder={isRusakBerat ? '-' : '0'}
                  disabled={isRusakBerat}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Jasa</label>
                <input
                  type="number"
                  min={0}
                  value={hargaJasa}
                  onChange={(e) => setHargaJasa(e.target.value)}
                  placeholder={isRusakBerat ? '-' : '0'}
                  disabled={isRusakBerat}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Hasil Pengerjaan</label>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={3}
                placeholder="cth. Komponen IC diganti dan unit telah ditest running 24 jam"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Menyimpan...' : 'Simpan & Tandai Selesai'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}