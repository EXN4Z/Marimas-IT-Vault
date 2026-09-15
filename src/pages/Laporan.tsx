import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Users, ClipboardList, Loader2, Download, FileSpreadsheet, Images, History, Tags, Building2, Landmark, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInventory, type Inventory } from '../api/masterData/inventory';
import { karyawanApi, type Karyawan } from '../api/karyawan';
import { getAllInventoryPemakai, type InventoryPemakai } from '../api/transaksi/inventoryPemakai';
import InventoryExportModal from '../components/laporan/InventoryExportModal';
import KaryawanExportModal from '../components/laporan/KaryawanExportModal';
import InventoryPemakaiExportModal from '../components/laporan/InventoryPemakaiExportModal';
import ScrollableTabBar from '../components/shared/ScrollableTabBar';
import TabFotoInventory from '../components/transaksi/TabFotoInventory';
import TabRiwayatInventory from '../components/transaksi/TabRiwayatInventory';
import { getKategori, type Kategori } from '../api/masterData/kategori';
import KategoriExportModal from '../components/laporan/KategoriExportModal';
import { getDepartemen, type Departemen } from '../api/masterData/departemen';
import DepartemenExportModal from '../components/laporan/DepartemenExportModal';
import { getCabang, type Cabang } from '../api/cabang';
import { getPerusahaan, type Perusahaan } from '../api/perusahaan';
import { getSupplier, type Supplier } from '../api/masterData/supplier';
import SimpleExportModal from '../components/laporan/SimpleExportModal';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    return isTabKey(fromUrl) ? fromUrl : 'export_data';
  });

  // ganti tab sekaligus sinkronin ke query param "?tab=" -- SEKARANG semua
  // tab (termasuk 'export_data') selalu nulis query-nya, gak ada
  // pengecualian lagi.
  const setActiveTab = (tab: TabKey) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // kalau user klik link dropdown sidebar yang query-nya beda tapi pathname
  // sama (gak remount komponen), effect ini yang nangkep perubahan query dan
  // update activeTab-nya -- sama pola kayak MasterData.tsx / Inventaris.tsx.
  //
  // REVISI: dulu ada cabang khusus "kalau gak ada query sama sekali ->
  // anggap tab export tanpa nulis balik ke url". Sekarang begitu halaman
  // diakses tanpa query ("/laporan" polos, mis. dari bookmark lama atau link
  // sidebar yang belum diupdate), url-nya DIPAKSA nulis balik jadi
  // "?tab=export_data" lewat setSearchParams (replace, gak nge-reload) biar
  // address bar selalu mencerminkan tab yang lagi aktif, konsisten dengan
  // 2 tab lain.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTabKey(fromUrl)) {
      if (fromUrl !== activeTab) setActiveTabState(fromUrl);
    } else {
      setActiveTabState('export_data');
      setSearchParams({ tab: 'export_data' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [exportInventoryOpen, setExportInventoryOpen] = useState(false);

  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [karyawanLoading, setKaryawanLoading] = useState(true);
  const [exportKaryawanOpen, setExportKaryawanOpen] = useState(false);

  // BARU: kartu export ketiga -- data pemakai inventory (serah-terima &
  // pengembalian), admin only sama kayak endpoint-nya (lihat routes/api.php).
  const [pemakaiList, setPemakaiList] = useState<InventoryPemakai[]>([]);
  const [pemakaiLoading, setPemakaiLoading] = useState(true);
  const [exportPemakaiOpen, setExportPemakaiOpen] = useState(false);
  // tambahan state (taruh dekat state pemakaiList)
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [kategoriLoading, setKategoriLoading] = useState(true);
  const [exportKategoriOpen, setExportKategoriOpen] = useState(false);
  // departemen
  const [departemenList, setDepartemenList] = useState<Departemen[]>([]);
  const [departemenLoading, setDepartemenLoading] = useState(true);
  const [exportDepartemenOpen, setExportDepartemenOpen] = useState(false);
  // BARU: cabang, perusahaan, role, supplier -- sebelumnya cuma bisa
  // diexport dari tab masing-masing di Master Data, sekarang dilengkapi
  // di sini juga biar semua master data punya kartu export di 1 tempat.
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [cabangLoading, setCabangLoading] = useState(true);
  const [exportCabangOpen, setExportCabangOpen] = useState(false);

  const [perusahaanList, setPerusahaanList] = useState<Perusahaan[]>([]);
  const [perusahaanLoading, setPerusahaanLoading] = useState(true);
  const [exportPerusahaanOpen, setExportPerusahaanOpen] = useState(false);

  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [exportSupplierOpen, setExportSupplierOpen] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    getInventory({ posisi: 'induk' })
      .then(setInventoryList)
      .catch(console.error)
      .finally(() => setInventoryLoading(false));

    getKategori()
      .then(setKategoriList)
      .catch(console.error)
      .finally(() => setKategoriLoading(false));

    getDepartemen()
      .then(setDepartemenList)
      .catch(console.error)
      .finally(() => setDepartemenLoading(false));

    karyawanApi
      .getAll()
      .then((res) => setKaryawanList(res.data))
      .catch(console.error)
      .finally(() => setKaryawanLoading(false));

    getCabang()
      .then(setCabangList)
      .catch(console.error)
      .finally(() => setCabangLoading(false));

    getPerusahaan()
      .then(setPerusahaanList)
      .catch(console.error)
      .finally(() => setPerusahaanLoading(false));

    getSupplier()
      .then(setSupplierList)
      .catch(console.error)
      .finally(() => setSupplierLoading(false));
  }, [isStaff]);

  useEffect(() => {
    if (!isAdmin) return;
    getAllInventoryPemakai()
      .then(setPemakaiList)
      .catch(console.error)
      .finally(() => setPemakaiLoading(false));
  }, [isAdmin]);

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
              ? 'Kelola dan unduh dokumentasi foto aset inventory perusahaan.'
              : 'Pantau dan unduh seluruh riwayat pergerakan aset dan serah terima inventory.'}
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
        <TabFotoInventory />
      ) : (
        <TabRiwayatInventory />
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