#!/usr/bin/env node
/**
 * fix-status-pasang-induk.mjs
 *
 * Menyamakan aturan status di FORM EDIT inventory dengan jalur "Pasang ke Induk" dan jalur
 * pengembalian: item yang menempel ke induk berstatus
 *   - 'dipakai'  kalau induknya sedang dipinjam (punya InventoryPemakai aktif),
 *   - 'tersedia' kalau induknya tidak sedang dipinjam.
 *
 * Sebelumnya form edit SELALU memaksa 'dipakai' saat parent_id terisi, sehingga item yang menempel
 * ke induk yang tidak dipinjam tampil "Dipakai" tanpa pemakai. Aturan baru juga dihitung ulang saat
 * form disimpan lagi (item yang sudah menempel), jadi data lama yang salah ikut terkoreksi.
 * Item yang sedang dalam penanganan (menunggu_perbaikan/diperbaiki/rusak_berat) tetap tidak disentuh.
 *
 * Pemakaian (dari root project):
 *   node fix-status-pasang-induk.mjs            # terapkan
 *   node fix-status-pasang-induk.mjs --dry-run  # cuma cek apakah bisa diterapkan
 *   node fix-status-pasang-induk.mjs /path/ke/project
 *
 * Idempotent. Kalau struktur kode tidak cocok, file TIDAK diubah dan alasannya dicetak.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const FILE = path.join(ROOT, 'app', 'Actions', 'MasterData', 'InventoryAction.php');

const ATTACH_OLD = `        // Baru DIPASANG ke induk (attach) -> paksa 'dipakai'
        if ($parentIdBaru && $parentIdBaru != $parentIdLama) {
            $validated['status'] = 'dipakai';
            return;
        }`;

const ATTACH_NEW = `        // Baru DIPASANG ke induk (attach) -> status mengikuti pinjaman induk
        if ($parentIdBaru && $parentIdBaru != $parentIdLama) {
            $validated['status'] = $this->indukSedangDipinjam((int) $parentIdBaru) ? 'dipakai' : 'tersedia';
            return;
        }`;

const SAME_OLD = `        // MASIH menempel ke induk yang sama -> tetap 'dipakai'
        if ($parentIdBaru) {
            $validated['status'] = 'dipakai';
            return;
        }`;

const SAME_NEW = `        // MASIH menempel ke induk yang sama -> status dihitung ulang mengikuti pinjaman induk
        if ($parentIdBaru) {
            $validated['status'] = $this->indukSedangDipinjam((int) $parentIdBaru) ? 'dipakai' : 'tersedia';
            return;
        }`;

const HELPER = `    /** True kalau induk punya pemakaian aktif (disetujui & belum dikembalikan). */
    private function indukSedangDipinjam(int $parentId): bool
    {
        return InventoryPemakai::where('inventory_id', $parentId)
            ->whereNull('dikembalikan_at')
            ->exists();
    }

`;

const HELPER_ANCHOR = '    // ------------------------------------------------------------------ simpan / perbarui / hapus';

async function main() {
  let src;
  try {
    src = await fs.readFile(FILE, 'utf8');
  } catch {
    console.error(`Tidak ketemu: ${path.relative(ROOT, FILE)}. Jalankan dari root project atau kasih path-nya.`);
    process.exit(1);
  }

  if (src.includes('indukSedangDipinjam')) {
    console.log('InventoryAction.php: sudah diterapkan, dilewati.');
    return;
  }

  const missing = [];
  if (!src.includes(ATTACH_OLD)) missing.push('blok attach');
  if (!src.includes(SAME_OLD)) missing.push('blok "masih menempel"');
  if (!src.includes(HELPER_ANCHOR)) missing.push('anchor helper');
  if (missing.length) {
    console.error(`Struktur tidak cocok (${missing.join(', ')}). TIDAK diubah. Mungkin file sudah diedit manual.`);
    process.exit(1);
  }

  let out = src
    .replace(ATTACH_OLD, ATTACH_NEW)
    .replace(SAME_OLD, SAME_NEW)
    .replace(HELPER_ANCHOR, HELPER + HELPER_ANCHOR);

  // Perbarui komentar invarian (opsional; dilewati kalau teksnya sudah beda).
  out = out.replace(
    /Invariant: item yang MENEMPEL ke item lain \(parent_id terisi\) statusnya HARUS 'dipakai', dan yang\s*\n\s*\* berdiri sendiri\/jadi induk \(parent_id kosong\) HARUS 'tersedia' -- apapun kategorinya, dan terlepas dari\s*\n\s*\* induknya lagi dipinjam atau tidak\./,
    "Invariant: item yang MENEMPEL ke item lain (parent_id terisi) statusnya mengikuti pinjaman induknya\n     * ('dipakai' kalau induk sedang dipinjam, selain itu 'tersedia'), dan yang berdiri sendiri/jadi induk\n     * (parent_id kosong) HARUS 'tersedia' -- apapun kategorinya.",
  );

  if (!DRY) await fs.writeFile(FILE, out, 'utf8');
  console.log(`InventoryAction.php: ${DRY ? 'AKAN diubah' : 'diubah'} (attach + resave mengikuti pinjaman induk).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
