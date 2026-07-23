import { useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/AppLayout';

type Role = 'admin' | 'hr' | 'manajer' | 'karyawan';
type TabKey = 'semua' | 'karyawan' | 'hr_manajer' | 'admin';

interface Pekerja {
    nip: string;
    departemen: { nama: string } | null;
    jabatan: { nama: string } | null;
}

interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
    pekerja: Pekerja | null;
}

const roleStyles: Record<Role, string> = {
    admin: 'bg-red-50 text-red-700',
    hr: 'bg-pink-50 text-pink-700',
    manajer: 'bg-purple-50 text-purple-700',
    karyawan: 'bg-teal-50 text-teal-700',
};

const roleLabels: Record<Role, string> = {
    admin: 'Admin',
    hr: 'HR',
    manajer: 'Manajer',
    karyawan: 'Karyawan',
};

const tabs: { key: TabKey; label: string; icon: JSX.Element }[] = [
    {
        key: 'semua',
        label: 'Semua Pekerja',
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
];

function initials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export default function KaryawanPage() {
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

    useEffect(() => {
        api.get<{ role: Role }>('/user').then((res) => setCurrentRole(res.data.role)).catch(() => {});

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
                setErrorMsg('Anda tidak punya akses untuk menghapus karyawan ini.');
            } else {
                setErrorMsg('Gagal menghapus karyawan. Coba lagi.');
            }
            setUserToDelete(null);
        } finally {
            setDeleting(false);
        }
    }

    const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? 'Pekerja';

    return (
        <AppLayout title="Data Karyawan">
            <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-gray-900">Data Karyawan</h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola data seluruh pengguna sistem.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    {/* Tab navigation menggantikan dropdown filter role */}
                    <nav className="mb-4">
                        <ul className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto">
                            {tabs.map((tab) => (
                                <li key={tab.key}>
                                    <button
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                            activeTab === tab.key
                                                ? 'border-black text-black font-medium'
                                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

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
                            {isAdmin && (
                                <button
                                    onClick={() => navigate('/karyawan/create', { state: { backgroundLocation: location } })}
                                    className="flex items-center justify-center gap-2 bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 whitespace-nowrap"
                                >
                                    + Tambah Karyawan
                                </button>
                            )}
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                        Total {activeTabLabel} ada <span className="font-semibold text-gray-900">{filtered.length}</span>
                    </p>

                    {loading && <p className="text-center text-sm text-gray-400 py-8">Memuat data...</p>}

                    {!loading && errorMsg && <p className="text-center text-sm text-gray-400 py-8">{errorMsg}</p>}

                    {!loading && !errorMsg && filtered.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-8">Tidak ada karyawan yang cocok dengan filter ini.</p>
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
        </AppLayout>
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
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs px-3 py-1 rounded-full ${roleStyles[user.role]}`}>
                    {roleLabels[user.role]}
                </span>
                {user.pekerja && (
                    <span className="text-xs text-gray-500">
                        {user.pekerja.departemen?.nama || 'Departemen tidak ditentukan'}
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

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    // Bangun daftar nomor halaman dengan elipsis jika halaman terlalu banyak
    const pageNumbers = useMemo<(number | 'ellipsis')[]>(() => {
        const pages: (number | 'ellipsis')[] = [];
        const delta = 1; // jumlah halaman di kiri/kanan halaman aktif yang ditampilkan

        for (let i = 1; i <= totalPages; i++) {
            const isEdge = i === 1 || i === totalPages;
            const isNearCurrent = Math.abs(i - currentPage) <= delta;
            if (isEdge || isNearCurrent) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== 'ellipsis') {
                pages.push('ellipsis');
            }
        }
        return pages;
    }, [currentPage, totalPages]);

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-1 mt-4 pt-4 border-t border-gray-100">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
                Sebelumnya
            </button>

            {pageNumbers.map((p, idx) =>
                p === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-sm text-gray-400">
                        ...
                    </span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`min-w-[2rem] px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            p === currentPage
                                ? 'bg-black text-white font-medium'
                                : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
                        }`}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
                Selanjutnya
            </button>
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
            <div className="bg-white rounded-xl w-full max-w-sm p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Hapus karyawan?</h2>
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