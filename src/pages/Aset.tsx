import { useEffect, useState } from 'react';
import { Boxes, Plus, Search, X, Pencil, Trash2, HandCoins, Undo2, ImageOff, Wrench, CheckCircle2, Cog } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import AsetFormModal from '../components/AsetFormModal';
import AsetSerahTerimaModal from '../components/AsetSerahTerimaModal';
import AsetPengembalianModal from '../components/AsetPengembalianModal';
import AsetPerbaikanModal from '../components/AsetPerbaikanModal';
import AsetPerbaikanSelesaiModal from '../components/AsetPerbaikanSelesaiModal';
import AsetSparepartModal from '../components/AsetSparepartModal';
import { useAuth } from '../context/AuthContext';
import {
  getAset,
  getAsetById,
  deleteAset,
  deletePerbaikanAset,
  deletePenggantianSparepart,
  type Aset,
  type AsetStatus,
  type AsetPemakai,
  type AsetPerbaikan,
} from '../api/aset';
import { getJenisAset, type JenisAset } from '../api/jenisAset';
import { getSupplier, type Supplier } from '../api/supplier';
import { getKelengkapanMaster, type KelengkapanMaster } from '../api/kelengkapanMaster';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

const STATUS_LABEL: Record<AsetStatus, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  rusak: 'Rusak',
  diperbaiki: 'Diperbaiki',
};

const STATUS_STYLE: Record<AsetStatus, string> = {
  tersedia: 'bg-emerald-50 text-emerald-700',
  dipakai: 'bg-amber-50 text-amber-700',
  rusak: 'bg-red-50 text-red-700',
  diperbaiki: 'bg-orange-50 text-orange-700',
};

