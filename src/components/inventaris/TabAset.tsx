import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Plus, X, Pencil, Trash2, HandCoins, Undo2, ImageOff, Wrench, CheckCircle2, PlayCircle, Printer, Eye, Tag, ChevronDown, Upload, Loader2 } from 'lucide-react';
import Pagination from '../shared/Pagination';
import ScrollableTabBar from '../shared/ScrollableTabBar';
import SearchInput from '../shared/SearchInput';
import StatusBadge from '../shared/StatusBadge';
import AsetFormModal from './AsetFormModal';
import AsetSerahTerimaModal from './AsetSerahTerimaModal';
import AsetPengembalianModal from './AsetPengembalianModal';
import AsetLaporKerusakanModal from './AsetLaporKerusakanModal';
import AsetPenangananSelesaiModal from './AsetPenangananSelesaiModal';
import { useAuth } from '../../context/AuthContext';
import { printStruk } from '../../utils/printStruk';
import { namaPemakai, userIdPemakai, isCabangPemakai } from './asetHelpers';
import api from '../../api/axios';
import {
  getAset,
  getAsetById,
  deleteAset,
  deletePenangananAset,
  deletePemakaiAset,
  terimaPenangananAset,
  jualAset,
  type Aset,
  type AsetStatus,
  type AsetPemakai,
  type AsetPenanganan,
} from '../../api/aset';
import { getJenisAset, type JenisAset, type JenisAsetKategori } from '../../api/jenisAset';
import { getSupplier, type Supplier } from '../../api/supplier';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

const STATUS_LABEL: Record<AsetStatus, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  menunggu_perbaikan: 'Menunggu Perbaikan',
  diperbaiki: 'Sedang Diperbaiki',
  rusak_berat: 'Rusak Berat',
  dijual: 'Dijual',
};

const STATUS_STYLE: Record<AsetStatus, string> = {
  tersedia: 'bg-emerald-50 text-emerald-700',
  dipakai: 'bg-amber-50 text-amber-700',
  menunggu_perbaikan: 'bg-yellow-50 text-yellow-700',
  diperbaiki: 'bg-orange-50 text-orange-700',
  rusak_berat: 'bg-red-100 text-red-800',
  dijual: 'bg-purple-50 text-purple-700',
};

// urutan tampil di tabel: tersedia paling atas, lalu dipakai, lalu status
// yang lagi dalam proses penanganan, rusak, rusak_berat, dan dijual paling
// bawah — dipakai sebagai key sort di filteredAset, BUKAN untuk urutan
// dropdown filter (dropdown tetap ikut urutan STATUS_LABEL di atas).
const STATUS_PRIORITY: Record<AsetStatus, number> = {
  tersedia: 1,
  dipakai: 2,
  menunggu_perbaikan: 3,
  diperbaiki: 4,
  rusak_berat: 5,
  dijual: 6,
};

function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}


interface Props {
  onlyMenipis?: boolean;
  onCount?: (count: number) => void;
}

