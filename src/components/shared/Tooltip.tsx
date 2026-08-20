import { type ReactNode } from 'react';

interface TooltipProps {
  /** Teks lengkap yang ditampilkan di dalam tooltip saat di-hover. */
  content: string;
  /** Elemen yang jadi trigger hover (biasanya teks yang ke-truncate). */
  children: ReactNode;
  className?: string;
}

/**
 * Tooltip custom pengganti native `title=""` attribute bawaan browser.
 * Dipakai buat nampilin teks lengkap dari sel tabel yang di-truncate
 * (mis. kolom Jenis/Merek, Aset Induk/Lokasi) dengan tampilan yang bisa
 * di-styling -- rounded, arrow, transisi fade -- bukan kotak hitam polos
 * bawaan OS.
 *
 * `group`/`group-hover` dipakai (bukan state React) biar gak nambah re-render
 * tiap hover; murni CSS. `pointer-events-none` di tooltip-nya sendiri biar
 * gak ganggu event mouse ke elemen di baliknya.
 */
export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  return (
    <span className={`group/tooltip relative inline-block min-w-0 max-w-full ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 bottom-full z-20 mb-1.5 max-w-xs -translate-y-0.5 whitespace-normal rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-all duration-150 group-hover/tooltip:translate-y-0 group-hover/tooltip:opacity-100"
      >
        {content}
        <span className="absolute left-3 top-full h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-slate-800" />
      </span>
    </span>
  );
}