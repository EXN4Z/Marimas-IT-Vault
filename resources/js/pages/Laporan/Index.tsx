import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Boxes, Users, ClipboardList, Loader2, Download, FileSpreadsheet, Images, History, Tags, Building2, Landmark, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Inventory } from '../../features/inventory/types/inventory';
import type { LaporanExportData } from '../../features/laporan/types';
import type { Karyawan } from '../../features/karyawan/types';
import type { InventoryPemakai } from '../../features/inventory/types/inventoryPemakai';
import InventoryExportModal from '../../features/laporan/export/InventoryExportModal';
import KaryawanExportModal from '../../features/laporan/export/KaryawanExportModal';
import InventoryPemakaiExportModal from '../../features/laporan/export/InventoryPemakaiExportModal';
import ScrollableTabBar from '../../components/navigation/ScrollableTabBar';
import FotoInventoryTab from '../../features/laporan/foto/FotoInventoryTab';
import RiwayatInventoryTab from '../../features/laporan/riwayat/RiwayatInventoryTab';
import type { Kategori } from '../../features/master-data/kategori/types';
import KategoriExportModal from '../../features/laporan/export/KategoriExportModal';
import type { Departemen } from '../../features/master-data/departemen/types';
import DepartemenExportModal from '../../features/laporan/export/DepartemenExportModal';
import type { Cabang } from '../../features/master-data/cabang/types';
import type { Perusahaan } from '../../features/master-data/perusahaan/types';
import type { Supplier } from '../../features/master-data/supplier/types';
import SimpleExportModal from '../../features/laporan/export/SimpleExportModal';

// Admin-only. Semua role selain admin (hr/manajer/cabang termasuk)
// disamakan persis seperti karyawan -- yaitu TIDAK punya akses ke halaman
// Laporan ini (sinkron sama menu sidebar di AppLayout.tsx).

// dulu halaman ini cuma 2 kartu export (Inventory & Karyawan) -- sekarang jadi
// tab-based karena Foto Inventory & Riwayat Inventory (pindahan dari Inventaris.tsx,
// yang bakal dihapus) ikut digabung ke sini.
//
// REVISI: tab "export" DULU sengaja gak dikasih query "?tab=" biar cocok
// sama child "Export Data" di dropdown sidebar Laporan (AppLayout.tsx) yang
// path-nya polos "/laporan" tanpa query. Sekarang diseragamkan -- SEMUA tab
// (termasuk export) selalu tercermin di query param, jadi url yang benar
// buat tab ini adalah "/laporan?tab=export_data", BUKAN "/laporan" polos.
// Kalau halaman diakses tanpa query sama sekali (mis. link lama/bookmark),
// effect di bawah otomatis redirect (replace, gak nge-reload) ke
// "?tab=export_data" biar url selalu konsisten dengan tab yang lagi aktif.
//
// CATATAN: kalau ada link sidebar (AppLayout.tsx) yang masih nunjuk ke
// "/laporan" polos buat menu "Export Data", sebaiknya diupdate juga jadi
// "/laporan?tab=export_data" supaya url di address bar langsung benar sejak
// awal klik, bukan nunggu di-redirect oleh effect ini.
type TabKey = 'export_data' | 'foto_inventory' | 'riwayat_inventory';

const TAB_KEYS: TabKey[] = ['export_data', 'foto_inventory', 'riwayat_inventory'];

