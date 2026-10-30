import type { AktivitasInventoryTerbaru } from '../../types';

export type AktivitasTone = 'primary' | 'green' | 'yellow' | 'alert' | 'slate';

// [DASHBOARD-V4] Warna titik: Dipinjam ungu, Dikembalikan hijau, Lapor Rusak kuning, Rusak Berat merah.
export function toneAktivitas(ev: AktivitasInventoryTerbaru): AktivitasTone {
  switch (ev.type) {
    case 'pinjam':
      return 'primary';
    case 'kembali':
      return 'green';
    case 'lapor_rusak':
    case 'mulai_perbaikan':
      return 'yellow';
    case 'selesai_perbaikan':
      return ev.hasil === 'rusak_berat' ? 'alert' : 'green';
    default:
      return 'slate';
  }
}

// Label aksi singkat: "Agnes <Meminjam>".
export function labelAktivitas(ev: AktivitasInventoryTerbaru): string {
  switch (ev.type) {
    case 'pinjam':
      return 'Meminjam';
    case 'kembali':
      return 'Mengembalikan';
    case 'lapor_rusak':
      return 'Lapor Rusak';
    case 'mulai_perbaikan':
      return 'Mulai Perbaikan';
    case 'selesai_perbaikan':
      return ev.hasil === 'rusak_berat' ? 'Rusak Berat' : 'Selesai Perbaikan';
    default:
      return 'Menjual';
  }
}

const dua = (n: number) => String(n).padStart(2, '0');

// "AM 09:10" + "05/10/2026"
export function waktuRingkas(iso: string): { jam: string; tanggal: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { jam: '-', tanggal: '-' };
  return { jam: `${d.getHours() < 12 ? 'AM' : 'PM'} ${dua(d.getHours())}:${dua(d.getMinutes())}`, tanggal: `${dua(d.getDate())}/${dua(d.getMonth() + 1)}/${d.getFullYear()}` };
}
