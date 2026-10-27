import StatusProportionBar from '../../../components/feedback/StatusProportionBar';
import type { PenangananTab } from '../types';

const SEGMEN: { key: PenangananTab; label: string; warna: string }[] = [
  { key: 'menunggu', label: 'Menunggu', warna: '#9fb3d6' },
  { key: 'diperbaiki', label: 'Dikerjakan', warna: '#101a33' },
  { key: 'diperbaiki_selesai', label: 'Selesai', warna: '#0b3a9a' },
  { key: 'rusak_berat', label: '', warna: '#b53a12' },
];

// Bar segmen proporsi laporan per status (menggantikan kartu KPI + tab).
export default function PenangananProgressBar({ counts }: { counts: Record<PenangananTab, number> }) {
  return (
    <StatusProportionBar
      ariaLabel="Proporsi laporan per status"
      segments={SEGMEN.map((s) => ({ key: s.key, label: s.label, count: counts[s.key], color: s.warna }))}
    />
  );
}
