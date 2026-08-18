import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, Download, Loader2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAsetKelengkapan,
  deleteAsetKelengkapan,
  importAsetKelengkapan,
  type AsetKelengkapan,
} from '../../api/asetKelengkapan';
import StatusBadge from '../shared/StatusBadge';
import Pagination from '../shared/Pagination';
import AsetKelengkapanForm from './AsetKelengkapanForm';
import AsetKelengkapanExportModal from './AsetKelengkapanExportModal';

const STATUS_LABEL: Record<string, string> = {
  tersedia: 'Tersedia',
  dipakai: 'Dipakai',
  rusak: 'Rusak',
  diperbaiki: 'Sedang Diperbaiki',
};

const STATUS_STYLE: Record<string, string> = {
  tersedia: 'bg-emerald-50 text-emerald-700',
  dipakai: 'bg-amber-50 text-amber-700',
  rusak: 'bg-red-100 text-red-800',
  diperbaiki: 'bg-orange-50 text-orange-700',
};

export default function TabKelengkapanAset() {
  const [items, setItems] = useState<AsetKelengkapan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination — client-side krn API kelengkapan gak dipaging di backend,
  // style sama kayak pager tabel Aset (10 per halaman).
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AsetKelengkapan | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AsetKelengkapan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteForceAvailable, setDeleteForceAvailable] = useState(false);

  // Import Excel (kelengkapan berdiri sendiri, nempel ke aset induk yang
  // sudah ada) & export Excel/PDF — pola sama kayak TabAset & MasterData.
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAsetKelengkapan();
      setItems(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? 'Anda tidak punya akses ke halaman ini.' : 'Gagal memuat data kelengkapan aset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lastPage = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const pageClamped = Math.min(page, lastPage);
  const pageItems = items.slice((pageClamped - 1) * ITEMS_PER_PAGE, pageClamped * ITEMS_PER_PAGE);

  // Balik ke halaman 1 tiap kali data-nya reload (misal abis tambah/hapus/import)
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const res = await importAsetKelengkapan(file);
      toast.success(res.message || 'Berhasil import data kelengkapan aset.');
      loadData();
    } catch (err: any) {
      const apiErrors: string[] | undefined = err.response?.data?.errors;
      const msg =
        (apiErrors && apiErrors[0]) ||
        err.response?.data?.message ||
        'Gagal import data kelengkapan aset.';
      toast.error(msg);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: AsetKelengkapan) => {
    setEditing(item);
    setFormOpen(true);
  };

  const confirmDelete = async (force = false) => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAsetKelengkapan(deleteTarget.id, force);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteForceAvailable(false);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus kelengkapan.');
      setDeleteForceAvailable(!!err.response?.data?.force_available);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-slate-500">
          Kelola kelengkapan aset (charger, tas, mouse, dll) sebagai item tersendiri — serah-terima
          dan riwayat pemakaiannya dicatat terpisah dari aset utama.
        </p>
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition"
          >
            <Download size={16} />
            Export
          </button>

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
            {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {importLoading ? 'Mengimport...' : 'Import Excel'}
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <Plus size={16} />
            Tambah Kelengkapan
          </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}
        {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada kelengkapan aset.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Kode</th>
                  <th className="px-6 py-3 font-medium">Jenis / Merek</th>
                  <th className="px-6 py-3 font-medium">Aset Induk / Lokasi</th>
                  <th className="px-6 py-3 font-medium">Serial Number</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{item.kode_kelengkapan}</td>
                    <td className="px-6 py-3 text-slate-600">
                      {item.nama || '-'} · {[item.merek, item.tipe].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {item.aset ? (
                        <span className="font-mono text-[13px]">{item.aset.kode_aset}</span>
                      ) : item.lokasiKantor ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <MapPin size={13} className="text-slate-300 shrink-0" />
                          {item.lokasiKantor.nama}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{item.serial_number || '-'}</td>
                    <td className="px-6 py-3">
                      <StatusBadge colorClass={STATUS_STYLE[item.status] || 'bg-slate-100 text-slate-600'}>
                        {STATUS_LABEL[item.status] || item.status}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          title="Edit"
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError('');
                            setDeleteForceAvailable(false);
                            setDeleteTarget(item);
                          }}
                          title="Hapus"
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && items.length > 0 && lastPage > 1 && (
          <div className="px-6 py-3 border-t border-slate-100">
            <Pagination
              currentPage={pageClamped}
              totalPages={lastPage}
              onPageChange={setPage}
              totalItems={items.length}
              itemLabel="kelengkapan"
              className="pt-0 mt-0 border-t-0"
            />
          </div>
        )}
      </div>

      {/* FORM TAMBAH / EDIT */}
      <AsetKelengkapanForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={loadData}
      />

      {/* EXPORT EXCEL/PDF */}
      <AsetKelengkapanExportModal open={exportOpen} onClose={() => setExportOpen(false)} data={items} />

      {/* KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Hapus kelengkapan?</h2>
            <p className="text-sm text-slate-500 mb-3">
              <span className="font-medium text-slate-700">{deleteTarget.kode_kelengkapan}</span> akan dihapus
              permanen beserta riwayatnya, dan tidak bisa dikembalikan.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {deleteError}
                {deleteForceAvailable && ' Item ini punya riwayat, tapi bisa dihapus paksa kalau memang data lama/test.'}
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
    </div>
  );
}