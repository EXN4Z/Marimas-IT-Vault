import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
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
import type { Inventory, InventoryStatus } from '../../../../api/masterData/inventory';
import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';
import {
  deletePenangananInventory,
  terimaPenangananInventory,
  type InventoryPenanganan,
} from '../../../../api/transaksi/inventoryPenanganan';
import type { InventoryIndukOpsi, InventoryList, InventoryOpsi, InventoryRow } from '../../../../types/inventory';
import { STATUS_LABEL } from './helpers';
import InventoryRowActions from './InventoryRowActions';
import InventoryHeaderBar from './InventoryHeaderBar';
import InventorySedangDipakai from './InventorySedangDipakai';
import InventoryStatusTabs from './InventoryStatusTabs';
import InventoryFilterBar from './InventoryFilterBar';
import InventoryTable from './InventoryTable';
import InventoryJualConfirmModal from './InventoryJualConfirmModal';
import InventoryDetailModal from './InventoryDetailModal';
import { handlePrintSerahTerima, handlePrintPengembalian } from './printHelpers';

// [F4-INERTIA] Tab "Inventory" di Master Data (tadinya axios + useInventoryList + filter/pagination di client). Sekarang:
//  - data dari props server (MasterDataPageController -> props.inventory, hanya dikirim saat tab ini aktif);
//  - pagination, pencarian, filter status, dan filter kategori dijalankan server lewat router.get (query string = sumber kebenaran);
//  - Tambah / Edit / Detail / Jual / Pasang ke Induk / Lepas dari Induk / Hapus = modal overlay dengan state lokal;
//  - mutasi inventory lewat router.* ke /master-data/inventory, hasilnya toast dari flash server (FlashToaster);
//  - detail (riwayat lengkap) diminta lewat partial reload props.inventoryDetail (?detail=<id>, URL browser tidak berubah);
//  - auto-refresh 5 detik = partial reload async (list + "sedang dipakai" + detail yang lagi terbuka).
// [F5-INERTIA] Serah-terima / pengembalian / hapus riwayat pemakaian = Inertia (router.post|delete ke /master-data/inventory*, toast dari
// flash server, struk dicetak dari flash.struk). Lapor kerusakan / penanganan masih lewat axios (dipindah di F6); setelah
// sukses, tab ini cukup memuat ulang props lewat segarkan().
interface InventoryPageProps {
  inventory?: InventoryList;
  inventoryDipakai?: InventoryRow[];
  inventoryOpsi?: InventoryOpsi;
  inventoryExport?: InventoryRow[];
  inventoryIndukOpsi?: InventoryIndukOpsi[];
  inventoryDetail?: Inventory | null;
}

interface FilterBaru {
  search?: string;
  status?: InventoryStatus | '';
  kategori?: number[];
  page?: number;
}

const OPSI_KOSONG: InventoryOpsi = { kategori: [], supplier: [], perusahaan: [] };

