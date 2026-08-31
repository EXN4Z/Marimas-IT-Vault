import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import api from '../../api/axios';
import { importKaryawan } from '../../api/auth';
import type { Karyawan } from '../../api/karyawan';
import ScrollableTabBar from '../shared/ScrollableTabBar';
import Pagination from '../shared/Pagination';
import KaryawanExportModal from '../laporan/KaryawanExportModal';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan' | 'cabang';
type TabKey = 'semua' | 'karyawan' | 'hr_manajer' | 'admin' | 'cabang';

interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
    nik: string | null;
    // phone/lokasi_kantor/tanggal_masuk sebenarnya selalu ikut kekirim dari
    // endpoint /karyawan (lihat UserController::index di backend), cuma
    // dulu gak dimasukin ke interface ini karena belum kepake di tabel.
    // Sekarang dipakai buat export (lihat KaryawanExportModal).
    phone?: string | null;
    departemen: { nama: string } | null;
    lokasi_kantor?: { nama: string } | null;
    tanggal_masuk?: string | null;
}

const roleStyles: Record<Role, string> = {
    admin: 'bg-red-50 text-red-700',
    hr: 'bg-pink-50 text-pink-700',
    manajer: 'bg-purple-50 text-purple-700',
    karyawan: 'bg-teal-50 text-teal-700',
    cabang: 'bg-blue-50 text-blue-700',
};

