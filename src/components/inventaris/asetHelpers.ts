/**
 * Helper bersama buat tab-tab aset (dipisah dari AsetDetailModal lama yang
 * sudah dihapus karena detail view-nya sudah digabung inline ke TabAset).
 */

export function formatTanggalId(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Gabung tanggal + jam jadi satu string, buat kolom tabel yang cuma punya
// 1 slot ("Tgl Serah Terima", "Tgl Lapor", dst) tapi mau nunjukin jam
// kejadian juga -- bukan bikin kolom baru. `waktuAkurat` idealnya diisi
// kolom *_at (diterima_at/dikembalikan_at/lapor_at, datetime lengkap);
// `tanggalFallback` (kolom tanggal_* lama, cuma nyimpen tanggal) dipakai
// kalau *_at-nya null (data lama sebelum kolom *_at ada / belum tercatat).
export function formatTanggalWaktuId(waktuAkurat: string | null, tanggalFallback: string | null): string {
  if (waktuAkurat) {
    const d = new Date(waktuAkurat);
    const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${tanggal}, ${jam}`;
  }
  return formatTanggalId(tanggalFallback);
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
// di asetHelpers.ts
export function isCabangPemakai(pemakai?: PemakaiLike | null): boolean {
  return !pemakai?.pekerja && !!pemakai?.user;
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