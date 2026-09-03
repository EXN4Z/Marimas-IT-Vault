import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Wrench, Printer, PlayCircle, Eye, ImageOff, Upload, Download, Loader2 } from 'lucide-react';
import Pagination from '../components/shared/Pagination';
import Select from '../components/shared/Select';
import api from '../api/axios';
import { terimaPenangananInventory, selesaikanPenangananInventory, getInventoryPenanganan, type InventoryPenanganan } from '../api/transaksi/inventoryPenanganan';
import { formatTanggalId, namaPemakai, formatJenisKerusakan } from '../components/masterData/inventoryHelpers';
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

function formatRupiah(n?: number | null) {
  if (n == null) return '-';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

type TabStatus = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';

const ITEMS_PER_PAGE = 10;

export default function PenangananInventory({ onCount }: Props) {
  // BARU: halaman ini sekarang bisa diakses karyawan/manajer juga (dulu
  // admin+hr only), tapi datanya sudah discoping ke laporan milik sendiri
  // dari backend (lihat InventoryPenangananController::index()). Aksi
  // admin-only (Terima Laporan, Tandai Selesai, Import/Export) tetap
  // disembunyikan dari non-admin di sini karena endpoint-nya juga tetap
  // admin-only di backend -- non-admin cuma boleh lihat, gak bisa proses.
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [penangananList, setPenangananList] = useState<InventoryPenanganan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePenanganan, setActivePenanganan] = useState<InventoryPenanganan | null>(null);
  const [activeTab, setActiveTab] = useState<TabStatus>('menunggu');
  const [page, setPage] = useState(1);

  // Search bar khusus tab "Berhasil Diperbaiki" & "Rusak Berat" -- masing-masing
  // punya state kata kunci sendiri biar gak nyampur pas pindah tab.
  const [searchSelesai, setSearchSelesai] = useState('');
  const [searchRusakBerat, setSearchRusakBerat] = useState('');

  // Detail utk "Berhasil Diperbaiki" & "Rusak Berat" sama-sama munculnya
  // lewat modal kecil (absolute, nutupin layar), bukan expand inline lagi.
  const [detailModalTarget, setDetailModalTarget] = useState<InventoryPenanganan | null>(null);

  // BARU: laporan yang lagi direview sebelum diterima -- klik "Terima Laporan"
  // di card gak langsung nembak API lagi, tapi buka modal detail (termasuk
  // foto bukti kerusakan) dulu. Aksi terima yang sebenarnya dipicu dari
  // tombol konfirmasi di dalam modal ini.
  const [terimaTarget, setTerimaTarget] = useState<InventoryPenanganan | null>(null);

  // BARU: Import & Export -- SENGAJA cuma diaktifin buat 2 tab yang datanya
  // sudah final (tanggal_selesai terisi): "Berhasil Diperbaiki" & "Rusak
  // Berat". Tab "Menunggu Terima" & "Sedang Diperbaiki" gak dikasih tombol
  // ini karena datanya masih berubah-ubah (belum jadi catatan final).
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
      load(); // refresh list biar hasil import langsung kelihatan di tabel
    } catch (err: any) {
      setImportMessage({
        type: 'error',
        text: err.response?.data?.message || 'Gagal mengimport file',
      });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
    }
  };

  const handleTabChange = (tab: TabStatus) => {
    setActiveTab(tab);
    setPage(1); // balik ke halaman 1 tiap ganti tab biar gak nyangkut di halaman kosong
    setImportMessage(null); // pesan import tab lama gak perlu nyangkut ke tab baru
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

  // versi diam-diam buat polling — gak nyalain loading spinner / error state
  const loadSilent = () => {
    getInventoryPenanganan()
      .then(setPenangananList)
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    load();
  }, []);

  // auto-refresh tiap 5 detik biar status (menunggu perbaikan / sedang
  // diperbaiki / selesai) langsung update di layar tanpa perlu F5.
  useEffect(() => {
    const interval = setInterval(loadSilent, 5000);
    return () => clearInterval(interval);
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return; // hindari kedip ke 0 sebelum fetch pertama kelar
    const belumDitangani = penangananList.filter((p) => !p.tanggal_selesai).length;
    if (lastCount.current !== belumDitangani) {
      lastCount.current = belumDitangani;
      onCount?.(belumDitangani);
    }
  }, [penangananList, loading, onCount]);

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  // dipanggil dari dalam modal TerimaLaporanModal, bukan langsung dari card lagi
  const handleTerima = async (p: InventoryPenanganan) => {
    setTerimaLoadingId(p.id);
    try {
      const updated = await terimaPenangananInventory(p.id);
      setPenangananList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Laporan diterima, aset ditandai sedang diperbaiki.');
      setTerimaTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menerima laporan.');
    } finally {
      setTerimaLoadingId(null);
    }
  };

  const handleSelesai = (updated: InventoryPenanganan) => {
    setPenangananList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setActivePenanganan(null);
    toast.success('Perbaikan selesai dicatat.');
  };

  const handlePrintStruk = (p: InventoryPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
      // rusak berat: gak ada biaya/proses perbaikan, jadi struknya diringkes
      // -- cuma hasil & durasi (catatan & no. struk udah otomatis ke-print
      // di luar rows lewat parameter catatan/noStruk)
      printStruk({
        judul: 'Bukti Penanganan Inventory',
        noStruk: p.no_struk,
        tanggal: formatTanggalId(p.tanggal_selesai),
        rows: [
          { label: 'Hasil', value: 'Rusak Berat (tidak bisa diperbaiki)' },
          { label: 'Durasi', value: p.durasi_hari != null ? `${p.durasi_hari} hari` : '-' },
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
        { label: 'Durasi', value: p.durasi_hari != null ? `${p.durasi_hari} hari` : '-' },
        { label: 'Biaya Komponen', value: formatRupiah(p.biaya_komponen) },
        { label: 'Biaya Jasa', value: formatRupiah(p.harga_jasa) },
      ],
      totalLabel: 'Total Biaya',
      totalValue: formatRupiah(totalBiaya),
      catatan: p.catatan,
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-4 w-56 rounded" />
          <Skeleton className="h-3 w-80 rounded" />
        </div>
        {/* Fake tab bar, niru ScrollableTabBar biar layout gak "loncat" */}
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg shrink-0" />
          ))}
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <SkeletonListCard rows={5} />
        </div>
      </div>
    );
  }

  // pisah per status: belum diterima admin, lagi diperbaiki, dan yang udah
  // selesai dipecah lagi jadi 2 -- berhasil diperbaiki vs rusak berat --
  // biar gak nyampur di satu tab.
  const menungguList = penangananList.filter((p) => !p.tanggal_selesai && !p.tanggal_diterima);
  const diperbaikiList = penangananList.filter((p) => !p.tanggal_selesai && !!p.tanggal_diterima);
  const diperbaikiSelesaiList = penangananList.filter((p) => !!p.tanggal_selesai && p.hasil !== 'rusak_berat');
  const rusakBeratList = penangananList.filter((p) => !!p.tanggal_selesai && p.hasil === 'rusak_berat');

  // Cocokin kata kunci ke kode aset, jenis kerusakan, keluhan, dan nama pelapor
  // -- dipakai buat search bar di tab "Berhasil Diperbaiki" & "Rusak Berat".
  const matchSearch = (p: InventoryPenanganan, keyword: string) => {
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.inventory?.kode_inventory || '').toLowerCase().includes(q) ||
      (p.jenis_kerusakan || '').toLowerCase().includes(q) ||
      (p.keluhan || '').toLowerCase().includes(q) ||
      (namaPemakai(p.pemakai)).toLowerCase().includes(q)
    );
  };

  const diperbaikiSelesaiFiltered = diperbaikiSelesaiList.filter((p) => matchSearch(p, searchSelesai));
  const rusakBeratFiltered = rusakBeratList.filter((p) => matchSearch(p, searchRusakBerat));

  const tabs: { key: TabStatus; label: string; list: InventoryPenanganan[] }[] = [
    { key: 'menunggu', label: 'Menunggu Terima', list: menungguList },
    { key: 'diperbaiki', label: 'Sedang Diperbaiki', list: diperbaikiList },
    { key: 'diperbaiki_selesai', label: 'Berhasil Diperbaiki', list: diperbaikiSelesaiList },
    { key: 'rusak_berat', label: 'Rusak Berat', list: rusakBeratList },
  ];

  // displayedList (yang beneran dirender & dipaginasi) pakai versi yang sudah
  // difilter search untuk 2 tab tsb, sedangkan badge jumlah di tab header
  // (di atas) tetap pakai jumlah total biar gak bikin bingung pas lagi nyari.
  const displayedList =
    activeTab === 'diperbaiki_selesai'
      ? diperbaikiSelesaiFiltered
      : activeTab === 'rusak_berat'
        ? rusakBeratFiltered
        : tabs.find((t) => t.key === activeTab)?.list ?? [];

  const totalPages = Math.max(1, Math.ceil(displayedList.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedList = displayedList.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Forum Penanganan Inventory</h3>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Laporan kerusakan dari peminjam yang belum/sudah ditangani.'
              : 'Status laporan kerusakan inventory yang pernah/sedang kamu pakai.'}
          </p>
        </div>

        {/* Import & Export -- cuma tampil di tab "Berhasil Diperbaiki" &
            "Rusak Berat" (lihat catatan di deklarasi canImportExport). */}
        {canImportExport && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importLoading ? 'Mengimport...' : 'Import Excel'}
            </button>
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        )}
      </div>

      {importMessage && (
        <p className={`text-sm mb-4 -mt-2 ${importMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {importMessage.text}
        </p>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <ScrollableTabBar
        className="mb-4"
        activeTab={activeTab}
        onChange={handleTabChange}
        tabs={tabs.map((t) => ({
          key: t.key,
          label: t.label,
          badge: t.list.length,
          badgeClassName: activeTab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
        }))}
      />

      {(activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat') && (
        <SearchInput
          value={activeTab === 'diperbaiki_selesai' ? searchSelesai : searchRusakBerat}
          onChange={(value) => {
            if (activeTab === 'diperbaiki_selesai') {
              setSearchSelesai(value);
            } else {
              setSearchRusakBerat(value);
            }
            setPage(1); // balik ke halaman 1 tiap kata kunci berubah
          }}
          placeholder={
            activeTab === 'diperbaiki_selesai'
              ? 'Cari aset berhasil diperbaiki (kode aset, keluhan, pelapor)...'
              : 'Cari aset rusak berat (kode aset, keluhan, pelapor)...'
          }
          className="mb-4"
        />
      )}

      {activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat' ? (
        // Tab "Berhasil Diperbaiki" & "Rusak Berat": tabel, mirip pola tabel
        // di halaman Aset (TabAset.tsx). Detail lengkap buka lewat modal kecil.
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium text-left">Kode Inventory</th>
                  <th className="px-4 py-3 font-medium text-left">Kerusakan</th>
                  <th className="px-4 py-3 font-medium text-left">Pelapor</th>
                  <th className="px-4 py-3 font-medium text-left">Tanggal Selesai</th>
                  <th className="px-4 py-3 font-medium text-left">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((p) => {
                  const rusakBerat = p.hasil === 'rusak_berat';
                  return (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.inventory?.kode_inventory}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                        <p className="font-medium text-slate-800 truncate">{formatJenisKerusakan(p.jenis_kerusakan)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                        <p className="truncate" title={namaPemakai(p.pemakai)}>{namaPemakai(p.pemakai)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge
                          colorClass={rusakBerat ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}
                          size="xs"
                        >
                          {rusakBerat ? 'Rusak Berat' : 'Berhasil Diperbaiki'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setDetailModalTarget(p)}
                            title="Lihat Detail"
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
            <p className="text-sm text-slate-400 text-center py-8">
              {activeTab === 'diperbaiki_selesai'
                ? (searchSelesai.trim()
                    ? `Tidak ditemukan hasil untuk "${searchSelesai}".`
                    : 'Belum ada penanganan yang berhasil diperbaiki.')
                : (searchRusakBerat.trim()
                    ? `Tidak ditemukan hasil untuk "${searchRusakBerat}".`
                    : 'Belum ada aset yang dinyatakan rusak berat.')}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedList.map((p) => {
            const diterima = !!p.tanggal_diterima;
            const statusLabel = diterima ? 'Sedang Diperbaiki' : 'Menunggu Perbaikan';
            const statusStyle = diterima ? 'bg-orange-50 text-orange-700' : 'bg-yellow-50 text-yellow-700';

            return (
              <div key={p.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-800">{p.inventory?.kode_inventory}</span>
                  <StatusBadge colorClass={statusStyle} size="xs">{statusLabel}</StatusBadge>
                </div>
                <p className="text-xs text-slate-500">
                  Dilaporkan oleh <span className="font-medium">{namaPemakai(p.pemakai)}</span> · {formatTanggalId(p.tanggal_lapor)}
                </p>
                <p className="text-sm text-slate-700 mt-2">
                  <span className="font-medium">{formatJenisKerusakan(p.jenis_kerusakan)}</span> — {p.keluhan}
                </p>

                {/* Aksi proses (Terima Laporan / Tandai Selesai) admin-only --
                    endpoint terima()/update() di backend juga admin-only, jadi
                    non-admin cuma bisa pantau statusnya di sini. */}
                {isAdmin && (!diterima ? (
                  // BARU: gak langsung terima -- buka modal detail (+ foto) dulu,
                  // aksi terima yang sebenarnya dipicu dari dalam modal itu.
                  <button
                    onClick={() => setTerimaTarget(p)}
                    className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition flex items-center gap-1.5 w-fit"
                  >
                    <PlayCircle size={14} />
                    Terima Laporan
                  </button>
                ) : (
                  <button
                    onClick={() => setActivePenanganan(p)}
                    className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 w-fit"
                  >
                    <Wrench size={14} />
                    Tandai Selesai
                  </button>
                ))}
              </div>
            );
          })}
          {displayedList.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              {activeTab === 'menunggu' && 'Tidak ada laporan yang menunggu diterima.'}
              {activeTab === 'diperbaiki' && 'Tidak ada aset yang sedang diperbaiki.'}
            </p>
          )}
        </div>
      )}

      {displayedList.length > ITEMS_PER_PAGE && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
          totalItems={displayedList.length}
          itemLabel="data"
        />
      )}

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

      {/* BARU: modal review sebelum terima laporan -- nampilin detail lengkap
          laporan (termasuk foto bukti kerusakan kalau ada) sebelum admin
          benar-benar konfirmasi terima. */}
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

// BARU: modal yang muncul begitu admin klik "Terima Laporan" di tab
// "Menunggu Terima" -- nampilin detail laporan (jenis kerusakan, keluhan,
// pelapor, tanggal lapor, dan foto bukti kalau ada) sebelum admin konfirmasi
// terima. Fotonya diambil dari kolom `foto` (path relatif disk `public`),
// sama pola kayak foto aset & thumbnail di Riwayat Perbaikan (TabAset.tsx).
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
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <PlayCircle size={18} className="text-amber-600" />
            Terima Laporan Kerusakan
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="w-full h-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center mb-4">
          {(penanganan as any).foto ? (
            <img
              src={STORAGE_BASE_URL + (penanganan as any).foto}
              alt="Foto kerusakan"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-300">
              <ImageOff size={24} />
              <span className="text-xs">Tidak ada foto</span>
            </div>
          )}
        </div>

        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 flex flex-col gap-2 mb-4">
          <p><span className="font-medium text-slate-800">Inventory:</span> {penanganan.inventory?.kode_inventory || '-'}</p>
          <p><span className="font-medium text-slate-800">Jenis Kerusakan:</span> {formatJenisKerusakan(penanganan.jenis_kerusakan)}</p>
          <p><span className="font-medium text-slate-800">Keluhan:</span> {penanganan.keluhan}</p>
          <p><span className="font-medium text-slate-800">Dilaporkan Oleh:</span> {namaPemakai(penanganan.pemakai)}</p>
          <p><span className="font-medium text-slate-800">Tanggal Lapor:</span> {formatTanggalId(penanganan.tanggal_lapor)}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-40"
          >
            {loading ? 'Memproses...' : 'Ya, Terima'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Wrench size={18} className={rusakBerat ? 'text-red-600' : 'text-emerald-600'} />
            {rusakBerat ? 'Detail Rusak Berat' : 'Detail Berhasil Diperbaiki'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {(penanganan as any).foto && (
          <div className="w-full h-40 rounded-lg overflow-hidden mb-4 bg-slate-100">
            <img
              src={STORAGE_BASE_URL + (penanganan as any).foto}
              alt="Foto kerusakan"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <p className="text-xs text-slate-400 mb-4">
          {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)} — {penanganan.keluhan}
        </p>

        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 flex flex-col gap-2">
          <p><span className="font-medium text-slate-800">Hasil:</span> {rusakBerat ? 'Rusak Berat (tidak bisa diperbaiki)' : 'Diperbaiki'}</p>
          {!rusakBerat && (
            <p>
              <span className="font-medium text-slate-800">Biaya:</span> {formatRupiah(penanganan.total_biaya)}
              {' '}(komponen {formatRupiah(penanganan.biaya_komponen)} + jasa {formatRupiah(penanganan.harga_jasa)})
            </p>
          )}
          <p><span className="font-medium text-slate-800">Durasi:</span> {penanganan.durasi_hari != null ? `${penanganan.durasi_hari} hari` : '-'}</p>
          {penanganan.catatan && (
            <p><span className="font-medium text-slate-800">Catatan:</span> {penanganan.catatan}</p>
          )}
          {penanganan.no_struk && (
            <p><span className="font-medium text-slate-800">No. Struk:</span> {penanganan.no_struk}</p>
          )}
        </div>

        {penanganan.no_struk && (
          <button
            onClick={() => onPrint(penanganan)}
            className="mt-4 w-full text-sm font-semibold px-3 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
          >
            <Printer size={14} />
            Cetak Struk
          </button>
        )}
      </div>
    </div>
  );
}

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
    // rusak berat = gak ada biaya perbaikan, kosongin biar gak ke-submit
    // nilai lama yang sempat diisi sebelum ganti pilihan
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
              {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)} — {penanganan.keluhan}
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Hasil</label>
            <Select
              value={hasil}
              onChange={(v) => handleHasilChange(v as 'diperbaiki' | 'rusak_berat')}
              options={[
                { value: 'diperbaiki', label: 'Diperbaiki' },
                { value: 'rusak_berat', label: 'Rusak Berat (tidak bisa diperbaiki)' },
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Detail Perbaikan / Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              placeholder="cth. Ganti SSD baru, sudah normal"
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