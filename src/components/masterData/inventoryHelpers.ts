/**
 * Helper bersama buat tab-tab inventory (dipisah dari InventoryDetailModal lama yang
 * sudah dihapus karena detail view-nya sudah digabung inline ke TabInventory).
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

// Bentuk minimal yang dibutuhkan namaPemakai/userIdPemakai/isCabangPemakai.
// SENGAJA gak pakai `InventoryPemakai` penuh sebagai tipe parameter:
// InventoryPenanganan.pemakai punya bentuk yang lebih ringkas ({ id, user? }) dan
// gak punya field wajib InventoryPemakai lain (created_at, inventory_id, dst), jadi
// kalau helper ini strict ke InventoryPemakai, TS bakal nolak dipanggil dengan
// p.pemakai. InventoryPemakai tetap otomatis cocok di sini karena dia superset
// dari bentuk minimal ini.
interface PemakaiLike {
  user?: { id: number; name: string; role?: string } | null;
}

// Sejak tabel pekerja dihapus, penerima (karyawan ATAUPUN akun cabang)
// sama-sama nempel lewat relasi `user` -- bedanya cuma role. "Akun cabang"
// dicek dari user.role === 'cabang', bukan lagi ada/tidaknya objek pekerja.
export function isCabangPemakai(pemakai?: PemakaiLike | null): boolean {
  return pemakai?.user?.role === 'cabang';
}
/**
 * Ambil nama penerima inventory -- karyawan maupun akun cabang, dua-duanya
 * lewat relasi `user` yang sama (tidak ada lagi objek `pekerja` terpisah).
 * Terima InventoryPemakai penuh ATAU bentuk ringkas InventoryPenanganan.pemakai.
 */
export function namaPemakai(pemakai?: PemakaiLike | null): string {
  return pemakai?.user?.name || '-';
}

/**
 * Ambil user id penerima inventory, dipakai buat cek "apakah aku peminjamnya".
 */
export function userIdPemakai(pemakai?: PemakaiLike | null): number | undefined {
  return pemakai?.user?.id ?? undefined;
}

export function formatRupiah(n: number | null): string {
  if (n == null) return '-';
  return 'Rp ' + n.toLocaleString('id-ID');
}