import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Plus, X, Pencil, Trash2, HandCoins, Undo2, ImageOff, Wrench, CheckCircle2, PlayCircle, Printer, Eye, Tag, ChevronDown, Upload, Loader2, Download, AlertTriangle, MapPin, Link2 } from 'lucide-react';
import Pagination from '../shared/Pagination';
import ScrollableTabBar from '../shared/ScrollableTabBar';
import SearchInput from '../shared/SearchInput';
import StatusBadge from '../shared/StatusBadge';
import Tooltip from '../shared/Tooltip';
import InventoryFormModal from './InventoryFormModal';
import InventorySerahTerimaModal from './InventorySerahTerimaModal';
import InventoryPengembalianModal from './InventoryPengembalianModal';
import InventoryLaporKerusakanModal from './InventoryLaporKerusakanModal';
import InventoryPenangananSelesaiModal from '../transaksi/InventoryPenangananSelesaiModal';
import InventoryExportModal from './InventoryExportModal';
import InventoryKelengkapanExportModal from './InventoryKelengkapanExportModal';
import { useAuth } from '../../context/AuthContext';
import { printStruk } from '../../utils/printStruk';
import { namaPemakai, userIdPemakai, isCabangPemakai } from './inventoryHelpers';
import {
  getInventory,
  getInventoryById,
  deleteInventory,
  jualInventory,
  importInventory,
  type Inventory,
  type InventoryStatus,
} from '../../api/masterData/inventory';
import { laporRusakKelengkapan } from '../../api/transaksi/inventoryKelengkapan';
import { deletePemakaiInventory, type InventoryPemakai } from '../../api/transaksi/inventoryPemakai';
import { deletePenangananInventory, terimaPenangananInventory, type InventoryPenanganan } from '../../api/transaksi/inventoryPenanganan';
import { getSupplier, type Supplier } from '../../api/masterData/supplier';

// Kategori (dari tabel `kategori`, 2 baris: "Barang Utama" & "Kelengkapan") --
// filter kategori tabel gabungan pakai a.kategori?.nama langsung (bukan bikin
// helper isKelengkapan/isBarangUtama baru di inventoryHelpers.ts, karena cuma
// dipakai di file ini).
type KategoriFilter = 'semua' | 'barang_utama' | 'kelengkapan';

// Status yang HANYA relevan buat Barang Utama -- endpoint jual() (writeoff)
// masih isBarangUtama()-only, Kelengkapan gak pernah bisa masuk status ini.
// Status penanganan/perbaikan (menunggu_perbaikan, diperbaiki, rusak_berat)
// SUDAH TIDAK termasuk di sini -- sejak Kelengkapan berdiri sendiri
// (parent_id null) ikut alur InventoryPenanganan yang sama kaya Barang
// Utama (lihat renderAksi), status itu jadi relevan buat keduanya.
// Dropdown status disembunyiin status di bawah ini kalau filter Kategori
// lagi di-set ke Kelengkapan -- lihat statusTabs di bawah.
const STATUS_KHUSUS_BARANG_UTAMA: InventoryStatus[] = ['dijual'];

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

const STATUS_LABEL: Record<InventoryStatus, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  menunggu_perbaikan: 'Menunggu Perbaikan',
  diperbaiki: 'Sedang Diperbaiki',
  rusak: 'Rusak',
  rusak_berat: 'Rusak Berat',
  dijual: 'Dijual',
};

const STATUS_STYLE: Record<InventoryStatus, string> = {
  tersedia: 'bg-emerald-50 text-emerald-700',
  dipakai: 'bg-amber-50 text-amber-700',
  menunggu_perbaikan: 'bg-yellow-50 text-yellow-700',
  diperbaiki: 'bg-orange-50 text-orange-700',
  rusak: 'bg-red-100 text-red-800',
  rusak_berat: 'bg-red-100 text-red-800',
  dijual: 'bg-purple-50 text-purple-700',
};

