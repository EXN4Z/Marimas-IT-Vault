import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getAsetKelengkapan,
  deleteAsetKelengkapan,
  type AsetKelengkapan,
} from '../../api/asetKelengkapan';
import StatusBadge from '../shared/StatusBadge';
import AsetKelengkapanForm from './AsetKelengkapanForm';

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

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AsetKelengkapan | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AsetKelengkapan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteForceAvailable, setDeleteForceAvailable] = useState(false);

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
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
        >
          <Plus size={16} />
          Tambah Kelengkapan
        </button>
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
                  <th className="px-6 py-3 font-medium">Aset Induk</th>
                  <th className="px-6 py-3 font-medium">Serial Number</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{item.kode_kelengkapan}</td>
                    <td className="px-6 py-3 text-slate-600">
                      {item.nama || '-'} · {[item.merek, item.tipe].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {item.aset ? (
                        <span className="font-mono text-[13px]">{item.aset.kode_aset}</span>
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
      </div>

      {/* FORM TAMBAH / EDIT */}
      <AsetKelengkapanForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={loadData}
      />

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