const roleLabels: Record<Role, string> = {
    admin: 'Admin',
    hr: 'HR',
    manajer: 'Manajer',
    karyawan: 'Karyawan',
    cabang: 'Cabang',
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
        key: 'karyawan',
        label: 'Karyawan',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        key: 'hr_manajer',
        label: 'HR / Manajer',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m-3 14h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
    {
        key: 'cabang',
        label: 'Cabang',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    }
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
    const [currentRole, setCurrentRole] = useState<Role | null>(null); // BARU: untuk cek role user saat ini

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

    // BARU: state untuk modal export (Excel/PDF) — komponennya sudah ada &
    // dipakai di halaman Laporan, di sini tinggal dipasang ulang.
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
        api.get<{ role: Role }>('/user').then((res) => setCurrentRole(res.data.role)).catch(() => {});
        loadUsers();
    }, []);

    const isAdmin = currentRole === 'admin';

    const filtered = useMemo<User[]>(() => {
        const q = search.toLowerCase().trim();
        return users.filter((u) => {
            const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
            const matchTab =
                activeTab === 'semua' ||
                (activeTab === 'hr_manajer' ? u.role === 'hr' || u.role === 'manajer' : u.role === activeTab);
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
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
            setUserToDelete(null);
        } catch (err: any) {
            if (err.response?.status === 403) {
                setErrorMsg('Anda tidak punya akses untuk menghapus user ini.');
            } else {
                setErrorMsg('Gagal menghapus user. Coba lagi.');
            }
            setUserToDelete(null);
        } finally {
            setDeleting(false);
        }
    }

    // BARU: handler saat user pilih file dari <input type="file">
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
                loadUsers(); // refresh daftar karyawan setelah import sukses
            } else {
                setImportErrors(result.errors || [result.message || 'Import gagal.']);
            }
        } catch (err: any) {
            const data = err.response?.data;
            if (data?.errors) {
                setImportErrors(data.errors);
            } else {
                setImportErrors([data?.message || 'Gagal import file. Coba lagi.']);
            }
        } finally {
            setImporting(false);
            // reset value biar bisa pilih file yang sama lagi kalau perlu re-upload
            e.target.value = '';
        }
    }

    const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? 'Pekerja';

    return (
        <>
            <div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    {/* Tab navigation menggantikan dropdown filter role */}
                    <ScrollableTabBar
                        className="mb-4"
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        tabs={tabs}
                    />

                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <div className="relative flex-1">
                            <svg
                                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Cari nama atau email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
                            />
                        </div>
                            <div className="flex gap-2">
                                {/* BARU: tombol Export (Excel/PDF) — dibuka buat semua role yang
                                    bisa lihat halaman ini, bukan cuma admin, soalnya cuma nampilin
                                    data yang sudah kefilter/keliatan di tabel (bukan aksi ubah data). */}
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                                >
                                    <FileDown size={16} />
                                    Export
                                </button>
                            </div>
                            {isAdmin && (
                                <div className="flex gap-2">
                                    {/* BARU: tombol Import Excel */}
                                    <button
                                        onClick={() => setShowImportModal(true)}
                                        className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                                    >
                                        Import Excel
                                    </button>
                                    <button
                                        onClick={() => navigate('/karyawan/create', { state: { backgroundLocation: location } })}
                                        className="flex items-center justify-center gap-2 bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 whitespace-nowrap"
                                    >
                                        + Tambah User
                                    </button>
                                </div>
                            )}
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                        Total {activeTabLabel} ada <span className="font-semibold text-gray-900">{filtered.length}</span>
                    </p>

                    {loading && <p className="text-center text-sm text-gray-400 py-8">Memuat data...</p>}

                    {!loading && errorMsg && <p className="text-center text-sm text-gray-400 py-8">{errorMsg}</p>}

                    {!loading && !errorMsg && filtered.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-8">Tidak ada user yang cocok dengan filter ini.</p>
                    )}

                    {!loading && !errorMsg && filtered.length > 0 && (
                        <>
                            <div className="divide-y divide-gray-100">
                                {paginated.map((user) => (
                                    <UserRow
                                        key={user.id}
                                        user={user}
                                        isAdmin={isAdmin}
                                        onDelete={() => setUserToDelete(user)}
                                        onEdit={() => navigate(`/karyawan/${user.id}/edit`, { state: { backgroundLocation: location } })}
                                    />
                                ))}
                            </div>

                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                totalItems={filtered.length}
                                itemLabel="user"
                            />
                        </>
                    )}
                </div>
            </div>

            {userToDelete && (
                <ConfirmDeleteModal
                    user={userToDelete}
                    deleting={deleting}
                    onCancel={() => setUserToDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}

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
            {/* BARU: modal export Excel/PDF — data yang dikirim udah sesuai
                filter tab & pencarian yang lagi aktif di tabel (bukan cuma
                halaman yang lagi ditampilin, tapi SEMUA hasil filter). */}
            {showExportModal && (
                <KaryawanExportModal
                    open={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    data={filtered as unknown as Karyawan[]}
                />
            )}
        </>
    );
}

interface UserRowProps {
    user: User;
    isAdmin: boolean;
    onDelete: () => void;
    onEdit: () => void;
}

function UserRow({ user, isAdmin, onDelete, onEdit }: UserRowProps) {
    return (
        <div className="flex items-center justify-between py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700 flex-shrink-0">
                    {initials(user.name)}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.nik || user.email || '-'}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs px-3 py-1 rounded-full ${roleStyles[user.role]}`}>
                    {roleLabels[user.role]}
                </span>
                {user.departemen && (
                    <span className="text-xs text-gray-500">
                        {user.departemen?.nama || 'Departemen tidak ditentukan'}
                    </span>
                )}
                {isAdmin && (
                    <>
                        <button onClick={onEdit} className="text-xs text-gray-500 hover:text-black">
                            Edit
                        </button>
                        <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-700">
                            Hapus
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

interface ConfirmDeleteModalProps {
    user: User;
    deleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

function ConfirmDeleteModal({ user, deleting, onCancel, onConfirm }: ConfirmDeleteModalProps) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Hapus user?</h2>
                <p className="text-sm text-gray-500 mb-5">
                    <span className="font-medium text-gray-700">{user.name}</span> akan dihapus permanen dan
                    tidak bisa dikembalikan.
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={deleting}
                        className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {deleting ? 'Menghapus...' : 'Ya, hapus'}
                    </button>
                </div>
            </div>
        </div>
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