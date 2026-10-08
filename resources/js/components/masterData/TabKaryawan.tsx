import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useNavigate, useLocation } from '../../lib/router';
import toast from 'react-hot-toast';
import { Download, Upload, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { importKaryawan } from '../../api/auth';
import ScrollableTabBar from '../shared/ScrollableTabBar';
import Pagination from '../shared/Pagination';
import Tooltip from '../shared/Tooltip';
import SearchInput from '../shared/SearchInput';
import { SkeletonTable } from '../shared/skeleton';
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal';
import KaryawanExportModal from '../laporan/KaryawanExportModal';
import { type Karyawan } from '../../api/masterData/karyawan';

type TabKey = 'semua' | 'user' | 'admin';

// Sama shape persis dengan tipe Karyawan di api/karyawan.ts (dipakai bareng
// KaryawanExportModal, lihat tombol Export di bawah) -- dulu didefinisikan
// ulang di sini secara terpisah, sekarang di-alias langsung biar gak
// nyimpang dan export-nya gak perlu mapping/cast apapun.
type User = Karyawan;

const roleStyles: Record<string, string> = {
    admin: 'bg-red-50 text-red-700',
    user: 'bg-teal-50 text-teal-700',
};
const defaultRoleStyle = 'bg-slate-50 text-slate-700';

// status kosong (data lama / belum ke-load) dianggap aktif, sama seperti
// default di database.
function StatusBadge({ status, small = false }: { status?: string; small?: boolean }) {
    const nonaktif = status === 'nonaktif';
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
                small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
            } ${nonaktif ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}
        >
            {/* Ukuran titik nonaktif sengaja w-[7px] h-[7px], BUKAN w-1.5 h-1.5:
                di index.css ada rule dark mode yang maksa semua .w-1.5.h-1.5.rounded-full
                jadi hijau (!important) buat indikator "online", jadi titik nonaktif
                ikut ke-hijau-in kalau pakai ukuran itu. */}
            <span className={nonaktif ? 'w-[7px] h-[7px] rounded-full bg-red-500' : 'w-1.5 h-1.5 rounded-full bg-emerald-500'} />
            {nonaktif ? 'Nonaktif' : 'Aktif'}
        </span>
    );
}

const roleLabels: Record<string, string> = {
    admin: 'Admin',
    user: 'User',
};

const tabs: { key: TabKey; label: string; icon: JSX.Element }[] = [
    {
        key: 'semua',
        label: 'Semua',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a4 4 0 10-8 0" />
            </svg>
        ),
    },
    {
        key: 'user',
        label: 'User',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        key: 'admin',
        label: 'Admin',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
];

