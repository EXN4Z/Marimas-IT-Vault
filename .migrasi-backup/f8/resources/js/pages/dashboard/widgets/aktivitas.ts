import type { AktivitasInventoryTerbaru } from '../useDashboardData';
import { THEME } from './theme';

// ==== Timeline Aktivitas ====
export const AKTIVITAS_ASET_STYLE: Record<AktivitasInventoryTerbaru['type'], { color: string; label: string; tone: 'amber' | 'emerald' | 'rose' | 'orange' | 'sky' | 'indigo' }> = {
  pinjam: { color: THEME.amber, label: 'menerima', tone: 'amber' },
  kembali: { color: THEME.emerald, label: 'mengembalikan', tone: 'emerald' },
  lapor_rusak: { color: THEME.rose, label: 'melaporkan kerusakan', tone: 'rose' },
  mulai_perbaikan: { color: THEME.orange, label: 'mulai perbaikan', tone: 'orange' },
  selesai_perbaikan: { color: THEME.sky, label: 'selesai perbaikan', tone: 'sky' },
  dijual: { color: THEME.purple, label: 'menjual', tone: 'indigo' },
};

export const AKTIVITAS_STATUS_LABEL: Record<AktivitasInventoryTerbaru['type'], string> = {
  pinjam: 'Diterima',
  kembali: 'Dikembalikan',
  lapor_rusak: 'Rusak Dilaporkan',
  mulai_perbaikan: 'Diperbaiki',
  selesai_perbaikan: 'Selesai Perbaikan',
  dijual: 'Terjual',
};

export function formatWaktuSingkat(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
