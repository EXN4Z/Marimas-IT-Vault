import type { PenangananTab } from '../types';

const SEGMEN: { key: PenangananTab; label: string; warna: string }[] = [
  { key: 'menunggu', label: 'Menunggu', warna: '#9fb3d6' },
  { key: 'diperbaiki', label: 'Dikerjakan', warna: '#101a33' },
  { key: 'diperbaiki_selesai', label: 'Selesai', warna: '#0b3a9a' },
  { key: 'rusak_berat', label: '', warna: '#b53a12' },
];

// Bar segmen proporsi laporan per status (menggantikan kartu KPI + tab).
export default function PenangananProgressBar({ counts }: { counts: Record<PenangananTab, number> }) {
  const aktif = SEGMEN.filter((s) => counts[s.key] > 0);
  if (aktif.length === 0) return null;

  return (
    <div>
      <div className="flex gap-0.5 h-2.5" role="img" aria-label="Proporsi laporan per status">
        {aktif.map((s) => (
          <div key={s.key} style={{ flex: counts[s.key], background: s.warna, minWidth: 4 }} />
        ))}
      </div>
      <div className="flex gap-0.5 mt-1.5 text-[11px] text-slate-500">
        {aktif.map((s) => (
          <span key={s.key} style={{ flex: counts[s.key] }} className="truncate">
            {s.label} {counts[s.key]}
          </span>
        ))}
      </div>
    </div>
  );
}
