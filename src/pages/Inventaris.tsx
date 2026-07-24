import { useCallback, useEffect, useState, type JSX } from 'react';
import { Package, HandCoins, Undo2, Search, X, AlertTriangle, ScanLine, ClipboardList, Wrench } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import ScanQrModal from '../components/ScanQrModal';
import PeminjamanModal from '../components/PeminjamanModal';
import TabBarang from '../components/inventaris/TabBarang';
import TabAset from '../components/inventaris/TabAset';
import TabStokMenipis from '../components/inventaris/TabStokMenipis';
import TabKelengkapanAset from '../components/inventaris/TabKelengkapanAset';
import TabPenangananAset from '../components/inventaris/TabPenangananAset';
import TabPersetujuanAset from '../components/inventaris/TabPersetujuanAset';
import { useAuth } from '../context/AuthContext';
import { getBarangByKode, type Barang } from '../api/barang';
import { getRiwayatPeminjaman, type Peminjaman } from '../api/peminjaman';
import { getRiwayatAset, type RiwayatAsetEvent } from '../api/aset';

function formatWaktu(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

type TabKey = 'barang' | 'aset' | 'stok_menipis' | 'kelengkapan_aset' | 'penanganan_aset' | 'persetujuan_aset';

export default function Inventaris() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabKey>('barang');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Partial<Record<TabKey, number>>>({});

  const refreshRiwayatAset = useCallback(() => {
    if (!isAdmin) {
      setRiwayatAsetLoading(false);
      return;
    }
    setRiwayatAsetLoading(true);
    getRiwayatAset(10)
      .then(setRiwayatAset)
      .catch(console.error)
      .finally(() => setRiwayatAsetLoading(false));
  }, [isAdmin]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'aset') refreshRiwayatAset();
  };

  const [riwayat, setRiwayat] = useState<Peminjaman[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(true);

  const [riwayatAset, setRiwayatAset] = useState<RiwayatAsetEvent[]>([]);
  const [riwayatAsetLoading, setRiwayatAsetLoading] = useState(true);

  const [peminjamanBarang, setPeminjamanBarang] = useState<Barang | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lookingUpBarang, setLookingUpBarang] = useState(false);

  useEffect(() => {
    // /peminjaman dibatasi backend ke role admin — karyawan biasa skip fetch ini
    // biar gak nembak endpoint yang emang gak diizinkan (403).
    if (!isAdmin) {
      setRiwayatLoading(false);
      return;
    }
    setRiwayatLoading(true);
    getRiwayatPeminjaman(10)
      .then(setRiwayat)
      .catch(console.error)
      .finally(() => setRiwayatLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    // /aset-pemakai/riwayat juga dibatasi ke role admin
    refreshRiwayatAset();
  }, [refreshRiwayatAset]);

  // stabil: hindari infinite loop di child (onCount di deps useEffect anak)
  const updateCount = useCallback((key: TabKey, n: number) => {
    setCounts((c) => (c[key] === n ? c : { ...c, [key]: n }));
  }, []);

  const handleCountBarang = useCallback((n: number) => updateCount('barang', n), [updateCount]);
  const handleCountAset = useCallback((n: number) => updateCount('aset', n), [updateCount]);
  const handleCountPenanganan = useCallback((n: number) => updateCount('penanganan_aset', n), [updateCount]);
  const handleCountPersetujuan = useCallback((n: number) => updateCount('persetujuan_aset', n), [updateCount]);

  const handleScanSuccess = async (kodeBarang: string) => {
    setScanError('');
    setLookingUpBarang(true);
    try {
      const found = await getBarangByKode(kodeBarang);
      setPeminjamanBarang(found);
      setScannerOpen(false);
    } catch (err: any) {
      setScanError(err.response?.data?.message || `Kode "${kodeBarang}" tidak dikenali sebagai barang.`);
    } finally {
      setLookingUpBarang(false);
    }
  };

  const handlePeminjamanBaru = (list: Peminjaman[]) => {
    setRiwayat((prev) => [...list, ...prev].slice(0, 10));
  };

  const tabs: { key: TabKey; label: string; icon: typeof Package; adminOnly?: boolean }[] = [
    { key: 'barang', label: 'Barang', icon: Package },
    { key: 'aset', label: 'Aset', icon: Package },
    { key: 'stok_menipis', label: 'Stok Menipis', icon: AlertTriangle },
    { key: 'kelengkapan_aset', label: 'Kelengkapan Aset', icon: ClipboardList },
    { key: 'persetujuan_aset', label: 'Persetujuan Aset', icon: HandCoins, adminOnly: true },
    { key: 'penanganan_aset', label: 'Penanganan Aset', icon: Wrench, adminOnly: true },
  ];

  const showSearchableGrid = activeTab === 'barang' || activeTab === 'aset' || activeTab === 'stok_menipis';

  return (
    <AppLayout title="Inventaris">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <p className="text-sm text-slate-500">Kelola aset IT</p>
        <button
          onClick={() => {
            setScanError('');
            setScannerOpen(true);
          }}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
        >
          <ScanLine size={16} />
          Scan QR
        </button>
      </div>

      <nav className="mb-6">
        <ul className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
          {tabs
            .filter((t) => !t.adminOnly || isAdmin)
            .map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => handleTabChange(t.key)}
                  className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    activeTab === t.key
                      ? 'border-slate-900 text-slate-900 font-medium'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                  {counts[t.key] != null && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        t.key === 'stok_menipis' || t.key === 'penanganan_aset' || t.key === 'persetujuan_aset'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {counts[t.key]}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </nav>

      {scanError && (
        <div className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
          <span>{scanError}</span>
          <button onClick={() => setScanError('')} className="text-amber-500 hover:text-amber-700">
            <X size={16} />
          </button>
        </div>
      )}

      {showSearchableGrid && activeTab === 'aset' ? (
        <div className="flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang, kode, atau jenis aset..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none"
            />
          </div>

          <TabAset search={search} onCount={handleCountAset} />

          {/* RIWAYAT ASET — sementara ditaruh di bawah tabel (bukan di samping)
              soalnya tabel aset kolomnya banyak, kalau dipepetin sidebar jadi
              kesempitan/ke-scroll horizontal terus. Admin only. */}
          {isAdmin && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                Riwayat Aset <span className="text-slate-400 font-normal">({riwayatAset.length})</span>
              </h3>
              {riwayatAsetLoading ? (
                <p className="text-sm text-slate-400 text-center py-6">Memuat riwayat...</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {riwayatAset.map((ev, idx) => {
                    const style: Record<RiwayatAsetEvent['type'], { bg: string; icon: JSX.Element; label: string }> = {
                      pinjam: { bg: 'bg-amber-50 text-amber-600', icon: <HandCoins size={16} />, label: 'menerima' },
                      kembali: { bg: 'bg-emerald-50 text-emerald-600', icon: <Undo2 size={16} />, label: 'mengembalikan' },
                      lapor_rusak: { bg: 'bg-red-50 text-red-600', icon: <AlertTriangle size={16} />, label: 'melaporkan kerusakan' },
                      selesai_perbaikan: { bg: 'bg-sky-50 text-sky-600', icon: <Wrench size={16} />, label: 'selesai diperbaiki' },
                    };
                    const s = style[ev.type];
                    const kode = ev.aset?.kode_aset || '-';
                    return (
                      <li key={`${ev.type}-${idx}`} className="flex items-start gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                          {s.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800">
                            {ev.nama ? <span className="font-medium">{ev.nama} </span> : ''}
                            {s.label} <span className="font-medium">{kode}</span>
                          </p>
                          <p className="text-xs text-slate-400">{formatWaktu(ev.waktu)}</p>
                        </div>
                      </li>
                    );
                  })}
                  {riwayatAset.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">Belum ada aktivitas aset.</p>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : showSearchableGrid ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama barang, kode, atau jenis aset..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none"
              />
            </div>

            {activeTab === 'barang' && <TabBarang search={search} onCount={handleCountBarang} />}
            {activeTab === 'stok_menipis' && <TabStokMenipis search={search} />}
          </div>

          {/* RIWAYAT PEMINJAMAN BARANG — admin only, tab barang/stok_menipis */}
          {isAdmin && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 h-fit">
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                Riwayat <span className="text-slate-400 font-normal">({riwayat.length})</span>
              </h3>
              {riwayatLoading ? (
                <p className="text-sm text-slate-400 text-center py-6">Memuat riwayat...</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {riwayat.map((p) => {
                    const dikembalikan = p.status === 'dikembalikan';
                    const waktu = dikembalikan ? p.tanggal_kembali_aktual! : p.tanggal_pinjam;
                    return (
                      <li key={p.id} className="flex items-start gap-3">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            dikembalikan ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {dikembalikan ? <Undo2 size={16} /> : <HandCoins size={16} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800">
                            <span className="font-medium">{p.user?.name || '-'}</span>{' '}
                            {dikembalikan ? 'mengembalikan' : 'meminjam'} <span className="font-medium">{p.jumlah}</span> pcs
                          </p>
                          <p className="text-xs text-slate-400">{formatWaktu(waktu)}</p>
                        </div>
                      </li>
                    );
                  })}
                  {riwayat.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">Belum ada riwayat peminjaman.</p>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'kelengkapan_aset' ? (
        <TabKelengkapanAset />
      ) : activeTab === 'persetujuan_aset' ? (
        <TabPersetujuanAset onCount={handleCountPersetujuan} />
      ) : (
        <TabPenangananAset onCount={handleCountPenanganan} />
      )}

      {peminjamanBarang && (
        <PeminjamanModal
          barang={peminjamanBarang}
          onClose={() => setPeminjamanBarang(null)}
          onBarangUpdate={(updated) => setPeminjamanBarang(updated)}
          onPeminjamanBaru={handlePeminjamanBaru}
        />
      )}

      {scannerOpen && (
        <ScanQrModal onClose={() => setScannerOpen(false)} onScanSuccess={handleScanSuccess} isProcessing={lookingUpBarang} />
      )}
    </AppLayout>
  );
}