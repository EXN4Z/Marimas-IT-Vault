import { useEffect, useMemo, useRef, useState } from 'react';
import { HandCoins, Undo2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import AsetFormModal from '../AsetFormModal';
import AsetSerahTerimaModal from '../AsetSerahTerimaModal';
import AsetPengembalianModal from '../AsetPengembalianModal';
import AsetPerbaikanModal from '../AsetPerbaikanModal';
import AsetPerbaikanSelesaiModal from '../AsetPerbaikanSelesaiModal';
import AsetSparepartModal from '../AsetSparepartModal';
import AsetLaporKerusakanModal from '../AsetLaporKerusakanModal';
import AsetDetailModal, { kelengkapanLevel, kelengkapanLevelStyle } from './AsetDetailModal';
import { useAuth } from '../../context/AuthContext';
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
} from '../../api/aset';
import { getJenisAset, type JenisAset } from '../../api/jenisAset';
import { getSupplier, type Supplier } from '../../api/supplier';
import { getKelengkapanMaster, type KelengkapanMaster } from '../../api/kelengkapanMaster';

const ASET_STATUS_LABEL: Record<AsetStatus, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  rusak: 'Rusak',
  diperbaiki: 'Diperbaiki',
};

const ASET_STATUS_STYLE: Record<AsetStatus, string> = {
  tersedia: 'bg-emerald-50 text-emerald-700',
  dipakai: 'bg-amber-50 text-amber-700',
  rusak: 'bg-red-50 text-red-700',
  diperbaiki: 'bg-orange-50 text-orange-700',
};

interface Props {
  search: string;
  onlyMenipis?: boolean;
  onCount?: (count: number) => void;
}

