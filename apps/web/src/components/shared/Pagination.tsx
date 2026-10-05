import { useEffect, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** Total data (opsional) — kalau diisi, muncul teks ringkasan di sisi desktop/tablet/TV */
    totalItems?: number;
    /** Label satuan data untuk teks ringkasan, mis. "karyawan", "aset", "tiket" */
    itemLabel?: string;
    className?: string;
}

/**
 * Komponen pagination terpusat dipakai di semua halaman (Karyawan, Absensi,
 * Pengajuan Izin, Inventaris, Ticketing, dll) supaya perilaku & tampilannya
 * konsisten di satu tempat.
 *
 * - Desktop / tablet / TV (>= sm): nomor halaman + tombol Sebelumnya/Selanjutnya,
 *   ditambah kolom kecil "Ke halaman" untuk loncat langsung tanpa pencet satu-satu.
 * - Mobile (< sm): gaya stepper ala aplikasi mobile — tombol bulat kiri/kanan,
 *   dan indikator "halaman / total" yang bisa diketik langsung untuk loncat.
 */
export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemLabel,
    className = '',
}: PaginationProps) {
    const [inputValue, setInputValue] = useState(String(currentPage));

    // Sinkronkan kolom input tiap kali halaman aktif berubah dari luar
    // (misal lewat tombol Sebelumnya/Selanjutnya atau nomor halaman)
    useEffect(() => {
        setInputValue(String(currentPage));
    }, [currentPage]);

    if (totalPages <= 1) return null;

    const pageNumbers: (number | 'ellipsis')[] = [];
    const delta = 1;
    for (let i = 1; i <= totalPages; i++) {
        const isEdge = i === 1 || i === totalPages;
        const isNearCurrent = Math.abs(i - currentPage) <= delta;
        if (isEdge || isNearCurrent) {
            pageNumbers.push(i);
        } else if (pageNumbers[pageNumbers.length - 1] !== 'ellipsis') {
            pageNumbers.push('ellipsis');
        }
    }

    const commitJump = () => {
        const parsed = Number(inputValue);
        if (!Number.isFinite(parsed) || inputValue.trim() === '') {
            setInputValue(String(currentPage));
            return;
        }
        const clamped = Math.min(totalPages, Math.max(1, Math.round(parsed)));
        setInputValue(String(clamped));
        if (clamped !== currentPage) onPageChange(clamped);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
            commitJump();
        }
    };

    const jumpInputClass =
        'text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

    return (
        <div className={`pt-4 mt-2 border-t border-slate-100 ${className}`}>
            {/* Desktop / tablet / TV */}
            <div className="hidden sm:flex items-center justify-between gap-4 flex-wrap">
                {totalItems !== undefined ? (
                    <p className="text-xs text-slate-400 whitespace-nowrap">
                        Halaman {currentPage} dari {totalPages}
                        {itemLabel ? ` · ${totalItems} total ${itemLabel}` : ''}
                    </p>
                ) : (
                    <span />
                )}

                <div className="flex items-center gap-1 flex-wrap justify-end">
                    <button
                        type="button"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                    >
                        Sebelumnya
                    </button>

                    {pageNumbers.map((p, idx) =>
                        p === 'ellipsis' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-slate-400">
                                …
                            </span>
                        ) : (
                            <button
                                type="button"
                                key={p}
                                onClick={() => onPageChange(p)}
                                aria-current={p === currentPage ? 'page' : undefined}
                                className={`min-w-[2rem] px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                    p === currentPage
                                        ? 'bg-slate-900 text-white font-medium'
                                        : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            >
                                {p}
                            </button>
                        )
                    )}

                    <button
                        type="button"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                    >
                        Selanjutnya
                    </button>

                    <div className="flex items-center gap-1.5 ml-1 pl-2.5 border-l border-slate-200">
                        <label htmlFor="pagination-jump-desktop" className="text-xs text-slate-400 whitespace-nowrap">
                            Ke halaman
                        </label>
                        <input
                            id="pagination-jump-desktop"
                            type="number"
                            min={1}
                            max={totalPages}
                            inputMode="numeric"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={commitJump}
                            className={`w-14 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 ${jumpInputClass}`}
                            aria-label={`Loncat ke halaman, dari ${totalPages} halaman`}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile — stepper bergaya aplikasi mobile, indikator halaman bisa diketik untuk loncat */}
            <div className="flex sm:hidden items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Halaman sebelumnya"
                    className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full border border-slate-200 text-slate-600 active:bg-slate-100 disabled:opacity-30 disabled:active:bg-transparent transition"
                >
                    <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-1.5 bg-slate-50 rounded-full px-3 py-2 border border-slate-200">
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        inputMode="numeric"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={commitJump}
                        className={`w-8 bg-transparent text-sm font-semibold text-slate-900 ${jumpInputClass}`}
                        aria-label={`Loncat ke halaman, dari ${totalPages} halaman`}
                    />
                    <span className="text-sm text-slate-400 whitespace-nowrap">/ {totalPages}</span>
                </div>

                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Halaman selanjutnya"
                    className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full border border-slate-200 text-slate-600 active:bg-slate-100 disabled:opacity-30 disabled:active:bg-transparent transition"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}