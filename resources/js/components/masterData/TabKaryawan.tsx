import { useEffect, useRef, useState, type JSX } from 'react';
import { router, usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { Download, Upload, Plus, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ScrollableTabBar from '../navigation/ScrollableTabBar';
import Pagination from '../table/Pagination';
import Tooltip from '../feedback/Tooltip';
import SearchInput from '../form/SearchInput';
import ConfirmDeleteModal from '../modal/ConfirmDeleteModal';
import KaryawanExportModal from '../laporan/KaryawanExportModal';
import KaryawanFormModal from './karyawan/KaryawanFormModal';
import KaryawanDetailModal from './karyawan/KaryawanDetailModal';
import type { KaryawanList, KaryawanOpsi, KaryawanRow } from '../../types/karyawan';

type TabKey = 'semua' | 'user' | 'admin';

// [F3-INERTIA] Satu baris user dari props server (lengkap: id relasi, tanggal_masuk, status). Dipakai juga
// KaryawanExportModal, jadi tetap kompatibel dengan tipe Karyawan di api/masterData/karyawan.ts.
type User = KaryawanRow;

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

// [F3-INERTIA] Tab "Data User" di Master Data (tadinya halaman /karyawan, lalu tab dengan axios + halaman
// Create/Edit/Show terpisah). Sekarang:
//  - data dari props server (MasterDataPageController -> props.karyawan, hanya dikirim saat tab ini aktif);
//  - pagination, pencarian, dan filter role dijalankan server lewat router.get (query string = sumber kebenaran);
//  - Tambah / Edit / Detail = modal overlay dengan state lokal (KaryawanFormModal / KaryawanDetailModal);
//  - mutasi (hapus, import) lewat router.* ke /master-data/karyawan, hasilnya toast dari flash server (FlashToaster).
interface KaryawanPageProps {
    karyawan?: KaryawanList;
    karyawanOpsi?: KaryawanOpsi;
    karyawanExport?: User[];
}

export default function TabKaryawan() {
    const { user: authUser } = useAuth();
    const isAdmin = authUser?.role === 'admin';

    const pageProps = usePage().props as unknown as KaryawanPageProps;
    const list = pageProps.karyawan;
    const users: User[] = list?.data ?? [];
    const activeTab: TabKey = list?.filters.role ?? 'semua';
    const serverSearch = list?.filters.search ?? '';
    const currentPage = list?.current_page ?? 1;
    const totalPages = list?.last_page ?? 1;
    const totalUsers = list?.total ?? 0;

    const [searchInput, setSearchInput] = useState<string>(serverSearch);
    const [listLoading, setListLoading] = useState<boolean>(false);

    // Modal Tambah/Edit (user null = Tambah) dan modal Detail -- state lokal, bukan route.
    const [formModal, setFormModal] = useState<{ user: User | null } | null>(null);
    const [detailUser, setDetailUser] = useState<User | null>(null);

    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [deleteError, setDeleteError] = useState<string>('');

    // State import Excel karyawan
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState<boolean>(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [showImportModal, setShowImportModal] = useState<boolean>(false);

    // Modal export (Excel/PDF). Datanya = SEMUA hasil filter aktif, diambil lewat partial reload
    // (props.karyawanExport) tiap tombol Export diklik, bukan cuma halaman yang lagi tampil.
    const [showExportModal, setShowExportModal] = useState<boolean>(false);
    const [exportLoading, setExportLoading] = useState<boolean>(false);

    // Pindah halaman / ganti filter = visit ringan ke /master-data (partial reload cuma props.karyawan).
    // Nilai default (search kosong, role semua, halaman 1) tidak ikut di URL.
    function visitList(next: { search?: string; role?: TabKey; page?: number }) {
        const search = (next.search ?? searchInput).trim();
        const role = next.role ?? activeTab;
        const page = next.page ?? 1;

        const data: Record<string, string | number> = { tab: 'karyawan' };
        if (search) data.search = search;
        if (role !== 'semua') data.role = role;
        if (page > 1) data.page = page;

        setListLoading(true);
        router.get('/master-data', data, {
            only: ['karyawan'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () => setListLoading(false),
        });
    }

    // Pencarian: tunggu user berhenti mengetik sebentar sebelum minta data ke server.
    useEffect(() => {
        if (searchInput.trim() === serverSearch) return;
        const timer = setTimeout(() => visitList({ search: searchInput, page: 1 }), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    function openCreate() {
        setFormModal({ user: null });
    }

    function openEdit(user: User) {
        setFormModal({ user });
    }

    // Dari tombol "Hapus User" di dalam modal Edit: tutup form dulu, baru buka konfirmasi hapus.
    function requestDelete(user: User) {
        setFormModal(null);
        setDeleteError('');
        setUserToDelete(user);
    }

    function confirmDelete() {
        if (!userToDelete) return;

        setDeleting(true);
        setDeleteError('');
        // Sukses -> toast dari flash server. Gagal (mis. masih punya pinjaman inventory) -> error bag "delete",
        // tampil di dalam modal konfirmasi.
        router.delete(`/master-data/karyawan/${userToDelete.id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setUserToDelete(null),
            onError: (errors) => setDeleteError(errors.delete || 'Gagal menghapus user. Coba lagi.'),
            onFinish: () => setDeleting(false),
        });
    }

    function openExport() {
        setExportLoading(true);
        router.reload({
            only: ['karyawanExport'],
            onSuccess: () => setShowExportModal(true),
            onError: () => toast.error('Gagal menyiapkan data export. Coba lagi.'),
            onFinish: () => setExportLoading(false),
        });
    }

    // Handler saat user pilih file dari <input type="file">.
    // Sukses -> toast dari flash server + modal ditutup. Ada baris bermasalah -> error bag "file" (satu pesan per
    // baris, dipisah newline) tampil sebagai list di modal. Baris yang valid tetap tersimpan (sama seperti dulu),
    // dan list otomatis ter-refresh karena server redirect balik ke halaman ini.
    function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportErrors([]);

        router.post('/master-data/karyawan/import', { file }, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setShowImportModal(false),
            onError: (errors) =>
                setImportErrors(
                    String(errors.file || 'Gagal import file. Coba lagi.')
                        .split('\n')
                        .filter(Boolean)
                ),
            onFinish: () => {
                setImporting(false);
                // reset value biar bisa pilih file yang sama lagi kalau perlu re-upload
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
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
                            onClick={openExport}
                            disabled={exportLoading}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
                        >
                            {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
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
                            onClick={openCreate}
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
                        onChange={(key) => visitList({ role: key, page: 1 })}
                        tabs={tabs}
                    />

                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <SearchInput
                            value={searchInput}
                            onChange={setSearchInput}
                            placeholder="Cari nama, email, atau NIK user..."
                            className="flex-1"
                        />
                    </div>

                    <p className="text-xs text-slate-500 mb-4">
                        Total {activeTabLabel}: <span className="font-semibold text-slate-900">{totalUsers}</span> user
                    </p>

                    <div className={`border border-slate-200 rounded-lg overflow-hidden transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
                        {!list && <p className="text-center text-sm text-red-500 py-8">Gagal memuat data. Coba lagi.</p>}

                        {list && users.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-8">Tidak ada user yang cocok dengan pencarian / filter ini.</p>
                        )}

                        {list && users.length > 0 && (
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
                                            {users.map((user) => (
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
                                                                onClick={() => setDetailUser(user)}
                                                                title="Detail User"
                                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEdit(user)}
                                                                        title="Edit User"
                                                                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                                    >
                                                                        <Pencil size={15} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => requestDelete(user)}
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
                                    {users.map((user) => (
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
                                                        onClick={() => setDetailUser(user)}
                                                        title="Detail"
                                                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {isAdmin && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(user)}
                                                                title="Edit"
                                                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => requestDelete(user)}
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
                                            onPageChange={(page) => visitList({ page })}
                                            totalItems={totalUsers}
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

            {/* MODAL TAMBAH / EDIT */}
            {formModal && pageProps.karyawanOpsi && (
                <KaryawanFormModal
                    key={formModal.user?.id ?? 'baru'}
                    user={formModal.user}
                    opsi={pageProps.karyawanOpsi}
                    onClose={() => setFormModal(null)}
                    onDelete={requestDelete}
                />
            )}

            {/* MODAL DETAIL */}
            {detailUser && <KaryawanDetailModal user={detailUser} onClose={() => setDetailUser(null)} />}

            {/* MODAL KONFIRMASI HAPUS */}
            <ConfirmDeleteModal
                isOpen={!!userToDelete}
                itemName={userToDelete?.name || ''}
                itemCode={userToDelete?.nik || undefined}
                itemType="Karyawan / User"
                warningMessage="Akun login dan seluruh hak akses user ini akan dicabut secara permanen."
                loading={deleting}
                errorMessage={deleteError}
                onClose={() => {
                    setUserToDelete(null);
                    setDeleteError('');
                }}
                onConfirm={confirmDelete}
            />

            {/* MODAL IMPORT EXCEL */}
            {showImportModal && (
                <ImportModal
                    importing={importing}
                    errors={importErrors}
                    fileInputRef={fileInputRef}
                    onFileSelected={handleFileSelected}
                    onClose={() => {
                        setShowImportModal(false);
                        setImportErrors([]);
                    }}
                />
            )}

            {/* Modal export Excel/PDF — data = SEMUA hasil filter aktif (props.karyawanExport), bukan cuma halaman yang tampil. */}
            <KaryawanExportModal
                open={showExportModal}
                onClose={() => setShowExportModal(false)}
                data={pageProps.karyawanExport ?? []}
            />
        </>
    );
}

// Modal untuk pilih & upload file Excel karyawan
interface ImportModalProps {
    importing: boolean;
    errors: string[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClose: () => void;
}

function ImportModal({ importing, errors, fileInputRef, onFileSelected, onClose }: ImportModalProps) {
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