function initials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// Dipindah dari halaman /karyawan (Karyawan.tsx) -- sekarang jadi tab
// "Data User" di dalam Master Data, sepola sama tab Inventory/Kategori/dst
// (lihat MasterData.tsx). Route /karyawan lama di-redirect ke sini.
export default function TabKaryawan() {
    const navigate = useNavigate();
    const location = useLocation();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [currentRole, setCurrentRole] = useState<string | null>(null);

    const [search, setSearch] = useState<string>('');
    const [activeTab, setActiveTab] = useState<TabKey>('semua');
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 10;

    // BARU: state untuk import Excel karyawan
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState<boolean>(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSuccessMsg, setImportSuccessMsg] = useState<string>('');
    const [showImportModal, setShowImportModal] = useState<boolean>(false);

    // Modal export (Excel/PDF) -- komponennya sudah ada & dipakai di halaman
    // Laporan, di sini dipasang ulang biar bisa export langsung dari tab
    // "Data User" tanpa pindah halaman.
    const [showExportModal, setShowExportModal] = useState<boolean>(false);

    function loadUsers() {
        setLoading(true);
        api
            .get<User[]>('/karyawan')
            .then((res) => setUsers(res.data))
            .catch((err) => {
                if (err.response?.status === 403) {
                    setErrorMsg('Anda tidak punya akses ke halaman ini.');
                } else {
                    setErrorMsg('Gagal memuat data. Coba lagi.');
                }
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        api.get<{ role: string }>('/user').then((res) => setCurrentRole(res.data.role)).catch(() => {});
        loadUsers();
    }, []);

    const isAdmin = currentRole === 'admin';

    const filtered = useMemo<User[]>(() => {
        const q = search.toLowerCase().trim();
        return users.filter((u) => {
            const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
            const matchTab = activeTab === 'semua' || u.role === activeTab;
            return matchSearch && matchTab;
        });
    }, [users, search, activeTab]);

    // Reset ke halaman 1 setiap kali pencarian atau tab berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, activeTab]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

    const paginated = useMemo<User[]>(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }, [filtered, currentPage]);

    async function confirmDelete() {
        if (!userToDelete) return;

        setDeleting(true);
        try {
            await api.delete(`/karyawan/${userToDelete.id}`);
            toast.success(`User ${userToDelete.name} berhasil dihapus.`);
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
            setUserToDelete(null);
        } catch (err: any) {
            const msg = err.response?.status === 403
                ? 'Anda tidak punya akses untuk menghapus user ini.'
                : err.response?.data?.message || 'Gagal menghapus user. Coba lagi.';
            toast.error(msg);
            setUserToDelete(null);
        } finally {
            setDeleting(false);
        }
    }

    // BARU: handler saat user pilih file dari <input type="file">
    // FIX: loadUsers() sekarang SELALU dipanggil setelah proses import
    // selesai (baik result.success true maupun false), bukan cuma di
    // jalur success. Soalnya backend (KaryawanImport) tetap menyimpan
    // baris-baris yang valid walau ada baris lain yang di-skip karena
    // duplikat -- response "success: false" bukan berarti TIDAK ADA
    // data yang berhasil ditambahkan. Tanpa ini, data baru yang sukses
    // masuk baru kelihatan setelah user refresh manual (tidak realtime).
    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportErrors([]);
        setImportSuccessMsg('');

        try {
            const result = await importKaryawan(file);
            if (result.success) {
                setImportSuccessMsg(result.message || 'Import berhasil.');
            } else {
                setImportErrors(result.errors || [result.message || 'Import gagal.']);
            }
            loadUsers(); // refresh daftar karyawan -- selalu jalan, apapun hasilnya
        } catch (err: any) {
            const data = err.response?.data;
            if (data?.errors) {
                setImportErrors(data.errors);
            } else {
                setImportErrors([data?.message || 'Gagal import file. Coba lagi.']);
            }
            loadUsers(); // jaga-jaga: tetap refresh kalau ada baris yang sempat tersimpan
        } finally {
            setImporting(false);
            // reset value biar bisa pilih file yang sama lagi kalau perlu re-upload
            e.target.value = '';
        }
    }

    const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? 'Pekerja';

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <p className="text-sm text-slate-500">
                    Kelola data user dan karyawan sistem, akun login, departemen, dan hak akses.
                </p>
                {isAdmin && (
                    <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
                        >
                            <Download size={16} />
                            Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
                        >
                            <Upload size={16} />
                            Import Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/karyawan/create', { state: { backgroundLocation: location } })}
                            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs"
                        >
                            <Plus size={16} />
                            Tambah User
                        </button>
                    </div>
                )}
            </div>

            <div>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    {/* Tab navigation role */}
                    <ScrollableTabBar
                        className="mb-4"
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        tabs={tabs}
                    />

                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Cari nama, email, atau NIK user..."
                            className="flex-1"
                        />
                    </div>

                    <p className="text-xs text-slate-500 mb-4">
                        Total {activeTabLabel}: <span className="font-semibold text-slate-900">{filtered.length}</span> user
                    </p>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        {loading && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <SkeletonTable columns={6} rows={6} />
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && errorMsg && <p className="text-center text-sm text-red-500 py-8">{errorMsg}</p>}

                        {!loading && !errorMsg && filtered.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-8">Tidak ada user yang cocok dengan pencarian / filter ini.</p>
                        )}

                        {!loading && !errorMsg && filtered.length > 0 && (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/50">
                                                <th className="px-6 py-3.5 font-medium">Nama Karyawan</th>
                                                <th className="px-6 py-3.5 font-medium">Email</th>
                                                <th className="px-6 py-3.5 font-medium">Departemen</th>
                                                <th className="px-6 py-3.5 font-medium">Role</th>
                                                <th className="px-6 py-3.5 font-medium">Status</th>
                                                <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginated.map((user) => (
                                                <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                                                    <td className="px-6 py-3.5 text-slate-800">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                                                                {initials(user.name)}
                                                            </div>
                                                            <div className="min-w-0 max-w-[200px]">
                                                                <Tooltip content={user.name}>
                                                                    <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <div className="max-w-[220px]">
                                                            <Tooltip content={user.email || '-'}>
                                                                <p className="truncate text-slate-700">{user.email || '-'}</p>
                                                            </Tooltip>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                                                            {user.departemen?.nama || 'Belum diatur'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleStyles[user.role ?? ''] || defaultRoleStyle}`}>
                                                            {roleLabels[user.role ?? ''] || user.role || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <StatusBadge status={user.status} />
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/karyawan/${user.id}`, { state: { backgroundLocation: location } })}
                                                                title="Detail User"
                                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => navigate(`/karyawan/${user.id}/edit`, { state: { backgroundLocation: location } })}
                                                                        title="Edit User"
                                                                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                                    >
                                                                        <Pencil size={15} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setUserToDelete(user)}
                                                                        title="Hapus User"
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

                                {/* Mobile List View */}
                                <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                                    {paginated.map((user) => (
                                        <div key={user.id} className="p-4 flex flex-col gap-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                                                        {initials(user.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                                                        <p className="text-xs text-slate-400 truncate">{user.nik || user.email || '-'}</p>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${roleStyles[user.role ?? ''] || defaultRoleStyle}`}>
                                                    {roleLabels[user.role ?? ''] || user.role || '-'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <StatusBadge status={user.status} small />
                                                    <span className="text-xs text-slate-500 truncate">
                                                        {user.departemen?.nama || 'Departemen belum diatur'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/karyawan/${user.id}`, { state: { backgroundLocation: location } })}
                                                        title="Detail"
                                                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {isAdmin && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/karyawan/${user.id}/edit`, { state: { backgroundLocation: location } })}
                                                                title="Edit"
                                                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUserToDelete(user)}
                                                                title="Hapus"
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="px-6 py-3 border-t border-slate-100">
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                            totalItems={filtered.length}
                                            itemLabel="user"
                                            className="pt-0 mt-0 border-t-0"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDeleteModal
                isOpen={!!userToDelete}
                itemName={userToDelete?.name || ''}
                itemCode={userToDelete?.nik || undefined}
                itemType="Karyawan / User"
                warningMessage="Akun login dan seluruh hak akses user ini akan dicabut secara permanen."
                loading={deleting}
                onClose={() => setUserToDelete(null)}
                onConfirm={confirmDelete}
            />

            {/* BARU: modal import Excel */}
            {showImportModal && (
                <ImportModal
                    importing={importing}
                    errors={importErrors}
                    successMsg={importSuccessMsg}
                    fileInputRef={fileInputRef}
                    onFileSelected={handleFileSelected}
                    onClose={() => {
                        setShowImportModal(false);
                        setImportErrors([]);
                        setImportSuccessMsg('');
                    }}
                />
            )}
            {/* Modal export Excel/PDF — data yang dikirim udah sesuai filter
                tab & pencarian yang lagi aktif di tabel (bukan cuma halaman
                yang lagi ditampilin, tapi SEMUA hasil filter). */}
            <KaryawanExportModal
                open={showExportModal}
                onClose={() => setShowExportModal(false)}
                data={filtered}
            />
        </>
    );
}

// BARU: modal untuk pilih & upload file Excel karyawan
interface ImportModalProps {
    importing: boolean;
    errors: string[];
    successMsg: string;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClose: () => void;
}

function ImportModal({ importing, errors, successMsg, fileInputRef, onFileSelected, onClose }: ImportModalProps) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Import Data Karyawan</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Upload file Excel (.xlsx) berisi kolom NIK, Nama, Email, Phone, Departemen, dan
                    Tanggal Masuk. Karyawan baru akan otomatis dibuatkan akun dan passwordnya
                    dikirim ke email masing-masing.
                </p>

                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-8 cursor-pointer hover:bg-gray-50">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600">
                        {importing ? 'Mengupload & memproses...' : 'Klik untuk pilih file Excel'}
                    </span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        disabled={importing}
                        onChange={onFileSelected}
                    />
                </label>

                {successMsg && (
                    <div className="mt-4 text-sm bg-green-50 text-green-700 rounded-lg p-3">
                        {successMsg}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="mt-4 text-sm bg-red-50 text-red-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <p className="font-medium mb-1">Gagal import:</p>
                        <ul className="list-disc list-inside space-y-1">
                            {errors.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-5">
                    <button
                        onClick={onClose}
                        disabled={importing}
                        className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}