function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function AsetPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [jenisOptions, setJenisOptions] = useState<JenisAset[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [kelengkapanOptions, setKelengkapanOptions] = useState<KelengkapanMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AsetStatus | ''>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingAset, setEditingAset] = useState<Aset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Aset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Aset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [serahTerimaAset, setSerahTerimaAset] = useState<Aset | null>(null);
  const [pengembalianTarget, setPengembalianTarget] = useState<{ aset: Aset; pemakai: AsetPemakai } | null>(null);

  const [perbaikanAsetTarget, setPerbaikanAsetTarget] = useState<Aset | null>(null);
  const [perbaikanSelesaiTarget, setPerbaikanSelesaiTarget] = useState<{ aset: Aset; perbaikan: AsetPerbaikan } | null>(null);
  const [sparepartAsetTarget, setSparepartAsetTarget] = useState<Aset | null>(null);
  const [historyActionError, setHistoryActionError] = useState('');

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

  useEffect(() => {
    loadList();
    getJenisAset().then(setJenisOptions).catch(() => {});
    getSupplier().then(setSupplierOptions).catch(() => {});
    getKelengkapanMaster().then(setKelengkapanOptions).catch(() => {});
  }, []);

  const openDetail = async (id: number) => {
    setDetailId(id);
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAset(deleteTarget.id);
      setAsetList((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (detailId === deleteTarget.id) closeDetail();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menghapus aset.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeletePerbaikan = async (id: number) => {
    if (!confirm('Hapus riwayat perbaikan ini?')) return;
    setHistoryActionError('');
    try {
      await deletePerbaikanAset(id);
      await refreshDetail();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat perbaikan.');
    }
  };

  const handleDeleteSparepart = async (id: number) => {
    if (!confirm('Hapus riwayat penggantian sparepart ini?')) return;
    setHistoryActionError('');
    try {
      await deletePenggantianSparepart(id);
      await refreshDetail();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat sparepart.');
    }
  };

  const filteredAset = asetList.filter((a) => {
    const matchStatus = !statusFilter || a.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      a.kode_aset.toLowerCase().includes(q) ||
      (a.serial_number || '').toLowerCase().includes(q) ||
      (a.merek || '').toLowerCase().includes(q) ||
      (a.tipe || '').toLowerCase().includes(q) ||
      (a.jenis?.nama || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <AppLayout title="Aset">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-slate-500">
          Kelola aset IT per-unit (laptop, monitor, dsb) — serah-terima ke karyawan dan riwayatnya.
        </p>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingAset(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
          >
            <Plus size={16} />
            Tambah Aset
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode aset, merek, tipe, serial number..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AsetStatus | '')}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">Semua Status</option>
          {(Object.keys(STATUS_LABEL) as AsetStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}
        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && filteredAset.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada aset.</p>
        )}

        {!loading && !error && filteredAset.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Kode Aset</th>
                  <th className="px-6 py-3 font-medium">Jenis</th>
                  <th className="px-6 py-3 font-medium">Merek / Tipe</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Dipakai Oleh</th>
                  <th className="px-6 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredAset.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition cursor-pointer"
                    onClick={() => openDetail(a.id)}
                  >
                    <td className="px-6 py-3 font-medium text-slate-800">{a.kode_aset}</td>
                    <td className="px-6 py-3 text-slate-600">{a.jenis?.nama || '-'}</td>
                    <td className="px-6 py-3 text-slate-600">{[a.merek, a.tipe].filter(Boolean).join(' ') || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{a.pemakaiSaatIni?.pekerja?.user?.name || '-'}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && (
                          <>
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
                              onClick={() => setDeleteTarget(a)}
                              title="Hapus"
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM TAMBAH / EDIT ASET */}
      {formOpen && (
        <AsetFormModal
          aset={editingAset}
          jenisOptions={jenisOptions}
          supplierOptions={supplierOptions}
          kelengkapanOptions={kelengkapanOptions}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Hapus aset?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-medium text-slate-700">{deleteTarget.kode_aset}</span> akan dihapus permanen
              beserta riwayatnya, dan tidak bisa dikembalikan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL ASET */}
      {detailId && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
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
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-2 ${STATUS_STYLE[detail.status]}`}>
                      {STATUS_LABEL[detail.status]}
                    </span>
                    <p className="text-sm text-slate-800 font-medium">{[detail.merek, detail.tipe].filter(Boolean).join(' ') || '-'}</p>
                    <p className="text-xs text-slate-400">{detail.jenis?.nama || '-'} · {detail.warna || '-'}</p>
                    <p className="text-xs text-slate-400">S/N: {detail.serial_number || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
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
                    {detail.status === 'dipakai' && detail.pemakaiSaatIni && (
                      <button
                        onClick={() => setPengembalianTarget({ aset: detail, pemakai: detail.pemakaiSaatIni! })}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                      >
                        <Undo2 size={14} />
                        Terima Kembali
                      </button>
                    )}
                    {(detail.status === 'tersedia' || detail.status === 'dipakai') && (
                      <button
                        onClick={() => setPerbaikanAsetTarget(detail)}
                        className="flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-100 transition"
                      >
                        <Wrench size={14} />
                        Lapor Kerusakan
                      </button>
                    )}
                    <button
                      onClick={() => setSparepartAsetTarget(detail)}
                      className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-200 transition"
                    >
                      <Cog size={14} />
                      Catat Sparepart
                    </button>
                  </div>
                )}

                {/* KELENGKAPAN */}
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-2">Kelengkapan</p>
                  <div className="flex flex-col gap-1.5">
                    {(detail.kelengkapan || []).map((k) => (
                      <div key={k.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="text-slate-700">{k.kelengkapan_master?.nama}</span>
                        {k.keterangan && <span className="text-xs text-slate-400">{k.keterangan}</span>}
                      </div>
                    ))}
                    {!detail.kelengkapan?.length && (
                      <p className="text-xs text-slate-400">Belum ada kelengkapan tercatat.</p>
                    )}
                  </div>
                </div>

                {/* RIWAYAT PEMAKAI / PEMINJAMAN */}
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-2">Riwayat Pemakai (Peminjaman)</p>
                  <ul className="flex flex-col gap-2">
                    {(detail.pemakai || []).map((p) => (
                      <li key={p.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-slate-800">{p.pekerja?.user?.name || '-'}</span>{' '}
                        <span className="text-slate-500">
                          — {formatTanggalId(p.tanggal_penerimaan)}
                          {p.tanggal_pengembalian ? ` s/d ${formatTanggalId(p.tanggal_pengembalian)}` : ' (masih dipakai)'}
                        </span>
                        {p.catatan_penerimaan && (
                          <p className="text-slate-400 mt-0.5">Terima: {p.catatan_penerimaan}</p>
                        )}
                        {p.catatan_pengembalian && (
                          <p className="text-slate-400 mt-0.5">Kembali: {p.catatan_pengembalian}</p>
                        )}
                      </li>
                    ))}
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
                  <ul className="flex flex-col gap-2">
                    {(detail.perbaikan || []).map((p) => (
                      <li key={p.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium mb-1 ${
                                p.status === 'selesai' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                              }`}
                            >
                              {p.status === 'selesai' ? 'Selesai' : 'Proses'}
                            </span>
                            <p className="text-slate-700">{p.keterangan_kerusakan}</p>
                            <p className="text-slate-400 mt-0.5">
                              {formatTanggalId(p.tanggal_perbaikan)}
                              {p.tanggal_selesai ? ` s/d ${formatTanggalId(p.tanggal_selesai)}` : ''}
                              {p.teknisi_vendor ? ` · ${p.teknisi_vendor}` : ''}
                              {p.biaya != null ? ` · ${formatRupiah(p.biaya)}` : ''}
                            </p>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {p.status === 'proses' && (
                                <button
                                  onClick={() => setPerbaikanSelesaiTarget({ aset: detail, perbaikan: p })}
                                  title="Tandai selesai"
                                  className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 transition"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePerbaikan(p.id)}
                                title="Hapus"
                                className="p-1.5 rounded-md text-red-500 hover:bg-red-100 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                    {!detail.perbaikan?.length && (
                      <p className="text-xs text-slate-400">Belum ada riwayat perbaikan.</p>
                    )}
                  </ul>
                </div>

                {/* RIWAYAT PENGGANTIAN SPAREPART */}
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-2">Riwayat Penggantian Sparepart</p>
                  <ul className="flex flex-col gap-2">
                    {(detail.penggantianSparepart || []).map((s) => (
                      <li key={s.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-800">{s.nama_sparepart}</span>{' '}
                          <span className="text-slate-500">— {formatTanggalId(s.tanggal)}</span>
                          {s.keterangan && <p className="text-slate-400 mt-0.5">{s.keterangan}</p>}
                          {s.biaya != null && <p className="text-slate-400 mt-0.5">{formatRupiah(s.biaya)}</p>}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSparepart(s.id)}
                            title="Hapus"
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-100 transition flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                    {!detail.penggantianSparepart?.length && (
                      <p className="text-xs text-slate-400">Belum ada riwayat penggantian sparepart.</p>
                    )}
                  </ul>
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
          onSuccess={() => {
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
          onClose={() => setPengembalianTarget(null)}
          onSuccess={() => {
            setPengembalianTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {perbaikanAsetTarget && (
        <AsetPerbaikanModal
          aset={perbaikanAsetTarget}
          onClose={() => setPerbaikanAsetTarget(null)}
          onSuccess={() => {
            setPerbaikanAsetTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {perbaikanSelesaiTarget && (
        <AsetPerbaikanSelesaiModal
          aset={perbaikanSelesaiTarget.aset}
          perbaikan={perbaikanSelesaiTarget.perbaikan}
          onClose={() => setPerbaikanSelesaiTarget(null)}
          onSuccess={() => {
            setPerbaikanSelesaiTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}

      {sparepartAsetTarget && (
        <AsetSparepartModal
          aset={sparepartAsetTarget}
          onClose={() => setSparepartAsetTarget(null)}
          onSuccess={() => {
            setSparepartAsetTarget(null);
            loadList();
            if (detailId) refreshDetail();
          }}
        />
      )}
    </AppLayout>
  );
}