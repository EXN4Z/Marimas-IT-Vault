import { AlertTriangle, Wrench } from 'lucide-react';
import type { InventoryStatus } from '../types/inventory';

// Penanda di kolom aksi untuk item yang sudah punya laporan kerusakan (bukan tombol, cuma label).
// - menunggu_perbaikan / diperbaiki -> "Sudah Lapor" (laporan masih berjalan)
// - rusak_berat                     -> "Rusak Berat" (sudah diputuskan tidak bisa diperbaiki)
// Dipakai bareng oleh baris tabel, card mobile, dan kartu "Sedang Anda Pakai" supaya teksnya selalu sama.
export default function InventoryLaporStatus({ status, size = 'md' }: { status: InventoryStatus; size?: 'sm' | 'md' }) {
  const rusakBerat = status === 'rusak_berat';
  const Icon = rusakBerat ? AlertTriangle : Wrench;

  return (
    <span
      title={rusakBerat ? 'Dinyatakan rusak berat, tidak bisa diperbaiki' : 'Laporan kerusakan sudah dikirim, menunggu/sedang ditangani'}
      className={[
        'flex items-center gap-1.5 text-xs font-semibold rounded-lg cursor-default',
        size === 'sm' ? 'px-3 py-1.5' : 'px-3 py-2',
        rusakBerat ? 'text-[#C4411F] bg-[#C4411F]/10 dark:text-[#ff8a65]' : 'text-ink-500 bg-surface-100',
      ].join(' ')}
    >
      <Icon size={size === 'sm' ? 13 : 14} />
      {rusakBerat ? 'Rusak Berat' : 'Sudah Lapor'}
    </span>
  );
}
