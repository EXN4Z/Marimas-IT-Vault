import { useRef, type MouseEvent } from 'react';

/**
 * Fix bug "drag-select teks di dalam modal lalu mouse kepeleset/lepas di
 * backdrop = modal ikut ketutup". Root cause-nya: kalau modal cuma pakai
 * onClick di backdrop dengan cek `e.target === e.currentTarget`, event click
 * itu ditentukan dari titik mouseup — jadi mulai drag-select di dalam modal
 * (mousedown di panel) tapi lepas klik di luar modal (mouseup di backdrop)
 * bisa kehitung sebagai "klik di luar" dan modal ke-close padahal cuma niat
 * seleksi teks.
 *
 * Hook ini pastikan modal cuma nutup kalau mousedown DAN mouseup dua-duanya
 * kena backdrop-nya sendiri (bukan hasil drag yang start-nya dari dalam panel).
 *
 * Pemakaian:
 * ```tsx
 * const backdrop = useBackdropClose(onClose, !submitting);
 * <div className="fixed inset-0 ..." {...backdrop}>
 * ```
 *
 * `enabled` opsional: dipakai buat nonaktifin close-on-backdrop selagi
 * loading/submitting (dulu sering ditulis manual sebagai `&& !loading`).
 */
export function useBackdropClose(onClose: () => void, enabled: boolean = true) {
  const mouseDownOnBackdrop = useRef(false);

  function onMouseDown(e: MouseEvent<HTMLDivElement>) {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const shouldClose = mouseDownOnBackdrop.current && e.target === e.currentTarget;
    mouseDownOnBackdrop.current = false;
    if (shouldClose && enabled) onClose();
  }

  return { onMouseDown, onClick };
}