export default function TabAset({ onlyMenipis, onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');

  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [jenisOptions, setJenisOptions] = useState<JenisAset[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<AsetStatus | ''>('');
  // Filter kategori jenis: '' (semua), 'aset_utama', atau 'kelengkapan'.
  // Kategori-nya nempel di jenis aset (lihat Master Data > Jenis Aset),
  // bukan kolom sendiri di tabel aset -- makanya difilter dari a.jenis?.kategori.
  const [kategoriFilter, setKategoriFilter] = useState<JenisAsetKategori | ''>('');

  // Pagination tabel aset — style sama kayak pager Riwayat Aset (10 per
  // halaman, angka + elipsis). Client-side krn /api/aset gak dipaging
  // di backend, tapi UI-nya ngikut pola yang sama.
  const [asetPage, setAsetPage] = useState(1);
  const ASET_PER_PAGE = 10;

  const [formOpen, setFormOpen] = useState(false);
  const [editingAset, setEditingAset] = useState<Aset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Aset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // BARU: kalau delete normal gagal krn aset punya riwayat pemakai/penanganan
  // (data lama/test yang "kecantol"), backend balikin force_available: true —
  // munculin opsi hapus paksa di modal yang sama, gak perlu klik ulang.
  const [deleteForceAvailable, setDeleteForceAvailable] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Aset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Serah-terima 1 aset utama (klik tombol "Serahkan" di baris) -- di dalam
  // modalnya sendiri ada checklist buat nambahin aset kelengkapan (tas,
  // charger, dst) yang mau ikut dipinjamkan bareng aset utama ini dalam SATU
  // proses (satu penerima, satu tanggal, satu set foto bukti, satu struk).
  // Tetap ditaruh di sini (bukan di dalam modal) karena aset yang diklik
  // datang dari tabel/detail panel ini.
  const [serahTerimaAset, setSerahTerimaAset] = useState<Aset | null>(null);
  const [pengembalianTarget, setPengembalianTarget] = useState<{ aset: Aset; pemakai: AsetPemakai } | null>(null);

  const [perbaikanAsetTarget, setPerbaikanAsetTarget] = useState<Aset | null>(null);
  const [penangananSelesaiTarget, setPenangananSelesaiTarget] = useState<{ aset: Aset; penanganan: AsetPenanganan } | null>(null);
  const [historyActionError, setHistoryActionError] = useState('');

  // BARU: state untuk aksi "Jual Aset" (aset berstatus tersedia atau rusak_berat) —
  // cuma tanda/konfirmasi, gak ada form harga/catatan
  const [jualTarget, setJualTarget] = useState<Aset | null>(null);
  const [jualLoading, setJualLoading] = useState(false);
  const [jualError, setJualError] = useState('');

  // PINDAHAN dari Inventaris.tsx: Import Excel data aset (bulk import: aset +
  // jenis + supplier + kelengkapan) — sekarang ditaruh di sini biar aksinya
  // nempel langsung sama tabel/list aset yang dia pengaruhi.
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadList = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAset();
      setAsetList(data);
    } catch (err) {
      setError('Gagal memuat data aset. Coba refresh halaman.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // BARU: versi "diam-diam" buat polling — gak nyalain loading spinner /
  // error state, biar gak ganggu tampilan yang lagi dilihat user.
  const loadListSilent = async () => {
    try {
      const data = await getAset();
      setAsetList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImportLoading(true);
    setImportMessage(null);

    try {
      const res = await api.post('/import-aset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportMessage({ type: 'success', text: res.data.message });
      // refresh list aset setelah import berhasil (badge count ikut update
      // otomatis lewat efek onCount di bawah begitu asetList berubah)
      loadList();
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

  useEffect(() => {
    loadList();
    getJenisAset().then(setJenisOptions).catch(() => {});
    getSupplier().then(setSupplierOptions).catch(() => {});
  }, []);

  // dipakai polling interval biar selalu tau detailId TERBARU tanpa perlu
  // re-create interval-nya tiap kali detailId berubah
  const detailIdRef = useRef<number | null>(null);
  useEffect(() => {
    detailIdRef.current = detailId;
  }, [detailId]);

  // BARU: auto-refresh tiap 5 detik biar perubahan status (menunggu perbaikan /
  // sedang diperbaiki / tersedia) langsung kelihatan tanpa perlu refresh manual —
  // baik di list maupun di modal detail yang lagi kebuka.
  useEffect(() => {
    const interval = setInterval(() => {
      loadListSilent();
      if (detailIdRef.current) {
        refreshDetailSilent(detailIdRef.current);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return; // hindari kedip ke 0 sebelum fetch pertama kelar
    if (lastCount.current !== asetList.length) {
      lastCount.current = asetList.length;
      onCount?.(asetList.length);
    }
  }, [asetList, loading, onCount]);

  const openDetail = async (id: number) => {
    setDetailId(id);
    setPenangananPage(1);
    setExpandedPenangananId(null);
    setExpandedPemakaiId(null);
    setDetailLoading(true);
    try {
      const data = await getAsetById(id);
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  const refreshDetail = async () => {
    if (!detailId) return;
    const data = await getAsetById(detailId);
    setDetail(data);
    setAsetList((prev) => prev.map((a) => (a.id === data.id ? { ...a, status: data.status } : a)));
  };

  // versi silent buat dipanggil dari polling interval (gak ada loading state)
  const refreshDetailSilent = async (id: number) => {
    try {
      const data = await getAsetById(id);
      setDetail((prev) => (prev && prev.id === id ? data : prev));
      setAsetList((prev) => prev.map((a) => (a.id === data.id ? { ...a, status: data.status } : a)));
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async (force = false) => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAset(deleteTarget.id, force);
      setAsetList((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteForceAvailable(false);
      if (detailId === deleteTarget.id) closeDetail();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus aset.');
      setDeleteForceAvailable(!!err.response?.data?.force_available);
    } finally {
      setDeleting(false);
    }
  };

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  // Pagination + dropdown detail buat Riwayat Perbaikan — style ringkas kayak
  // Riwayat Pemakai, limit 5 per halaman (beda dari Pagination tabel aset yg 10).
  const RIWAYAT_PERBAIKAN_PER_PAGE = 5;
  const [penangananPage, setPenangananPage] = useState(1);
  const [expandedPenangananId, setExpandedPenangananId] = useState<number | null>(null);
  const [expandedPemakaiId, setExpandedPemakaiId] = useState<number | null>(null);
  const [deletingPemakaiId, setDeletingPemakaiId] = useState<number | null>(null);

  const handleTerimaPenanganan = async (id: number) => {
    setHistoryActionError('');
    setTerimaLoadingId(id);
    try {
      await terimaPenangananAset(id);
      await refreshDetail();
      loadList();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menerima laporan penanganan.');
    } finally {
      setTerimaLoadingId(null);
    }
  };

  const handleDeletePenanganan = async (id: number) => {
    if (!confirm('Hapus riwayat penanganan ini?')) return;
    setHistoryActionError('');
    try {
      await deletePenangananAset(id);
      await refreshDetail();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat penanganan.');
    }
  };

  const handleDeletePemakai = async (id: number) => {
    if (!confirm('Hapus riwayat pemakaian ini?')) return;
    setHistoryActionError('');
    setDeletingPemakaiId(id);
    try {
      await deletePemakaiAset(id);
      await refreshDetail();
      loadList();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat pemakaian.');
    } finally {
      setDeletingPemakaiId(null);
    }
  };

  const handlePrintPenanganan = (aset: Aset, p: AsetPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
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
        { label: 'Aset', value: `${aset.kode_aset} — ${[aset.merek, aset.tipe].filter(Boolean).join(' ') || '-'}` },
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

  // BARU: sekarang bisa serah-terima lebih dari 1 aset dalam sekali proses
  // (aset utama + kelengkapan yang ikut dipinjamkan) -- tetap 1 struk gabungan,
  // pakai no_struk_penerimaan dari aset PERTAMA (aset utama yang diklik) sebagai
  // nomor struknya, item lain cuma numpang jadi baris "Aset 2", "Aset 3", dst.
  const handlePrintSerahTerima = (results: { aset: Aset; pemakai: AsetPemakai }[]) => {
    if (!results.length) return;
    const utama = results[0];
    if (!utama.pemakai.no_struk_penerimaan) return;
    const asetRows = results.map((r, i) => ({
      label: results.length > 1 ? `Aset ${i + 1}` : 'Aset',
      value: `${r.aset.kode_aset} — ${[r.aset.merek, r.aset.tipe].filter(Boolean).join(' ') || '-'}`,
    }));
    printStruk({
      judul: 'Bukti Serah Terima Aset',
      noStruk: utama.pemakai.no_struk_penerimaan,
      tanggal: formatTanggalId(utama.pemakai.tanggal_penerimaan),
      rows: [
        ...asetRows,
        { label: 'Diserahkan Kepada', value: namaPemakai(utama.pemakai) },
        { label: 'Nomor Penerimaan', value: utama.pemakai.nomor_penerimaan || '-' },
      ],
      catatan: utama.pemakai.catatan_penerimaan,
    });
  };

  const handlePrintPengembalian = (aset: Aset, pemakai: AsetPemakai) => {
    if (!pemakai.no_struk_pengembalian) return;
    printStruk({
      judul: 'Bukti Pengembalian Aset',
      noStruk: pemakai.no_struk_pengembalian,
      tanggal: formatTanggalId(pemakai.tanggal_pengembalian),
      rows: [
        { label: 'Aset', value: `${aset.kode_aset} — ${[aset.merek, aset.tipe].filter(Boolean).join(' ') || '-'}` },
        { label: 'Dikembalikan Oleh', value: namaPemakai(pemakai) },
        { label: 'Struk Penerimaan Asli', value: pemakai.no_struk_penerimaan || '-' },
      ],
      catatan: pemakai.catatan_pengembalian,
    });
  };

  // BARU: buka modal konfirmasi jual
  const openJual = (a: Aset) => {
    setJualTarget(a);
    setJualError('');
  };

  // BARU: submit aksi jual — tandai aset sebagai 'dijual', gak ada input tambahan
  const confirmJual = async () => {
    if (!jualTarget) return;
    setJualLoading(true);
    setJualError('');
    try {
      const updated = await jualAset(jualTarget.id);
      setAsetList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (detailId === updated.id) setDetail(updated);
      toast.success('Aset berhasil ditandai sebagai dijual.');
      setJualTarget(null);
    } catch (err: any) {
      setJualError(err.response?.data?.message || 'Gagal menandai aset sebagai terjual.');
    } finally {
      setJualLoading(false);
    }
  };

  const filteredAset = asetList
    .filter((a) => {
      const matchStatus = !statusFilter || a.status === statusFilter;
      const matchKategori = !kategoriFilter || (a.jenis?.kategori ?? 'aset_utama') === kategoriFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        a.kode_aset.toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q) ||
        (a.merek || '').toLowerCase().includes(q) ||
        (a.tipe || '').toLowerCase().includes(q) ||
        (a.jenis?.nama || '').toLowerCase().includes(q) ||
        // BARU: search juga cocokkan nama di kolom "Dipakai Oleh". Status
        // 'dijual' sengaja dilewati karena kolomnya ditampilkan sebagai "-"
        // di tabel (namaPemakai lama sudah tidak relevan buat aset yang dijual).
        (a.status !== 'dijual' && namaPemakai(a.pemakai_saat_ini).toLowerCase().includes(q));
      return matchStatus && matchKategori && matchSearch;
    })
    .filter((a) => !onlyMenipis || a.status === 'tersedia')
    // KARYAWAN/CABANG cuma boleh liat aset yang masih tersedia, atau aset yang
    // lagi dia pinjam sendiri. Aset yang dipakai/ditangani orang lain kehide
    // total dari tabel (bukan cuma nama pemakainya doang).
    // FIX: pakai userIdPemakai() (bukan akses langsung .pekerja?.user?.id),
    // biar akun cabang (yang gak punya pekerja, cuma user langsung) juga
    // kedeteksi bener sebagai pemilik record, bukan malah aset yang lagi dia
    // pegang sendiri ikut ke-filter hilang dari tabelnya.
    .filter((a) => {
      if (isAdmin) return true;
      const akuPeminjamnya = userIdPemakai(a.pemakai_saat_ini) === user?.id;
      return a.status === 'tersedia' || akuPeminjamnya;
    })
    // BARU: urutkan berdasarkan prioritas status — tersedia paling atas,
    // dipakai, lalu status dalam proses penanganan, rusak_berat, dan
    // dijual paling bawah. Lihat STATUS_PRIORITY di atas.
    .sort((a, b) => {
      const diffStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (diffStatus !== 0) return diffStatus;
      return a.kode_aset.localeCompare(b.kode_aset, 'id', { numeric: true });
    });

  // Jumlah aset per status (dari asetList utuh, bukan yang udah difilter),
  // dipakai buat badge angka di tiap opsi dropdown status.
  const statusCounts = useMemo(() => {
    const counts: Record<AsetStatus, number> = {
      tersedia: 0,
      dipakai: 0,
      menunggu_perbaikan: 0,
      diperbaiki: 0,
      rusak_berat: 0,
      dijual: 0,
    };
    for (const a of asetList) counts[a.status] += 1;
    return counts;
  }, [asetList]);

  const asetLastPage = Math.max(1, Math.ceil(filteredAset.length / ASET_PER_PAGE));
  const asetPageClamped = Math.min(asetPage, asetLastPage);
  const pageAset = filteredAset.slice(
    (asetPageClamped - 1) * ASET_PER_PAGE,
    asetPageClamped * ASET_PER_PAGE
  );

  // Balik ke halaman 1 tiap kali search/filter/status atau isi data berubah,
  // biar gak nyangkut di halaman kosong (sama pola kayak riwayat search).
  useEffect(() => {
    setAsetPage(1);
  }, [search, statusFilter, kategoriFilter, onlyMenipis]);

  // Dipakai bareng oleh tabel (desktop) & card (mobile) biar tombol aksinya
  // gak ke-duplikasi/nyimpang antara 2 tampilan itu.
  const renderAksiAset = (a: Aset) => {
    const akuPeminjamnya = userIdPemakai(a.pemakai_saat_ini) === user?.id;
    const bolehLihatDetail = isAdmin || akuPeminjamnya;
    return (
      <>
        {bolehLihatDetail && (
          <button
            onClick={() => openDetail(a.id)}
            title="Detail"
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <Eye size={15} />
          </button>
        )}

        {isAdmin && (
          <>
            {a.status === 'tersedia' && (
              <button
                onClick={() => setSerahTerimaAset(a)}
                title="Serahkan ke Karyawan"
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                <HandCoins size={14} />
                Serahkan
              </button>
            )}
            {a.status === 'dipakai' && a.pemakai_saat_ini && (
              <button
                onClick={() => setPengembalianTarget({ aset: a, pemakai: a.pemakai_saat_ini! })}
                title="Terima Kembali"
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                <Undo2 size={14} />
                Terima Kembali
              </button>
            )}
            <button
              onClick={() => {
                setEditingAset(a);
                setFormOpen(true);
              }}
              title="Edit"
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => {
                setDeleteError('');
                setDeleteForceAvailable(false);
                setDeleteTarget(a);
              }}
              title="Hapus"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}

        {!isAdmin && akuPeminjamnya && a.status === 'dipakai' && a.pemakai_saat_ini && (
          <button
            onClick={() => setPengembalianTarget({ aset: a, pemakai: a.pemakai_saat_ini! })}
            title="Kembalikan"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 transition"
          >
            <Undo2 size={14} />
            Kembalikan
          </button>
        )}

        {!isAdmin && akuPeminjamnya && a.status === 'dipakai' && (
          <button
            onClick={() => setPerbaikanAsetTarget(a)}
            title="Lapor Kerusakan"
            className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition"
          >
            <Wrench size={14} />
            Lapor Rusak
          </button>
        )}
        {!isAdmin && akuPeminjamnya && (a.status === 'menunggu_perbaikan' || a.status === 'diperbaiki' || a.status === 'rusak_berat') && (
          <span
            title="Laporan kerusakan sudah dikirim, menunggu ditangani admin"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg cursor-default"
          >
            <Wrench size={14} />
            Sudah Lapor
          </span>
        )}
      </>
    );
  };

  const [expandedAsetId, setExpandedAsetId] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-slate-500">
          Kelola aset IT per-unit (laptop, monitor, dsb) — serah-terima ke karyawan dan riwayatnya.
        </p>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {isAdmin && (
            <>
              {/* PINDAHAN dari Inventaris.tsx: Import Excel data aset */}
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
                {importLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {importLoading ? 'Mengimport...' : 'Import Excel'}
              </button>

              <button
                onClick={() => {
                  setEditingAset(null);
                  setFormOpen(true);
                }}
                className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
              >
                <Plus size={16} />
                Tambah Aset
              </button>
            </>
          )}
        </div>
      </div>

      {importMessage && (
        <p className={`text-sm mb-4 -mt-2 ${importMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {importMessage.text}
        </p>
      )}

      {/* Filter status sekarang pakai tab nav (ScrollableTabBar) -- sama pola
          kayak Forum Penanganan Aset, biar konsisten di seluruh halaman
          Inventaris. */}
      <ScrollableTabBar
        className="mb-4"
        activeTab={statusFilter === '' ? 'semua' : statusFilter}
        onChange={(key) => setStatusFilter(key === 'semua' ? '' : (key as AsetStatus))}
        tabs={[
          {
            key: 'semua' as const,
            label: 'Semua Status',
            badge: asetList.length,
            badgeClassName: statusFilter === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
          },
          ...(Object.keys(STATUS_LABEL) as AsetStatus[]).map((s) => ({
            key: s,
            label: STATUS_LABEL[s],
            badge: statusCounts[s],
            badgeClassName: statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
          })),
        ]}
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama, kode, atau jenis aset..."
          className="flex-1"
        />
        {/* Filter kategori jenis: Aset Utama (laptop, proyektor, dst) vs
            Kelengkapan (tas, charger, dst) -- kategorinya nempel di jenis
            aset (Master Data > Jenis Aset), difilter dari a.jenis?.kategori. */}
        <select
          value={kategoriFilter}
          onChange={(e) => setKategoriFilter(e.target.value as JenisAsetKategori | '')}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 sm:w-56"
        >
          <option value="">Semua Kategori</option>
          <option value="aset_utama">Aset Utama</option>
          <option value="kelengkapan">Kelengkapan</option>
        </select>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}
        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && filteredAset.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada aset.</p>
        )}

        {!loading && !error && filteredAset.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-[1180px] text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 text-middle text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Kode Aset</th>
                  <th className="px-6 py-3 font-medium">Jenis</th>
                  <th className="px-6 py-3 font-medium">Merek / Tipe</th>
                  <th className="px-6 py-3 font-medium">Jumlah</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Dipakai Oleh</th>
                  <th className="px-6 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pageAset.map((a) => {
                  return (
                    <tr key={a.id} className="text-center border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                      <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{a.kode_aset}</td>
                      <td className="px-6 py-3 text-slate-600 max-w-[140px]">
                        <p className="truncate" title={a.jenis?.nama || '-'}>{a.jenis?.nama || '-'}</p>
                      </td>
                      <td className="px-6 py-3 text-slate-600 max-w-[160px]">
                        <p className="truncate" title={[a.merek, a.tipe].filter(Boolean).join(' ') || '-'}>
                          {[a.merek, a.tipe].filter(Boolean).join(' ') || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{a.jumlah ?? 1}</td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <StatusBadge colorClass={STATUS_STYLE[a.status]}>{STATUS_LABEL[a.status]}</StatusBadge>
                      </td>
                      <td className="px-6 py-3 text-slate-600 max-w-[160px]">
                        <p className="truncate" title={a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}>
                          {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}
                          {a.status !== 'dijual' && isCabangPemakai(a.pemakai_saat_ini) && (
                            <span className="ml-1.5 text-[11px] text-slate-400">(Cabang)</span>
                          )}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1 flex-nowrap">
                          {renderAksiAset(a)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MOBILE: list card dengan dropdown expand-in-place per baris,
            gantiin tabel yang kepenuhan di layar sempit. Pola sama kayak
            "Dropdown detail" Riwayat Pemakai/Perbaikan di panel detail. */}
        {!loading && !error && filteredAset.length > 0 && (
          <div className="sm:hidden flex flex-col divide-y divide-slate-100">
            {pageAset.map((a) => {
              const expanded = expandedAsetId === a.id;
              return (
                <div key={a.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedAsetId(expanded ? null : a.id)}
                    className="w-full flex items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{a.kode_aset}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {a.jenis?.nama || '-'} · {[a.merek, a.tipe].filter(Boolean).join(' ') || '-'} · Jumlah: {a.jumlah ?? 1}
                      </p>
                      <StatusBadge colorClass={STATUS_STYLE[a.status]} size="xs" className="mt-1.5">
                        {STATUS_LABEL[a.status]}
                      </StatusBadge>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <p className="text-xs text-slate-500">
                        Dipakai Oleh:{' '}
                        <span className="text-slate-700 font-medium">
                          {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}
                          {a.status !== 'dijual' && isCabangPemakai(a.pemakai_saat_ini) && ' (Cabang)'}
                        </span>
                      </p>
                      <div className="flex items-center flex-wrap gap-1.5">
                        {renderAksiAset(a)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && filteredAset.length > 0 && asetLastPage > 1 && (
          <div className="px-6 py-3 border-t border-slate-100">
            <Pagination
              currentPage={asetPageClamped}
              totalPages={asetLastPage}
              onPageChange={setAsetPage}
              totalItems={filteredAset.length}
              itemLabel="aset"
              className="pt-0 mt-0 border-t-0"
            />
          </div>
        )}
      </div>

      {/* FORM TAMBAH / EDIT ASET */}
      {formOpen && (
        <AsetFormModal
          aset={editingAset}
          jenisOptions={jenisOptions}
          supplierOptions={supplierOptions}
          onClose={() => setFormOpen(false)}
          onSaved={(saved) => {
            setAsetList((prev) => {
              const exists = prev.some((a) => a.id === saved.id);
              return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
            });
            setFormOpen(false);
            if (detailId === saved.id) refreshDetail();
          }}
        />
      )}

    
      {/* KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Hapus aset?</h2>
            <p className="text-sm text-slate-500 mb-3">
              <span className="font-medium text-slate-700">{deleteTarget.kode_aset}</span> akan dihapus permanen
              beserta riwayatnya, dan tidak bisa dikembalikan.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {deleteError}
                {deleteForceAvailable && ' Aset ini punya riwayat, tapi bisa dihapus paksa kalau memang data lama/test.'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                  setDeleteForceAvailable(false);
                }}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => confirmDelete(false)}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, hapus'}
              </button>
              {deleteForceAvailable && (
                <button
                  onClick={() => confirmDelete(true)}
                  disabled={deleting}
                  className="text-sm px-4 py-2 rounded-lg bg-red-800 text-white hover:bg-red-900 disabled:opacity-50"
                >
                  {deleting ? 'Menghapus...' : 'Hapus Paksa'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARU: KONFIRMASI JUAL ASET — cuma tanda, gak ada form */}
      {jualTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Tandai aset sebagai dijual?</h2>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-medium text-slate-700">{jualTarget.kode_aset}</span> akan ditandai dengan status{' '}
              <span className="font-medium">Dijual</span> dan tidak bisa diserahkan/dipinjamkan lagi.
            </p>

            <div className="mb-4" />

            {jualError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{jualError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setJualTarget(null)}
                disabled={jualLoading}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmJual}
                disabled={jualLoading}
                className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {jualLoading ? 'Menyimpan...' : 'Ya, Dijual'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL ASET — disembunyiin sementara kalau ada modal aksi (serah-terima,
          terima kembali, jual, dst) yang kebuka di atasnya, biar gak numpuk 2
          modal + 2 overlay keliatan bareng */}
      {detailId &&
        !serahTerimaAset &&
        !pengembalianTarget &&
        !perbaikanAsetTarget &&
        !penangananSelesaiTarget &&
        !jualTarget && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Boxes size={18} className="text-slate-400" />
                {detail?.kode_aset || 'Memuat...'}
              </h3>
              <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {detailLoading && <p className="text-sm text-slate-400 text-center py-8">Memuat detail...</p>}

            {!detailLoading && detail && (
              <div className="flex flex-col gap-5">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {detail.foto ? (
                      <img src={STORAGE_BASE_URL + detail.foto} alt={detail.kode_aset} className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff size={22} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <StatusBadge colorClass={STATUS_STYLE[detail.status]} className="mb-2">
                      {STATUS_LABEL[detail.status]}
                    </StatusBadge>
                    <p className="text-sm text-slate-800 font-medium">{[detail.merek, detail.tipe].filter(Boolean).join(' ') || '-'}</p>
                    <p className="text-xs text-slate-400">{detail.jenis?.nama || '-'} · {detail.warna || '-'}</p>
                    <p className="text-xs text-slate-400">S/N: {detail.serial_number || '-'}</p>
                    <p className="text-xs text-slate-400">Jumlah: {detail.jumlah ?? 1}</p>
                  </div>
                </div>

                {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm">
                    <p className="text-xs text-slate-400 mb-1">Dipinjam Oleh</p>
                    <p className="text-slate-800 font-medium">
                      {namaPemakai(detail.pemakai_saat_ini)}
                      {isCabangPemakai(detail.pemakai_saat_ini) && ' (Cabang)'}
                    </p>
                    {detail.pemakai_saat_ini.pekerja && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        NIK: {detail.pemakai_saat_ini.pekerja.nik || '-'} · {detail.pemakai_saat_ini.pekerja.departemen?.nama || '-'}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Perusahaan</p>
                    <p className="text-slate-800">{detail.perusahaan || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Supplier</p>
                    <p className="text-slate-800">{detail.supplier?.nama || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tanggal Pembelian</p>
                    <p className="text-slate-800">{formatTanggalId(detail.tanggal_pembelian)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">No. Surat Jalan / GR</p>
                    <p className="text-slate-800">{detail.no_surat_jalan || '-'} / {detail.no_good_receive || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tanggal Garansi</p>
                    <p className="text-slate-800">{formatTanggalId(detail.tanggal_garansi)}</p>
                  </div>
                </div>

                {detail.keterangan && (
                  <div>
                    <p className="text-xs text-slate-400">Keterangan</p>
                    <p className="text-sm text-slate-700">{detail.keterangan}</p>
                  </div>
                )}

                {/* AKSI KONTEKSTUAL */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    {detail.status === 'tersedia' && (
                      <button
                        onClick={() => setSerahTerimaAset(detail)}
                        className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-800 transition"
                      >
                        <HandCoins size={14} />
                        Serahkan ke Karyawan
                      </button>
                    )}
                    {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
                      <button
                        onClick={() => setPengembalianTarget({ aset: detail, pemakai: detail.pemakai_saat_ini! })}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                      >
                        <Undo2 size={14} />
                        Terima Kembali
                      </button>
                    )}
                    {/* Tombol Jual Aset di panel detail (ikon mata) — muncul buat status
                        tersedia ATAU rusak_berat. Sekarang ini SATU-SATUNYA tempat aksi
                        jual bisa dipicu (nggak ada lagi tombol cepat di baris tabel). */}
                    {(detail.status === 'tersedia' || detail.status === 'rusak_berat') && (
                      <button
                        onClick={() => openJual(detail)}
                        className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-purple-700 transition"
                      >
                        <Tag size={14} />
                        Jual Aset
                      </button>
                    )}
                  </div>
                )}

                {/* KARYAWAN/CABANG: lapor kerusakan kalau lagi dia pakai sendiri.
                    (Ajukan pinjam sendiri sudah dicabut — aset cuma boleh
                    diserahkan admin lewat tombol "Serahkan".) */}
                {!isAdmin && (() => {
                  const akuPemakaiSaatIni = userIdPemakai(detail.pemakai_saat_ini) === user?.id;

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.status === 'dipakai' && akuPemakaiSaatIni && (
                        <button
                          onClick={() => setPengembalianTarget({ aset: detail, pemakai: detail.pemakai_saat_ini! })}
                          className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                        >
                          <Undo2 size={14} />
                          Kembalikan
                        </button>
                      )}
                      {detail.status === 'dipakai' && akuPemakaiSaatIni && (
                        <button
                          onClick={() => setPerbaikanAsetTarget(detail)}
                          className="flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-100 transition"
                        >
                          <Wrench size={14} />
                          Lapor Kerusakan
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* RIWAYAT PEMAKAI / PEMINJAMAN */}
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-2">Riwayat Pemakai (Peminjaman)</p>
                  <ul className="flex flex-col gap-2">
                    {(detail.pemakai || []).map((p) => {
                      const expanded = expandedPemakaiId === p.id;
                      return (
                        <li key={p.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                          {/* Baris ringkas — nama & rentang tanggal doang */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-medium text-slate-800">{namaPemakai(p)}</span>{' '}
                              <span className="text-slate-500">
                                — {formatTanggalId(p.tanggal_penerimaan)}
                                {p.tanggal_pengembalian ? ` s/d ${formatTanggalId(p.tanggal_pengembalian)}` : ' (masih dipakai)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isAdmin && p.no_struk_penerimaan && (
                                <button
                                  onClick={() => handlePrintSerahTerima([{ aset: detail, pemakai: p }])}
                                  title="Cetak struk penerimaan"
                                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition"
                                >
                                  <Printer size={13} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeletePemakai(p.id)}
                                  disabled={deletingPemakaiId === p.id}
                                  title="Hapus"
                                  className="p-1.5 rounded-md text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => setExpandedPemakaiId(expanded ? null : p.id)}
                                title={expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition"
                              >
                                {expanded ? <ChevronDown size={14} className="rotate-180 transition-transform" /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Dropdown detail — expand di tempat, gak buka modal/halaman baru */}
                          {expanded && (
                            <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-0.5">
                              {p.catatan_penerimaan && (
                                <p className="text-slate-400">Terima: {p.catatan_penerimaan}</p>
                              )}
                              {p.catatan_pengembalian && (
                                <p className="text-slate-400">Kembali: {p.catatan_pengembalian}</p>
                              )}
                              {p.no_struk_penerimaan && (
                                <p className="text-slate-400">Struk terima: {p.no_struk_penerimaan}</p>
                              )}
                              {p.no_struk_pengembalian && (
                                <p className="text-slate-400">Struk kembali: {p.no_struk_pengembalian}</p>
                              )}
                              {!p.catatan_penerimaan && !p.catatan_pengembalian && !p.no_struk_penerimaan && !p.no_struk_pengembalian && (
                                <p className="text-slate-400">Tidak ada catatan tambahan.</p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                    {!detail.pemakai?.length && (
                      <p className="text-xs text-slate-400">Belum ada riwayat pemakai.</p>
                    )}
                  </ul>
                </div>

                {historyActionError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {historyActionError}
                  </p>
                )}

                {/* RIWAYAT PERBAIKAN / PENANGANAN KERUSAKAN */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-900 mb-2">Riwayat Perbaikan</p>
                  {(() => {
                    const semuaPenanganan = detail.penanganan || [];
                    const totalPenangananPage = Math.max(1, Math.ceil(semuaPenanganan.length / RIWAYAT_PERBAIKAN_PER_PAGE));
                    const halamanPenanganan = semuaPenanganan.slice(
                      (penangananPage - 1) * RIWAYAT_PERBAIKAN_PER_PAGE,
                      penangananPage * RIWAYAT_PERBAIKAN_PER_PAGE
                    );
                    return (
                      <>
                        <ul className="flex flex-col gap-2">
                          {halamanPenanganan.map((p) => {
                            const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
                            const selesai = !!p.tanggal_selesai;
                            const diterima = !!p.tanggal_diterima;
                            const statusLabel = selesai ? 'Selesai' : diterima ? 'Sedang Diperbaiki' : 'Menunggu Diterima';
                            const statusStyle = selesai
                              ? 'bg-emerald-50 text-emerald-700'
                              : diterima
                              ? 'bg-orange-50 text-orange-700'
                              : 'bg-yellow-50 text-yellow-700';
                            const namaPelapor = namaPemakai(p.pemakai);
                            const expanded = expandedPenangananId === p.id;
                            return (
                              <li key={p.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                                {/* Baris ringkas — sama gaya kayak Riwayat Pemakai */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <StatusBadge colorClass={statusStyle} size="xs" className="mb-1">
                                      {statusLabel}
                                    </StatusBadge>{' '}
                                    <span className="font-medium text-slate-800">{p.keluhan}</span>{' '}
                                    <span className="text-slate-500">— {formatTanggalId(p.tanggal_lapor)}</span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {isAdmin && !selesai && !diterima && (
                                      <button
                                        onClick={() => handleTerimaPenanganan(p.id)}
                                        disabled={terimaLoadingId === p.id}
                                        title="Terima & mulai tangani laporan ini"
                                        className="p-1.5 rounded-md text-amber-600 hover:bg-amber-100 transition disabled:opacity-50"
                                      >
                                        <PlayCircle size={14} />
                                      </button>
                                    )}
                                    {isAdmin && !selesai && diterima && (
                                      <button
                                        onClick={() => setPenangananSelesaiTarget({ aset: detail, penanganan: p })}
                                        title="Tandai selesai"
                                        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 transition"
                                      >
                                        <CheckCircle2 size={14} />
                                      </button>
                                    )}
                                    {isAdmin && p.no_struk && (
                                      <button
                                        onClick={() => handlePrintPenanganan(detail, p)}
                                        title="Cetak struk"
                                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition"
                                      >
                                        <Printer size={13} />
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleDeletePenanganan(p.id)}
                                        title="Hapus"
                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-100 transition"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setExpandedPenangananId(expanded ? null : p.id)}
                                      title={expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                                      className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition"
                                    >
                                      {expanded ? <ChevronDown size={14} className="rotate-180 transition-transform" /> : <Eye size={14} />}
                                    </button>
                                  </div>
                                </div>

                                {/* Dropdown detail — expand di tempat, gak buka modal/halaman baru */}
                                {expanded && (
                                  <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-0.5">
                                    <StatusBadge colorClass="bg-slate-200 text-slate-600" size="xs" className="mb-1 capitalize w-fit">
                                      {p.jenis_kerusakan}
                                    </StatusBadge>
                                    {p.hasil && <p className="text-slate-500">Hasil: {p.hasil}</p>}
                                    <p className="text-slate-400">
                                      Dipinjam oleh: <span className="font-medium">{namaPelapor === '-' ? 'Tidak ada (audit gudang)' : namaPelapor}</span>
                                    </p>
                                    <p className="text-slate-400">
                                      Lapor {formatTanggalId(p.tanggal_lapor)}
                                      {p.tanggal_diterima ? ` · Diterima ${formatTanggalId(p.tanggal_diterima)}` : ''}
                                      {p.tanggal_selesai ? ` · Selesai ${formatTanggalId(p.tanggal_selesai)}` : ''}
                                      {p.durasi_hari != null ? ` · ${p.durasi_hari} hari` : ''}
                                    </p>
                                    {(p.harga_jasa != null || p.biaya_komponen != null) && (
                                      <p className="text-slate-400">
                                        Komponen {formatRupiah(p.biaya_komponen)} + Jasa {formatRupiah(p.harga_jasa)} = <span className="font-medium text-slate-600">{formatRupiah(totalBiaya)}</span>
                                      </p>
                                    )}
                                    {p.no_struk && <p className="text-slate-400">Struk: {p.no_struk}</p>}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                          {!semuaPenanganan.length && (
                            <p className="text-xs text-slate-400">Belum ada riwayat perbaikan.</p>
                          )}
                        </ul>

                        {semuaPenanganan.length > RIWAYAT_PERBAIKAN_PER_PAGE && (
                          <Pagination
                            currentPage={penangananPage}
                            totalPages={totalPenangananPage}
                            onPageChange={(page) => {
                              setPenangananPage(page);
                              setExpandedPenangananId(null);
                            }}
                            totalItems={semuaPenanganan.length}
                            itemLabel="riwayat"
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {serahTerimaAset && (
        <AsetSerahTerimaModal
          aset={serahTerimaAset}
          onClose={() => setSerahTerimaAset(null)}
          onSuccess={(results) => {
            handlePrintSerahTerima(results);
            setSerahTerimaAset(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {pengembalianTarget && (
        <AsetPengembalianModal
          aset={pengembalianTarget.aset}
          pemakai={pengembalianTarget.pemakai}
          isAdmin={isAdmin}
          onClose={() => setPengembalianTarget(null)}
          onSuccess={(pemakai) => {
            handlePrintPengembalian(pengembalianTarget.aset, pemakai);
            setPengembalianTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {perbaikanAsetTarget && (
        <AsetLaporKerusakanModal
          aset={perbaikanAsetTarget}
          onClose={() => setPerbaikanAsetTarget(null)}
          onSuccess={() => {
            setPerbaikanAsetTarget(null);
            toast.success('Laporan kerusakan berhasil dikirim.');
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {penangananSelesaiTarget && (
        <AsetPenangananSelesaiModal
          aset={penangananSelesaiTarget.aset}
          penanganan={penangananSelesaiTarget.penanganan}
          onClose={() => setPenangananSelesaiTarget(null)}
          onSuccess={() => {
            setPenangananSelesaiTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}
    </div>
  );
}