import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import InventoryFormModal from '../InventoryFormModal';
import InventorySerahTerimaModal from '../InventorySerahTerimaModal';
import InventoryPengembalianModal from '../InventoryPengembalianModal';
import InventoryLaporKerusakanModal from '../InventoryLaporKerusakanModal';
import InventoryLepasDariIndukModal from '../InventoryLepasDariIndukModal';
import InventoryPasangIndukModal from '../InventoryPasangParentModal';
import InventoryPenangananSelesaiModal from '../../../transaksi/InventoryPenangananSelesaiModal';
import InventoryExportModal from '../../../laporan/InventoryExportModal';
import ConfirmDeleteModal from '../../../shared/ConfirmDeleteModal';
import { useAuth } from '../../../../context/AuthContext';
import { namaPemakai, userIdPemakai } from '../../../../utils/inventoryHelpers';
import {
  getInventoryById,
  deleteInventory,
  jualInventory,
  importInventory,
  type Inventory,
  type InventoryStatus,
} from '../../../../api/masterData/inventory';
import { deletePemakaiInventory, type InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';
import {
  deletePenangananInventory,
  terimaPenangananInventory,
  type InventoryPenanganan,
} from '../../../../api/transaksi/inventoryPenanganan';
import { useInventoryList } from './useInventoryList';
import { STATUS_PRIORITY, ASET_PER_PAGE, STATUS_KHUSUS_INDUK } from './helpers';
import InventoryRowActions from './InventoryRowActions';
import InventoryHeaderBar from './InventoryHeaderBar';
import InventorySedangDipakai from './InventorySedangDipakai';
import InventoryStatusTabs from './InventoryStatusTabs';
import InventoryFilterBar from './InventoryFilterBar';
import InventoryTable from './InventoryTable';
import InventoryJualConfirmModal from './InventoryJualConfirmModal';
import InventoryDetailModal from './InventoryDetailModal';
import { handlePrintSerahTerima, handlePrintPengembalian } from './printHelpers';

interface Props {
  onlyMenipis?: boolean;
  onCount?: (count: number) => void;
}

export default function TabInventory({ onlyMenipis, onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');

  const { inventoryList, setInventoryList, supplierOptions, kategoriOptions, loading, error, loadList, loadListSilent } = useInventoryList(onCount);

  const [statusFilter, setStatusFilter] = useState<InventoryStatus | ''>('');
  // Filter kategori (dinamis, multi-select) di sisi client -- 1 request
  // getInventory() tanpa ?kategori_id= (biar sekali fetch ambil semua),
  // filter dilakuin di FE lewat dropdown checklist ini. Array kosong = semua
  // kategori. Aman buat non-admin juga: pembatasan visibility non-admin di
  // backend (InventoryController::index()) gak bergantung ke query
  // ?kategori_id=, jadi fetch tanpa filter tetap ke-filter dengan benar oleh
  // backend.
  const [selectedKategoriIds, setSelectedKategoriIds] = useState<number[]>([]);
  const [kategoriDropdownOpen, setKategoriDropdownOpen] = useState(false);
  const kategoriDropdownRef = useRef<HTMLDivElement>(null);

  // BARU: Lapor Rusak Kelengkapan -- dipindah dari TabKelengkapanInventory.tsx.
  // Masuk alur InventoryPenanganan (menunggu_perbaikan -> diperbaiki -> selesai).

  // Export -- 1 tombol & 1 modal (InventoryExportModal) untuk semua kategori.
  const [exportOpen, setExportOpen] = useState(false);

  // Pagination tabel inventory — style sama kayak pager Riwayat Inventory (10 per
  // halaman, angka + elipsis). Client-side krn /api/inventory gak dipaging
  // di backend, tapi UI-nya ngikut pola yang sama.
  const [inventoryPage, setInventoryPage] = useState(1);

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

  // BARU (3B): state untuk aksi "Lepas dari Induk" — muncul di baris tabel
  // kelengkapan yang masih nempel (parent_id terisi) & di panel detail children.
  const [lepasTarget, setLepasTarget] = useState<Inventory | null>(null);

  // BARU: state untuk aksi "Pasang ke Induk" — kelengkapan berdiri sendiri
  // (parent_id null) yang statusnya tersedia bisa dipasang ke Barang Utama
  // tertentu lewat modal ini (kebalikan dari Lepas dari Induk).
  const [pasangIndukTarget, setPasangIndukTarget] = useState<Inventory | null>(null);

  // PINDAHAN dari Inventaris.tsx: Import Excel data inventory (bulk import: inventory +
  // jenis + supplier + kelengkapan) — sekarang ditaruh di sini biar aksinya
  // nempel langsung sama tabel/list inventory yang dia pengaruhi.
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Tutup dropdown kategori kalau klik di luar. Sebelumnya pakai listener
  // capture-phase yang nutup dropdown pada SETIAP klik di document tanpa
  // ngecek apakah kliknya di dalam dropdown -- akibatnya checkbox kategori
  // gak bisa dipilih lebih dari satu kali, karena tiap klik checkbox juga
  // langsung nutup dropdown-nya. Sekarang dicek dulu apakah target klik ada
  // di dalam kategoriDropdownRef sebelum nutup.
  useEffect(() => {
    if (!kategoriDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (kategoriDropdownRef.current && !kategoriDropdownRef.current.contains(e.target as Node)) {
        setKategoriDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [kategoriDropdownOpen]);

  const openDetail = async (id: number) => {
    setDetailId(id);
    setPenangananPage(1);
    setPemakaiPage(1);
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

  const [penangananPage, setPenangananPage] = useState(1);
  const [pemakaiPage, setPemakaiPage] = useState(1);
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

  // BARU: karyawan/cabang sekarang selalu lihat TABEL yang isinya cuma
  // inventory berstatus 'tersedia' (siap dipinjam) -- apapun status filter
  // yang mereka pilih, tabel gak lagi nyampur nampilin inventory yang lagi
  // dia pakai sendiri. Item yang lagi dia pakai dipisah & ditampilkan
  // sebagai card di section "Sedang Anda Pakai" (lihat myBorrowedItems di
  // bawah), bukan sebagai baris tabel lagi.
  const visibleInventoryList = useMemo(() => {
    if (isAdmin) return inventoryList;
    return inventoryList.filter((a) => a.status === 'tersedia');
  }, [inventoryList, isAdmin]);

  // BARU: daftar inventory yang lagi dipakai/ditangani (proses perbaikan)
  // oleh karyawan/cabang yang sedang login -- dipakai buat render section
  // card "Sedang Anda Pakai" di atas tabel, terpisah dari tabel utama yang
  // sekarang murni isinya inventory tersedia. Pakai userIdPemakai() (bukan
  // akses langsung .pekerja?.user?.id) biar akun cabang (yang gak punya
  // pekerja, cuma user langsung) juga kedeteksi bener sebagai pemilik
  // record.
  const myBorrowedItems = useMemo(() => {
    if (isAdmin) return [];
    return inventoryList.filter((a) => userIdPemakai(a.pemakai_saat_ini) === user?.id);
  }, [inventoryList, isAdmin, user?.id]);

  // Daftar item yang boleh jadi induk (parent_id === null, apapun
  // kategorinya) buat pilihan di modal Pasang ke Induk -- diambil dari
  // inventoryList yang sudah ada di state, gak perlu fetch ulang.
  const indukOptions = useMemo(
    () => inventoryList.filter((a) => a.parent_id === null),
    [inventoryList]
  );

  const filteredInventory = visibleInventoryList
    .filter((a) => {
      const matchStatus = !statusFilter || a.status === statusFilter;
      // Filter kategori multi-select -- array kosong berarti semua kategori
      // lolos. Dikombinasikan AND dengan filter status & search yang sudah
      // ada.
      const matchKategori =
        selectedKategoriIds.length === 0 ||
        (a.kategori_id != null && selectedKategoriIds.includes(a.kategori_id));
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
  // yang bikin badge tab selalu sinkron sama isi tabelnya. Buat non-admin,
  // visibleInventoryList cuma berisi status 'tersedia', jadi tab status pun
  // sudah disembunyikan sekalian (lihat isAdmin && <ScrollableTabBar> di bawah).
  // Ngitung dari populasi yang sudah kena filter kategori aktif (selectedKategoriIds)
  // biar badge per-status konsisten dengan badge "Semua Status".
  const statusCounts = useMemo(() => {
    const counts: Record<InventoryStatus, number> = {
      tersedia: 0,
      dipakai: 0,
      menunggu_perbaikan: 0,
      diperbaiki: 0,
      rusak_berat: 0,
      dijual: 0,
    };
    for (const a of visibleInventoryList) {
      const matchKategori =
        selectedKategoriIds.length === 0 ||
        (a.kategori_id != null && selectedKategoriIds.includes(a.kategori_id));
      if (matchKategori) counts[a.status] += 1;
    }
    return counts;
  }, [visibleInventoryList, selectedKategoriIds]);

  // Apakah ada item yang parent_id === null di dalam hasil filter kategori aktif?
  // Dipakai untuk menentukan apakah tab "Dijual" ditampilkan -- kalau semua
  // item yang lolos filter adalah child (menempel), tab dijual disembunyikan
  // karena endpoint jual() hanya berlaku untuk item yang bukan child.
  const adaIndukDiFilterAktif = useMemo(() => {
    return visibleInventoryList.some((a) => {
      const matchKategori =
        selectedKategoriIds.length === 0 ||
        (a.kategori_id != null && selectedKategoriIds.includes(a.kategori_id));
      return matchKategori && a.parent_id === null;
    });
  }, [visibleInventoryList, selectedKategoriIds]);

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
  }, [search, statusFilter, selectedKategoriIds, onlyMenipis]);

  // Toggle satu kategori_id di filter multi-select. Kalau setelah toggle
  // hasil filter jadi gak ada induk (adaIndukDiFilterAktif false) dan status
  // aktif adalah STATUS_KHUSUS_INDUK, reset status ke semua.
  const handleToggleKategori = (id: number) => {
    setSelectedKategoriIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // cek apakah ada induk di hasil filter baru
      const adaInduk = visibleInventoryList.some((a) => {
        const matchKategori =
          next.length === 0 || (a.kategori_id != null && next.includes(a.kategori_id));
        return matchKategori && a.parent_id === null;
      });
      if (!adaInduk && statusFilter && STATUS_KHUSUS_INDUK.includes(statusFilter)) {
        setStatusFilter('');
      }
      return next;
    });
  };

  // Tombol aksi per baris (tabel desktop & card mobile) -- isinya sekarang di InventoryRowActions.tsx
  const renderAksi = (a: Inventory) => (
    <InventoryRowActions
      a={a}
      isAdmin={isAdmin}
      openDetail={openDetail}
      setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
      setLepasTarget={setLepasTarget}
      setEditingInventory={setEditingInventory}
      setFormOpen={setFormOpen}
      setDeleteError={setDeleteError}
      setDeleteForceAvailable={setDeleteForceAvailable}
      setDeleteTarget={setDeleteTarget}
      user={user}
      setPasangIndukTarget={setPasangIndukTarget}
      setSerahTerimaInventory={setSerahTerimaInventory}
      setPengembalianTarget={setPengembalianTarget}
    />
  );

  const [expandedInventoryId, setExpandedInventoryId] = useState<number | null>(null);

  return (
    <>
      <InventoryHeaderBar
        setExportOpen={setExportOpen}
        isAdmin={isAdmin}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        importLoading={importLoading}
        setEditingInventory={setEditingInventory}
        setFormOpen={setFormOpen}
      />

      {importMessage && (
        <p className={`text-sm mb-4 -mt-2 ${importMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {importMessage.text}
        </p>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">

      {/* BARU: section card "Sedang Anda Pakai" -- cuma buat karyawan/cabang
          (non-admin), berisi inventory yang lagi dia pakai/lagi ditangani
          (menunggu_perbaikan/diperbaiki/rusak_berat) sendiri. Item-item ini
          sengaja TIDAK ikut ditampilkan sebagai baris di tabel utama lagi --
          tabel utama sekarang murni daftar inventory 'tersedia' (lihat
          visibleInventoryList). Ditaruh sebelum tab status/tabel biar
          langsung kelihatan begitu tab ini dibuka. */}
      {!isAdmin && myBorrowedItems.length > 0 && (
        <InventorySedangDipakai
          myBorrowedItems={myBorrowedItems}
          openDetail={openDetail}
          setPengembalianTarget={setPengembalianTarget}
          setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
        />
      )}

      {/* Filter status sekarang pakai tab nav (ScrollableTabBar) -- sama pola
          kayak Forum Penanganan Inventory, biar konsisten di seluruh halaman
          Inventaris. BARU: cuma dimunculkan buat admin -- tabel non-admin
          sekarang selalu isinya inventory 'tersedia' aja (lihat
          visibleInventoryList), jadi tab status gak relevan lagi buat mereka. */}
      {isAdmin && (
        <InventoryStatusTabs
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusCounts={statusCounts}
          adaIndukDiFilterAktif={adaIndukDiFilterAktif}
        />
      )}

      <InventoryFilterBar
        search={search}
        setSearch={setSearch}
        kategoriDropdownRef={kategoriDropdownRef}
        setKategoriDropdownOpen={setKategoriDropdownOpen}
        selectedKategoriIds={selectedKategoriIds}
        kategoriOptions={kategoriOptions}
        kategoriDropdownOpen={kategoriDropdownOpen}
        setSelectedKategoriIds={setSelectedKategoriIds}
        handleToggleKategori={handleToggleKategori}
      />

      <InventoryTable
        loading={loading}
        error={error}
        filteredInventory={filteredInventory}
        pageInventory={pageInventory}
        renderAksi={renderAksi}
        expandedInventoryId={expandedInventoryId}
        setExpandedInventoryId={setExpandedInventoryId}
        inventoryLastPage={inventoryLastPage}
        inventoryPageClamped={inventoryPageClamped}
        setInventoryPage={setInventoryPage}
      />

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
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.nama || deleteTarget?.kode_inventory || ''}
        itemCode={deleteTarget?.kode_inventory}
        itemType="Inventory"
        loading={deleting}
        errorMessage={deleteError}
        forceAvailable={deleteForceAvailable}
        warningMessage={
          deleteForceAvailable
            ? 'Inventory ini memiliki riwayat pemakaian/penanganan. Anda dapat melakukan Hapus Paksa jika memang data lama/test.'
            : 'Menghapus inventory akan menghapus data beserta seluruh riwayat terkait secara permanen.'
        }
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
          setDeleteForceAvailable(false);
        }}
        onConfirm={(force) => confirmDelete(!!force)}
      />

      {/* BARU: KONFIRMASI JUAL ASET — cuma tanda, gak ada form */}
      {jualTarget && (
        <InventoryJualConfirmModal
          jualTarget={jualTarget}
          jualError={jualError}
          setJualTarget={setJualTarget}
          jualLoading={jualLoading}
          confirmJual={confirmJual}
        />
      )}

      {/* EXPORT -- 1 modal untuk semua kategori. Data yang dikirim =
          filteredInventory (ngikutin filter status/search/kategori aktif). */}
      <InventoryExportModal open={exportOpen} onClose={() => setExportOpen(false)} data={filteredInventory} />

      {/* Konfirmasi Lapor Rusak Kelengkapan lama (instan/final) sudah
          dihapus -- kelengkapan yang nempel ke induk sekarang lapor
          kerusakan lewat InventoryLaporKerusakanModal yang sama kaya Barang
          Utama, lihat renderAksiKelengkapan di atas. */}

      {/* DETAIL ASET — disembunyiin sementara kalau ada modal aksi (serah-terima,
          terima kembali, jual, dst) yang kebuka di atasnya, biar gak numpuk 2
          modal + 2 overlay keliatan bareng */}
      {detailId &&
        !serahTerimaInventory &&
        !pengembalianTarget &&
        !perbaikanInventoryTarget &&
        !penangananSelesaiTarget &&
        !jualTarget &&
        !lepasTarget &&
        !pasangIndukTarget && (
        <InventoryDetailModal
          closeDetail={closeDetail}
          detail={detail}
          detailLoading={detailLoading}
          isAdmin={isAdmin}
          setSerahTerimaInventory={setSerahTerimaInventory}
          setPengembalianTarget={setPengembalianTarget}
          setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
          setPasangIndukTarget={setPasangIndukTarget}
          openJual={openJual}
          user={user}
          openDetail={openDetail}
          setLepasTarget={setLepasTarget}
          pemakaiPage={pemakaiPage}
          expandedPemakaiId={expandedPemakaiId}
          handleDeletePemakai={handleDeletePemakai}
          deletingPemakaiId={deletingPemakaiId}
          setExpandedPemakaiId={setExpandedPemakaiId}
          setPemakaiPage={setPemakaiPage}
          historyActionError={historyActionError}
          penangananPage={penangananPage}
          expandedPenangananId={expandedPenangananId}
          handleTerimaPenanganan={handleTerimaPenanganan}
          terimaLoadingId={terimaLoadingId}
          setPenangananSelesaiTarget={setPenangananSelesaiTarget}
          handleDeletePenanganan={handleDeletePenanganan}
          setExpandedPenangananId={setExpandedPenangananId}
          setPenangananPage={setPenangananPage}
        />
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

      {/* BARU (3B): Modal Lepas dari Induk — dipicu dari baris tabel
          (renderAksiKelengkapan) maupun tombol Lepas di panel detail children.
          onSuccess: refresh list + detail (parent berubah karena child-nya
          berkurang), tutup modal, tampilkan toast. */}
      {lepasTarget && (
        <InventoryLepasDariIndukModal
          inventory={lepasTarget}
          onClose={() => setLepasTarget(null)}
          onSuccess={(updated) => {
            setLepasTarget(null);
            toast.success(`${updated.kode_inventory} berhasil dilepas dari induk.`);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {/* BARU: Modal Pasang ke Induk — kebalikan dari Lepas dari Induk. Dipicu
          dari baris tabel/card (kelengkapan berdiri sendiri, status tersedia)
          maupun tombol di panel detail. onSuccess: refresh list + detail
          (kalau lagi kebuka), tutup modal, tampilkan toast. */}
      {pasangIndukTarget && (
        <InventoryPasangIndukModal
          inventory={pasangIndukTarget}
          indukOptions={indukOptions}
          onClose={() => setPasangIndukTarget(null)}
          onSuccess={(updated) => {
            setPasangIndukTarget(null);
            toast.success(`${updated.kode_inventory} berhasil dipasang ke induk.`);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}
    </div>
    </>
  );
}
