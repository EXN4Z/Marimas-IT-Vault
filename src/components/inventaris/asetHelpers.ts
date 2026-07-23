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

// Bentuk minimal yang dibutuhkan namaPemakai/userIdPemakai. SENGAJA gak
// pakai `AsetPemakai` penuh sebagai tipe parameter: AsetPenanganan.pemakai
// punya bentuk yang lebih ringkas ({ id, pekerja?, user? }) dan gak punya
// field wajib AsetPemakai lain (created_at, aset_id, dst), jadi kalau
// helper ini strict ke AsetPemakai, TS bakal nolak dipanggil dengan
// p.pemakai. AsetPemakai tetap otomatis cocok di sini karena dia superset
// dari bentuk minimal ini.
interface PemakaiLike {
  pekerja?: { user?: { id: number; name: string } } | null;
  user?: { id: number; name: string } | null;
}

/**
 * Ambil nama penerima aset, entah dia karyawan (lewat pekerja.user)
 * atau akun cabang (lewat user langsung). Terima AsetPemakai penuh
 * ATAU bentuk ringkas AsetPenanganan.pemakai.
 */
export function namaPemakai(pemakai?: PemakaiLike | null): string {
  return pemakai?.pekerja?.user?.name || pemakai?.user?.name || '-';
}

/**
 * Ambil user id penerima aset, dipakai buat cek "apakah aku peminjamnya".
 * Sama-sama harus cek dua kemungkinan (pekerja.user.id atau user.id).
 */
export function userIdPemakai(pemakai?: PemakaiLike | null): number | undefined {
  return pemakai?.pekerja?.user?.id ?? pemakai?.user?.id ?? undefined;
}

export function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}