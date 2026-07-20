import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  X,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Ticket as TicketIcon,
  AlertCircle,
  User as UserIcon,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import {
  getTicketsAktif,
  getTicketsHistory,
  createTicket,
  updateTicketStatus,
  type Ticket,
  type TicketStatus,
} from '../api/ticketing';

type TabKey = 'aktif' | 'history';

const STAFF_ROLES = ['admin', 'hr', 'manajer', 'manager'];

const kategoriOptions = ['IT', 'HR', 'Fasilitas', 'Keuangan', 'Lainnya'];

const statusMeta: Record<
  TicketStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  pending: { label: 'Pending', badge: 'bg-amber-50 text-amber-600', icon: Clock },
  diproses: { label: 'Diproses', badge: 'bg-blue-50 text-blue-600', icon: Loader2 },
  selesai: { label: 'Selesai', badge: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  ditolak: { label: 'Ditolak', badge: 'bg-red-50 text-red-600', icon: XCircle },
};

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTanggal(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function Ticketing() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [ticketsAktif, setTicketsAktif] = useState<Ticket[]>([]);
  const [ticketsHistory, setTicketsHistory] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('aktif');

  // modal buat laporan
  const [createOpen, setCreateOpen] = useState(false);
  const [formJudul, setFormJudul] = useState('');
  const [formKategori, setFormKategori] = useState(kategoriOptions[0]);
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // modal detail / update status
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [catatanAdmin, setCatatanAdmin] = useState('');
  const [updating, setUpdating] = useState<TicketStatus | null>(null);
  const [detailError, setDetailError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [aktif, history] = await Promise.all([getTicketsAktif(), getTicketsHistory()]);
      setTicketsAktif(aktif);
      setTicketsHistory(history);
    } catch (err) {
      setError('Gagal memuat data laporan. Coba refresh halaman.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingCount = ticketsAktif.filter((t) => t.status === 'pending').length;
  const diprosesCount = ticketsAktif.filter((t) => t.status === 'diproses').length;
  const selesaiCount = ticketsHistory.filter((t) => t.status === 'selesai').length;

  const listShown = activeTab === 'aktif' ? ticketsAktif : ticketsHistory;
  const filteredList = useMemo(
    () =>
      listShown.filter(
        (t) =>
          t.judul.toLowerCase().includes(search.toLowerCase()) ||
          (t.kategori ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (t.pelapor?.name ?? '').toLowerCase().includes(search.toLowerCase())
      ),
    [listShown, search]
  );

  const openCreateModal = () => {
    setFormJudul('');
    setFormKategori(kategoriOptions[0]);
    setFormDeskripsi('');
    setFormError('');
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setCreateOpen(false);
  };

  const handleSubmitCreate = async () => {
    if (!formJudul.trim() || !formDeskripsi.trim()) {
      setFormError('Judul dan deskripsi laporan wajib diisi.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const newTicket = await createTicket({
        judul: formJudul.trim(),
        deskripsi: formDeskripsi.trim(),
        kategori: formKategori,
      });
      setTicketsAktif((prev) => [newTicket, ...prev]);
      setActiveTab('aktif');
      setCreateOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal mengirim laporan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (ticket: Ticket) => {
    setDetailTicket(ticket);
    setCatatanAdmin(ticket.catatan_admin ?? '');
    setDetailError('');
  };

  const closeDetail = () => {
    if (updating) return;
    setDetailTicket(null);
    setDetailError('');
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!detailTicket) return;
    setUpdating(status);
    setDetailError('');
    try {
      const updated = await updateTicketStatus(detailTicket.id, {
        status,
        catatan_admin: catatanAdmin.trim() || undefined,
      });

      const isNowDone = updated.status === 'selesai' || updated.status === 'ditolak';

      setTicketsAktif((prev) =>
        isNowDone
          ? prev.filter((t) => t.id !== updated.id)
          : prev.map((t) => (t.id === updated.id ? updated : t))
      );

      if (isNowDone) {
        setTicketsHistory((prev) => [updated, ...prev.filter((t) => t.id !== updated.id)]);
        setActiveTab('history');
        setDetailTicket(null);
      } else {
        setDetailTicket(updated);
      }
    } catch (err: any) {
      setDetailError(err.response?.data?.message || 'Gagal memperbarui status. Coba lagi.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Ticketing">
        <p className="text-sm text-slate-500">Memuat data laporan...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ticketing">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-sm text-slate-500">Buat dan pantau laporan / pengaduan kamu di sini.</p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
        >
          <Plus size={16} />
          Buat Laporan
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 mt-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-400 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-400 mb-1">Diproses</p>
          <p className="text-2xl font-bold text-blue-600">{diprosesCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-400 mb-1">Selesai</p>
          <p className="text-2xl font-bold text-emerald-600">{selesaiCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-400 mb-1">Total Riwayat</p>
          <p className="text-2xl font-bold text-slate-900">{ticketsHistory.length}</p>
        </div>
      </div>

      {/* TABS + SEARCH */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-6 pt-5">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('aktif')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'aktif' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              Sedang / Pending Proses ({ticketsAktif.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              History Laporan ({ticketsHistory.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul / kategori..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-2">
            {filteredList.map((ticket) => {
              const meta = statusMeta[ticket.status];
              const StatusIcon = meta.icon;
              return (
                <button
                  key={ticket.id}
                  onClick={() => openDetail(ticket)}
                  className="text-left flex items-center justify-between border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                      <TicketIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{ticket.judul}</p>
                        {ticket.kategori && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                            {ticket.kategori}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {isStaff && ticket.pelapor ? `${ticket.pelapor.name} · ` : ''}
                        {formatTanggal(ticket.created_at)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${meta.badge}`}
                  >
                    <StatusIcon size={13} className={ticket.status === 'diproses' ? 'animate-spin' : ''} />
                    {meta.label}
                  </span>
                </button>
              );
            })}

            {filteredList.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-10">
                {activeTab === 'aktif' ? 'Belum ada laporan yang sedang berjalan.' : 'Belum ada riwayat laporan.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL BUAT LAPORAN */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Buat Laporan</h3>
              <button onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Judul</label>
                <input
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  maxLength={150}
                  placeholder="Contoh: Printer lantai 2 rusak"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Kategori</label>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {kategoriOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Deskripsi</label>
                <textarea
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Jelaskan detail laporan / kendala kamu..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <button
                onClick={handleSubmitCreate}
                disabled={submitting}
                className="w-full text-white text-sm font-semibold py-3 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-900 hover:bg-slate-800"
              >
                {submitting ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL LAPORAN */}
      {detailTicket && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Detail Laporan</h3>
              <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusMeta[detailTicket.status].badge}`}
              >
                {statusMeta[detailTicket.status].label}
              </span>
              {detailTicket.kategori && (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {detailTicket.kategori}
                </span>
              )}
            </div>

            <h4 className="text-sm font-semibold text-slate-900 mb-1 break-words">{detailTicket.judul}</h4>
            <p className="text-sm text-slate-600 whitespace-pre-line break-words mb-4">{detailTicket.deskripsi}</p>

            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-700 flex-shrink-0">
                {initials(detailTicket.pelapor?.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">Dilaporkan oleh</p>
                <p className="text-sm font-medium text-slate-800 truncate">
                  {detailTicket.pelapor?.name ?? '-'}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400">Tanggal</p>
                <p className="text-xs text-slate-600">{formatTanggal(detailTicket.created_at)}</p>
              </div>
            </div>

            {detailTicket.penanggung_jawab && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                <UserIcon size={14} />
                Ditangani oleh <span className="font-medium text-slate-700">{detailTicket.penanggung_jawab.name}</span>
              </div>
            )}

            {detailTicket.catatan_admin && !isStaff && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Catatan Admin</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{detailTicket.catatan_admin}</p>
              </div>
            )}

            {isStaff && (detailTicket.status === 'pending' || detailTicket.status === 'diproses') && (
              <>
                <div className="mb-4">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Catatan Admin (opsional)
                  </label>
                  <textarea
                    value={catatanAdmin}
                    onChange={(e) => setCatatanAdmin(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Tulis catatan untuk pelapor..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                  />
                </div>

                {detailError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                    {detailError}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {detailTicket.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus('diproses')}
                      disabled={!!updating}
                      className="w-full text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-40 bg-blue-600 hover:bg-blue-700"
                    >
                      {updating === 'diproses' ? 'Memproses...' : 'Tandai Diproses'}
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus('selesai')}
                    disabled={!!updating}
                    className="w-full text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-40 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updating === 'selesai' ? 'Menyimpan...' : 'Tandai Selesai'}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('ditolak')}
                    disabled={!!updating}
                    className="w-full text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-40 bg-slate-100 hover:bg-slate-200"
                  >
                    {updating === 'ditolak' ? 'Menyimpan...' : 'Tolak Laporan'}
                  </button>
                </div>
              </>
            )}

            {isStaff &&
              (detailTicket.status === 'selesai' || detailTicket.status === 'ditolak') &&
              detailTicket.catatan_admin && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Catatan Admin</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{detailTicket.catatan_admin}</p>
                </div>
              )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