export default function TabInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const pageProps = usePage().props as unknown as InventoryPageProps;
  const list = pageProps.inventory;
  const pageInventory = list?.data ?? [];
  const statusFilter: InventoryStatus | '' = list?.filters.status ?? '';
  const selectedKategoriIds = list?.filters.kategori ?? [];
  const serverSearch = list?.filters.search ?? '';
  const currentPage = list?.current_page ?? 1;
  const lastPage = list?.last_page ?? 1;
  const totalInventory = list?.total ?? 0;
  const adaIndukDiFilterAktif = list?.ada_induk ?? false;
  const myBorrowedItems = pageProps.inventoryDipakai ?? [];
  const opsi = pageProps.inventoryOpsi ?? OPSI_KOSONG;

  const [searchInput, setSearchInput] = useState<string>(serverSearch);
  const [listLoading, setListLoading] = useState<boolean>(false);

  const [kategoriDropdownOpen, setKategoriDropdownOpen] = useState(false);
  const kategoriDropdownRef = useRef<HTMLDivElement>(null);

  // Export -- 1 tombol & 1 modal (InventoryExportModal) untuk semua kategori. Datanya = SEMUA hasil filter aktif,
  // diambil lewat partial reload (props.inventoryExport) tiap tombol Export diklik, bukan cuma halaman yang tampil.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<InventoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inventory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Kalau hapus normal gagal krn inventory punya riwayat pemakai/penanganan (data lama/test), server menandai
  // error "force_available" -- modal yang sama menawarkan Hapus Paksa.
  const [deleteForceAvailable, setDeleteForceAvailable] = useState(false);

  // Detail: id disimpan lokal; datanya = props.inventoryDetail (diminta lewat partial reload). detailIdRef supaya
  // polling selalu tahu id TERBARU tanpa membuat ulang interval.
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailIdRef = useRef<number | null>(null);
  const propDetail = pageProps.inventoryDetail ?? null;
  const detail = detailId !== null && propDetail && propDetail.id === detailId ? propDetail : null;
  const detailLoading = detailId !== null && detail === null;

  // Serah-terima 1 inventory utama (kelengkapan ikut otomatis di server) & pengembalian: modal -> router.post (F5).
  // Lapor kerusakan & penanganan selesai: masih axios (F6).
  const [serahTerimaInventory, setSerahTerimaInventory] = useState<Inventory | null>(null);
  const [pengembalianTarget, setPengembalianTarget] = useState<{ inventory: Inventory; pemakai: InventoryPemakai } | null>(null);

  const [perbaikanInventoryTarget, setPerbaikanInventoryTarget] = useState<Inventory | null>(null);
  const [penangananSelesaiTarget, setPenangananSelesaiTarget] = useState<{ inventory: Inventory; penanganan: InventoryPenanganan } | null>(null);
  const [historyActionError, setHistoryActionError] = useState('');

  // Jual: inventory tersedia atau rusak_berat -- cuma konfirmasi, gak ada form.
  const [jualTarget, setJualTarget] = useState<Inventory | null>(null);
  const [jualLoading, setJualLoading] = useState(false);
  const [jualError, setJualError] = useState('');

  // Lepas dari Induk (baris kelengkapan yang menempel & panel detail children) dan Pasang ke Induk (kebalikannya).
  const [lepasTarget, setLepasTarget] = useState<Inventory | null>(null);
  const [pasangIndukTarget, setPasangIndukTarget] = useState<Inventory | null>(null);

  // Import Excel data inventory (bulk). Sukses -> toast dari flash server; gagal -> pesan error inline.
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);
  const [penangananPage, setPenangananPage] = useState(1);
  const [pemakaiPage, setPemakaiPage] = useState(1);
  const [expandedPenangananId, setExpandedPenangananId] = useState<number | null>(null);
  const [expandedPemakaiId, setExpandedPemakaiId] = useState<number | null>(null);
  const [deletingPemakaiId, setDeletingPemakaiId] = useState<number | null>(null);
  const [expandedInventoryId, setExpandedInventoryId] = useState<number | null>(null);

  // ------------------------------------------------------------------ request ke server

  // Query string dari filter. Nilai default (search kosong, status semua, kategori kosong, halaman 1) tidak ikut di URL.
  function bangunData(f: Required<FilterBaru>, detailParam?: number | null): Record<string, string | number | number[]> {
    const data: Record<string, string | number | number[]> = { tab: 'inventory' };
    if (f.search) data.search = f.search;
    if (f.status) data.status = f.status;
    if (f.kategori.length > 0) data.kategori = f.kategori;
    if (f.page > 1) data.page = f.page;
    if (detailParam) data.detail = detailParam;
    return data;
  }

  // Filter yang SEDANG aktif di server (sumber kebenaran = props, bukan input yang lagi diketik).
  function filterAktif(): Required<FilterBaru> {
    return { search: serverSearch, status: statusFilter, kategori: selectedKategoriIds, page: currentPage };
  }

  // Pindah halaman / ganti filter = visit ringan ke /master-data (partial reload cuma props.inventory), URL ikut berubah.
  function visitList(next: FilterBaru) {
    const f: Required<FilterBaru> = {
      search: (next.search ?? searchInput).trim(),
      status: next.status ?? statusFilter,
      kategori: next.kategori ?? selectedKategoriIds,
      page: next.page ?? 1,
    };

    setListLoading(true);
    router.get('/master-data', bangunData(f), {
      only: ['inventory'],
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onFinish: () => setListLoading(false),
    });
  }

  // Muat ulang list + "sedang dipakai" (+ detail yang lagi terbuka) tanpa mengubah filter/URL. silent = polling:
  // async (tidak membatalkan request lain, mis. submit form yang lagi jalan) dan tanpa progress bar.
  function segarkan(silent = false) {
    const id = detailIdRef.current;
    const only = ['inventory', 'inventoryDipakai'];
    if (id) only.push('inventoryDetail');

    const options = {
      only,
      preserveState: true,
      preserveScroll: true,
      replace: true,
      preserveUrl: true,
      async: silent,
      showProgress: !silent,
    };

    // Detail butuh ?detail=<id> di request; preserveUrl menjaga URL browser tetap bersih.
    router.get('/master-data', bangunData(filterAktif(), id), options);
  }

  // Polling 5 detik biar perubahan status (menunggu perbaikan / sedang diperbaiki / tersedia) langsung kelihatan, baik di
  // list maupun di modal detail yang kebuka. Dilewati kalau tab browser lagi disembunyikan.
  const segarkanRef = useRef(segarkan);
  segarkanRef.current = segarkan;
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      segarkanRef.current(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Pencarian: tunggu user berhenti mengetik sebentar sebelum minta data ke server.
  useEffect(() => {
    if (searchInput.trim() === serverSearch) return;
    const timer = setTimeout(() => visitList({ search: searchInput, page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Kandidat induk dimuat hanya saat form Tambah/Edit atau modal Pasang ke Induk dibuka.
  useEffect(() => {
    if (!formOpen && !pasangIndukTarget) return;
    router.reload({ only: ['inventoryIndukOpsi'], async: true, showProgress: false });
  }, [formOpen, pasangIndukTarget]);

  // Tutup dropdown kategori kalau klik di luar (dicek dulu apakah target klik ada di dalam dropdown, supaya
  // checkbox kategori bisa dipilih lebih dari satu kali).
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

  // ------------------------------------------------------------------ detail

  function openDetail(id: number) {
    setDetailId(id);
    detailIdRef.current = id;
    setPenangananPage(1);
    setPemakaiPage(1);
    setExpandedPenangananId(null);
    setExpandedPemakaiId(null);

    router.get('/master-data', bangunData(filterAktif(), id), {
      only: ['inventoryDetail'],
      preserveState: true,
      preserveScroll: true,
      preserveUrl: true,
      onSuccess: (page) => {
        const d = (page.props as unknown as InventoryPageProps).inventoryDetail;
        if (!d || d.id !== id) {
          toast.error('Detail inventory tidak bisa dibuka (tidak ditemukan atau kamu tidak punya akses).');
          closeDetail();
        }
      },
    });
  }

  function closeDetail() {
    setDetailId(null);
    detailIdRef.current = null;
  }

  // ------------------------------------------------------------------ mutasi inventory (Inertia)

  function confirmDelete(force = false) {
    if (!deleteTarget) return;
    const target = deleteTarget;

    setDeleting(true);
    setDeleteError('');
    // Sukses -> toast dari flash server. Gagal -> error bag "delete" tampil di modal konfirmasi
    // (+ "force_available" -> tawarkan Hapus Paksa).
    router.delete(`/master-data/inventory/${target.id}`, {
      data: force ? { force: true } : undefined,
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteForceAvailable(false);
        if (detailIdRef.current === target.id) closeDetail();
      },
      onError: (errors) => {
        setDeleteError(errors.delete || 'Gagal menghapus inventory.');
        setDeleteForceAvailable(!!errors.force_available);
      },
      onFinish: () => setDeleting(false),
    });
  }

  function openJual(a: Inventory) {
    setJualTarget(a);
    setJualError('');
  }

  // Jual: tandai inventory sebagai 'dijual', gak ada input tambahan.
  function confirmJual() {
    if (!jualTarget) return;

    setJualLoading(true);
    setJualError('');
    router.post(`/master-data/inventory/${jualTarget.id}/jual`, {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setJualTarget(null);
        if (detailIdRef.current) segarkan();
      },
      onError: (errors) => setJualError(errors.jual || 'Gagal menandai inventory sebagai terjual.'),
      onFinish: () => setJualLoading(false),
    });
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    router.post('/master-data/inventory/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => setImportError(String(errors.file || 'Gagal mengimport file')),
      onFinish: () => {
        setImportLoading(false);
        // reset biar bisa upload file yang sama lagi
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  }

  function siapkanExport() {
    setExportLoading(true);
    router.reload({
      only: ['inventoryExport'],
      onSuccess: () => setExportOpen(true),
      onError: () => toast.error('Gagal menyiapkan data export. Coba lagi.'),
      onFinish: () => setExportLoading(false),
    });
  }

  // InventoryHeaderBar memanggil setExportOpen(true): buka modal = ambil dulu datanya dari server.
  const bukaExport: React.Dispatch<React.SetStateAction<boolean>> = (v) => {
    const next = typeof v === 'function' ? v(exportOpen) : v;
    if (next) siapkanExport();
    else setExportOpen(false);
  };

  // ------------------------------------------------------------------ aksi riwayat di modal detail
  // (hapus riwayat pemakaian = Inertia [F5-INERTIA]; terima/hapus penanganan = axios sampai F6)

  async function handleTerimaPenanganan(id: number) {
    setHistoryActionError('');
    setTerimaLoadingId(id);
    try {
      await terimaPenangananInventory(id);
      segarkan();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menerima laporan penanganan.');
    } finally {
      setTerimaLoadingId(null);
    }
  }

  async function handleDeletePenanganan(id: number) {
    if (!confirm('Hapus riwayat penanganan ini?')) return;
    setHistoryActionError('');
    try {
      await deletePenangananInventory(id);
      segarkan();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat penanganan.');
    }
  }

  function handleDeletePemakai(id: number) {
    if (!confirm('Hapus riwayat pemakaian ini?')) return;
    setHistoryActionError('');
    setDeletingPemakaiId(id);
    // Sukses -> toast dari flash server; gagal (mis. ada laporan perbaikan terkait) -> error bag "hapus" tampil di modal detail.
    router.delete(`/master-data/inventory-pemakai/${id}`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => segarkan(),
      onError: (errors) => setHistoryActionError(errors.hapus || 'Gagal menghapus riwayat pemakaian.'),
      onFinish: () => setDeletingPemakaiId(null),
    });
  }

  // ------------------------------------------------------------------ filter (adapter ke komponen filter lama)

  // Toggle satu kategori_id di filter multi-select. Status "Dijual" otomatis di-reset oleh server kalau hasil filter
  // baru tidak punya item induk.
  const handleToggleKategori = (id: number) => {
    const next = selectedKategoriIds.includes(id) ? selectedKategoriIds.filter((x) => x !== id) : [...selectedKategoriIds, id];
    visitList({ kategori: next, page: 1 });
  };

  const setSelectedKategoriIds: React.Dispatch<React.SetStateAction<number[]>> = (v) => {
    const next = typeof v === 'function' ? v(selectedKategoriIds) : v;
    visitList({ kategori: next, page: 1 });
  };

  const setStatusFilter: React.Dispatch<React.SetStateAction<InventoryStatus | ''>> = (v) => {
    const next = typeof v === 'function' ? v(statusFilter) : v;
    visitList({ status: next, page: 1 });
  };

  // Tombol aksi per baris (tabel desktop & card mobile) -- isinya di InventoryRowActions.tsx
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

  return (
    <>
      <InventoryHeaderBar
        setExportOpen={bukaExport}
        exportLoading={exportLoading}
        isAdmin={isAdmin}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        importLoading={importLoading}
        setEditingInventory={setEditingInventory}
        setFormOpen={setFormOpen}
      />

      {importError && <p className="text-sm mb-4 -mt-2 text-red-600">{importError}</p>}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">

      {/* Section card "Sedang Anda Pakai" -- cuma buat karyawan/cabang (non-admin), berisi inventory yang lagi dia
          pakai/lagi ditangani sendiri. Tabel utama non-admin murni daftar inventory 'tersedia'. */}
      {!isAdmin && myBorrowedItems.length > 0 && (
        <InventorySedangDipakai
          myBorrowedItems={myBorrowedItems}
          openDetail={openDetail}
          setPengembalianTarget={setPengembalianTarget}
          setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
        />
      )}

      {/* Filter status pakai tab nav (ScrollableTabBar). Cuma buat admin -- tabel non-admin selalu isinya
          inventory 'tersedia' aja. */}
      {isAdmin && (
        <InventoryStatusTabs
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          adaIndukDiFilterAktif={adaIndukDiFilterAktif}
        />
      )}

      <InventoryFilterBar
        search={searchInput}
        setSearch={setSearchInput}
        kategoriDropdownRef={kategoriDropdownRef}
        setKategoriDropdownOpen={setKategoriDropdownOpen}
        selectedKategoriIds={selectedKategoriIds}
        kategoriOptions={opsi.kategori}
        kategoriDropdownOpen={kategoriDropdownOpen}
        setSelectedKategoriIds={setSelectedKategoriIds}
        handleToggleKategori={handleToggleKategori}
      />

      <p className="text-xs text-slate-500 mb-4">
        Total {statusFilter === '' ? 'Semua' : (STATUS_LABEL[statusFilter] ?? 'Status')}: <span className="font-semibold text-slate-900">{totalInventory}</span> inventory
      </p>

      <div className={`transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
        <InventoryTable
          pageInventory={pageInventory}
          renderAksi={renderAksi}
          expandedInventoryId={expandedInventoryId}
          setExpandedInventoryId={setExpandedInventoryId}
          inventoryLastPage={lastPage}
          inventoryPageClamped={currentPage}
          setInventoryPage={(page) => visitList({ page })}
          totalItems={totalInventory}
        />
      </div>

      {/* FORM TAMBAH / EDIT INVENTORY */}
      {formOpen && (
        <InventoryFormModal
          inventory={editingInventory}
          opsi={opsi}
          indukOptions={pageProps.inventoryIndukOpsi}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            if (detailIdRef.current) segarkan();
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

      {/* KONFIRMASI JUAL INVENTORY — cuma tanda, gak ada form */}
      {jualTarget && (
        <InventoryJualConfirmModal
          jualTarget={jualTarget}
          jualError={jualError}
          setJualTarget={setJualTarget}
          jualLoading={jualLoading}
          confirmJual={confirmJual}
        />
      )}

      {/* EXPORT -- 1 modal untuk semua kategori. Data = SEMUA hasil filter status/search/kategori aktif. */}
      <InventoryExportModal open={exportOpen} onClose={() => setExportOpen(false)} data={pageProps.inventoryExport ?? []} />

      {/* DETAIL INVENTORY — disembunyiin sementara kalau ada modal aksi (serah-terima, terima kembali, jual, dst)
          yang kebuka di atasnya, biar gak numpuk 2 modal + 2 overlay keliatan bareng */}
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
            segarkan();
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
            segarkan();
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
            segarkan();
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
            segarkan();
          }}
        />
      )}

      {/* Lepas dari Induk — dipicu dari baris tabel maupun tombol Lepas di panel detail children. Sukses -> toast dari
          flash server; modal ditutup, list + detail dimuat ulang oleh redirect (detail lewat segarkan()). */}
      {lepasTarget && (
        <InventoryLepasDariIndukModal
          inventory={lepasTarget}
          onClose={() => setLepasTarget(null)}
          onSuccess={() => {
            setLepasTarget(null);
            if (detailIdRef.current) segarkan();
          }}
        />
      )}

      {/* Pasang ke Induk — kebalikan dari Lepas dari Induk. Kandidat induk = props.inventoryIndukOpsi (dimuat saat modal dibuka). */}
      {pasangIndukTarget && (
        <InventoryPasangIndukModal
          inventory={pasangIndukTarget}
          indukOptions={pageProps.inventoryIndukOpsi ?? []}
          memuatOpsi={pageProps.inventoryIndukOpsi === undefined}
          onClose={() => setPasangIndukTarget(null)}
          onSuccess={() => {
            setPasangIndukTarget(null);
            if (detailIdRef.current) segarkan();
          }}
        />
      )}
    </div>
    </>
  );
}