// urutan tampil di tabel: tersedia paling atas, lalu dipakai, lalu status
// yang lagi dalam proses penanganan, rusak, rusak_berat, dan dijual paling
// bawah — dipakai sebagai key sort di filteredInventory, BUKAN untuk urutan
// dropdown filter (dropdown tetap ikut urutan STATUS_LABEL di atas).
const STATUS_PRIORITY: Record<InventoryStatus, number> = {
  tersedia: 1,
  dipakai: 2,
  menunggu_perbaikan: 3,
  diperbaiki: 4,
  rusak: 5,
  rusak_berat: 6,
  dijual: 7,
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

export default function TabInventory({ onlyMenipis, onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');

  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<InventoryStatus | ''>('');
  // BARU (gabung Inventory + Kelengkapan): filter kategori di sisi client --
  // 1 request getInventory() tanpa ?kategori= (biar sekali fetch ambil semua),
  // filter Barang Utama/Kelengkapan/Semua dilakuin di FE lewat dropdown ini.
  // Aman buat non-admin juga: pembatasan visibility non-admin di backend
  // (InventoryController::index()) gak bergantung ke query ?kategori=, jadi
  // fetch tanpa kategori tetap ke-filter dengan benar oleh backend.
  const [kategoriFilter, setKategoriFilter] = useState<KategoriFilter>('semua');

  // BARU: Lapor Rusak Kelengkapan -- dipindah dari TabKelengkapanInventory.tsx.
  // Final, gak bisa dibatalin (kelengkapan dilepas otomatis dari induk & pindah
  // ke status 'rusak').
  const [rusakTarget, setRusakTarget] = useState<Inventory | null>(null);
  const [rusakSubmitting, setRusakSubmitting] = useState(false);
  const [rusakError, setRusakError] = useState('');

  // BARU: Export -- 1 tombol, modalnya nyesuain isi export sama kategori yang
  // lagi aktif difilter (InventoryExportModal buat Barang Utama/Semua,
  // InventoryKelengkapanExportModal buat kolom yang relevan ke Kelengkapan
  // kayak Inventory Induk/Lokasi). Diputuskan gini (bukan 1 modal universal)
  // karena kedua modal itu kolomnya beda banget & masing2 udah lengkap/teruji --
  // gabungin jadi 1 modal generik malah bikin banyak kolom kosong/gak relevan.
  const [exportOpen, setExportOpen] = useState(false);

  // Pagination tabel inventory — style sama kayak pager Riwayat Inventory (10 per
  // halaman, angka + elipsis). Client-side krn /api/inventory gak dipaging
  // di backend, tapi UI-nya ngikut pola yang sama.
  const [inventoryPage, setInventoryPage] = useState(1);
  const ASET_PER_PAGE = 10;

  const [formOpen, setFormOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<Inventory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inventory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // BARU: kalau delete normal gagal krn inventory punya riwayat pemakai/penanganan
  // (data lama/test yang "kecantol"), backend balikin force_available: true —
  // munculin opsi hapus paksa di modal yang sama, gak perlu klik ulang.
  const [deleteForceAvailable, setDeleteForceAvailable] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Inventory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Serah-terima 1 inventory utama (klik tombol "Serahkan" di baris) -- di dalam
  // modalnya sendiri ada checklist buat nambahin inventory kelengkapan (tas,
  // charger, dst) yang mau ikut dipinjamkan bareng inventory utama ini dalam SATU
  // proses (satu penerima, satu tanggal, satu set foto bukti, satu struk).
  // Tetap ditaruh di sini (bukan di dalam modal) karena inventory yang diklik
  // datang dari tabel/detail panel ini.
  const [serahTerimaInventory, setSerahTerimaInventory] = useState<Inventory | null>(null);
  const [pengembalianTarget, setPengembalianTarget] = useState<{ inventory: Inventory; pemakai: InventoryPemakai } | null>(null);

  const [perbaikanInventoryTarget, setPerbaikanInventoryTarget] = useState<Inventory | null>(null);
  const [penangananSelesaiTarget, setPenangananSelesaiTarget] = useState<{ inventory: Inventory; penanganan: InventoryPenanganan } | null>(null);
  const [historyActionError, setHistoryActionError] = useState('');

  // BARU: state untuk aksi "Jual Inventory" (inventory berstatus tersedia atau rusak_berat) —
  // cuma tanda/konfirmasi, gak ada form harga/catatan
  const [jualTarget, setJualTarget] = useState<Inventory | null>(null);
  const [jualLoading, setJualLoading] = useState(false);
  const [jualError, setJualError] = useState('');

  // PINDAHAN dari Inventaris.tsx: Import Excel data inventory (bulk import: inventory +
  // jenis + supplier + kelengkapan) — sekarang ditaruh di sini biar aksinya
  // nempel langsung sama tabel/list inventory yang dia pengaruhi.
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadList = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getInventory();
      setInventoryList(data);
    } catch (err) {
      setError('Gagal memuat data inventory. Coba refresh halaman.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // BARU: versi "diam-diam" buat polling — gak nyalain loading spinner /
  // error state, biar gak ganggu tampilan yang lagi dilihat user.
  const loadListSilent = async () => {
    try {
      const data = await getInventory();
      setInventoryList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportMessage(null);

    try {
      const res = await importInventory(file);
      setImportMessage({ type: 'success', text: res.message });
      // refresh list inventory setelah import berhasil (badge count ikut update
      // otomatis lewat efek onCount di bawah begitu inventoryList berubah)
      loadList();
    } catch (err: any) {
      setImportMessage({
        type: 'error',
        text: err.response?.data?.errors?.[0] || err.response?.data?.message || 'Gagal mengimport file',
      });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
    }
  };

  useEffect(() => {
    loadList();
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
    if (lastCount.current !== inventoryList.length) {
      lastCount.current = inventoryList.length;
      onCount?.(inventoryList.length);
    }
  }, [inventoryList, loading, onCount]);

  const openDetail = async (id: number) => {
    setDetailId(id);
    setPenangananPage(1);
    setExpandedPenangananId(null);
    setExpandedPemakaiId(null);
    setDetailLoading(true);
    try {
      const data = await getInventoryById(id);
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
    const data = await getInventoryById(detailId);
    setDetail(data);
    setInventoryList((prev) => prev.map((a) => (a.id === data.id ? { ...a, status: data.status } : a)));
  };

  // versi silent buat dipanggil dari polling interval (gak ada loading state)
  const refreshDetailSilent = async (id: number) => {
    try {
      const data = await getInventoryById(id);
      setDetail((prev) => (prev && prev.id === id ? data : prev));
      setInventoryList((prev) => prev.map((a) => (a.id === data.id ? { ...a, status: data.status } : a)));
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async (force = false) => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteInventory(deleteTarget.id, force);
      setInventoryList((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteForceAvailable(false);
      if (detailId === deleteTarget.id) closeDetail();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus inventory.');
      setDeleteForceAvailable(!!err.response?.data?.force_available);
    } finally {
      setDeleting(false);
    }
  };

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  // Pagination + dropdown detail buat Riwayat Perbaikan — style ringkas kayak
  // Riwayat Pemakai, limit 5 per halaman (beda dari Pagination tabel inventory yg 10).
  const RIWAYAT_PERBAIKAN_PER_PAGE = 5;
  const [penangananPage, setPenangananPage] = useState(1);
  const [expandedPenangananId, setExpandedPenangananId] = useState<number | null>(null);
  const [expandedPemakaiId, setExpandedPemakaiId] = useState<number | null>(null);
  const [deletingPemakaiId, setDeletingPemakaiId] = useState<number | null>(null);

  const handleTerimaPenanganan = async (id: number) => {
    setHistoryActionError('');
    setTerimaLoadingId(id);
    try {
      await terimaPenangananInventory(id);
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
      await deletePenangananInventory(id);
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
      await deletePemakaiInventory(id);
      await refreshDetail();
      loadList();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat pemakaian.');
    } finally {
      setDeletingPemakaiId(null);
    }
  };

  const handlePrintPenanganan = (inventory: Inventory, p: InventoryPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
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
        { label: 'Inventory', value: `${inventory.kode_inventory} — ${inventory.nama || '-'}` },
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

  // BARU: sekarang bisa serah-terima lebih dari 1 inventory dalam sekali proses
  // (inventory utama + kelengkapan yang ikut dipinjamkan) -- tetap 1 struk gabungan,
  // pakai no_struk_penerimaan dari inventory PERTAMA (inventory utama yang diklik) sebagai
  // nomor struknya, item lain cuma numpang jadi baris "Inventory 2", "Inventory 3", dst.
  const handlePrintSerahTerima = (results: { inventory: Inventory; pemakai: InventoryPemakai }[]) => {
    if (!results.length) return;
    const utama = results[0];
    if (!utama.pemakai.no_struk_penerimaan) return;
    const inventoryRows = results.map((r, i) => ({
      label: results.length > 1 ? `Inventory ${i + 1}` : 'Inventory',
      value: `${r.inventory.kode_inventory} — ${r.inventory.nama || '-'}`,
    }));
    printStruk({
      judul: 'Bukti Serah Terima Inventory',
      noStruk: utama.pemakai.no_struk_penerimaan,
      tanggal: formatTanggalId(utama.pemakai.tanggal_penerimaan),
      rows: [
        ...inventoryRows,
        { label: 'Diserahkan Kepada', value: namaPemakai(utama.pemakai) },
        { label: 'Nomor Penerimaan', value: utama.pemakai.nomor_penerimaan || '-' },
      ],
      catatan: utama.pemakai.catatan_penerimaan,
    });
  };

  const handlePrintPengembalian = (inventory: Inventory, pemakai: InventoryPemakai) => {
    if (!pemakai.no_struk_pengembalian) return;
    printStruk({
      judul: 'Bukti Pengembalian Inventory',
      noStruk: pemakai.no_struk_pengembalian,
      tanggal: formatTanggalId(pemakai.tanggal_pengembalian),
      rows: [
        { label: 'Inventory', value: `${inventory.kode_inventory} — ${inventory.nama || '-'}` },
        { label: 'Dikembalikan Oleh', value: namaPemakai(pemakai) },
        { label: 'Struk Penerimaan Asli', value: pemakai.no_struk_penerimaan || '-' },
      ],
      catatan: pemakai.catatan_pengembalian,
    });
  };

  // BARU: buka modal konfirmasi jual
  const openJual = (a: Inventory) => {
    setJualTarget(a);
    setJualError('');
  };

  // BARU: submit aksi jual — tandai inventory sebagai 'dijual', gak ada input tambahan
  const confirmJual = async () => {
    if (!jualTarget) return;
    setJualLoading(true);
    setJualError('');
    try {
      const updated = await jualInventory(jualTarget.id);
      setInventoryList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (detailId === updated.id) setDetail(updated);
      toast.success('Inventory berhasil ditandai sebagai dijual.');
      setJualTarget(null);
    } catch (err: any) {
      setJualError(err.response?.data?.message || 'Gagal menandai inventory sebagai terjual.');
    } finally {
      setJualLoading(false);
    }
  };

  // KARYAWAN/CABANG cuma boleh liat inventory yang masih tersedia, atau inventory yang
  // LAGI dia pinjam sendiri (bukan yang PERNAH -- begitu pengembalian sudah
  // terjadi, otomatis maupun manual, inventory itu bukan "milik" dia lagi).
  // FIX: pakai userIdPemakai() (bukan akses langsung .pekerja?.user?.id),
  // biar akun cabang (yang gak punya pekerja, cuma user langsung) juga
  // kedeteksi bener sebagai pemilik record, bukan malah inventory yang lagi dia
  // pegang sendiri ikut ke-filter hilang dari tabelnya.
  //
  // FIX BUG: dulu filter kepemilikan ini cuma dipasang di rantai
  // `filteredInventory` (buat nentuin baris tabel), sementara `statusCounts` &
  // badge "Semua Status" masih ngitung dari `inventoryList` MENTAH (belum kena
  // filter ini). Akibatnya begitu inventory karyawan dikembalikan otomatis
  // (mis. admin tandai rusak berat), barisnya udah ilang dari tabel, tapi
  // angka di badge tab tetap ngitung inventory itu -- angka "kecantol" padahal
  // tabelnya kosong. Sekarang filter kepemilikan ditarik jadi satu sumber
  // (`visibleInventoryList`) yang dipakai bareng oleh tabel & badge, jadi
  // keduanya selalu sinkron.
  const visibleInventoryList = useMemo(() => {
    if (isAdmin) return inventoryList;
    return inventoryList.filter((a) => {
      const akuPeminjamnya = userIdPemakai(a.pemakai_saat_ini) === user?.id;
      return a.status === 'tersedia' || akuPeminjamnya;
    });
  }, [inventoryList, isAdmin, user?.id]);

  const filteredInventory = visibleInventoryList
    .filter((a) => {
      const matchStatus = !statusFilter || a.status === statusFilter;
      // BARU: filter kategori (Semua/Barang Utama/Kelengkapan), dikombinasikan
      // AND dengan filter status & search yang sudah ada.
      const matchKategori =
        kategoriFilter === 'semua' ||
        (kategoriFilter === 'barang_utama' && a.kategori?.nama === 'Barang Utama') ||
        (kategoriFilter === 'kelengkapan' && a.kategori?.nama === 'Kelengkapan');
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        a.kode_inventory.toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q) ||
        (a.nama || '').toLowerCase().includes(q) ||
        // BARU: search juga cocokkan nama di kolom "Dipakai Oleh". Status
        // 'dijual' sengaja dilewati karena kolomnya ditampilkan sebagai "-"
        // di tabel (namaPemakai lama sudah tidak relevan buat inventory yang dijual).
        (a.status !== 'dijual' && namaPemakai(a.pemakai_saat_ini).toLowerCase().includes(q));
      return matchStatus && matchKategori && matchSearch;
    })
    .filter((a) => !onlyMenipis || a.status === 'tersedia')
    // BARU: urutkan berdasarkan prioritas status — tersedia paling atas,
    // dipakai, lalu status dalam proses penanganan, rusak_berat, dan
    // dijual paling bawah. Lihat STATUS_PRIORITY di atas.
    .sort((a, b) => {
      const diffStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (diffStatus !== 0) return diffStatus;
      return a.kode_inventory.localeCompare(b.kode_inventory, 'id', { numeric: true });
    });

  // Jumlah inventory per status (dari visibleInventoryList -- yang udah kena filter
  // kepemilikan, sama kayak sumber filteredInventory -- BUKAN dari inventoryList
  // mentah), dipakai buat badge angka di tiap opsi dropdown status. Ini
  // yang bikin badge tab selalu sinkron sama isi tabelnya.
  // BARU: statusCounts sekarang ikut filter kategoriFilter juga, biar badge
  // per-status di tab nav konsisten dengan badge "Semua Status" di sebelahnya
  // (keduanya harus ngitung dari populasi yang sama -- baris yang lolos
  // filter Kategori aktif).
  const statusCounts = useMemo(() => {
    const counts: Record<InventoryStatus, number> = {
      tersedia: 0,
      dipakai: 0,
      menunggu_perbaikan: 0,
      diperbaiki: 0,
      rusak: 0,
      rusak_berat: 0,
      dijual: 0,
    };
    for (const a of visibleInventoryList) {
      const matchKategori =
        kategoriFilter === 'semua' ||
        (kategoriFilter === 'barang_utama' && a.kategori?.nama === 'Barang Utama') ||
        (kategoriFilter === 'kelengkapan' && a.kategori?.nama === 'Kelengkapan');
      if (matchKategori) counts[a.status] += 1;
    }
    return counts;
  }, [visibleInventoryList, kategoriFilter]);

  const inventoryLastPage = Math.max(1, Math.ceil(filteredInventory.length / ASET_PER_PAGE));
  const inventoryPageClamped = Math.min(inventoryPage, inventoryLastPage);
  const pageInventory = filteredInventory.slice(
    (inventoryPageClamped - 1) * ASET_PER_PAGE,
    inventoryPageClamped * ASET_PER_PAGE
  );

  // Balik ke halaman 1 tiap kali search/filter/status atau isi data berubah,
  // biar gak nyangkut di halaman kosong (sama pola kayak riwayat search).
  useEffect(() => {
    setInventoryPage(1);
  }, [search, statusFilter, kategoriFilter, onlyMenipis]);

  // BARU: ganti filter Kategori -- kalau pindah ke "Kelengkapan" dan status
  // yang lagi aktif itu status yang cuma relevan buat Barang Utama (dijual),
  // reset ke "Semua Status" sekalian, daripada nyangkut di status yang gak
  // ada opsinya lagi di dropdown/tab. Status penanganan (menunggu_perbaikan,
  // diperbaiki, rusak_berat) TETAP dipertahankan kalau lagi aktif, karena
  // sekarang relevan juga buat Kelengkapan berdiri sendiri. Ditaruh di sini
  // (bukan useEffect terpisah) karena ini reaksi langsung ke aksi user
  // (ganti dropdown), bukan sinkronisasi state.
  const handleKategoriFilterChange = (next: KategoriFilter) => {
    setKategoriFilter(next);
    if (next === 'kelengkapan' && statusFilter && STATUS_KHUSUS_BARANG_UTAMA.includes(statusFilter)) {
      setStatusFilter('');
    }
  };

  // BARU (dipindah dari TabKelengkapanInventory.tsx): submit Lapor Rusak Kelengkapan.
  const confirmRusak = async () => {
    if (!rusakTarget) return;
    setRusakSubmitting(true);
    setRusakError('');
    try {
      await laporRusakKelengkapan(rusakTarget.id);
      setRusakTarget(null);
      loadList(); // refresh -- item pindah ke status 'rusak', lepas dari induk (kalau ada)
      toast.success(`${rusakTarget.kode_inventory} dilaporkan rusak.`);
    } catch (err: any) {
      setRusakError(err.response?.data?.message || 'Gagal melaporkan kerusakan.');
    } finally {
      setRusakSubmitting(false);
    }
  };

  // Aksi buat baris Kelengkapan yang MASIH NEMPEL ke induk (parent_id
  // terisi) -- Lapor Rusak (admin, status tersedia/dipakai), Edit, Hapus.
  // TIDAK ada Detail/Serah Terima/Terima Kembali/Jual (kelengkapan yang
  // nempel gak ikut alur peminjaman perorangan -- dia ikut serah-terima/
  // kembali BARENG induknya lewat form Barang Utama, bukan sendiri-sendiri).
  // Non-admin gak dapat aksi apapun di baris ini, sama seperti behaviour
  // TabKelengkapanInventory.tsx yang lama.
  //
  // Kelengkapan yang BERDIRI SENDIRI (parent_id null) sudah TIDAK lewat sini
  // lagi -- dia dispatch ke renderAksiInventory yang sama kaya Barang Utama
  // (lihat renderAksi di bawah), termasuk buat Lapor Rusak-nya (sekarang
  // lewat alur InventoryPenanganan, bukan endpoint instan
  // lapor-rusak-kelengkapan yang dipakai fungsi ini).
  const renderAksiKelengkapan = (a: Inventory) => {
    if (!isAdmin) return null;
    return (
      <>
        {(a.status === 'tersedia' || a.status === 'dipakai') && (
          <button
            onClick={() => {
              setRusakError('');
              setRusakTarget(a);
            }}
            title="Lapor Rusak"
            className="p-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            <AlertTriangle size={15} />
          </button>
        )}
        <button
          onClick={() => {
            setEditingInventory(a);
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
    );
  };

  // Dispatcher aksi tabel gabungan -- Kelengkapan yang MASIH NEMPEL ke induk
  // (parent_id terisi) pakai set aksi terbatas (renderAksiKelengkapan).
  // Barang Utama DAN Kelengkapan yang berdiri sendiri (parent_id null) pakai
  // set aksi yang sama persis (renderAksiInventory) -- keduanya boleh
  // di-Serahkan/di-Terima Kembali/Lapor Rusak langsung tanpa lewat induk.
  const renderAksi = (a: Inventory) =>
    a.kategori?.nama === 'Kelengkapan' && a.parent_id ? renderAksiKelengkapan(a) : renderAksiInventory(a);

  // Dipakai bareng oleh tabel (desktop) & card (mobile) biar tombol aksinya
  // gak ke-duplikasi/nyimpang antara 2 tampilan itu.
  const renderAksiInventory = (a: Inventory) => {
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
                onClick={() => setSerahTerimaInventory(a)}
                title="Serahkan ke Karyawan"
                className="p-2 text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition"
              >
                <HandCoins size={15} />
              </button>
            )}
            {a.status === 'dipakai' && a.pemakai_saat_ini && (
              <button
                onClick={() => setPengembalianTarget({ inventory: a, pemakai: a.pemakai_saat_ini! })}
                title="Terima Kembali"
                className="p-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
              >
                <Undo2 size={15} />
              </button>
            )}
            <button
              onClick={() => {
                setEditingInventory(a);
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
            onClick={() => setPengembalianTarget({ inventory: a, pemakai: a.pemakai_saat_ini! })}
            title="Kembalikan"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 transition"
          >
            <Undo2 size={14} />
            Kembalikan
          </button>
        )}

        {!isAdmin && akuPeminjamnya && a.status === 'dipakai' && (
          <button
            onClick={() => setPerbaikanInventoryTarget(a)}
            title="Lapor Kerusakan"
            className="p-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            <Wrench size={15} />
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

  const [expandedInventoryId, setExpandedInventoryId] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-slate-500">
          Kelola inventory IT — Barang Utama (laptop, monitor, dsb) dan Kelengkapan (charger, tas, mouse, dsb) dalam satu tabel.
        </p>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* BARU: Export -- 1 tombol buat semua kategori, isi modalnya
              nyesuain filter Kategori yang lagi aktif (lihat komentar
              exportOpen di atas). Sengaja gak dibatasi isAdmin, sama kayak
              tombol Export lama di TabKelengkapanInventory.tsx (non-admin
              tetap boleh export data yang KELIATAN buat dia). */}
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition"
          >
            <Download size={16} />
            Export
          </button>

          {isAdmin && (
            <>
              {/* PINDAHAN dari Inventaris.tsx: Import Excel data inventory */}
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
                  setEditingInventory(null);
                  setFormOpen(true);
                }}
                className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
              >
                <Plus size={16} />
                Tambah Inventory
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
          kayak Forum Penanganan Inventory, biar konsisten di seluruh halaman
          Inventaris. */}
      <ScrollableTabBar
        className="mb-4"
        activeTab={statusFilter === '' ? 'semua' : statusFilter}
        onChange={(key) => setStatusFilter(key === 'semua' ? '' : (key as InventoryStatus))}
        tabs={[
          {
            key: 'semua' as const,
            label: 'Semua Status',
            badge: Object.values(statusCounts).reduce((sum, n) => sum + n, 0),
            badgeClassName: statusFilter === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
          },
          // Tab "Rusak Berat" & "Dijual" cuma buat admin -- non-admin gak
          // perlu (dan gak boleh) lihat inventory yang udah di-writeoff/dijual.
          // BARU: status "Dijual" (khusus Barang Utama, endpoint jual() masih
          // isBarangUtama()-only) disembunyikan kalau filter Kategori lagi
          // di-set ke Kelengkapan. Status penanganan (menunggu_perbaikan,
          // diperbaiki, rusak_berat) TETAP tampil buat kedua kategori, karena
          // sekarang relevan juga buat Kelengkapan yang berdiri sendiri.
          ...(Object.keys(STATUS_LABEL) as InventoryStatus[])
            .filter((s) => isAdmin || (s !== 'rusak_berat' && s !== 'dijual'))
            .filter((s) => kategoriFilter !== 'kelengkapan' || !STATUS_KHUSUS_BARANG_UTAMA.includes(s))
            .map((s) => ({
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
          placeholder="Cari nama atau kode inventory..."
          className="flex-1"
        />
        {/* BARU: dropdown filter Kategori (Semua/Barang Utama/Kelengkapan) --
            kolom & aksi tabel di bawah ikut menyesuaikan pilihan ini. */}
        <div className="relative sm:w-56">
          <select
            value={kategoriFilter}
            onChange={(e) => handleKategoriFilterChange(e.target.value as KategoriFilter)}
            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06]"
          >
            <option value="semua">Semua Kategori</option>
            <option value="barang_utama">Barang Utama</option>
            <option value="kelengkapan">Kelengkapan</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}
        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && filteredInventory.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada inventory.</p>
        )}

        {!loading && !error && filteredInventory.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-middle text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Kode Inventory</th>
                  <th className="px-6 py-3 font-medium">Nama</th>
                  {/* BARU: kolom Kategori cuma tampil di mode "Semua" -- di mode
                      Barang Utama/Kelengkapan kategorinya udah jelas dari filter,
                      gak perlu diulang di tiap baris. */}
                  {kategoriFilter === 'semua' && <th className="px-6 py-3 font-medium">Kategori</th>}
                  {/* Kolom Jumlah cuma relevan buat Barang Utama (barang serialized
                      vs bukan) -- Kelengkapan selalu 1 unit per baris. */}
                  {kategoriFilter !== 'kelengkapan' && <th className="px-6 py-3 font-medium">Jumlah</th>}
                  {kategoriFilter === 'kelengkapan' && <th className="px-6 py-3 font-medium">Serial Number</th>}
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">
                    {kategoriFilter === 'barang_utama' ? 'Dipakai Oleh' : 'Dipakai Oleh / Lokasi'}
                  </th>
                  <th className="px-6 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pageInventory.map((a) => {
                  const isKelengkapan = a.kategori?.nama === 'Kelengkapan';
                  return (
                    <tr key={a.id} className="text-center border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                      <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{a.kode_inventory}</td>
                      <td className="px-6 py-3 text-slate-600 max-w-[160px]">
                        <Tooltip content={a.nama || '-'}>
                          <p className="truncate">{a.nama || '-'}</p>
                        </Tooltip>
                        {/* BARU: indikator "Menempel ke ..." buat baris Kelengkapan
                            yang parent_id-nya terisi -- data a.parent udah tersedia
                            dari eager-load backend, gak perlu request tambahan. */}
                        {isKelengkapan && a.parent && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <Link2 size={11} className="shrink-0" />
                            Menempel ke {a.parent.kode_inventory}
                          </p>
                        )}
                      </td>
                      {kategoriFilter === 'semua' && (
                        <td className="px-6 py-3 whitespace-nowrap">
                          <StatusBadge colorClass={isKelengkapan ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'}>
                            {a.kategori?.nama || '-'}
                          </StatusBadge>
                        </td>
                      )}
                      {kategoriFilter !== 'kelengkapan' && (
                        <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{a.jumlah ?? 1}</td>
                      )}
                      {kategoriFilter === 'kelengkapan' && (
                        <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{a.serial_number || '-'}</td>
                      )}
                      <td className="px-6 py-3 whitespace-nowrap">
                        <StatusBadge colorClass={STATUS_STYLE[a.status]}>{STATUS_LABEL[a.status]}</StatusBadge>
                      </td>
                      <td className="px-6 py-3 text-slate-600 max-w-[160px]">
                        {/* BARU: kolom "Dipakai Oleh / Lokasi" kontekstual -- Barang
                            Utama & Kelengkapan yang lagi dipakai/nempel nunjukin
                            pemakai; Kelengkapan berdiri sendiri (tanpa parent, tanpa
                            pemakai) nunjukin lokasi kantor-nya. */}
                        {isKelengkapan && !a.pemakai_saat_ini && a.status !== 'dijual' ? (
                          a.lokasiKantor ? (
                            <Tooltip content={a.lokasiKantor.nama}>
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <MapPin size={13} className="text-slate-300 shrink-0" />
                                <span className="truncate">{a.lokasiKantor.nama}</span>
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        ) : (
                          <Tooltip content={a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}>
                            <p className="truncate">
                              {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}
                              {a.status !== 'dijual' && isCabangPemakai(a.pemakai_saat_ini) && (
                                <span className="ml-1.5 text-[11px] text-slate-400">(Cabang)</span>
                              )}
                            </p>
                          </Tooltip>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1 flex-nowrap">
                          {renderAksi(a)}
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
        {!loading && !error && filteredInventory.length > 0 && (
          <div className="sm:hidden flex flex-col divide-y divide-slate-100">
            {pageInventory.map((a) => {
              const expanded = expandedInventoryId === a.id;
              const isKelengkapan = a.kategori?.nama === 'Kelengkapan';
              return (
                <div key={a.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedInventoryId(expanded ? null : a.id)}
                    className="w-full flex items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{a.kode_inventory}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {isKelengkapan
                          ? a.nama || '-'
                          : `${a.nama || '-'} · Jumlah: ${a.jumlah ?? 1}`}
                      </p>
                      {isKelengkapan && a.parent && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                          <Link2 size={11} className="shrink-0" />
                          Menempel ke {a.parent.kode_inventory}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <StatusBadge colorClass={STATUS_STYLE[a.status]} size="xs">
                          {STATUS_LABEL[a.status]}
                        </StatusBadge>
                        {kategoriFilter === 'semua' && (
                          <StatusBadge colorClass={isKelengkapan ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'} size="xs">
                            {a.kategori?.nama || '-'}
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                      {isKelengkapan && !a.pemakai_saat_ini && a.status !== 'dijual' ? (
                        <p className="text-xs text-slate-500">
                          Lokasi:{' '}
                          <span className="text-slate-700 font-medium">{a.lokasiKantor?.nama || '-'}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Dipakai Oleh:{' '}
                          <span className="text-slate-700 font-medium">
                            {a.status === 'dijual' ? '-' : namaPemakai(a.pemakai_saat_ini)}
                            {a.status !== 'dijual' && isCabangPemakai(a.pemakai_saat_ini) && ' (Cabang)'}
                          </span>
                        </p>
                      )}
                      <div className="flex items-center flex-wrap gap-1.5">
                        {renderAksi(a)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && filteredInventory.length > 0 && inventoryLastPage > 1 && (
          <div className="px-6 py-3 border-t border-slate-100">
            <Pagination
              currentPage={inventoryPageClamped}
              totalPages={inventoryLastPage}
              onPageChange={setInventoryPage}
              totalItems={filteredInventory.length}
              itemLabel="inventory"
              className="pt-0 mt-0 border-t-0"
            />
          </div>
        )}
      </div>

      {/* FORM TAMBAH / EDIT ASET */}
      {formOpen && (
        <InventoryFormModal
          inventory={editingInventory}
          supplierOptions={supplierOptions}
          onClose={() => setFormOpen(false)}
          onSaved={(saved, warning) => {
            setInventoryList((prev) => {
              const exists = prev.some((a) => a.id === saved.id);
              return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
            });
            setFormOpen(false);
            if (detailId === saved.id) refreshDetail();
            if (warning) toast.error(warning);
          }}
        />
      )}

    
      {/* KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Hapus inventory?</h2>
            <p className="text-sm text-slate-500 mb-3">
              <span className="font-medium text-slate-700">{deleteTarget.kode_inventory}</span> akan dihapus permanen
              beserta riwayatnya, dan tidak bisa dikembalikan.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {deleteError}
                {deleteForceAvailable && ' Inventory ini punya riwayat, tapi bisa dihapus paksa kalau memang data lama/test.'}
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
            <h2 className="text-base font-semibold text-slate-900 mb-1">Tandai inventory sebagai dijual?</h2>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-medium text-slate-700">{jualTarget.kode_inventory}</span> akan ditandai dengan status{' '}
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

      {/* BARU: EXPORT -- modalnya nyesuain kategori yang lagi difilter (lihat
          komentar exportOpen di atas). Kalau lagi filter "Kelengkapan", pakai
          modal & kolom Kelengkapan; selain itu (Semua/Barang Utama) pakai
          modal & kolom Barang Utama. Data yang dikirim = filteredInventory
          (ngikutin filter status/search/kategori yang lagi aktif di tabel). */}
      {kategoriFilter === 'kelengkapan' ? (
        <InventoryKelengkapanExportModal open={exportOpen} onClose={() => setExportOpen(false)} data={filteredInventory} />
      ) : (
        <InventoryExportModal open={exportOpen} onClose={() => setExportOpen(false)} data={filteredInventory} />
      )}

      {/* BARU: KONFIRMASI LAPOR RUSAK KELENGKAPAN (dipindah dari
          TabKelengkapanInventory.tsx) — final, gak bisa dibatalin setelah confirm */}
      {rusakTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">Lapor kelengkapan rusak?</h2>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              <span className="font-medium text-slate-700">{rusakTarget.kode_inventory}</span> — Kelengkapan
              ini beneran rusak? Setelah dilaporkan, gak bisa dibatalin.
            </p>
            {rusakError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {rusakError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRusakTarget(null);
                  setRusakError('');
                }}
                disabled={rusakSubmitting}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmRusak}
                disabled={rusakSubmitting}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rusakSubmitting ? 'Melaporkan...' : 'Ya, Lapor Rusak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL ASET — disembunyiin sementara kalau ada modal aksi (serah-terima,
          terima kembali, jual, dst) yang kebuka di atasnya, biar gak numpuk 2
          modal + 2 overlay keliatan bareng */}
      {detailId &&
        !serahTerimaInventory &&
        !pengembalianTarget &&
        !perbaikanInventoryTarget &&
        !penangananSelesaiTarget &&
        !jualTarget && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Boxes size={18} className="text-slate-400" />
                {detail?.kode_inventory || 'Memuat...'}
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
                      <img src={STORAGE_BASE_URL + detail.foto} alt={detail.kode_inventory} className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff size={22} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <StatusBadge colorClass={STATUS_STYLE[detail.status]} className="mb-2">
                      {STATUS_LABEL[detail.status]}
                    </StatusBadge>
                    <p className="text-sm text-slate-800 font-medium">{detail.nama || '-'}</p>
                    <p className="text-xs text-slate-400">{detail.warna || '-'}</p>
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
                    {detail.pemakai_saat_ini.user && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        NIK: {detail.pemakai_saat_ini.user.nik || '-'} · {detail.pemakai_saat_ini.user.departemen?.nama || '-'}
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

                {/* KELENGKAPAN — daftar aksesoris (tas, charger, dst) yang
                    nempel ke inventory ini lewat children (parent_id). Read-only
                    di sini; buat nambah/pasang kelengkapan baru, dilakuin
                    lewat form Edit Inventory (section Kelengkapan). */}
                {detail.children && detail.children.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-400">
                        Kelengkapan ({detail.children?.length || 0})
                      </p>
                    </div>
                    {detail.children && detail.children.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {detail.children.map((k: Inventory) => (
                          <div
                            key={k.id}
                            className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-slate-800 font-medium truncate">
                                {k.nama || k.kode_inventory}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {k.kode_inventory}
                                {k.serial_number ? ` · S/N: ${k.serial_number}` : ''}
                              </p>
                            </div>
                            <StatusBadge
                              colorClass={STATUS_STYLE[k.status] || 'bg-slate-100 text-slate-600'}
                              className="shrink-0"
                            >
                              {STATUS_LABEL[k.status] || k.status}
                            </StatusBadge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 italic">Belum ada kelengkapan terpasang.</p>
                    )}
                  </div>
                )}

                {/* AKSI KONTEKSTUAL */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    {detail.status === 'tersedia' && (
                      <button
                        onClick={() => setSerahTerimaInventory(detail)}
                        className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-800 transition"
                      >
                        <HandCoins size={14} />
                        Serahkan ke Karyawan
                      </button>
                    )}
                    {detail.status === 'dipakai' && detail.pemakai_saat_ini && (
                      <button
                        onClick={() => setPengembalianTarget({ inventory: detail, pemakai: detail.pemakai_saat_ini! })}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                      >
                        <Undo2 size={14} />
                        Terima Kembali
                      </button>
                    )}
                    {/* Tombol Jual Inventory di panel detail (ikon mata) — muncul buat status
                        tersedia ATAU rusak_berat. Sekarang ini SATU-SATUNYA tempat aksi
                        jual bisa dipicu (nggak ada lagi tombol cepat di baris tabel). */}
                    {(detail.status === 'tersedia' || detail.status === 'rusak_berat') && (
                      <button
                        onClick={() => openJual(detail)}
                        className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-purple-700 transition"
                      >
                        <Tag size={14} />
                        Jual Inventory
                      </button>
                    )}
                  </div>
                )}

                {/* KARYAWAN/CABANG: lapor kerusakan kalau lagi dia pakai sendiri.
                    (Ajukan pinjam sendiri sudah dicabut — inventory cuma boleh
                    diserahkan admin lewat tombol "Serahkan".) */}
                {!isAdmin && (() => {
                  const akuPemakaiSaatIni = userIdPemakai(detail.pemakai_saat_ini) === user?.id;

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.status === 'dipakai' && akuPemakaiSaatIni && (
                        <button
                          onClick={() => setPengembalianTarget({ inventory: detail, pemakai: detail.pemakai_saat_ini! })}
                          className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                        >
                          <Undo2 size={14} />
                          Kembalikan
                        </button>
                      )}
                      {detail.status === 'dipakai' && akuPemakaiSaatIni && (
                        <button
                          onClick={() => setPerbaikanInventoryTarget(detail)}
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
                                  onClick={() => handlePrintSerahTerima([{ inventory: detail, pemakai: p }])}
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
                              {p.user && (
                                <p className="text-slate-400">
                                  NIK: {p.user.nik || '-'} · {p.user.departemen?.nama || '-'}
                                </p>
                              )}
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
                                        onClick={() => setPenangananSelesaiTarget({ inventory: detail, penanganan: p })}
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

      {serahTerimaInventory && (
        <InventorySerahTerimaModal
          inventory={serahTerimaInventory}
          onClose={() => setSerahTerimaInventory(null)}
          onSuccess={(results) => {
            handlePrintSerahTerima(results);
            setSerahTerimaInventory(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {pengembalianTarget && (
        <InventoryPengembalianModal
          inventory={pengembalianTarget.inventory}
          pemakai={pengembalianTarget.pemakai}
          isAdmin={isAdmin}
          onClose={() => setPengembalianTarget(null)}
          onSuccess={(pemakai) => {
            handlePrintPengembalian(pengembalianTarget.inventory, pemakai);
            setPengembalianTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {perbaikanInventoryTarget && (
        <InventoryLaporKerusakanModal
          inventory={perbaikanInventoryTarget}
          onClose={() => setPerbaikanInventoryTarget(null)}
          onSuccess={() => {
            setPerbaikanInventoryTarget(null);
            toast.success('Laporan kerusakan berhasil dikirim.');
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {penangananSelesaiTarget && (
        <InventoryPenangananSelesaiModal
          inventory={penangananSelesaiTarget.inventory}
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