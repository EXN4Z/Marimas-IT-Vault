import { X, Boxes, HandCoins, Undo2, Wrench, Cog, CheckCircle2, ImageOff, Trash2 } from 'lucide-react';
import { type Aset, type AsetStatus, type AsetPerbaikan } from '../../api/aset';

const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/storage/';

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

export function kelengkapanLevel(aset: Aset, totalMaster: number): number {
  const jumlah = aset.kelengkapan?.length || 0;
  return Math.max(0, Math.min(jumlah, totalMaster));
}

export function kelengkapanLevelStyle(level: number, totalMaster: number): string {
  if (level >= totalMaster) return 'bg-emerald-50 text-emerald-700';
  if (level === totalMaster - 1) return 'bg-amber-50 text-amber-700';
  if (level === totalMaster - 2) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

export function kelengkapanLevelLabel(level: number, totalMaster: number): string {
  const kurang = totalMaster - level;
  if (kurang <= 0) return `Lengkap (${level})`;
  return `Kurang ${kurang} (${level})`;
}

export function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}

interface Props {
  detail: Aset | null;
  detailLoading: boolean;
  isAdmin: boolean;
  isPemakaiAktif: boolean;
  totalKelengkapanMaster: number;
  historyActionError: string;
  onClose: () => void;
  onSerahTerima: (aset: Aset) => void;
  onTerimaKembali: (aset: Aset) => void;
  onLaporKerusakan: (aset: Aset) => void;
  onLaporRusakPeminjam: (aset: Aset) => void;
  onPinjam: (aset: Aset) => void;
  onCatatSparepart: (aset: Aset) => void;
  onTandaiSelesaiPerbaikan: (aset: Aset, perbaikan: AsetPerbaikan) => void;
  onHapusPerbaikan: (id: number) => void;
  onHapusSparepart: (id: number) => void;
}

export default function AsetDetailModal({
  detail,
  detailLoading,
  isAdmin,
  isPemakaiAktif,
  totalKelengkapanMaster,
  historyActionError,
  onClose,
  onSerahTerima,
  onTerimaKembali,
  onLaporKerusakan,
  onLaporRusakPeminjam,
  onPinjam,
  onCatatSparepart,
  onTandaiSelesaiPerbaikan,
  onHapusPerbaikan,
  onHapusSparepart,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Boxes size={18} className="text-slate-400" />
            {detail?.kode_aset || 'Memuat...'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${ASET_STATUS_STYLE[detail.status]}`}>
                    {ASET_STATUS_LABEL[detail.status]}
                  </span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${kelengkapanLevelStyle(kelengkapanLevel(detail, totalKelengkapanMaster), totalKelengkapanMaster)}`}>
                    Kelengkapan {kelengkapanLevelLabel(kelengkapanLevel(detail, totalKelengkapanMaster), totalKelengkapanMaster)}
                  </span>
                </div>
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

            <div className="flex flex-wrap gap-2">
              {isAdmin && detail.status === 'tersedia' && (
                <button
                  onClick={() => onSerahTerima(detail)}
                  className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-800 transition"
                >
                  <HandCoins size={14} />
                  Serahkan ke Karyawan
                </button>
              )}
              {isAdmin && detail.status === 'dipakai' && detail.pemakaiSaatIni && (
                <button
                  onClick={() => onTerimaKembali(detail)}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  <Undo2 size={14} />
                  Terima Kembali
                </button>
              )}
              {isAdmin && (detail.status === 'tersedia' || detail.status === 'dipakai') && (
                <button
                  onClick={() => onLaporKerusakan(detail)}
                  className="flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-100 transition"
                >
                  <Wrench size={14} />
                  Lapor Kerusakan
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => onCatatSparepart(detail)}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-200 transition"
                >
                  <Cog size={14} />
                  Catat Sparepart
                </button>
              )}
              {!isAdmin && detail.status === 'dipakai' && isPemakaiAktif && (
                <button
                  onClick={() => onLaporRusakPeminjam(detail)}
                  className="flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-100 transition"
                >
                  <Wrench size={14} />
                  Lapor Rusak
                </button>
              )}
              {!isAdmin && detail.status === 'tersedia' && !detail.pemakaiPending?.length && (
                <button
                  onClick={() => onPinjam(detail)}
                  className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-800 transition"
                >
                  <HandCoins size={14} />
                  Pinjam Aset
                </button>
              )}
              {!isAdmin && detail.status === 'tersedia' && !!detail.pemakaiPending?.length && (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-2 rounded-lg">
                  <HandCoins size={14} />
                  Menunggu persetujuan admin
                </span>
              )}
            </div>

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
                    {p.catatan_penerimaan && <p className="text-slate-400 mt-0.5">Terima: {p.catatan_penerimaan}</p>}
                    {p.catatan_pengembalian && <p className="text-slate-400 mt-0.5">Kembali: {p.catatan_pengembalian}</p>}
                  </li>
                ))}
                {!detail.pemakai?.length && <p className="text-xs text-slate-400">Belum ada riwayat pemakai.</p>}
              </ul>
            </div>

            {historyActionError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {historyActionError}
              </p>
            )}

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
                              onClick={() => onTandaiSelesaiPerbaikan(detail, p)}
                              title="Tandai selesai"
                              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-100 transition"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => onHapusPerbaikan(p.id)}
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
                {!detail.perbaikan?.length && <p className="text-xs text-slate-400">Belum ada riwayat perbaikan.</p>}
              </ul>
            </div>

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
                        onClick={() => onHapusSparepart(s.id)}
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
  );
}