function isTabKey(value: string | null): value is TabKey {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

export default function Laporan() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  // Tab aktif = prop `tab` dari server (LaporanPageController memvalidasi; kosong/ngawur -> redirect
  // ke ?tab=export_data). Ganti tab = visit ringan ke URL yang sama: replace (history gak numpuk),
  // preserveState (list data & modal export yang sudah ke-load tidak hilang).
  const pageProps = usePage().props as unknown as { tab?: string; exportData?: LaporanExportData | null };
  const activeTab: TabKey = isTabKey(pageProps.tab ?? null) ? (pageProps.tab as TabKey) : 'export_data';

  const setActiveTab = (tab: TabKey) => {
    if (tab === activeTab) return;
    router.get('/laporan', { tab }, { replace: true, preserveState: true, preserveScroll: true });
  };

  // [F7-INERTIA] Data export datang lewat props `exportData` (deferred prop dari LaporanPageController); undefined/null = belum dimuat
  // (kartu menampilkan "Memuat data..."). Tidak ada axios lagi di halaman ini. Cuma state buka/tutup modal yang lokal.
  const exportData = pageProps.exportData ?? null;
  const inventoryList: Inventory[] = exportData?.inventory ?? [];
  const karyawanList: Karyawan[] = exportData?.karyawan ?? [];
  const pemakaiList: InventoryPemakai[] = exportData?.pemakai ?? [];
  const kategoriList: Kategori[] = exportData?.kategori ?? [];
  const departemenList: Departemen[] = exportData?.departemen ?? [];
  const cabangList: Cabang[] = exportData?.cabang ?? [];
  const perusahaanList: Perusahaan[] = exportData?.perusahaan ?? [];
  const supplierList: Supplier[] = exportData?.supplier ?? [];
  const dataLoading = !exportData;
  const inventoryLoading = dataLoading;
  const karyawanLoading = dataLoading;
  const pemakaiLoading = dataLoading;
  const kategoriLoading = dataLoading;
  const departemenLoading = dataLoading;
  const cabangLoading = dataLoading;
  const perusahaanLoading = dataLoading;
  const supplierLoading = dataLoading;

  const [exportInventoryOpen, setExportInventoryOpen] = useState(false);
  const [exportKaryawanOpen, setExportKaryawanOpen] = useState(false);
  const [exportPemakaiOpen, setExportPemakaiOpen] = useState(false);
  const [exportKategoriOpen, setExportKategoriOpen] = useState(false);
  const [exportDepartemenOpen, setExportDepartemenOpen] = useState(false);
  const [exportCabangOpen, setExportCabangOpen] = useState(false);
  const [exportPerusahaanOpen, setExportPerusahaanOpen] = useState(false);
  const [exportSupplierOpen, setExportSupplierOpen] = useState(false);

  if (!isStaff) {
    return (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: typeof FileSpreadsheet; adminOnly?: boolean }[] = [
    { key: 'export_data', label: 'Export Data', icon: FileSpreadsheet },
    // pindahan dari Inventaris.tsx
    { key: 'foto_inventory', label: 'Foto Inventory', icon: Images, adminOnly: true },
    { key: 'riwayat_inventory', label: 'Riwayat Inventory', icon: History },
  ];

  return (
    <>
      <ScrollableTabBar
        className="mb-6"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-slate-500">
          {activeTab === 'export_data'
            ? 'Pilih modul data yang ingin diexport ke format Excel (.xlsx) atau dokumen PDF.'
            : activeTab === 'foto_inventory'
              ? 'Kelola dan unduh dokumentasi foto inventory perusahaan.'
              : 'Pantau dan unduh seluruh riwayat pergerakan dan serah terima inventory.'}
        </p>
      </div>

      {activeTab === 'export_data' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Boxes size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Inventory</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data inventory IT (kode, jenis, status, kelengkapan, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportInventoryOpen(true)}
                disabled={inventoryLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {inventoryLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {inventoryLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Users size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Karyawan</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export data karyawan (NIK, nama, departemen, tanggal masuk, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportKaryawanOpen(true)}
                disabled={karyawanLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {karyawanLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {karyawanLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Tags size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Kategori</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data kategori barang inventory sebagai Excel atau PDF.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportKategoriOpen(true)}
                disabled={kategoriLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {kategoriLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {kategoriLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Building2 size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Departemen</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data departemen sebagai Excel atau PDF.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportDepartemenOpen(true)}
                disabled={departemenLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {departemenLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {departemenLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Landmark size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Cabang</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data cabang (nama, alamat, telepon, link lokasi) sebagai Excel atau PDF.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportCabangOpen(true)}
                disabled={cabangLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {cabangLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {cabangLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Building2 size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Perusahaan</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data perusahaan (nama, alamat, telepon, link) sebagai Excel atau PDF.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportPerusahaanOpen(true)}
                disabled={perusahaanLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {perusahaanLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {perusahaanLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Truck size={18} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Supplier</h3>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">
              Export seluruh data supplier (nama, alamat, telepon) sebagai Excel atau PDF.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExportSupplierOpen(true)}
                disabled={supplierLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                {supplierLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {supplierLoading ? 'Memuat data...' : 'Export Excel'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <ClipboardList size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Pemakai Inventory</h3>
              <p className="text-xs text-slate-500 leading-relaxed flex-1">
                Export riwayat serah-terima & pengembalian inventory (pemakai, status, struk, tanggal, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
              </p>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setExportPemakaiOpen(true)}
                  disabled={pemakaiLoading}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
                >
                  {pemakaiLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {pemakaiLoading ? 'Memuat data...' : 'Export Excel'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'foto_inventory' ? (
        <FotoInventoryTab />
      ) : (
        <RiwayatInventoryTab />
      )}

      <InventoryExportModal open={exportInventoryOpen} onClose={() => setExportInventoryOpen(false)} data={inventoryList} />
      <KaryawanExportModal open={exportKaryawanOpen} onClose={() => setExportKaryawanOpen(false)} data={karyawanList} />
      <KategoriExportModal open={exportKategoriOpen} onClose={() => setExportKategoriOpen(false)} data={kategoriList} />
      <DepartemenExportModal open={exportDepartemenOpen} onClose={() => setExportDepartemenOpen(false)} data={departemenList} />
      <SimpleExportModal
        open={exportCabangOpen}
        onClose={() => setExportCabangOpen(false)}
        data={cabangList}
        title="Data Cabang"
        itemLabel="cabang"
        headers={['Nama', 'Alamat', 'Telepon', 'Link']}
        toRow={(c) => [c.nama, c.alamat || '-', c.telepon || '-', c.link || '-']}
      />
      <SimpleExportModal
        open={exportPerusahaanOpen}
        onClose={() => setExportPerusahaanOpen(false)}
        data={perusahaanList}
        title="Data Perusahaan"
        itemLabel="perusahaan"
        headers={['Nama', 'Alamat', 'Telepon', 'Link']}
        toRow={(p) => [p.nama, p.alamat || '-', p.telepon || '-', p.link || '-']}
      />
      <SimpleExportModal
        open={exportSupplierOpen}
        onClose={() => setExportSupplierOpen(false)}
        data={supplierList}
        title="Data Supplier"
        itemLabel="supplier"
        headers={['Nama', 'Alamat', 'Telepon']}
        toRow={(s) => [s.nama, s.alamat || '-', s.telepon || '-']}
      />
      {isAdmin && (
        <InventoryPemakaiExportModal open={exportPemakaiOpen} onClose={() => setExportPemakaiOpen(false)} data={pemakaiList} />
        
        
      )}
    </>
  );
}