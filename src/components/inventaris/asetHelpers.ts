import { type Aset } from '../../api/aset';

/**
 * Helper bersama buat tab-tab aset (dipisah dari AsetDetailModal lama yang
 * sudah dihapus karena detail view-nya sudah digabung inline ke TabAset).
 */

export function kelengkapanLevel(aset: Aset, totalMaster: number): number {
  const jumlah = aset.kelengkapan?.length || 0;
  return Math.max(0, Math.min(jumlah, totalMaster));
}

export function kelengkapanLevelStyle(level: number, totalMaster: number): string {
  if (level >= totalMaster) return 'bg-emerald-50 text-emerald-700';
  if (level === totalMaster - 1) return 'bg-amber-50 text-amber-700';
  if (level === totalMaster - 2) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

export function kelengkapanLevelLabel(level: number, totalMaster: number): string {
  const kurang = totalMaster - level;
  if (kurang <= 0) return `Lengkap (${level})`;
  return `Kurang ${kurang} (${level})`;
}

export function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}
