import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Wrench, Printer, PlayCircle, ChevronLeft, ChevronRight, Eye, Search, ImageOff } from 'lucide-react';
import api from '../../api/axios';
import { terimaPenangananAset, selesaikanPenangananAset, type AsetPenanganan } from '../../api/aset';
import { formatTanggalId, namaPemakai } from './asetHelpers';
import { printStruk } from '../../utils/printStruk';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

// pakai tipe dari api/aset.ts (yang sudah punya tanggal_diterima), tapi hit
// endpoint yang sama '/aset-penanganan' — konsisten sama tab Aset & backend.
async function getAsetPenanganan(): Promise<AsetPenanganan[]> {
  const res = await api.get<AsetPenanganan[]>('/aset-penanganan');
  return res.data;
}

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

export default function TabPenangananAset({ onCount }: Props) {
  const [penangananList, setPenangananList] = useState<AsetPenanganan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePenanganan, setActivePenanganan] = useState<AsetPenanganan | null>(null);
  const [activeTab, setActiveTab] = useState<TabStatus>('menunggu');
  const [page, setPage] = useState(1);

  // Search bar khusus tab "Berhasil Diperbaiki" & "Rusak Berat" -- masing-masing
  // punya state kata kunci sendiri biar gak nyampur pas pindah tab.
  const [searchSelesai, setSearchSelesai] = useState('');
  const [searchRusakBerat, setSearchRusakBerat] = useState('');

  // Detail utk "Berhasil Diperbaiki" & "Rusak Berat" sama-sama munculnya
  // lewat modal kecil (absolute, nutupin layar), bukan expand inline lagi.
  const [detailModalTarget, setDetailModalTarget] = useState<AsetPenanganan | null>(null);

  // BARU: laporan yang lagi direview sebelum diterima -- klik "Terima Laporan"
  // di card gak langsung nembak API lagi, tapi buka modal detail (termasuk
  // foto bukti kerusakan) dulu. Aksi terima yang sebenarnya dipicu dari
  // tombol konfirmasi di dalam modal ini.
  const [terimaTarget, setTerimaTarget] = useState<AsetPenanganan | null>(null);

  const handleTabChange = (tab: TabStatus) => {
    setActiveTab(tab);
    setPage(1); // balik ke halaman 1 tiap ganti tab biar gak nyangkut di halaman kosong
  };

  const load = () => {
    setLoading(true);
    setError('');
    getAsetPenanganan()
      .then(setPenangananList)
      .catch((err) => {
        setError('Gagal memuat laporan penanganan aset.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  // versi diam-diam buat polling — gak nyalain loading spinner / error state
  const loadSilent = () => {
    getAsetPenanganan()
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
  const handleTerima = async (p: AsetPenanganan) => {
    setTerimaLoadingId(p.id);
    try {
      const updated = await terimaPenangananAset(p.id);
      setPenangananList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Laporan diterima, aset ditandai sedang diperbaiki.');
      setTerimaTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menerima laporan.');
    } finally {
      setTerimaLoadingId(null);
    }
  };

  const handleSelesai = (updated: AsetPenanganan) => {
    setPenangananList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setActivePenanganan(null);
    toast.success('Perbaikan selesai dicatat.');
  };

  const handlePrintStruk = (p: AsetPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
      // rusak berat: gak ada biaya/proses perbaikan, jadi struknya diringkes
      // -- cuma hasil & durasi (catatan & no. struk udah otomatis ke-print
      // di luar rows lewat parameter catatan/noStruk)
      printStruk({
        judul: 'Bukti Penanganan Aset',
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
      judul: 'Bukti Penanganan Aset',
      noStruk: p.no_struk,
      tanggal: formatTanggalId(p.tanggal_selesai),
      rows: [
        { label: 'Aset', value: p.aset?.kode_aset || '-' },
        { label: 'Jenis Kerusakan', value: p.jenis_kerusakan === 'hardware' ? 'Hardware' : 'Software' },
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
    return <p className="text-sm text-slate-500">Memuat laporan penanganan aset...</p>;
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
  const matchSearch = (p: AsetPenanganan, keyword: string) => {
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.aset?.kode_aset || '').toLowerCase().includes(q) ||
      (p.jenis_kerusakan || '').toLowerCase().includes(q) ||
      (p.keluhan || '').toLowerCase().includes(q) ||
      (namaPemakai(p.pemakai)).toLowerCase().includes(q)
    );
  };

  const diperbaikiSelesaiFiltered = diperbaikiSelesaiList.filter((p) => matchSearch(p, searchSelesai));
  const rusakBeratFiltered = rusakBeratList.filter((p) => matchSearch(p, searchRusakBerat));

  const tabs: { key: TabStatus; label: string; list: AsetPenanganan[] }[] = [
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
      <h3 className="text-base font-semibold text-slate-900 mb-1">Forum Penanganan Aset</h3>
      <p className="text-sm text-slate-500 mb-4">Laporan kerusakan dari peminjam yang belum/sudah ditangani.</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              activeTab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t.list.length}
            </span>
          </button>
        ))}
      </div>

      {(activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat') && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={activeTab === 'diperbaiki_selesai' ? searchSelesai : searchRusakBerat}
            onChange={(e) => {
              const value = e.target.value;
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
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      )}

      {activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat' ? (
        // Tab "Berhasil Diperbaiki" & "Rusak Berat": tabel, mirip pola tabel
        // di halaman Aset (TabAset.tsx). Detail lengkap buka lewat modal kecil.
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium text-left">Kode Aset</th>
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
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.aset?.kode_aset}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                        <p className="font-medium text-slate-800 truncate">{p.jenis_kerusakan}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                        <p className="truncate" title={namaPemakai(p.pemakai)}>{namaPemakai(p.pemakai)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTanggalId(p.tanggal_selesai)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            rusakBerat ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {rusakBerat ? 'Rusak Berat' : 'Berhasil Diperbaiki'}
                        </span>
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
                  <span className="text-sm font-medium text-slate-800">{p.aset?.kode_aset}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Dilaporkan oleh <span className="font-medium">{namaPemakai(p.pemakai)}</span> · {formatTanggalId(p.tanggal_lapor)}
                </p>
                <p className="text-sm text-slate-700 mt-2">
                  <span className="font-medium">{p.jenis_kerusakan}</span> — {p.keluhan}
                </p>

                {!diterima ? (
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
                )}
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
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Menampilkan {(safePage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(safePage * ITEMS_PER_PAGE, displayedList.length)} dari {displayedList.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setPage(num)}
                className={`min-w-[28px] h-[28px] text-xs font-semibold rounded-lg transition ${
                  num === safePage
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
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
  penanganan: AsetPenanganan;
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
          <p><span className="font-medium text-slate-800">Aset:</span> {penanganan.aset?.kode_aset || '-'}</p>
          <p><span className="font-medium text-slate-800">Jenis Kerusakan:</span> {penanganan.jenis_kerusakan}</p>
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
  penanganan: AsetPenanganan;
  onClose: () => void;
  onPrint: (p: AsetPenanganan) => void;
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
          {penanganan.aset?.kode_aset} · {penanganan.jenis_kerusakan} — {penanganan.keluhan}
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
  penanganan: AsetPenanganan;
  onClose: () => void;
  onSuccess: (updated: AsetPenanganan) => void;
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
      const updated = await selesaikanPenangananAset(penanganan.id, {
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
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Wrench size={18} className="text-emerald-600" />
            Form Perbaikan
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          {penanganan.aset?.kode_aset} · {penanganan.jenis_kerusakan} — {penanganan.keluhan}
        </p>

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
            <select
              value={hasil}
              onChange={(e) => handleHasilChange(e.target.value as 'diperbaiki' | 'rusak_berat')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="diperbaiki">Diperbaiki</option>
              <option value="rusak_berat">Rusak Berat (tidak bisa diperbaiki)</option>
            </select>
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

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-emerald-700 transition disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : 'Simpan & Tandai Selesai'}
        </button>
      </div>
    </div>
  );
}