export default function TabAset({ search, onlyMenipis, onCount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [jenisOptions, setJenisOptions] = useState<JenisAset[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [kelengkapanOptions, setKelengkapanOptions] = useState<KelengkapanMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const totalKelengkapanMaster = kelengkapanOptions.length || 3;

  const [expandedJenis, setExpandedJenis] = useState<string | null>(null);
  const [asetFormOpen, setAsetFormOpen] = useState(false);
  const [editingAset, setEditingAset] = useState<Aset | null>(null);
  const [asetDeleteTarget, setAsetDeleteTarget] = useState<Aset | null>(null);
  const [asetDeleting, setAsetDeleting] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Aset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [serahTerimaAset, setSerahTerimaAset] = useState<Aset | null>(null);
  const [pengembalianTarget, setPengembalianTarget] = useState<{ aset: Aset; pemakai: AsetPemakai } | null>(null);
  const [perbaikanAsetTarget, setPerbaikanAsetTarget] = useState<Aset | null>(null);
  const [perbaikanSelesaiTarget, setPerbaikanSelesaiTarget] = useState<{ aset: Aset; perbaikan: AsetPerbaikan } | null>(null);
  const [sparepartAsetTarget, setSparepartAsetTarget] = useState<Aset | null>(null);
  const [laporRusakTarget, setLaporRusakTarget] = useState<Aset | null>(null);
  const [historyActionError, setHistoryActionError] = useState('');

  const loadAset = () => {
    setLoading(true);
    setError('');
    getAset()
      .then(setAsetList)
      .catch((err) => {
        setError('Gagal memuat data aset. Coba refresh halaman.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAset();
    getJenisAset().then(setJenisOptions).catch(() => {});
    getSupplier().then(setSupplierOptions).catch(() => {});
    getKelengkapanMaster().then(setKelengkapanOptions).catch(() => {});
  }, []);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current !== asetList.length) {
      lastCount.current = asetList.length;
      onCount?.(asetList.length);
    }
  }, [asetList, onCount]);

  const asetStokList = useMemo(() => {
    const groups = new Map<string, { jenisNama: string; items: Aset[] }>();
    asetList.forEach((a) => {
      const key = a.jenis?.nama || 'Aset Lainnya';
      if (!groups.has(key)) groups.set(key, { jenisNama: key, items: [] });
      groups.get(key)!.items.push(a);
    });
    return Array.from(groups.entries()).map(([key, { jenisNama, items }]) => {
      const stokTersedia = items.filter((a) => a.status === 'tersedia').length;
      return { key, jenisNama, stok: items.length, stokTersedia, items };
    });
  }, [asetList]);

  const filteredAsetStok = asetStokList
    .filter((g) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        g.jenisNama.toLowerCase().includes(q) ||
        g.items.some(
          (a) =>
            a.kode_aset.toLowerCase().includes(q) ||
            (a.serial_number || '').toLowerCase().includes(q) ||
            (a.merek || '').toLowerCase().includes(q)
        );
      return matchSearch;
    })
    .filter((g) => !onlyMenipis || g.stokTersedia === 0);

  const openAsetDetail = async (id: number) => {
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

  const closeAsetDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  const refreshAsetDetail = async () => {
    if (!detailId) return;
    const data = await getAsetById(detailId);
    setDetail(data);
    setAsetList((prev) => prev.map((a) => (a.id === data.id ? { ...a, status: data.status } : a)));
  };

  const confirmDeleteAset = async () => {
    if (!asetDeleteTarget) return;
    setAsetDeleting(true);
    try {
      await deleteAset(asetDeleteTarget.id);
      setAsetList((prev) => prev.filter((a) => a.id !== asetDeleteTarget.id));
      setAsetDeleteTarget(null);
      if (detailId === asetDeleteTarget.id) closeAsetDetail();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menghapus aset.');
      setAsetDeleteTarget(null);
    } finally {
      setAsetDeleting(false);
    }
  };

  const handleDeletePerbaikanAset = async (id: number) => {
    if (!confirm('Hapus riwayat perbaikan ini?')) return;
    setHistoryActionError('');
    try {
      await deletePerbaikanAset(id);
      await refreshAsetDetail();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat perbaikan.');
    }
  };

  const handleDeleteSparepartAset = async (id: number) => {
    if (!confirm('Hapus riwayat penggantian sparepart ini?')) return;
    setHistoryActionError('');
    try {
      await deletePenggantianSparepart(id);
      await refreshAsetDetail();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat sparepart.');
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Memuat data aset...</p>;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          {onlyMenipis ? 'Aset Stok Menipis' : 'Daftar Aset'}
        </h3>
        {isAdmin && !onlyMenipis && (
          <button
            onClick={() => {
              setEditingAset(null);
              setAsetFormOpen(true);
            }}
            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition"
          >
            <Plus size={16} />
            Tambah Aset
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredAsetStok.map((g) => {
          const isOpen = expandedJenis === g.key;
          return (
            <div key={g.key} className="border border-slate-200 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-3 hover:bg-slate-50 transition cursor-pointer"
                onClick={() => setExpandedJenis(isOpen ? null : g.key)}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">{g.jenisNama}</p>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                        Aset
                      </span>
                      {g.stokTersedia === 0 && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                          Stok menipis
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{g.stok} unit tercatat</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{g.stokTersedia}</p>
                    <p className="text-[11px] text-slate-400">unit</p>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {g.items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-3 py-2 pl-9 hover:bg-slate-50/60 transition">
                      <div className="min-w-0 cursor-pointer" onClick={() => openAsetDetail(a.id)}>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-800">{a.kode_aset}</p>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ASET_STATUS_STYLE[a.status]}`}>
                            {ASET_STATUS_LABEL[a.status]}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${kelengkapanLevelStyle(kelengkapanLevel(a, totalKelengkapanMaster), totalKelengkapanMaster)}`}>
                            Kelengkapan {kelengkapanLevel(a, totalKelengkapanMaster)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {[a.merek, a.tipe].filter(Boolean).join(' ') || '-'} · S/N: {a.serial_number || '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isAdmin && (
                          <>
                            {a.status === 'tersedia' && (
                              <button
                                onClick={() => setSerahTerimaAset(a)}
                                title="Serahkan ke Karyawan"
                                className="h-7 px-2 rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1 hover:bg-slate-200 transition"
                              >
                                <HandCoins size={13} />
                                <span className="text-[11px] font-semibold">Pinjamkan</span>
                              </button>
                            )}
                            {a.status === 'dipakai' && a.pemakaiSaatIni && (
                              <button
                                onClick={() => setPengembalianTarget({ aset: a, pemakai: a.pemakaiSaatIni! })}
                                title="Terima Kembali"
                                className="h-7 px-2 rounded-lg bg-emerald-50 text-emerald-700 flex items-center gap-1 hover:bg-emerald-100 transition"
                              >
                                <Undo2 size={13} />
                                <span className="text-[11px] font-semibold">Kembalikan</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingAset(a);
                                setAsetFormOpen(true);
                              }}
                              title="Edit Aset"
                              className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setAsetDeleteTarget(a)}
                              title="Hapus Aset"
                              className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        {!isAdmin && a.status === 'dipakai' && a.pemakaiSaatIni?.pekerja?.user?.id === user?.id && (
                          <button
                            onClick={() => setLaporRusakTarget(a)}
                            title="Lapor Kerusakan"
                            className="h-7 px-2 rounded-lg bg-red-50 text-red-700 flex items-center gap-1 hover:bg-red-100 transition"
                          >
                            <Wrench size={13} />
                            <span className="text-[11px] font-semibold">Lapor Rusak</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredAsetStok.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            {onlyMenipis ? 'Tidak ada aset dengan stok menipis.' : 'Aset tidak ditemukan.'}
          </p>
        )}
      </div>

      {asetFormOpen && (
        <AsetFormModal
          aset={editingAset}
          jenisOptions={jenisOptions}
          supplierOptions={supplierOptions}
          kelengkapanOptions={kelengkapanOptions}
          onClose={() => setAsetFormOpen(false)}
          onSaved={(saved) => {
            setAsetList((prev) => {
              const exists = prev.some((a) => a.id === saved.id);
              return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
            });
            setAsetFormOpen(false);
            if (detailId === saved.id) refreshAsetDetail();
          }}
        />
      )}

      {asetDeleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Hapus aset?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-medium text-slate-700">{asetDeleteTarget.kode_aset}</span> akan dihapus
              permanen beserta riwayatnya, dan tidak bisa dikembalikan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAsetDeleteTarget(null)}
                disabled={asetDeleting}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteAset}
                disabled={asetDeleting}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {asetDeleting ? 'Menghapus...' : 'Ya, hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId && (
        <AsetDetailModal
          detail={detail}
          detailLoading={detailLoading}
          isAdmin={isAdmin}
          isPemakaiAktif={detail?.pemakaiSaatIni?.pekerja?.user?.id === user?.id}
          totalKelengkapanMaster={totalKelengkapanMaster}
          historyActionError={historyActionError}
          onClose={closeAsetDetail}
          onSerahTerima={setSerahTerimaAset}
          onTerimaKembali={(aset) => aset.pemakaiSaatIni && setPengembalianTarget({ aset, pemakai: aset.pemakaiSaatIni })}
          onLaporKerusakan={setPerbaikanAsetTarget}
          onLaporRusakPeminjam={setLaporRusakTarget}
          onCatatSparepart={setSparepartAsetTarget}
          onTandaiSelesaiPerbaikan={(aset, perbaikan) => setPerbaikanSelesaiTarget({ aset, perbaikan })}
          onHapusPerbaikan={handleDeletePerbaikanAset}
          onHapusSparepart={handleDeleteSparepartAset}
        />
      )}

      {serahTerimaAset && (
        <AsetSerahTerimaModal
          aset={serahTerimaAset}
          onClose={() => setSerahTerimaAset(null)}
          onSuccess={() => {
            setSerahTerimaAset(null);
            loadAset();
            if (detailId) refreshAsetDetail();
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
            loadAset();
            if (detailId) refreshAsetDetail();
          }}
        />
      )}

      {perbaikanAsetTarget && (
        <AsetPerbaikanModal
          aset={perbaikanAsetTarget}
          onClose={() => setPerbaikanAsetTarget(null)}
          onSuccess={() => {
            setPerbaikanAsetTarget(null);
            loadAset();
            if (detailId) refreshAsetDetail();
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
            loadAset();
            if (detailId) refreshAsetDetail();
          }}
        />
      )}

      {sparepartAsetTarget && (
        <AsetSparepartModal
          aset={sparepartAsetTarget}
          onClose={() => setSparepartAsetTarget(null)}
          onSuccess={() => {
            setSparepartAsetTarget(null);
            loadAset();
            if (detailId) refreshAsetDetail();
          }}
        />
      )}

      {laporRusakTarget && (
        <AsetLaporKerusakanModal
          aset={laporRusakTarget}
          onClose={() => setLaporRusakTarget(null)}
          onSuccess={() => {
            setLaporRusakTarget(null);
          }}
        />
      )}
    </div>
  );
}