import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const MIN = 1;
const MAX = 4;

// Viewer foto layar penuh: zoom lewat tombol, scroll mouse, atau klik/ketuk foto; geser foto saat diperbesar. Esc / klik latar = tutup.
export default function FotoZoomViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const atur = (next: number) => {
    const s = Math.min(MAX, Math.max(MIN, next));
    setScale(s);
    if (s === MIN) setPos({ x: 0, y: 0 });
  };
  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === '+' || e.key === '=') atur(scale + 0.5);
      else if (e.key === '-') atur(scale - 0.5);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, onClose]);

  const btn = 'h-9 w-9 grid place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 transition disabled:opacity-40';

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center overflow-hidden select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={(e) => atur(scale + (e.deltaY < 0 ? 0.25 : -0.25))}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button type="button" className={btn} onClick={() => atur(scale - 0.5)} disabled={scale <= MIN} aria-label="Perkecil">
          <ZoomOut size={18} />
        </button>
        <span className="min-w-[3rem] text-center text-xs font-semibold text-white">{Math.round(scale * 100)}%</span>
        <button type="button" className={btn} onClick={() => atur(scale + 0.5)} disabled={scale >= MAX} aria-label="Perbesar">
          <ZoomIn size={18} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={scale === 1} aria-label="Reset zoom">
          <RotateCcw size={16} />
        </button>
        <button type="button" className={btn} onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>

      <img
        src={src}
        alt={alt}
        draggable={false}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || scale === 1) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          setPos({ x: d.px + dx, y: d.py + dy });
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          // klik biasa (bukan geser) = ganti 100% <-> 200%
          if (d && !d.moved) atur(scale === 1 ? 2 : 1);
        }}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale === 1 ? 'zoom-in' : 'grab', touchAction: 'none' }}
        className="max-h-[90vh] max-w-[92vw] object-contain transition-transform duration-100"
      />
    </div>
  );
}
