#!/usr/bin/env node
// =============================================================================
// F4 - Migrasi ke Inertia: Inventory (list/detail/riwayat -> props, store/update/destroy/jual/pasang-ke-induk/
//      lepas-dari-induk/import -> router, form & detail = modal overlay di tab Inventory)
//
// Syarat: F1 + F2 + F3 sudah terpasang (pola acuan: CabangWebController, KaryawanWebController, FlashToaster, grup route master-data).
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f4.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f4.mjs            terapkan
//   node f4.mjs --revert   kembalikan semua dari .migrasi-backup/f4/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x (atau file yang diganti total isinya
// beda dari versi zip), script berhenti SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// File yang dihapus DIPINDAH ke .migrasi-backup/f4/ (bukan dihapus permanen) dan dikembalikan oleh --revert.
// Langkah { find, with } = ganti teks (harus ketemu tepat 1x). { start, end, with } = ganti dari anchor awal sampai
// SEBELUM anchor akhir. { replaceAll, sha } = ganti seluruh isi file, hanya jika SHA-256 isi aslinya (line ending
// dinormalisasi ke LF) cocok dengan versi zip yang dipakai menyusun script ini.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FASE = 'f4';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    path: "app/Queries/InventoryQuery.php",
    content: `<?php

namespace App\\Queries;

use App\\Models\\MasterData\\Inventory;
use App\\Models\\User;
use Illuminate\\Database\\Eloquent\\Builder;

/**
 * [F4-INERTIA] Query dasar & aturan akses inventory, dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\MasterData\\InventoryController (index, show -- masih dipakai Laporan/Dashboard sampai F7/F8)
 *  - Web : App\\Http\\Controllers\\MasterData\\InventoryWebController (props tab Inventory di Master Data)
 *
 * Aturan scoping role dipindah APA ADANYA dari InventoryController::index() / show().
 */
class InventoryQuery
{
    /** Status yang SAMA SEKALI tidak boleh dilihat non-admin (bukan cuma disembunyikan di tab React). */
    public const STATUS_TERSEMBUNYI_NON_ADMIN = ['rusak_berat', 'dijual', 'rusak'];

    /** Eager-load yang dibutuhkan baris tabel / card / export inventory. */
    public static function dasar(): Builder
    {
        return Inventory::with([
            'kategori',
            'perusahaan',
            'supplier',
            'parent:id,kode_inventory,nama',
            'pemakaiSaatIni.user.departemen',
            'pemakaiPending.user.departemen',
            'penangananAktif',
            'writeoff.penyetuju:id,name',
        ]);
    }

    /** Eager-load lengkap buat modal detail (riwayat pemakai & penanganan + kelengkapan anak). */
    public static function relasiDetail(): array
    {
        return [
            'perusahaan',
            'kategori',
            'supplier',
            'parent',
            'children.supplier',
            'pemakaiSaatIni.user.departemen',
            'pemakaiPending.user.departemen',
            'pemakai.user.departemen',
            'penanganan.pemakai.user:id,name',
            'penanganan.dilaporkanOleh:id,name',
            'penangananAktif',
            'writeoff.penyetuju:id,name',
        ];
    }

    /**
     * Batasi query ke inventory yang BOLEH dilihat $user. Admin: semua. Non-admin: hanya yang 'tersedia' PLUS
     * yang lagi dia pegang/pending sendiri (pemakaiSaatIni/pemakaiPending, bukan riwayat lengkap), dan status
     * rusak_berat/dijual/rusak dikecualikan total.
     */
    public static function batasiUntuk(Builder $query, ?User $user): Builder
    {
        if ($user?->role === 'admin') {
            return $query;
        }

        return $query->whereNotIn('status', self::STATUS_TERSEMBUNYI_NON_ADMIN)
            ->where(function ($q) use ($user) {
                $q->where('status', 'tersedia')
                    ->orWhereHas('pemakaiSaatIni', function ($sub) use ($user) {
                        $sub->where('user_id', $user->id);
                    })
                    ->orWhereHas('pemakaiPending', function ($sub) use ($user) {
                        $sub->where('user_id', $user->id);
                    });
            });
    }

    /**
     * Boleh buka detail satu item? Aturan sama dengan batasiUntuk() tapi per-item. WAJIB dicek terpisah karena
     * detail bisa diminta langsung lewat ID tanpa lewat daftar/tabel.
     */
    public static function bolehDilihat(Inventory $inventory, ?User $user): bool
    {
        if ($user?->role === 'admin') {
            return true;
        }

        if (in_array($inventory->status, self::STATUS_TERSEMBUNYI_NON_ADMIN, true)) {
            return false;
        }

        $terkaitUser = $inventory->pemakaiSaatIni()->where('user_id', $user->id)->exists()
            || $inventory->pemakaiPending()->where('user_id', $user->id)->exists();

        return $inventory->status === 'tersedia' || $terkaitUser;
    }
}
`,
  },
  {
    path: "app/Actions/MasterData/InventoryAction.php",
    content: `<?php

namespace App\\Actions\\MasterData;

use App\\Http\\Controllers\\Concerns\\GeneratesStrukNumber;
use App\\Http\\Controllers\\Concerns\\SimpanFotoBukti;
use App\\Models\\MasterData\\Inventory;
use App\\Models\\Transaksi\\InventoryPemakai;
use App\\Models\\Transaksi\\InventoryWriteoff;
use App\\Models\\User;
use App\\Notifications\\KelengkapanDilepasDariInduk;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Log;
use Illuminate\\Support\\Facades\\Notification;
use Illuminate\\Support\\Facades\\Storage;
use Illuminate\\Validation\\ValidationException;

/**
 * [F4-INERTIA] Logika mutasi inventory (simpan / perbarui / hapus / jual / pasang ke induk / lepas dari induk),
 * dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\MasterData\\InventoryController (JSON, sampai F10)
 *  - Web : App\\Http\\Controllers\\MasterData\\InventoryWebController (redirect back + flash)
 *
 * Aturan validasi & aturan bisnis dipindah APA ADANYA dari InventoryController. Dulu pelanggaran aturan
 * dilempar lewat abort(422, ...); sekarang ValidationException supaya halaman web bisa menampilkannya
 * di dalam modal lewat error bag (API tetap membalas 422 dengan \`message\` yang sama).
 *
 * Kunci error untuk pelanggaran non-field: parent_id (struktur induk), delete (+ force_available),
 * jual, pasang, lepas.
 */
class InventoryAction
{
    use GeneratesStrukNumber;
    use SimpanFotoBukti;

    // ------------------------------------------------------------------ validasi

    /**
     * Validasi bareng buat store() & update(). Field unique (serial_number) dikecualikan dari record itu
     * sendiri kalau lagi mode update. Multipart FormData ngirim '' (bukan field ilang) pas dikosongkan dari FE,
     * jadi field nullable dinormalisasi manual ke null biar exists:... gak ikut divalidasi.
     */
    public function validasi(Request $request, ?Inventory $inventory = null): array
    {
        // PENTING: normalisasi parent_id HARUS dicek $request->has() dulu -- kalau field itu tidak dikirim
        // (admin cuma edit field lain), merge() tanpa cek ini akan MEMAKSA parent_id jadi null dan
        // $parentBaruDilepas di perbarui() salah kedeteksi (status kelengkapan ke-reset tanpa sengaja).
        if ($request->has('parent_id')) {
            $request->merge([
                'parent_id' => $request->parent_id === '' ? null : $request->parent_id,
            ]);
        }

        $request->merge([
            'serial_number' => $request->serial_number === '' ? null : $request->serial_number,
            'kategori_id' => $request->kategori_id === '' ? null : $request->kategori_id,
            'supplier_id' => $request->supplier_id === '' ? null : $request->supplier_id,
        ]);

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:inventory,id',
            'kategori_id' => 'required|exists:kategori,id',
            'nama' => 'nullable|string|max:255',
            'warna' => 'nullable|string|max:255',
            'merk' => 'nullable|string|max:255',
            'type' => 'nullable|string|max:255',
            'serial_number' => [
                'nullable',
                'string',
                'max:255',
                $inventory
                    ? 'unique:inventory,serial_number,' . $inventory->id
                    : 'unique:inventory,serial_number',
            ],
            'jumlah' => 'nullable|integer|min:1',
            'tanggal_garansi' => 'nullable|date',
            'tanggal_input' => 'nullable|date',
            'tanggal_invoice' => 'nullable|date',
            'perusahaan_id' => 'nullable|exists:perusahaan,id',
            'keterangan' => 'nullable|string',
            'foto' => 'nullable|image|max:4096',
            'supplier_id' => 'nullable|exists:supplier,id',
            'no_surat_jalan' => 'nullable|string|max:255',
            'no_good_receive' => 'nullable|string|max:255',
            'status' => 'nullable|in:tersedia,dipakai,menunggu_perbaikan,diperbaiki,rusak_berat',
            'tanggal_rusak' => 'nullable|date',
        ]);

        $this->validasiParent($validated, $inventory);
        $this->selaraskanStatusByParent($validated, $inventory);

        return $validated;
    }

    /**
     * Constraint struktural (bukan kategori): (a) item yang mau dikasih parent_id gak boleh sudah punya child
     * sendiri; (b) target parent-nya harus "induk murni" (belum menempel ke item lain, maks 1 level);
     * (c) gak boleh nempel ke diri sendiri.
     */
    private function validasiParent(array $validated, ?Inventory $inventory): void
    {
        if (empty($validated['parent_id'])) {
            return;
        }

        if ($inventory && $validated['parent_id'] == $inventory->id) {
            $this->tolak('parent_id', 'Item tidak boleh menempel ke dirinya sendiri.');
        }

        if ($inventory && $inventory->children()->exists()) {
            $this->tolak('parent_id', 'Item ini masih punya item lain yang menempel padanya, jadi tidak bisa dipasang menempel ke induk lain. Lepas dulu semua item yang menempel sebelum memasang item ini ke induk lain.');
        }

        $parent = Inventory::find($validated['parent_id']);
        if (!$parent) {
            $this->tolak('parent_id', 'parent_id yang dipilih tidak ditemukan.');
        }
        if ($parent->parent_id) {
            $this->tolak('parent_id', 'Item yang dipilih sebagai induk sudah menempel ke item lain, jadi tidak bisa dijadikan induk (maksimal 1 level nesting).');
        }
    }

    /**
     * Invariant: item yang MENEMPEL ke item lain (parent_id terisi) statusnya HARUS 'dipakai', dan yang
     * berdiri sendiri/jadi induk (parent_id kosong) HARUS 'tersedia' -- apapun kategorinya, dan terlepas dari
     * induknya lagi dipinjam atau tidak.
     */
    private function selaraskanStatusByParent(array &$validated, ?Inventory $inventory): void
    {
        $parentIdLama = $inventory?->parent_id;
        $parentIdBaru = array_key_exists('parent_id', $validated)
            ? $validated['parent_id']
            : $parentIdLama;

        // Baru DIPASANG ke induk (attach) -> paksa 'dipakai'
        if ($parentIdBaru && $parentIdBaru != $parentIdLama) {
            $validated['status'] = 'dipakai';
            return;
        }

        // Baru DILEPAS dari induk (detach) -> paksa 'tersedia'
        if ($parentIdLama && !$parentIdBaru) {
            $validated['status'] = 'tersedia';
            return;
        }

        // MASIH menempel ke induk yang sama -> tetap 'dipakai'
        if ($parentIdBaru) {
            $validated['status'] = 'dipakai';
            return;
        }

        // Dari awal sudah berdiri sendiri: mode update -> buang key status biar form Edit tidak menimpa status
        // secara tidak sengaja; mode store (item baru) -> default aman 'tersedia'.
        if (array_key_exists('status', $validated) && $inventory) {
            unset($validated['status']);
        } elseif (!$inventory) {
            $validated['status'] = 'tersedia';
        }
    }

    // ------------------------------------------------------------------ simpan / perbarui / hapus

    /** kode_inventory digenerate otomatis lewat trigger DB, JANGAN dikirim dari frontend. */
    public function simpan(Request $request, array $validated): Inventory
    {
        return DB::transaction(function () use ($request, $validated) {
            if ($request->hasFile('foto')) {
                $validated['foto'] = $request->file('foto')->store('inventory', 'public');
            }

            return Inventory::create($validated);
        });
    }

    /**
     * Foto lama dihapus dari storage kalau diganti foto baru / di-hapus (hapus_foto). Kalau parent_id berubah
     * (attach/detach lewat form Edit), riwayat InventoryPemakai kelengkapan ikut diselaraskan; status sendiri
     * sudah ditentukan selaraskanStatusByParent() di validasi().
     */
    public function perbarui(Request $request, Inventory $inventory, array $validated): Inventory
    {
        DB::transaction(function () use ($request, $validated, $inventory) {
            if ($request->hasFile('foto')) {
                if ($inventory->foto) {
                    Storage::disk('public')->delete($inventory->foto);
                }
                $validated['foto'] = $request->file('foto')->store('inventory', 'public');
            } elseif ($request->boolean('hapus_foto')) {
                if ($inventory->foto) {
                    Storage::disk('public')->delete($inventory->foto);
                }
                $validated['foto'] = null;
            }

            // parent_id LAMA ditangkap sebelum update() buat bedain "baru di-attach/dilepas sekarang" vs
            // "form disubmit ulang dengan parent_id yang sama".
            $parentIdLama = $inventory->parent_id;

            $inventory->update($validated);

            $parentBaruDiattach = $inventory->parent_id
                && $inventory->parent_id != $parentIdLama;

            $parentBaruDilepas = $parentIdLama
                && !$inventory->parent_id;

            if ($parentBaruDiattach) {
                $this->ikutkanKelengkapanKePemakaianInduk($inventory);
            }

            if ($parentBaruDilepas) {
                $this->lepasKelengkapanDariPemakaianAktif($inventory, 'Dikembalikan otomatis — kelengkapan dilepas dari induk lewat form edit.');
            }
        });

        return $inventory->fresh();
    }

    /**
     * Aturan (urutan cek):
     * 1. SELALU (termasuk force): item ini atau kelengkapan yang menempel padanya TIDAK boleh punya pinjaman
     *    aktif (disetujui/pending & belum dikembalikan).
     * 2. Tanpa force: tolak kalau punya kelengkapan menempel, masih menempel ke induk, punya riwayat penanganan,
     *    atau punya riwayat peminjaman (error ini membawa key \`force_available\`).
     * 3. force: lewatin guard riwayat -- kelengkapan anak dilepas dulu (berdiri sendiri, bukan ikut kehapus).
     * FK inventory_pemakai/penanganan/writeoff nullOnDelete, jadi riwayatnya TETAP ada.
     *
     * @return string kode_inventory yang dihapus (buat pesan sukses)
     */
    public function hapus(Inventory $inventory, bool $force = false): string
    {
        $idTerkait = $inventory->children()->pluck('id')->push($inventory->id);

        $pinjamanAktif = InventoryPemakai::whereIn('inventory_id', $idTerkait)
            ->whereIn('status', ['disetujui', 'pending'])
            ->whereNull('tanggal_pengembalian')
            ->exists();

        if ($pinjamanAktif) {
            $this->tolak('delete', 'Item ini (atau kelengkapan yang menempel padanya) masih dalam pinjaman. Kembalikan dulu sebelum menghapus.');
        }

        if (!$force) {
            if ($inventory->children()->exists()) {
                $this->tolakHapusBisaPaksa('Item ini masih punya kelengkapan yang menempel. Lepas dulu kelengkapannya sebelum menghapus.');
            }

            if ($inventory->parent_id) {
                $this->tolakHapusBisaPaksa('Item ini masih menempel ke induk. Lepas dulu dari induknya sebelum menghapus.');
            }

            if ($inventory->penanganan()->exists()) {
                $this->tolakHapusBisaPaksa('Item ini punya riwayat perbaikan/penanganan dan tidak bisa dihapus.');
            }

            if ($inventory->pemakai()->exists()) {
                $this->tolakHapusBisaPaksa('Item ini punya riwayat peminjaman dan tidak bisa dihapus.');
            }
        } else {
            // Query builder gak lewat selaraskanStatusByParent(), jadi status disamakan manual biar invariant
            // "parent_id null => status tersedia" tetap konsisten. Aman: guard (1) memastikan anak tidak dipinjam.
            $inventory->children()->update(['parent_id' => null, 'status' => 'tersedia']);
        }

        $kodeInventory = $inventory->kode_inventory;
        $inventory->delete();

        return $kodeInventory;
    }

    // ------------------------------------------------------------------ jual

    /**
     * Cuma berlaku buat item yang berdiri sendiri (bukan yang menempel ke item lain, dan bukan yang masih punya
     * item lain menempel padanya). Item yang menempel & rusak permanen ditangani lewat alur lapor kerusakan.
     */
    public function jual(Request $request, Inventory $inventory): Inventory
    {
        if ($inventory->children()->exists()) {
            $this->tolak('jual', 'Item ini masih punya kelengkapan yang menempel. Lepas dulu kelengkapannya sebelum menjual/writeoff item ini.');
        }

        if ($inventory->parent_id) {
            $this->tolak('jual', 'Item ini masih menempel ke induk. Lepas dulu dari induknya sebelum menjual/writeoff item ini.');
        }

        if ($inventory->status !== 'rusak_berat' && $inventory->status !== 'tersedia') {
            $this->tolak('jual', 'Item hanya bisa dijual jika statusnya Tersedia atau Rusak Berat.');
        }

        $validated = $request->validate([
            'alasan' => 'nullable|string',
            'no_berita_acara' => 'nullable|string|max:255',
            'catatan' => 'nullable|string',
        ]);

        DB::transaction(function () use ($inventory, $request, $validated) {
            $inventory->update(['status' => 'dijual']);

            // jaga-jaga: pemakaian yang masih "nyangkut" aktif ditutup paksa biar "Dipakai Oleh" tidak nunjuk
            // ke orang yang udah gak pegang item ini lagi.
            InventoryPemakai::where('inventory_id', $inventory->id)
                ->where('status', 'disetujui')
                ->whereNull('tanggal_pengembalian')
                ->update([
                    'tanggal_pengembalian' => now(),
                    'dikembalikan_at' => now(),
                    'catatan_pengembalian' => 'Dikembalikan otomatis — barang dijual.',
                ]);

            // catat sebagai riwayat writeoff (siapa yang nyetujui, kapan, kenapa)
            InventoryWriteoff::updateOrCreate(
                ['inventory_id' => $inventory->id],
                [
                    'disetujui_oleh' => $request->user()?->id,
                    'alasan' => $validated['alasan'] ?? 'Rusak berat, tidak dapat diperbaiki lagi.',
                    'no_berita_acara' => $validated['no_berita_acara'] ?? null,
                    'tanggal_writeoff' => now()->toDateString(),
                    'catatan' => $validated['catatan'] ?? null,
                ]
            );
        });

        return $inventory->fresh();
    }

    // ------------------------------------------------------------------ pasang / lepas induk

    /**
     * eks AsetKelengkapanController@pasangPengganti. Nempelin item 'tersedia' ke induk tertentu. Kalau induk
     * tujuan lagi dipinjam, item ini ikut dibikinin record InventoryPemakai sendiri (foto_penerimaan wajib)
     * supaya ke-cover cascade kembalikan() waktu induknya dikembalikan.
     */
    public function pasangKeInduk(Request $request, Inventory $inventory): Inventory
    {
        // item yang sendiri sudah jadi induk gak bisa sekaligus jadi anak (cegah nesting > 1 level)
        if ($inventory->children()->exists()) {
            $this->tolak('pasang', 'Item ini masih punya item lain yang menempel padanya, jadi tidak bisa dipasang ke induk lain.');
        }

        if ($inventory->status !== 'tersedia') {
            $this->tolak('pasang', 'Kelengkapan ini tidak tersedia untuk dipasang.');
        }

        $request->validate([
            'parent_id' => 'required|exists:inventory,id',
        ]);

        if ((int) $request->input('parent_id') === $inventory->id) {
            $this->tolak('pasang', 'Item tidak boleh menempel ke dirinya sendiri.');
        }

        $parent = Inventory::findOrFail($request->input('parent_id'));
        if ($parent->parent_id) {
            $this->tolak('pasang', 'Item yang dipilih sebagai induk sudah menempel ke item lain, jadi tidak bisa dijadikan induk.');
        }

        // foto cuma wajib kalau induknya beneran lagi dipinjam (baru di situ ada record InventoryPemakai)
        $pemakaiIndukAktif = InventoryPemakai::where('inventory_id', $parent->id)
            ->where('status', 'disetujui')
            ->whereNull('tanggal_pengembalian')
            ->first();

        $rules = ['catatan_penerimaan' => 'nullable|string'];
        if ($pemakaiIndukAktif) {
            $rules['foto_penerimaan'] = 'required|array|min:1|max:3';
            $rules['foto_penerimaan.*'] = 'image|mimes:jpg,jpeg,png,webp|max:1024';
        }

        $validated = $request->validate($rules, [
            'foto_penerimaan.*.max' => 'Maksimal size foto adalah 1MB',
            'foto_penerimaan.required' => 'Foto penerimaan wajib diisi karena barang utama ini sedang dipinjam.',
        ]);

        DB::transaction(function () use ($inventory, $parent, $request, $validated, $pemakaiIndukAktif) {
            $inventory->update([
                'parent_id' => $parent->id,
                'status' => $pemakaiIndukAktif ? 'dipakai' : 'tersedia',
            ]);

            if ($pemakaiIndukAktif) {
                $noStruk = $this->generateNoStrukRandom('inventory_pemakai', 'no_struk_penerimaan');
                $fotoPaths = $this->simpanFotoBukti($request, 'foto_penerimaan', 'inventory-pemakai/penerimaan');

                InventoryPemakai::create([
                    'inventory_id' => $inventory->id,
                    'user_id' => $pemakaiIndukAktif->user_id,
                    'status' => 'disetujui',
                    'requested_by_user_id' => $request->user()?->id,
                    'no_struk_penerimaan' => $noStruk,
                    'tanggal_penerimaan' => now()->toDateString(),
                    'diterima_at' => now(),
                    'catatan_penerimaan' => $validated['catatan_penerimaan']
                        ?? 'Dipasang susulan -- mengikuti barang utama yang sedang dipinjam.',
                    'foto_penerimaan' => $fotoPaths,
                ]);
            }
        });

        return $inventory->fresh();
    }

    /**
     * Jalur cepat khusus tombol "Lepas dari Induk" buat ngosongin parent_id kelengkapan yang lagi nempel.
     * Status dipaksa balik 'tersedia' (invariant parent_id null => tersedia) KECUALI item lagi dalam proses
     * penanganan (menunggu_perbaikan/diperbaiki/rusak_berat) -- status itu tidak boleh ditimpa.
     */
    public function lepasDariInduk(Request $request, Inventory $inventory): Inventory
    {
        if (!$inventory->parent_id) {
            $this->tolak('lepas', 'Item ini tidak sedang menempel ke induk manapun.');
        }

        $validated = $request->validate([
            'keterangan' => 'nullable|string',
        ]);

        // tangkep dulu sebelum parent_id dikosongin -- butuh buat isi pesan notif ("sebelumnya terpasang di ...")
        $indukLabel = null;
        $parent = $inventory->load('parent')->parent;
        if ($parent) {
            $indukLabel = trim(($parent->kode_inventory ?? '') . ' ' . ($parent->nama ?? ''));
        }

        DB::transaction(function () use ($inventory) {
            $statusSedangDitangani = in_array($inventory->status, ['menunggu_perbaikan', 'diperbaiki', 'rusak_berat'], true);

            $inventory->update([
                'parent_id' => null,
                'status' => $statusSedangDitangani ? $inventory->status : 'tersedia',
            ]);

            $this->lepasKelengkapanDariPemakaianAktif($inventory, 'Dikembalikan otomatis — kelengkapan dilepas dari induk oleh admin.');
        });

        // notif ke admin lain (exclude yang ngelakuin aksi). try-catch: aksi lepas yang SUDAH tersimpan jangan
        // ikut gagal kalau notif error.
        try {
            $pelaku = $request->user();

            Notification::send(
                User::whereHas('roleRef', fn ($q) => $q->where('nama', 'admin'))
                    ->where('id', '!=', $pelaku->id)
                    ->get(),
                new KelengkapanDilepasDariInduk(
                    $inventory,
                    $indukLabel,
                    $inventory->status,
                    $validated['keterangan'] ?? null,
                    $pelaku->name
                )
            );
        } catch (\\Throwable $e) {
            Log::error('Gagal mengirim notifikasi lepas kelengkapan dari induk', [
                'inventory_id' => $inventory->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $inventory->fresh();
    }

    // ------------------------------------------------------------------ helper riwayat pemakaian

    /**
     * Kalau induk $inventory (kelengkapan yang baru di-attach) lagi punya pemakaian aktif, buatkan $inventory
     * record InventoryPemakai yang senasib (user & foto penerimaan sama seperti induknya). Murni soal riwayat;
     * status ditentukan selaraskanStatusByParent(). Dipanggil di DALAM DB::transaction.
     */
    private function ikutkanKelengkapanKePemakaianInduk(Inventory $inventory): void
    {
        $pemakaiAktifInduk = InventoryPemakai::where('inventory_id', $inventory->parent_id)
            ->where('status', 'disetujui')
            ->whereNull('tanggal_pengembalian')
            ->latest('tanggal_penerimaan')
            ->first();

        if (!$pemakaiAktifInduk) {
            return;
        }

        $noStrukAnak = $this->generateNoStrukRandom('inventory_pemakai', 'no_struk_penerimaan');

        InventoryPemakai::create([
            'inventory_id' => $inventory->id,
            'user_id' => $pemakaiAktifInduk->user_id,
            'status' => 'disetujui',
            'no_struk_penerimaan' => $noStrukAnak,
            'tanggal_penerimaan' => now()->toDateString(),
            'diterima_at' => now(),
            'catatan_penerimaan' => 'Ditambahkan & dipinjamkan otomatis -- menempel ke barang utama yang sedang dipakai.',
            'foto_penerimaan' => $pemakaiAktifInduk->foto_penerimaan,
        ]);
    }

    /**
     * Simetris dengan ikutkanKelengkapanKePemakaianInduk(): tutup pemakaian aktif $inventory kalau ada (idempotent).
     * Murni beres-beres riwayat InventoryPemakai. Dipanggil di DALAM DB::transaction.
     */
    private function lepasKelengkapanDariPemakaianAktif(Inventory $inventory, string $catatanPengembalian): void
    {
        InventoryPemakai::where('inventory_id', $inventory->id)
            ->where('status', 'disetujui')
            ->whereNull('tanggal_pengembalian')
            ->update([
                'tanggal_pengembalian' => now(),
                'dikembalikan_at' => now(),
                'catatan_pengembalian' => $catatanPengembalian,
            ]);
    }

    // ------------------------------------------------------------------ error

    private function tolak(string $key, string $pesan): never
    {
        throw ValidationException::withMessages([$key => $pesan]);
    }

    /** Penolakan hapus yang masih bisa dipaksa: \`force_available\` ikut dikirim supaya modal menawarkan "Hapus Paksa". */
    private function tolakHapusBisaPaksa(string $pesan): never
    {
        throw ValidationException::withMessages(['delete' => $pesan, 'force_available' => '1']);
    }
}
`,
  },
  {
    path: "app/Http/Controllers/MasterData/InventoryWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Actions\\MasterData\\InventoryAction;
use App\\Http\\Controllers\\Controller;
use App\\Imports\\MasterData\\InventoryBuktiImport;
use App\\Models\\MasterData\\Inventory;
use App\\Queries\\InventoryQuery;
use Exception;
use Illuminate\\Database\\Eloquent\\Builder;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

// [F4-INERTIA] Versi Inertia dari InventoryController (API) untuk tab "Inventory" di Master Data.
// Data baca (daftar/dipakai/export/opsi/detail) dipanggil MasterDataPageController sebagai props; mutasi dipanggil
// lewat routes/web.php (session + CSRF, admin-only), balasan = redirect back + flash (bukan JSON).
// Logika mutasi & aturan akses SAMA dengan versi API karena dipakai bareng lewat InventoryAction / InventoryQuery.
// InventoryController (API) sengaja dibiarkan dulu: GET /api/inventory masih dipakai Laporan (F7) & Dashboard (F8).
class InventoryWebController extends Controller
{
    private const PER_HALAMAN = 10;

    private const STATUS = ['tersedia', 'dipakai', 'menunggu_perbaikan', 'diperbaiki', 'rusak_berat', 'dijual'];

    // Status yang cuma bisa dipunyai item yang BUKAN child (jual() menolak item yang punya parent_id).
    private const STATUS_KHUSUS_INDUK = ['dijual'];

    public function __construct(private InventoryAction $inventory)
    {
    }

    // ================================================================== DATA BACA (props halaman Master Data)

    // Satu halaman data tab Inventory. Pagination, pencarian, filter status, dan filter kategori dijalankan
    // server; sumber kebenarannya query string (?search=&status=&kategori[]=&page=). Urutan: status
    // (tersedia, dipakai, penanganan, rusak_berat, dijual) lalu kode_inventory. Tiap baris sudah lengkap
    // (relasi list + children_count), jadi modal edit cukup pakai baris ini -- tidak perlu request tambahan.
    public static function daftar(Request $request): array
    {
        $f = self::filterEfektif($request);

        $query = self::queryTerfilter($request, $f);

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / self::PER_HALAMAN));
        // halaman di luar jangkauan (mis. habis hapus item terakhir di halaman terakhir) -> geser ke halaman terakhir
        $page = min(max(1, (int) $request->query('page', 1)), $lastPage);

        $rows = self::urutkan($query->withCount('children'))
            ->forPage($page, self::PER_HALAMAN)
            ->get();

        return [
            'data' => $rows->all(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => self::PER_HALAMAN,
            // Ada item induk (parent_id kosong) di populasi filter kategori aktif? Menentukan tab status "Dijual" tampil.
            'ada_induk' => $f['ada_induk'],
            'filters' => [
                'search' => $f['search'] ?? '',
                'status' => $f['status'] ?? '',
                'kategori' => $f['kategori'],
            ],
        ];
    }

    // Non-admin: inventory yang LAGI dia pegang/ditangani (card "Sedang Anda Pakai"). Admin: kosong.
    public static function dipakai(Request $request): array
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            return [];
        }

        return InventoryQuery::batasiUntuk(InventoryQuery::dasar(), $user)
            ->whereHas('pemakaiSaatIni', fn ($q) => $q->where('user_id', $user->id))
            ->latest()
            ->get()
            ->all();
    }

    // SEMUA hasil filter aktif (bukan cuma halaman yang tampil) buat modal Export. Di MasterDataPageController
    // dikirim sebagai optional prop: baru dihitung waktu diminta lewat partial reload.
    public static function untukExport(Request $request): array
    {
        $f = self::filterEfektif($request);

        return self::urutkan(self::queryTerfilter($request, $f))->get()->all();
    }

    // Kandidat induk (item apapun yang berdiri sendiri) buat form "Pasang ke Induk" & modal Pasang ke Induk.
    // Optional prop: baru dimuat waktu modal dibuka.
    public static function indukOpsi(): array
    {
        return Inventory::indukSendiri()
            ->orderBy('kode_inventory')
            ->get(['id', 'kode_inventory', 'nama'])
            ->all();
    }

    // Pilihan dropdown form Tambah/Edit & filter kategori. Perilaku lama dipertahankan: kategori/supplier/perusahaan
    // dulu diambil lewat endpoint admin-only, jadi non-admin menerima daftar kosong.
    public static function opsi(Request $request): array
    {
        $admin = $request->user()->isAdmin();

        return [
            'kategori' => $admin ? KategoriWebController::daftar() : [],
            'supplier' => $admin ? SupplierWebController::daftar() : [],
            'perusahaan' => $admin ? PerusahaanWebController::daftar() : [],
        ];
    }

    // Detail satu item (?detail=<id>) lengkap dengan riwayat pemakai/penanganan + kelengkapan anak. null kalau
    // tidak ada / tidak boleh dilihat user ini (aturan sama dengan InventoryController::show(); tidak abort(403)
    // supaya visit-nya tidak jadi halaman error -- klien menampilkan toast).
    public static function detail(Request $request): ?Inventory
    {
        $id = (int) $request->query('detail', 0);
        if ($id <= 0) {
            return null;
        }

        $inventory = Inventory::find($id);
        if (!$inventory || !InventoryQuery::bolehDilihat($inventory, $request->user())) {
            return null;
        }

        return $inventory->load(InventoryQuery::relasiDetail());
    }

    // ================================================================== MUTASI (admin-only, redirect back + flash)

    // POST /master-data/inventory  (multipart: foto)
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->inventory->validasi($request);

        $this->inventory->simpan($request, $validated);

        return back()->with('success', 'Inventory baru berhasil ditambahkan.');
    }

    // PUT /master-data/inventory/{inventory}  (klien kirim POST + _method=put karena ada file; route didaftarkan PUT)
    public function update(Request $request, Inventory $inventory): RedirectResponse
    {
        $validated = $this->inventory->validasi($request, $inventory);

        $this->inventory->perbarui($request, $inventory, $validated);

        return back()->with('success', 'Perubahan inventory berhasil disimpan.');
    }

    // DELETE /master-data/inventory/{inventory}   (?force=1 / body force=true -> hapus paksa)
    // Gagal -> error bag key "delete" (+ "force_available" kalau masih bisa dipaksa), tampil di modal konfirmasi hapus.
    public function destroy(Request $request, Inventory $inventory): RedirectResponse
    {
        $kode = $this->inventory->hapus($inventory, $request->boolean('force'));

        return back()->with('success', "Inventory {$kode} berhasil dihapus.");
    }

    // POST /master-data/inventory/{inventory}/jual -- gagal -> error bag key "jual".
    public function jual(Request $request, Inventory $inventory): RedirectResponse
    {
        $this->inventory->jual($request, $inventory);

        return back()->with('success', 'Inventory berhasil ditandai sebagai dijual.');
    }

    // POST /master-data/inventory/{inventory}/pasang-ke-induk  (parent_id) -- gagal -> error bag "pasang"/"parent_id"/"foto_penerimaan".
    public function pasangKeInduk(Request $request, Inventory $inventory): RedirectResponse
    {
        $this->inventory->pasangKeInduk($request, $inventory);

        return back()->with('success', "{$inventory->kode_inventory} berhasil dipasang ke induk.");
    }

    // POST /master-data/inventory/{inventory}/lepas-dari-induk  (keterangan) -- gagal -> error bag key "lepas".
    public function lepasDariInduk(Request $request, Inventory $inventory): RedirectResponse
    {
        $this->inventory->lepasDariInduk($request, $inventory);

        return back()->with('success', "{$inventory->kode_inventory} berhasil dilepas dari induk.");
    }

    // POST /master-data/inventory/import -- Excel (.xlsx/.xls), semua-atau-tidak-sama-sekali (rollback).
    // Gagal -> error bag key "file" (pesan pertama, sama seperti tampilan lama).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new InventoryBuktiImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal mengimport file');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getRowCount()} baris data";
            }
        } catch (Exception $e) {
            DB::rollBack();
            $pesanError = 'Gagal import: ' . $e->getMessage();
        }

        if ($pesanError !== null) {
            throw ValidationException::withMessages(['file' => $pesanError]);
        }

        return back()->with('success', $pesanSukses);
    }

    // ================================================================== helper

    // Parameter filter dari query string, sudah "efektif":
    //  - status & kategori[] valid saja (status cuma berlaku buat admin: tab status non-admin disembunyikan);
    //  - status khusus induk ("dijual") di-reset ke semua kalau populasi filter kategori tidak punya satu pun
    //    item induk (perilaku lama saat user mencentang kategori).
    private static function filterEfektif(Request $request): array
    {
        $admin = $request->user()->isAdmin();

        $search = trim((string) $request->query('search', ''));

        $status = (string) $request->query('status', '');
        $status = $admin && in_array($status, self::STATUS, true) ? $status : null;

        $kategori = collect((array) $request->query('kategori', []))
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();

        $adaInduk = self::populasi($request, $kategori)->whereNull('parent_id')->exists();

        if ($status !== null && in_array($status, self::STATUS_KHUSUS_INDUK, true) && !$adaInduk) {
            $status = null;
        }

        return [
            'search' => $search !== '' ? $search : null,
            'status' => $status,
            'kategori' => $kategori,
            'ada_induk' => $adaInduk,
        ];
    }

    // Populasi yang boleh dilihat user (scoping role) + filter kategori. Non-admin: tabel selalu cuma
    // item 'tersedia' (yang lagi dia pakai tampil di card terpisah, lihat dipakai()).
    private static function populasi(Request $request, array $kategori): Builder
    {
        $user = $request->user();

        $query = InventoryQuery::batasiUntuk(InventoryQuery::dasar(), $user);

        if (!$user->isAdmin()) {
            $query->where('status', 'tersedia');
        }

        if ($kategori) {
            $query->whereIn('kategori_id', $kategori);
        }

        return $query;
    }

    // populasi + pencarian + filter status. Tanpa orderBy/withCount (supaya aman dipakai count()).
    private static function queryTerfilter(Request $request, array $f): Builder
    {
        $query = self::populasi($request, $f['kategori']);

        if ($f['status'] !== null) {
            $query->where('status', $f['status']);
        }

        if ($f['search'] !== null) {
            // escape karakter wildcard LIKE supaya yang diketik dianggap teks biasa; LOWER() biar tidak peka huruf besar/kecil
            $kata = '%' . mb_strtolower(str_replace(['\\\\', '%', '_'], ['\\\\\\\\', '\\\\%', '\\\\_'], $f['search'])) . '%';

            $query->where(function ($q) use ($kata) {
                $q->whereRaw('LOWER(inventory.kode_inventory) LIKE ?', [$kata])
                    ->orWhereRaw('LOWER(inventory.serial_number) LIKE ?', [$kata])
                    ->orWhereRaw('LOWER(inventory.nama) LIKE ?', [$kata])
                    // nama di kolom "Dipakai Oleh"; status 'dijual' dilewati (kolomnya ditampilkan "-")
                    ->orWhere(function ($qq) use ($kata) {
                        $qq->where('inventory.status', '!=', 'dijual')
                            ->whereHas('pemakaiSaatIni.user', fn ($u) => $u->whereRaw('LOWER(users.name) LIKE ?', [$kata]));
                    });
            });
        }

        return $query;
    }

    private static function urutkan(Builder $query): Builder
    {
        return $query
            ->orderByRaw("CASE inventory.status WHEN 'tersedia' THEN 1 WHEN 'dipakai' THEN 2 WHEN 'menunggu_perbaikan' THEN 3 WHEN 'diperbaiki' THEN 4 WHEN 'rusak_berat' THEN 5 WHEN 'dijual' THEN 6 ELSE 7 END")
            ->orderBy('inventory.kode_inventory')
            ->orderBy('inventory.id');
    }
}
`,
  },
  {
    path: "resources/js/types/inventory.ts",
    content: `import type { Inventory, InventoryStatus } from '../api/masterData/inventory';
import type { Kategori } from '../api/masterData/kategori';
import type { Supplier } from '../api/masterData/supplier';
import type { Perusahaan } from '../api/masterData/perusahaan';

// [F4-INERTIA] Bentuk data tab Inventory dari server (InventoryWebController, lewat MasterDataPageController).

// Satu baris list = Inventory + jumlah kelengkapan yang menempel (dipakai form Edit buat mengunci "Pasang ke Induk").
export interface InventoryRow extends Inventory {
  children_count?: number;
}

// Props \`inventory\`: satu halaman data + filter aktif (query string = sumber kebenaran).
export interface InventoryList {
  data: InventoryRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  /** Ada item induk (parent_id kosong) di populasi filter kategori aktif -> tab status "Dijual" ditampilkan. */
  ada_induk: boolean;
  filters: { search: string; status: InventoryStatus | ''; kategori: number[] };
}

// Props \`inventoryOpsi\`: pilihan dropdown form & filter kategori (kosong untuk non-admin, sama seperti dulu).
export interface InventoryOpsi {
  kategori: Kategori[];
  supplier: Supplier[];
  perusahaan: Perusahaan[];
}

// Props \`inventoryIndukOpsi\` (optional, dimuat saat modal dibuka): kandidat induk.
export interface InventoryIndukOpsi {
  id: number;
  kode_inventory: string;
  nama: string | null;
}
`,
  },
];

const DELETES = [
  "resources/js/components/masterData/inventory/TabInventory/useInventoryList.ts",
];

const EDITS = [
  {
    file: "routes/web.php",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `use App\\Http\\Controllers\\MasterData\\SupplierWebController;
`,
        with: `use App\\Http\\Controllers\\MasterData\\SupplierWebController;
use App\\Http\\Controllers\\MasterData\\InventoryWebController;
`,
      },
      {
        find: `        Route::delete('/karyawan/{id}', [KaryawanWebController::class, 'destroy'])->whereNumber('id');
    });`,
        with: `        Route::delete('/karyawan/{id}', [KaryawanWebController::class, 'destroy'])->whereNumber('id');

        // [F4-INERTIA] Inventory: modal Tambah/Edit/Hapus/Jual/Pasang ke Induk/Lepas dari Induk + import. Statis (/import) di atas {inventory}.
        // {inventory} = route model binding (LogActivity butuh model-nya buat deskripsi audit "mengubah/menghapus aset <kode>").
        // Update dengan foto: klien kirim POST + _method=put, jadi route-nya WAJIB didaftarkan PUT.
        Route::post('/inventory/import', [InventoryWebController::class, 'import']);
        Route::post('/inventory', [InventoryWebController::class, 'store']);
        Route::post('/inventory/{inventory}/jual', [InventoryWebController::class, 'jual'])->whereNumber('inventory');
        Route::post('/inventory/{inventory}/pasang-ke-induk', [InventoryWebController::class, 'pasangKeInduk'])->whereNumber('inventory');
        Route::post('/inventory/{inventory}/lepas-dari-induk', [InventoryWebController::class, 'lepasDariInduk'])->whereNumber('inventory');
        Route::put('/inventory/{inventory}', [InventoryWebController::class, 'update'])->whereNumber('inventory');
        Route::delete('/inventory/{inventory}', [InventoryWebController::class, 'destroy'])->whereNumber('inventory');
    });`,
      },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/MasterDataPageController.php",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `            'karyawanExport' => $tab === 'karyawan' ? Inertia::optional(fn () => KaryawanWebController::untukExport($request)) : null,
`,
        with: `            'karyawanExport' => $tab === 'karyawan' ? Inertia::optional(fn () => KaryawanWebController::untukExport($request)) : null,
            // [F4-INERTIA] Tab Inventory: satu halaman list (pagination/search/status/kategori dari query string), card
            // "sedang dipakai" (non-admin), pilihan dropdown form. Optional = baru dihitung saat diminta lewat partial reload:
            // SEMUA hasil filter buat Export, kandidat induk (saat modal dibuka), dan detail satu item (?detail=<id>).
            'inventory' => $tab === 'inventory' ? fn () => InventoryWebController::daftar($request) : null,
            'inventoryDipakai' => $tab === 'inventory' ? fn () => InventoryWebController::dipakai($request) : null,
            'inventoryOpsi' => $tab === 'inventory' ? fn () => InventoryWebController::opsi($request) : null,
            'inventoryExport' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryWebController::untukExport($request)) : null,
            'inventoryIndukOpsi' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryWebController::indukOpsi()) : null,
            'inventoryDetail' => $tab === 'inventory' ? Inertia::optional(fn () => InventoryWebController::detail($request)) : null,
`,
      },
    ],
  },
  {
    file: "app/Http/Middleware/HandleInertiaRequests.php",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `use Inertia\\Middleware;
`,
        with: `use Inertia\\Inertia;
use Inertia\\Middleware;
`,
      },
      {
        find: `            'flash' => [
                'success' => fn () => $request->hasSession() ? $request->session()->get('success') : null,
                'error' => fn () => $request->hasSession() ? $request->session()->get('error') : null,
            ],`,
        with: `            // [F4-INERTIA] Inertia::always: flash ikut di SETIAP response, termasuk partial reload (polling, pagination,
            // search). Tanpa ini, flash dari mutasi terakhir tetap menempel di props klien dan FlashToaster menampilkan
            // toast yang sama lagi di setiap partial reload berikutnya.
            'flash' => Inertia::always(fn () => [
                'success' => $request->hasSession() ? $request->session()->get('success') : null,
                'error' => $request->hasSession() ? $request->session()->get('error') : null,
            ]),`,
      },
    ],
  },
  {
    file: "app/Http/Middleware/LogActivity.php",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `        $uri = $route->uri(); // contoh: "inventory/{inventory}/pemakai"`,
        with: `        // [F4-INERTIA] Route web inventory ada di bawah prefix master-data/ (mis. "master-data/inventory/{inventory}/jual");
        // prefix dibuang supaya deskripsi audit sama dengan route API-nya.
        $uri = preg_replace('#^master-data/#', '', $route->uri()); // contoh: "inventory/{inventory}/pemakai"`,
      },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/InventoryController.php",
    marker: "[F4-INERTIA]",
    steps: [
      {
        start: `use App\\Http\\Controllers\\Controller;
`,
        end: `    /**
     * GET /api/inventory/foto — daftar item inventory yang punya foto DASAR
`,
        with: `use App\\Actions\\MasterData\\InventoryAction;
use App\\Http\\Controllers\\Controller;
use App\\Models\\MasterData\\Inventory;
use App\\Queries\\InventoryQuery;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\ValidationException;

// [F4-INERTIA] Controller API inventory. Aturan akses/query dipindah ke App\\Queries\\InventoryQuery dan logika
// mutasi ke App\\Actions\\MasterData\\InventoryAction (dipakai bareng InventoryWebController, halaman Inertia).
// Bentuk response JSON dipertahankan. Sampai F10 yang masih dipanggil frontend: index (Laporan/Dashboard) & foto (Laporan).
class InventoryController extends Controller
{
    public function __construct(private InventoryAction $inventory)
    {
    }

    /**
     * GET /api/inventory
     * Admin: daftar SEMUA inventory. Non-admin: dibatasi (lihat InventoryQuery::batasiUntuk()).
     * Filter opsional: ?kategori_id=, ?posisi=induk|menempel (struktur parent_id), ?parent_id=.
     */
    public function index(Request $request)
    {
        $query = InventoryQuery::dasar()->latest();

        if ($kategoriId = $request->query('kategori_id')) {
            $query->where('kategori_id', $kategoriId);
        }

        if ($posisi = $request->query('posisi')) {
            abort_unless(in_array($posisi, ['induk', 'menempel'], true), 422, 'Posisi tidak valid.');
            $posisi === 'induk' ? $query->indukSendiri() : $query->menempel();
        }

        if ($request->filled('parent_id')) {
            $query->where('parent_id', $request->query('parent_id'));
        }

        InventoryQuery::batasiUntuk($query, $request->user());

        return response()->json($query->get());
    }

    /**
     * GET /api/inventory/{inventory}
     * Detail satu item + riwayat lengkap. Non-admin dibatasi (InventoryQuery::bolehDilihat()).
     */
    public function show(Request $request, Inventory $inventory)
    {
        abort_unless(
            InventoryQuery::bolehDilihat($inventory, $request->user()),
            403,
            'Kamu tidak punya akses untuk melihat detail item ini.'
        );

        $inventory->load(InventoryQuery::relasiDetail());

        return response()->json($inventory);
    }

    /** POST /api/inventory -- kode_inventory digenerate otomatis lewat trigger DB. */
    public function store(Request $request)
    {
        $validated = $this->inventory->validasi($request);

        $inventory = $this->inventory->simpan($request, $validated);

        return response()->json(
            $inventory->load('kategori', 'supplier', 'parent', 'perusahaan'),
            201
        );
    }

    /** POST /api/inventory/{inventory} (+ _method=PUT dari frontend, krn ada file upload) */
    public function update(Request $request, Inventory $inventory)
    {
        $validated = $this->inventory->validasi($request, $inventory);

        $inventory = $this->inventory->perbarui($request, $inventory, $validated);

        return response()->json(
            $inventory->load('kategori', 'supplier', 'parent', 'perusahaan')
        );
    }

    /** DELETE /api/inventory/{inventory} -- ?force=1 lewatin guard riwayat. 422 membawa \`force_available\` kalau masih bisa dipaksa. */
    public function destroy(Request $request, Inventory $inventory)
    {
        try {
            $kodeInventory = $this->inventory->hapus($inventory, $request->boolean('force'));
        } catch (ValidationException $e) {
            $errors = $e->errors();

            $response = ['message' => $errors['delete'][0] ?? $e->getMessage()];
            if (isset($errors['force_available'])) {
                $response['force_available'] = true;
            }

            return response()->json($response, 422);
        }

        return response()->json(['message' => "Inventory {$kodeInventory} berhasil dihapus."]);
    }

    /** POST /api/inventory/{inventory}/jual */
    public function jual(Request $request, Inventory $inventory)
    {
        $inventory = $this->inventory->jual($request, $inventory);

        return response()->json($inventory->load([
            'kategori',
            'supplier',
            'pemakaiSaatIni',
            'writeoff.penyetuju:id,name',
        ]));
    }

    /** POST /api/inventory/{inventory}/pasang-pengganti-kelengkapan */
    public function pasangPenggantiKelengkapan(Request $request, Inventory $inventory)
    {
        $inventory = $this->inventory->pasangKeInduk($request, $inventory);

        return response()->json($inventory->load(['parent', 'supplier']));
    }

    /** POST /api/inventory/{inventory}/lepas-dari-induk */
    public function lepasDariInduk(Request $request, Inventory $inventory)
    {
        $inventory = $this->inventory->lepasDariInduk($request, $inventory);

        return response()->json($inventory->load(['kategori', 'supplier']));
    }

`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/TabInventory/InventoryHeaderBar.tsx",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAdmin: boolean;`,
        with: `  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** [F4-INERTIA] true selama data export diambil dari server (tombol Export dinonaktifkan). */
  exportLoading?: boolean;
  isAdmin: boolean;`,
      },
      {
        find: `({ setExportOpen, isAdmin, fileInputRef`,
        with: `({ setExportOpen, exportLoading = false, isAdmin, fileInputRef`,
      },
      {
        find: `          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
        >
          <Download size={16} />`,
        with: `          onClick={() => setExportOpen(true)}
          disabled={exportLoading}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
        >
          {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/TabInventory/helpers.ts",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `// urutan tampil di tabel: tersedia paling atas, lalu dipakai, lalu status
// yang lagi dalam proses penanganan, rusak_berat, dan dijual paling
// bawah -- dipakai sebagai key sort di filteredInventory, BUKAN untuk urutan
// dropdown filter (dropdown tetap ikut urutan STATUS_LABEL di atas).
export const STATUS_PRIORITY: Record<InventoryStatus, number> = {
  tersedia: 1,
  dipakai: 2,
  menunggu_perbaikan: 3,
  diperbaiki: 4,
  rusak_berat: 5,
  dijual: 6,
};

`,
        with: `// [F4-INERTIA] Urutan tampil (status lalu kode) dan pagination 10 per halaman sekarang dijalankan server
// (InventoryWebController), jadi STATUS_PRIORITY & ASET_PER_PAGE tidak dipakai lagi di client.

`,
      },
      {
        find: `export const ASET_PER_PAGE = 10;

`,
        with: ``,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/TabInventory/InventoryTable.tsx",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `import { SkeletonTable, SkeletonListCard } from '../../../shared/skeleton';
`,
        with: `// [F4-INERTIA] Loading/pagination sekarang dari props server: tabel cuma merender halaman yang dikirim.
`,
      },
      {
        find: `  loading: boolean;
  error: string;
  filteredInventory: Inventory[];
`,
        with: ``,
      },
      {
        find: `  setInventoryPage: React.Dispatch<React.SetStateAction<number>>;
`,
        with: `  setInventoryPage: (page: number) => void;
  /** Total inventory hasil filter (semua halaman). */
  totalItems: number;
`,
      },
      {
        find: `({ loading, error, filteredInventory, pageInventory, renderAksi, expandedInventoryId, setExpandedInventoryId, inventoryLastPage, inventoryPageClamped, setInventoryPage }`,
        with: `({ pageInventory, renderAksi, expandedInventoryId, setExpandedInventoryId, inventoryLastPage, inventoryPageClamped, setInventoryPage, totalItems }`,
      },
      {
        find: `      {loading && (
        <>
          {/* Desktop: skeleton tabel
              (Kode, Nama, Kategori, Jumlah, Status, Dipakai Oleh, Aksi) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <SkeletonTable columns={7} rows={6} />
              </tbody>
            </table>
          </div>
          {/* Mobile: skeleton list card, gantiin tampilan card per baris */}
          <div className="sm:hidden">
            <SkeletonListCard rows={5} />
          </div>
        </>
      )}
`,
        with: ``,
      },
      {
        find: `      {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
`,
        with: ``,
      },
      {
        find: `      {!loading && !error && filteredInventory.length === 0 && (`,
        with: `      {pageInventory.length === 0 && (`,
      },
      {
        find: `      {!loading && !error && filteredInventory.length > 0 && (
        <div className="hidden sm:block overflow-x-auto">`,
        with: `      {pageInventory.length > 0 && (
        <div className="hidden sm:block overflow-x-auto">`,
      },
      {
        find: `      {!loading && !error && filteredInventory.length > 0 && (
        <div className="sm:hidden flex flex-col divide-y divide-slate-100">`,
        with: `      {pageInventory.length > 0 && (
        <div className="sm:hidden flex flex-col divide-y divide-slate-100">`,
      },
      {
        find: `      {!loading && !error && filteredInventory.length > 0 && inventoryLastPage > 1 && (`,
        with: `      {pageInventory.length > 0 && inventoryLastPage > 1 && (`,
      },
      {
        find: `totalItems={filteredInventory.length}`,
        with: `totalItems={totalItems}`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/InventoryLepasDariIndukModal.tsx",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `import { lepasDariIndukInventory, type Inventory } from '../../../api/masterData/inventory';`,
        with: `import { router } from '@inertiajs/react';
import type { Inventory } from '../../../api/masterData/inventory';`,
      },
      {
        find: `  onSuccess: (updated: Inventory) => void;`,
        with: `  /** [F4-INERTIA] Sukses -> toast dari flash server; parent cukup menutup modal. */
  onSuccess: () => void;`,
      },
      {
        find: `  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await lepasDariIndukInventory(inventory.id, {
        keterangan: keterangan.trim() || undefined,
      });
      onSuccess(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal melepas kelengkapan dari induk. Coba lagi.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

`,
        with: `  const handleSubmit = () => {
    setSubmitting(true);
    setError('');
    router.post(\`/master-data/inventory/\${inventory.id}/lepas-dari-induk\`, { keterangan: keterangan.trim() || undefined }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) => {
        const msg = errors.lepas || Object.values(errors)[0] || 'Gagal melepas kelengkapan dari induk. Coba lagi.';
        setError(msg);
        toast.error(msg);
      },
      onFinish: () => setSubmitting(false),
    });
  };

`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/InventoryPasangParentModal.tsx",
    marker: "[F4-INERTIA]",
    steps: [
      {
        find: `import { pasangPenggantiKelengkapanInventory, type Inventory } from '../../../api/masterData/inventory';`,
        with: `import { router } from '@inertiajs/react';
import type { Inventory } from '../../../api/masterData/inventory';
import type { InventoryIndukOpsi } from '../../../types/inventory';`,
      },
      {
        find: `  indukOptions: Inventory[];
  onClose: () => void;
  onSuccess: (updated: Inventory) => void;`,
        with: `  /** [F4-INERTIA] Kandidat induk dari props server (dimuat saat modal dibuka). */
  indukOptions: InventoryIndukOpsi[];
  /** true selama kandidat induk belum sampai dari server. */
  memuatOpsi?: boolean;
  onClose: () => void;
  /** Sukses -> toast dari flash server; parent cukup menutup modal. */
  onSuccess: () => void;`,
      },
      {
        find: `({ inventory, indukOptions, onClose, onSuccess }`,
        with: `({ inventory, indukOptions, memuatOpsi = false, onClose, onSuccess }`,
      },
      {
        find: `  const handleSubmit = async () => {
    if (!parentId) {
      toast.error('Pilih salah satu unit induk terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updated = await pasangPenggantiKelengkapanInventory(inventory.id, parentId);
      onSuccess(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal memasang kelengkapan ke induk.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

`,
        with: `  const handleSubmit = () => {
    if (!parentId) {
      toast.error('Pilih salah satu unit induk terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    router.post(\`/master-data/inventory/\${inventory.id}/pasang-ke-induk\`, { parent_id: parentId }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) => {
        const msg = errors.pasang || Object.values(errors)[0] || 'Gagal memasang kelengkapan ke induk.';
        setError(msg);
        toast.error(msg);
      },
      onFinish: () => setLoading(false),
    });
  };

`,
      },
      {
        find: `                {indukOptions.length === 0
                  ? 'Belum ada item yang bisa dipilih jadi induk.'`,
        with: `                {memuatOpsi
                  ? 'Memuat daftar induk…'
                  : indukOptions.length === 0
                  ? 'Belum ada item yang bisa dipilih jadi induk.'`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/TabInventory/index.tsx",
    marker: "[F4-INERTIA]",
    steps: [
      {
        sha: "4abc05858c5fa72962aae31f6e07a20d6d403c6081b3349d1be20d2d3483cfca",
        replaceAll: `import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import InventoryFormModal from '../InventoryFormModal';
import InventorySerahTerimaModal from '../InventorySerahTerimaModal';
import InventoryPengembalianModal from '../InventoryPengembalianModal';
import InventoryLaporKerusakanModal from '../InventoryLaporKerusakanModal';
import InventoryLepasDariIndukModal from '../InventoryLepasDariIndukModal';
import InventoryPasangIndukModal from '../InventoryPasangParentModal';
import InventoryPenangananSelesaiModal from '../../../transaksi/InventoryPenangananSelesaiModal';
import InventoryExportModal from '../../../laporan/InventoryExportModal';
import ConfirmDeleteModal from '../../../shared/ConfirmDeleteModal';
import { useAuth } from '../../../../context/AuthContext';
import type { Inventory, InventoryStatus } from '../../../../api/masterData/inventory';
import { deletePemakaiInventory, type InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';
import {
  deletePenangananInventory,
  terimaPenangananInventory,
  type InventoryPenanganan,
} from '../../../../api/transaksi/inventoryPenanganan';
import type { InventoryIndukOpsi, InventoryList, InventoryOpsi, InventoryRow } from '../../../../types/inventory';
import { STATUS_LABEL } from './helpers';
import InventoryRowActions from './InventoryRowActions';
import InventoryHeaderBar from './InventoryHeaderBar';
import InventorySedangDipakai from './InventorySedangDipakai';
import InventoryStatusTabs from './InventoryStatusTabs';
import InventoryFilterBar from './InventoryFilterBar';
import InventoryTable from './InventoryTable';
import InventoryJualConfirmModal from './InventoryJualConfirmModal';
import InventoryDetailModal from './InventoryDetailModal';
import { handlePrintSerahTerima, handlePrintPengembalian } from './printHelpers';

// [F4-INERTIA] Tab "Inventory" di Master Data (tadinya axios + useInventoryList + filter/pagination di client). Sekarang:
//  - data dari props server (MasterDataPageController -> props.inventory, hanya dikirim saat tab ini aktif);
//  - pagination, pencarian, filter status, dan filter kategori dijalankan server lewat router.get (query string = sumber kebenaran);
//  - Tambah / Edit / Detail / Jual / Pasang ke Induk / Lepas dari Induk / Hapus = modal overlay dengan state lokal;
//  - mutasi inventory lewat router.* ke /master-data/inventory, hasilnya toast dari flash server (FlashToaster);
//  - detail (riwayat lengkap) diminta lewat partial reload props.inventoryDetail (?detail=<id>, URL browser tidak berubah);
//  - auto-refresh 5 detik = partial reload async (list + "sedang dipakai" + detail yang lagi terbuka).
// Aksi serah-terima / pengembalian / lapor kerusakan / penanganan masih lewat axios (dipindah di F5/F6); setelah
// sukses, tab ini cukup memuat ulang props lewat segarkan().
interface InventoryPageProps {
  inventory?: InventoryList;
  inventoryDipakai?: InventoryRow[];
  inventoryOpsi?: InventoryOpsi;
  inventoryExport?: InventoryRow[];
  inventoryIndukOpsi?: InventoryIndukOpsi[];
  inventoryDetail?: Inventory | null;
}

interface FilterBaru {
  search?: string;
  status?: InventoryStatus | '';
  kategori?: number[];
  page?: number;
}

const OPSI_KOSONG: InventoryOpsi = { kategori: [], supplier: [], perusahaan: [] };

export default function TabInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const pageProps = usePage().props as unknown as InventoryPageProps;
  const list = pageProps.inventory;
  const pageInventory = list?.data ?? [];
  const statusFilter: InventoryStatus | '' = list?.filters.status ?? '';
  const selectedKategoriIds = list?.filters.kategori ?? [];
  const serverSearch = list?.filters.search ?? '';
  const currentPage = list?.current_page ?? 1;
  const lastPage = list?.last_page ?? 1;
  const totalInventory = list?.total ?? 0;
  const adaIndukDiFilterAktif = list?.ada_induk ?? false;
  const myBorrowedItems = pageProps.inventoryDipakai ?? [];
  const opsi = pageProps.inventoryOpsi ?? OPSI_KOSONG;

  const [searchInput, setSearchInput] = useState<string>(serverSearch);
  const [listLoading, setListLoading] = useState<boolean>(false);

  const [kategoriDropdownOpen, setKategoriDropdownOpen] = useState(false);
  const kategoriDropdownRef = useRef<HTMLDivElement>(null);

  // Export -- 1 tombol & 1 modal (InventoryExportModal) untuk semua kategori. Datanya = SEMUA hasil filter aktif,
  // diambil lewat partial reload (props.inventoryExport) tiap tombol Export diklik, bukan cuma halaman yang tampil.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<InventoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inventory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Kalau hapus normal gagal krn inventory punya riwayat pemakai/penanganan (data lama/test), server menandai
  // error "force_available" -- modal yang sama menawarkan Hapus Paksa.
  const [deleteForceAvailable, setDeleteForceAvailable] = useState(false);

  // Detail: id disimpan lokal; datanya = props.inventoryDetail (diminta lewat partial reload). detailIdRef supaya
  // polling selalu tahu id TERBARU tanpa membuat ulang interval.
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailIdRef = useRef<number | null>(null);
  const propDetail = pageProps.inventoryDetail ?? null;
  const detail = detailId !== null && propDetail && propDetail.id === detailId ? propDetail : null;
  const detailLoading = detailId !== null && detail === null;

  // Serah-terima 1 inventory utama (checklist kelengkapan ada di dalam modalnya), pengembalian, lapor kerusakan,
  // dan penanganan selesai: masih axios (F5/F6).
  const [serahTerimaInventory, setSerahTerimaInventory] = useState<Inventory | null>(null);
  const [pengembalianTarget, setPengembalianTarget] = useState<{ inventory: Inventory; pemakai: InventoryPemakai } | null>(null);

  const [perbaikanInventoryTarget, setPerbaikanInventoryTarget] = useState<Inventory | null>(null);
  const [penangananSelesaiTarget, setPenangananSelesaiTarget] = useState<{ inventory: Inventory; penanganan: InventoryPenanganan } | null>(null);
  const [historyActionError, setHistoryActionError] = useState('');

  // Jual: inventory tersedia atau rusak_berat -- cuma konfirmasi, gak ada form.
  const [jualTarget, setJualTarget] = useState<Inventory | null>(null);
  const [jualLoading, setJualLoading] = useState(false);
  const [jualError, setJualError] = useState('');

  // Lepas dari Induk (baris kelengkapan yang menempel & panel detail children) dan Pasang ke Induk (kebalikannya).
  const [lepasTarget, setLepasTarget] = useState<Inventory | null>(null);
  const [pasangIndukTarget, setPasangIndukTarget] = useState<Inventory | null>(null);

  // Import Excel data inventory (bulk). Sukses -> toast dari flash server; gagal -> pesan error inline.
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);
  const [penangananPage, setPenangananPage] = useState(1);
  const [pemakaiPage, setPemakaiPage] = useState(1);
  const [expandedPenangananId, setExpandedPenangananId] = useState<number | null>(null);
  const [expandedPemakaiId, setExpandedPemakaiId] = useState<number | null>(null);
  const [deletingPemakaiId, setDeletingPemakaiId] = useState<number | null>(null);
  const [expandedInventoryId, setExpandedInventoryId] = useState<number | null>(null);

  // ------------------------------------------------------------------ request ke server

  // Query string dari filter. Nilai default (search kosong, status semua, kategori kosong, halaman 1) tidak ikut di URL.
  function bangunData(f: Required<FilterBaru>, detailParam?: number | null): Record<string, string | number | number[]> {
    const data: Record<string, string | number | number[]> = { tab: 'inventory' };
    if (f.search) data.search = f.search;
    if (f.status) data.status = f.status;
    if (f.kategori.length > 0) data.kategori = f.kategori;
    if (f.page > 1) data.page = f.page;
    if (detailParam) data.detail = detailParam;
    return data;
  }

  // Filter yang SEDANG aktif di server (sumber kebenaran = props, bukan input yang lagi diketik).
  function filterAktif(): Required<FilterBaru> {
    return { search: serverSearch, status: statusFilter, kategori: selectedKategoriIds, page: currentPage };
  }

  // Pindah halaman / ganti filter = visit ringan ke /master-data (partial reload cuma props.inventory), URL ikut berubah.
  function visitList(next: FilterBaru) {
    const f: Required<FilterBaru> = {
      search: (next.search ?? searchInput).trim(),
      status: next.status ?? statusFilter,
      kategori: next.kategori ?? selectedKategoriIds,
      page: next.page ?? 1,
    };

    setListLoading(true);
    router.get('/master-data', bangunData(f), {
      only: ['inventory'],
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onFinish: () => setListLoading(false),
    });
  }

  // Muat ulang list + "sedang dipakai" (+ detail yang lagi terbuka) tanpa mengubah filter/URL. silent = polling:
  // async (tidak membatalkan request lain, mis. submit form yang lagi jalan) dan tanpa progress bar.
  function segarkan(silent = false) {
    const id = detailIdRef.current;
    const only = ['inventory', 'inventoryDipakai'];
    if (id) only.push('inventoryDetail');

    const options = {
      only,
      preserveState: true,
      preserveScroll: true,
      replace: true,
      preserveUrl: true,
      async: silent,
      showProgress: !silent,
    };

    // Detail butuh ?detail=<id> di request; preserveUrl menjaga URL browser tetap bersih.
    router.get('/master-data', bangunData(filterAktif(), id), options);
  }

  // Polling 5 detik biar perubahan status (menunggu perbaikan / sedang diperbaiki / tersedia) langsung kelihatan, baik di
  // list maupun di modal detail yang kebuka. Dilewati kalau tab browser lagi disembunyikan.
  const segarkanRef = useRef(segarkan);
  segarkanRef.current = segarkan;
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      segarkanRef.current(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Pencarian: tunggu user berhenti mengetik sebentar sebelum minta data ke server.
  useEffect(() => {
    if (searchInput.trim() === serverSearch) return;
    const timer = setTimeout(() => visitList({ search: searchInput, page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Kandidat induk dimuat hanya saat form Tambah/Edit atau modal Pasang ke Induk dibuka.
  useEffect(() => {
    if (!formOpen && !pasangIndukTarget) return;
    router.reload({ only: ['inventoryIndukOpsi'], async: true, showProgress: false });
  }, [formOpen, pasangIndukTarget]);

  // Tutup dropdown kategori kalau klik di luar (dicek dulu apakah target klik ada di dalam dropdown, supaya
  // checkbox kategori bisa dipilih lebih dari satu kali).
  useEffect(() => {
    if (!kategoriDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (kategoriDropdownRef.current && !kategoriDropdownRef.current.contains(e.target as Node)) {
        setKategoriDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [kategoriDropdownOpen]);

  // ------------------------------------------------------------------ detail

  function openDetail(id: number) {
    setDetailId(id);
    detailIdRef.current = id;
    setPenangananPage(1);
    setPemakaiPage(1);
    setExpandedPenangananId(null);
    setExpandedPemakaiId(null);

    router.get('/master-data', bangunData(filterAktif(), id), {
      only: ['inventoryDetail'],
      preserveState: true,
      preserveScroll: true,
      preserveUrl: true,
      onSuccess: (page) => {
        const d = (page.props as unknown as InventoryPageProps).inventoryDetail;
        if (!d || d.id !== id) {
          toast.error('Detail inventory tidak bisa dibuka (tidak ditemukan atau kamu tidak punya akses).');
          closeDetail();
        }
      },
    });
  }

  function closeDetail() {
    setDetailId(null);
    detailIdRef.current = null;
  }

  // ------------------------------------------------------------------ mutasi inventory (Inertia)

  function confirmDelete(force = false) {
    if (!deleteTarget) return;
    const target = deleteTarget;

    setDeleting(true);
    setDeleteError('');
    // Sukses -> toast dari flash server. Gagal -> error bag "delete" tampil di modal konfirmasi
    // (+ "force_available" -> tawarkan Hapus Paksa).
    router.delete(\`/master-data/inventory/\${target.id}\`, {
      data: force ? { force: true } : undefined,
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteForceAvailable(false);
        if (detailIdRef.current === target.id) closeDetail();
      },
      onError: (errors) => {
        setDeleteError(errors.delete || 'Gagal menghapus inventory.');
        setDeleteForceAvailable(!!errors.force_available);
      },
      onFinish: () => setDeleting(false),
    });
  }

  function openJual(a: Inventory) {
    setJualTarget(a);
    setJualError('');
  }

  // Jual: tandai inventory sebagai 'dijual', gak ada input tambahan.
  function confirmJual() {
    if (!jualTarget) return;

    setJualLoading(true);
    setJualError('');
    router.post(\`/master-data/inventory/\${jualTarget.id}/jual\`, {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setJualTarget(null);
        if (detailIdRef.current) segarkan();
      },
      onError: (errors) => setJualError(errors.jual || 'Gagal menandai inventory sebagai terjual.'),
      onFinish: () => setJualLoading(false),
    });
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    router.post('/master-data/inventory/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => setImportError(String(errors.file || 'Gagal mengimport file')),
      onFinish: () => {
        setImportLoading(false);
        // reset biar bisa upload file yang sama lagi
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  }

  function siapkanExport() {
    setExportLoading(true);
    router.reload({
      only: ['inventoryExport'],
      onSuccess: () => setExportOpen(true),
      onError: () => toast.error('Gagal menyiapkan data export. Coba lagi.'),
      onFinish: () => setExportLoading(false),
    });
  }

  // InventoryHeaderBar memanggil setExportOpen(true): buka modal = ambil dulu datanya dari server.
  const bukaExport: React.Dispatch<React.SetStateAction<boolean>> = (v) => {
    const next = typeof v === 'function' ? v(exportOpen) : v;
    if (next) siapkanExport();
    else setExportOpen(false);
  };

  // ------------------------------------------------------------------ aksi riwayat di modal detail (axios sampai F5/F6)

  async function handleTerimaPenanganan(id: number) {
    setHistoryActionError('');
    setTerimaLoadingId(id);
    try {
      await terimaPenangananInventory(id);
      segarkan();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menerima laporan penanganan.');
    } finally {
      setTerimaLoadingId(null);
    }
  }

  async function handleDeletePenanganan(id: number) {
    if (!confirm('Hapus riwayat penanganan ini?')) return;
    setHistoryActionError('');
    try {
      await deletePenangananInventory(id);
      segarkan();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat penanganan.');
    }
  }

  async function handleDeletePemakai(id: number) {
    if (!confirm('Hapus riwayat pemakaian ini?')) return;
    setHistoryActionError('');
    setDeletingPemakaiId(id);
    try {
      await deletePemakaiInventory(id);
      segarkan();
    } catch (err: any) {
      setHistoryActionError(err.response?.data?.message || 'Gagal menghapus riwayat pemakaian.');
    } finally {
      setDeletingPemakaiId(null);
    }
  }

  // ------------------------------------------------------------------ filter (adapter ke komponen filter lama)

  // Toggle satu kategori_id di filter multi-select. Status "Dijual" otomatis di-reset oleh server kalau hasil filter
  // baru tidak punya item induk.
  const handleToggleKategori = (id: number) => {
    const next = selectedKategoriIds.includes(id) ? selectedKategoriIds.filter((x) => x !== id) : [...selectedKategoriIds, id];
    visitList({ kategori: next, page: 1 });
  };

  const setSelectedKategoriIds: React.Dispatch<React.SetStateAction<number[]>> = (v) => {
    const next = typeof v === 'function' ? v(selectedKategoriIds) : v;
    visitList({ kategori: next, page: 1 });
  };

  const setStatusFilter: React.Dispatch<React.SetStateAction<InventoryStatus | ''>> = (v) => {
    const next = typeof v === 'function' ? v(statusFilter) : v;
    visitList({ status: next, page: 1 });
  };

  // Tombol aksi per baris (tabel desktop & card mobile) -- isinya di InventoryRowActions.tsx
  const renderAksi = (a: Inventory) => (
    <InventoryRowActions
      a={a}
      isAdmin={isAdmin}
      openDetail={openDetail}
      setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
      setLepasTarget={setLepasTarget}
      setEditingInventory={setEditingInventory}
      setFormOpen={setFormOpen}
      setDeleteError={setDeleteError}
      setDeleteForceAvailable={setDeleteForceAvailable}
      setDeleteTarget={setDeleteTarget}
      user={user}
      setPasangIndukTarget={setPasangIndukTarget}
      setSerahTerimaInventory={setSerahTerimaInventory}
      setPengembalianTarget={setPengembalianTarget}
    />
  );

  return (
    <>
      <InventoryHeaderBar
        setExportOpen={bukaExport}
        exportLoading={exportLoading}
        isAdmin={isAdmin}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        importLoading={importLoading}
        setEditingInventory={setEditingInventory}
        setFormOpen={setFormOpen}
      />

      {importError && <p className="text-sm mb-4 -mt-2 text-red-600">{importError}</p>}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">

      {/* Section card "Sedang Anda Pakai" -- cuma buat karyawan/cabang (non-admin), berisi inventory yang lagi dia
          pakai/lagi ditangani sendiri. Tabel utama non-admin murni daftar inventory 'tersedia'. */}
      {!isAdmin && myBorrowedItems.length > 0 && (
        <InventorySedangDipakai
          myBorrowedItems={myBorrowedItems}
          openDetail={openDetail}
          setPengembalianTarget={setPengembalianTarget}
          setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
        />
      )}

      {/* Filter status pakai tab nav (ScrollableTabBar). Cuma buat admin -- tabel non-admin selalu isinya
          inventory 'tersedia' aja. */}
      {isAdmin && (
        <InventoryStatusTabs
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          adaIndukDiFilterAktif={adaIndukDiFilterAktif}
        />
      )}

      <InventoryFilterBar
        search={searchInput}
        setSearch={setSearchInput}
        kategoriDropdownRef={kategoriDropdownRef}
        setKategoriDropdownOpen={setKategoriDropdownOpen}
        selectedKategoriIds={selectedKategoriIds}
        kategoriOptions={opsi.kategori}
        kategoriDropdownOpen={kategoriDropdownOpen}
        setSelectedKategoriIds={setSelectedKategoriIds}
        handleToggleKategori={handleToggleKategori}
      />

      <p className="text-xs text-slate-500 mb-4">
        Total {statusFilter === '' ? 'Semua' : (STATUS_LABEL[statusFilter] ?? 'Status')}: <span className="font-semibold text-slate-900">{totalInventory}</span> inventory
      </p>

      <div className={\`transition-opacity \${listLoading ? 'opacity-60' : ''}\`}>
        <InventoryTable
          pageInventory={pageInventory}
          renderAksi={renderAksi}
          expandedInventoryId={expandedInventoryId}
          setExpandedInventoryId={setExpandedInventoryId}
          inventoryLastPage={lastPage}
          inventoryPageClamped={currentPage}
          setInventoryPage={(page) => visitList({ page })}
          totalItems={totalInventory}
        />
      </div>

      {/* FORM TAMBAH / EDIT INVENTORY */}
      {formOpen && (
        <InventoryFormModal
          inventory={editingInventory}
          opsi={opsi}
          indukOptions={pageProps.inventoryIndukOpsi}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            if (detailIdRef.current) segarkan();
          }}
        />
      )}

      {/* KONFIRMASI HAPUS */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.nama || deleteTarget?.kode_inventory || ''}
        itemCode={deleteTarget?.kode_inventory}
        itemType="Inventory"
        loading={deleting}
        errorMessage={deleteError}
        forceAvailable={deleteForceAvailable}
        warningMessage={
          deleteForceAvailable
            ? 'Inventory ini memiliki riwayat pemakaian/penanganan. Anda dapat melakukan Hapus Paksa jika memang data lama/test.'
            : 'Menghapus inventory akan menghapus data beserta seluruh riwayat terkait secara permanen.'
        }
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
          setDeleteForceAvailable(false);
        }}
        onConfirm={(force) => confirmDelete(!!force)}
      />

      {/* KONFIRMASI JUAL INVENTORY — cuma tanda, gak ada form */}
      {jualTarget && (
        <InventoryJualConfirmModal
          jualTarget={jualTarget}
          jualError={jualError}
          setJualTarget={setJualTarget}
          jualLoading={jualLoading}
          confirmJual={confirmJual}
        />
      )}

      {/* EXPORT -- 1 modal untuk semua kategori. Data = SEMUA hasil filter status/search/kategori aktif. */}
      <InventoryExportModal open={exportOpen} onClose={() => setExportOpen(false)} data={pageProps.inventoryExport ?? []} />

      {/* DETAIL INVENTORY — disembunyiin sementara kalau ada modal aksi (serah-terima, terima kembali, jual, dst)
          yang kebuka di atasnya, biar gak numpuk 2 modal + 2 overlay keliatan bareng */}
      {detailId &&
        !serahTerimaInventory &&
        !pengembalianTarget &&
        !perbaikanInventoryTarget &&
        !penangananSelesaiTarget &&
        !jualTarget &&
        !lepasTarget &&
        !pasangIndukTarget && (
        <InventoryDetailModal
          closeDetail={closeDetail}
          detail={detail}
          detailLoading={detailLoading}
          isAdmin={isAdmin}
          setSerahTerimaInventory={setSerahTerimaInventory}
          setPengembalianTarget={setPengembalianTarget}
          setPerbaikanInventoryTarget={setPerbaikanInventoryTarget}
          setPasangIndukTarget={setPasangIndukTarget}
          openJual={openJual}
          user={user}
          openDetail={openDetail}
          setLepasTarget={setLepasTarget}
          pemakaiPage={pemakaiPage}
          expandedPemakaiId={expandedPemakaiId}
          handleDeletePemakai={handleDeletePemakai}
          deletingPemakaiId={deletingPemakaiId}
          setExpandedPemakaiId={setExpandedPemakaiId}
          setPemakaiPage={setPemakaiPage}
          historyActionError={historyActionError}
          penangananPage={penangananPage}
          expandedPenangananId={expandedPenangananId}
          handleTerimaPenanganan={handleTerimaPenanganan}
          terimaLoadingId={terimaLoadingId}
          setPenangananSelesaiTarget={setPenangananSelesaiTarget}
          handleDeletePenanganan={handleDeletePenanganan}
          setExpandedPenangananId={setExpandedPenangananId}
          setPenangananPage={setPenangananPage}
        />
      )}

      {serahTerimaInventory && (
        <InventorySerahTerimaModal
          inventory={serahTerimaInventory}
          onClose={() => setSerahTerimaInventory(null)}
          onSuccess={(results) => {
            handlePrintSerahTerima(results);
            setSerahTerimaInventory(null);
            segarkan();
          }}
        />
      )}

      {pengembalianTarget && (
        <InventoryPengembalianModal
          inventory={pengembalianTarget.inventory}
          pemakai={pengembalianTarget.pemakai}
          isAdmin={isAdmin}
          onClose={() => setPengembalianTarget(null)}
          onSuccess={(pemakai) => {
            handlePrintPengembalian(pengembalianTarget.inventory, pemakai);
            setPengembalianTarget(null);
            segarkan();
          }}
        />
      )}

      {perbaikanInventoryTarget && (
        <InventoryLaporKerusakanModal
          inventory={perbaikanInventoryTarget}
          onClose={() => setPerbaikanInventoryTarget(null)}
          onSuccess={() => {
            setPerbaikanInventoryTarget(null);
            toast.success('Laporan kerusakan berhasil dikirim.');
            segarkan();
          }}
        />
      )}

      {penangananSelesaiTarget && (
        <InventoryPenangananSelesaiModal
          inventory={penangananSelesaiTarget.inventory}
          penanganan={penangananSelesaiTarget.penanganan}
          onClose={() => setPenangananSelesaiTarget(null)}
          onSuccess={() => {
            setPenangananSelesaiTarget(null);
            segarkan();
          }}
        />
      )}

      {/* Lepas dari Induk — dipicu dari baris tabel maupun tombol Lepas di panel detail children. Sukses -> toast dari
          flash server; modal ditutup, list + detail dimuat ulang oleh redirect (detail lewat segarkan()). */}
      {lepasTarget && (
        <InventoryLepasDariIndukModal
          inventory={lepasTarget}
          onClose={() => setLepasTarget(null)}
          onSuccess={() => {
            setLepasTarget(null);
            if (detailIdRef.current) segarkan();
          }}
        />
      )}

      {/* Pasang ke Induk — kebalikan dari Lepas dari Induk. Kandidat induk = props.inventoryIndukOpsi (dimuat saat modal dibuka). */}
      {pasangIndukTarget && (
        <InventoryPasangIndukModal
          inventory={pasangIndukTarget}
          indukOptions={pageProps.inventoryIndukOpsi ?? []}
          memuatOpsi={pageProps.inventoryIndukOpsi === undefined}
          onClose={() => setPasangIndukTarget(null)}
          onSuccess={() => {
            setPasangIndukTarget(null);
            if (detailIdRef.current) segarkan();
          }}
        />
      )}
    </div>
    </>
  );
}
`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/InventoryFormModal.tsx",
    marker: "[F4-INERTIA]",
    steps: [
      {
        sha: "3a32c06c855281ab6407c205f055be738ba01ab4f06b46a17405ca013a92e3b6",
        replaceAll: `import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import type { InventoryStatus } from '../../../api/masterData/inventory';
import type { InventoryIndukOpsi, InventoryOpsi, InventoryRow } from '../../../types/inventory';
import { ButtonCancel, ButtonSubmit, Field, SelectField, inputClass, inputErrorClass } from '../../shared/FormControls';

const KETERANGAN_MAX = 255;
const MAX_FOTO_MB = 4;
const STORAGE_BASE_URL = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/storage/' : '/storage/');
const ACCEPTED_FOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// REFACTOR KATEGORI BEBAS (Fase 3): form ini dulu punya 2 mode terpisah total
// (barang_utama vs kelengkapan, dipilih lewat prop kategoriKode) dengan 2 set
// state & 2 render tree yang nyaris gak overlap. Sejak kategori jadi bebas
// (lihat CHECKLIST_REFACTOR_KATEGORI.md Fase 1-2, backend sudah murni pakai
// parent_id, gak ada lagi makna "tipe" di kategori), form ini digabung jadi
// SATU: kategori cuma label buat dipilih dari dropdown, semua field & section
// berlaku sama buat kategori apapun. Yang menentukan bentuk UI sekarang cuma
// parent_id (item ini nempel ke sesuatu atau enggak) & apakah item ini punya
// children (kalau ya, gak boleh dikasih parent_id -- aturan dari backend
// InventoryController::validasiParent()).

// [F4-INERTIA] Form Tambah / Edit Inventory sebagai modal overlay di tab Inventory.
//  - Data baris dari props list (tidak ada request tambahan); pilihan dropdown dari props \`inventoryOpsi\`;
//    kandidat induk dari props \`inventoryIndukOpsi\` (dimuat tab saat modal dibuka, undefined = masih memuat).
//  - Submit pakai useForm (multipart): preserveState + preserveScroll, sukses -> modal ditutup (toast dari flash server),
//    error validasi server tampil di dalam modal lewat form.errors.
//  - Edit dengan foto: kirim POST + _method=put (route di server didaftarkan PUT).
// Kategori bebas: kategori cuma label buat dipilih dari dropdown; bentuk UI cuma ditentukan parent_id (menempel atau
// tidak) & apakah item punya children (kalau ya, gak boleh dikasih parent_id -- aturan server, InventoryAction).
// Status TIDAK dikirim dari form ini (perubahan status lewat aksi khusus: pinjam/kembalikan/lapor rusak/dst); 'status'
// di sini cuma buat badge read-only pas edit.

const STATUS_OPTIONS: { value: InventoryStatus; label: string; dot: string; ring: string }[] = [
  { value: 'tersedia', label: 'Tersedia', dot: 'bg-emerald-500', ring: 'ring-emerald-100 border-emerald-400 bg-emerald-50/60' },
  { value: 'dipakai', label: 'Dipakai', dot: 'bg-blue-500', ring: 'ring-blue-100 border-blue-400 bg-blue-50/60' },
];

interface InventoryFormModalProps {
  inventory: InventoryRow | null; // null = mode tambah
  opsi: InventoryOpsi;
  /** Kandidat induk; undefined = masih dimuat dari server. */
  indukOptions: InventoryIndukOpsi[] | undefined;
  onClose: () => void;
  onSaved: () => void;
}

// State form lokal -- \`jumlah\` ditahan sebagai string (biar input number kosong/parsial gak maksa jadi 0).
interface FormState {
  kategori_id: number | null;
  parent_id: number | null; // cuma valid kalau menempel ke induk murni (aturan server)
  nama: string;
  warna: string;
  serial_number: string;
  merk: string;
  type: string;
  jumlah: string;
  tanggal_garansi: string;
  perusahaan_id: number | null;
  keterangan: string;
  foto: File | null;
  supplier_id: number | null;
  tanggal_input: string;
  tanggal_invoice: string;
  no_surat_jalan: string;
  no_good_receive: string;
  status: InventoryStatus;
}

const EMPTY_FORM: FormState = {
  kategori_id: null,
  parent_id: null,
  nama: '',
  warna: '',
  serial_number: '',
  merk: '',
  type: '',
  jumlah: '1',
  tanggal_garansi: '',
  perusahaan_id: null,
  keterangan: '',
  foto: null,
  supplier_id: null,
  tanggal_input: '',
  tanggal_invoice: '',
  no_surat_jalan: '',
  no_good_receive: '',
  status: 'tersedia',
};

// Field yang punya tempat tampil sendiri di form; error lain dari server digabung di kotak error umum.
const FIELD_ERROR_DITAMPILKAN = ['kategori_id', 'nama', 'serial_number', 'tanggal_garansi', 'parent_id'];

// Payload ke server -- SAMA dengan buildInventoryFormData() lama: kolom kosong tidak dikirim (kecuali supplier_id),
// foto 3 kondisi (File baru / hapus_foto / tidak disentuh).
function bangunPayload(v: FormState, hapusFoto: boolean): Record<string, string | number | File> {
  const p: Record<string, string | number | File> = {};
  if (v.kategori_id != null) p.kategori_id = v.kategori_id;
  if (v.parent_id != null) p.parent_id = v.parent_id;
  if (v.nama) p.nama = v.nama;
  if (v.warna) p.warna = v.warna;
  if (v.serial_number) p.serial_number = v.serial_number;
  if (v.merk) p.merk = v.merk;
  if (v.type) p.type = v.type;
  if (v.jumlah) p.jumlah = Number(v.jumlah);
  if (v.tanggal_garansi) p.tanggal_garansi = v.tanggal_garansi;
  if (v.tanggal_input) p.tanggal_input = v.tanggal_input;
  if (v.tanggal_invoice) p.tanggal_invoice = v.tanggal_invoice;
  if (v.perusahaan_id != null) p.perusahaan_id = v.perusahaan_id;
  if (v.keterangan) p.keterangan = v.keterangan;

  if (v.foto instanceof File) {
    p.foto = v.foto;
  } else if (hapusFoto) {
    p.hapus_foto = 1;
  }
  // foto tidak disentuh -> tidak ada apa-apa yang dikirim, foto lama dibiarkan.

  p.supplier_id = v.supplier_id != null ? v.supplier_id : '';
  if (v.no_surat_jalan) p.no_surat_jalan = v.no_surat_jalan;
  if (v.no_good_receive) p.no_good_receive = v.no_good_receive;
  return p;
}

export default function InventoryFormModal({
  inventory,
  opsi,
  indukOptions,
  onClose,
  onSaved,
}: InventoryFormModalProps) {
  // ================= Referensi (dari props server) =================
  const daftarKategori = opsi.kategori;
  const loadingKategori = false;
  const effectiveSupplierOptions = opsi.supplier;
  const daftarPerusahaan = opsi.perusahaan;
  const loadingPerusahaan = false;

  // Kandidat "Inventory Induk" = item apapun yang lagi berdiri sendiri (parent_id null), kecuali item ini sendiri.
  const loadingRefs = indukOptions === undefined;
  const inventoryOptions = useMemo(
    () => (indukOptions ?? []).filter((a) => a.id !== inventory?.id),
    [indukOptions, inventory?.id]
  );

  // ================= Form state =================
  const formHook = useForm<FormState>(
    inventory
      ? {
          kategori_id: inventory.kategori_id ?? null,
          parent_id: inventory.parent_id ?? null,
          nama: inventory.nama || '',
          warna: inventory.warna || '',
          serial_number: inventory.serial_number || '',
          merk: inventory.merk || '',
          type: inventory.type || '',
          jumlah: inventory.jumlah ? String(inventory.jumlah) : '1',
          tanggal_garansi: inventory.tanggal_garansi ? inventory.tanggal_garansi.slice(0, 10) : '',
          perusahaan_id: inventory.perusahaan_id ?? null,
          keterangan: inventory.keterangan || '',
          foto: null,
          supplier_id: inventory.supplier_id ?? null,
          tanggal_input: inventory.tanggal_input ? inventory.tanggal_input.slice(0, 10) : '',
          tanggal_invoice: inventory.tanggal_invoice ? inventory.tanggal_invoice.slice(0, 10) : '',
          no_surat_jalan: inventory.no_surat_jalan || '',
          no_good_receive: inventory.no_good_receive || '',
          status: inventory.status,
        }
      : EMPTY_FORM
  );
  const form = formHook.data;
  const errors = formHook.errors as Record<string, string | undefined>;
  const processing = formHook.processing;

  const errorUmum = Object.entries(errors)
    .filter(([k, v]) => !!v && !FIELD_ERROR_DITAMPILKAN.includes(k))
    .map(([, v]) => v)
    .join(' ');

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    formHook.setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) formHook.clearErrors(key);
  }

  // Item yang sudah punya children gak boleh dikasih parent_id (dicek juga di server, InventoryAction) -- kunci field
  // Inventory Induk & jelasin kenapa. Jumlah children dari baris list (children_count).
  const jumlahKelengkapan = inventory?.children_count ?? 0;
  const sudahPunyaChildren = jumlahKelengkapan > 0;

  function pilihInventoryInduk(id: number | null) {
    formHook.setData((prev) => ({ ...prev, parent_id: id }));
    if (errors.parent_id) formHook.clearErrors('parent_id');
  }

  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(false);
  const inventoryFieldRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!inventoryDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (inventoryFieldRef.current && !inventoryFieldRef.current.contains(e.target as Node)) {
        setInventoryDropdownOpen(false);
        setInventorySearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inventoryDropdownOpen]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && inventoryDropdownOpen) {
        setInventoryDropdownOpen(false);
        setInventorySearch('');
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [inventoryDropdownOpen]);

  const inventoryTerpilih = useMemo(
    () => inventoryOptions.find((a) => a.id === form.parent_id) || null,
    [inventoryOptions, form.parent_id]
  );

  const inventoryFiltered = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return inventoryOptions;
    return inventoryOptions.filter((a) =>
      [a.kode_inventory, a.nama].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [inventoryOptions, inventorySearch]);

  // ================= Foto (drag & drop + preview) =================
  const [fotoPreview, setFotoPreview] = useState<string | null>(
    inventory?.foto ? STORAGE_BASE_URL + inventory.foto : null
  );
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [fotoError, setFotoError] = useState('');
  const fotoObjectUrl = useRef<string | null>(null);
  const dragCounter = useRef(0);

  // FIX (hapus foto): form.foto SELALU null baik pas form baru dibuka untuk
  // edit (foto lama masih ada, cuma preview-nya yang ditampilkan lewat
  // fotoPreview) MAUPUN setelah user klik "Hapus" -- dua kondisi itu gak
  // bisa dibedakan cuma dari value form.foto (sama-sama null). Makanya
  // dibutuhkan flag terpisah ini buat menandai user SECARA EKSPLISIT memilih
  // untuk menghapus foto yang sudah ada, biar buildInventoryFormData() bisa
  // ngirim sinyal 'hapus_foto' ke backend HANYA kalau memang ini yang
  // dimaksud user (bukan ke-trigger tiap kali form disubmit tanpa foto
  // baru).
  const [fotoDihapus, setFotoDihapus] = useState(false);

  useEffect(() => {
    return () => {
      if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    };
  }, []);

  function applyFoto(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_FOTO_TYPES.includes(file.type)) {
      setFotoError('Format harus PNG, JPG, atau WEBP.');
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setFotoError(\`Ukuran foto maksimal \${MAX_FOTO_MB}MB.\`);
      return;
    }
    setFotoError('');
    if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    const url = URL.createObjectURL(file);
    fotoObjectUrl.current = url;
    setField('foto', file);
    setFotoPreview(url);
    // FIX: kalau user pilih foto baru, batalkan flag hapus -- yang dia mau
    // sekarang adalah GANTI foto, bukan menghapusnya tanpa pengganti.
    setFotoDihapus(false);
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    applyFoto(e.target.files?.[0] || null);
  }
  function handleFotoDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingFoto(false);
    applyFoto(e.dataTransfer.files?.[0] || null);
  }
  function handleFotoDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingFoto(true);
  }
  function handleFotoDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setIsDraggingFoto(false);
  }
  function removeFoto() {
    if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    fotoObjectUrl.current = null;
    setField('foto', null);
    setFotoPreview(null);
    // FIX: tandai eksplisit bahwa user memang mau menghapus foto yang ada
    // (bukan sekadar kondisi awal form yang belum disentuh).
    setFotoDihapus(true);
  }

  // ================= Validasi & submit =================
  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.nama?.trim()) next.nama = 'Nama inventory wajib diisi.';
    if (!inventory && form.kategori_id == null) next.kategori_id = 'Kategori barang wajib dipilih.';
    const hasErrors = Object.keys(next).length > 0;
    if (hasErrors) {
      formHook.setError(next as Partial<Record<keyof FormState, string>>);
      toast.error('Mohon lengkapi kolom yang bertanda bintang (*).');
    }
    return !hasErrors;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (processing) return;
    if (!validate()) return;

    // status TIDAK dikirim. Edit: POST + _method=put (multipart, karena ada file).
    formHook.transform((d) => {
      const payload = bangunPayload(d, fotoDihapus);
      return inventory ? { ...payload, _method: 'put' } : payload;
    });

    formHook.post(inventory ? \`/master-data/inventory/\${inventory.id}\` : '/master-data/inventory', {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      // Sukses -> toast dari flash server (FlashToaster).
      onSuccess: () => onSaved(),
    });
  }

  // ================= Render =================
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-form-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 w-full max-w-2xl max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 id="inventory-form-title" className="text-lg font-semibold text-slate-900">
              {inventory ? \`Edit Inventory \${inventory.kode_inventory}\` : 'Tambah Inventory'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Tutup"
            className="group grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-200 group-hover:rotate-90">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="inventory-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {errorUmum && (
            <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {errorUmum}
            </p>
          )}

          {/* Section: Informasi Umum */}
          <Section
            index={0}
            title="Informasi Umum"
            icon={
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 5v3.5M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            {/* Kategori bebas -- semua kategori sama, gak ada cabang UI beda
                lagi berdasar kategori. Cuma bisa dipilih pas mode tambah;
                ganti kategori item yang sudah ada bukan hal yang aman
                dilakukan diam-diam lewat form edit biasa. */}
            <div className="sm:col-span-2">
              <Field label="Kategori" required={!inventory} error={errors.kategori_id}>
                {inventory ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium">
                      {daftarKategori.find((k) => k.id === form.kategori_id)?.nama ?? (loadingKategori ? 'Memuat…' : '-')}
                    </span>
                  </div>
                ) : (
                  <SelectField
                    value={form.kategori_id ?? ''}
                    disabled={loadingKategori}
                    error={!!errors.kategori_id}
                    onChange={(v) => setField('kategori_id', v ? Number(v) : null)}
                  >
                    <option value="">{loadingKategori ? 'Memuat kategori…' : 'Pilih kategori'}</option>
                    {daftarKategori.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                  </SelectField>
                )}
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Nama" error={errors.nama} required>
                <input
                  ref={firstFieldRef}
                  className={\`\${inputClass} \${errors.nama ? inputErrorClass : ''}\`}
                  value={form.nama}
                  placeholder="Masukkan nama inventory"
                  onChange={(e) => setField('nama', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Merk">
              <input className={inputClass} placeholder="Masukkan merk" value={form.merk} onChange={(e) => setField('merk', e.target.value)} />
            </Field>

            <Field label="Type">
              <input className={inputClass} placeholder="Masukkan type / model" value={form.type} onChange={(e) => setField('type', e.target.value)} />
            </Field>
            {/* Status BUKAN field yang bisa diisi manual di sini -- perubahan
                status (tersedia/dipakai/dst) selalu lewat transaksi
                (pinjamkan, kembalikan, lapor rusak), gak pernah lewat form
                create/update ini. Waktu create, status awal SELALU 'tersedia'
                (default kolom di DB). Waktu edit, tampilin status saat-ini
                sebagai info read-only aja. */}
            {inventory && (
              <div className="sm:col-span-2">
                <Field label="Status saat ini">
                  {(() => {
                    const s = STATUS_OPTIONS.find((o) => o.value === form.status);
                    return (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className={\`h-1.5 w-1.5 rounded-full \${s?.dot || 'bg-slate-400'}\`} />
                        <span className="font-medium">{s?.label || form.status}</span>
                      </div>
                    );
                  })()}
                </Field>
              </div>
            )}

            <Field label="Warna">
              <input className={inputClass} placeholder="Masukkan warna" value={form.warna} onChange={(e) => setField('warna', e.target.value)} />
            </Field>

            <Field label="Serial Number" error={errors.serial_number}>
              <input
                className={\`\${inputClass} font-mono text-[13px]\`}
                value={form.serial_number}
                placeholder="Masukkan serial number"
                onChange={(e) => setField('serial_number', e.target.value)}
              />
            </Field>

            <Field label="Jumlah">
              <input
                type="number"
                min={1}
                placeholder="Masukkan jumlah unit"
                className={inputClass}
                value={form.jumlah}
                onChange={(e) => setField('jumlah', e.target.value)}
              />
            </Field>

            <Field label="Tanggal Garansi" error={errors.tanggal_garansi}>
              <input
                type="date"
                className={\`\${inputClass} \${errors.tanggal_garansi ? inputErrorClass : ''}\`}
                value={form.tanggal_garansi}
                onChange={(e) => setField('tanggal_garansi', e.target.value)}
              />
            </Field>
          </Section>

          {/* Section: Struktur (Pasang ke Induk) */}
          <Section
            index={1}
            title="Struktur"
            icon={
              <path d="M3 6.5L8 3l5 3.5v5L8 15l-5-3.5v-5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <div className="sm:col-span-2" ref={inventoryFieldRef}>
              <Field label="Pasang ke Induk" error={errors.parent_id}>
                {sudahPunyaChildren ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Item ini punya {jumlahKelengkapan} kelengkapan menempel, jadi gak bisa dipasang ke induk lain.
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <input
                        className={\`\${inputClass} pl-8\`}
                        placeholder="Cari kode inventory atau nama…"
                        value={inventorySearch}
                        onChange={(e) => {
                          setInventorySearch(e.target.value);
                          setInventoryDropdownOpen(true);
                        }}
                        onFocus={() => setInventoryDropdownOpen(true)}
                      />
                    </div>
                    {inventoryTerpilih && !inventoryDropdownOpen && (
                      <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm animate-[fadeIn_120ms_ease-out]">
                        <span className="text-slate-700">
                          <span className="font-mono text-[13px]">{inventoryTerpilih.kode_inventory}</span>
                          {inventoryTerpilih.nama && <span className="text-slate-400"> — {inventoryTerpilih.nama}</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => pilihInventoryInduk(null)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          aria-label="Hapus pilihan inventory induk"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {inventoryDropdownOpen && (
                      <div className="absolute z-10 mt-1.5 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg animate-[dropIn_120ms_ease-out]">
                        <button
                          type="button"
                          onClick={() => {
                            pilihInventoryInduk(null);
                            setInventorySearch('');
                            setInventoryDropdownOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors border-b border-slate-100"
                        >
                          Tanpa inventory induk
                        </button>
                        {loadingRefs && <p className="px-3 py-2 text-sm text-slate-400">Memuat…</p>}
                        {!loadingRefs && inventoryFiltered.length === 0 && (
                          <p className="px-3 py-2 text-sm text-slate-400">Tidak ada inventory yang cocok</p>
                        )}
                        {inventoryFiltered.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              pilihInventoryInduk(a.id);
                              setInventorySearch('');
                              setInventoryDropdownOpen(false);
                            }}
                            className={\`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors \${
                              form.parent_id === a.id ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
                            }\`}
                          >
                            <span className="font-mono text-[13px]">{a.kode_inventory}</span>
                            {a.nama && <span className="text-slate-400"> — {a.nama}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Field>
            </div>

          </Section>

          {/* Section: Pembelian & Garansi */}
          <Section
            index={2}
            title="Pembelian & Garansi"
            icon={
              <path d="M3 5h10l-.8 7.2a1.5 1.5 0 01-1.49 1.3H5.29a1.5 1.5 0 01-1.49-1.3L3 5zM5.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <Field label="Supplier">
              <SelectField value={form.supplier_id ?? ''} onChange={(v) => setField('supplier_id', v ? Number(v) : null)}>
                <option value="">Pilih supplier</option>
                {effectiveSupplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </SelectField>
            </Field>

            {/* Perusahaan sekarang dropdown yang menyambung ke perusahaan_id
                (FK ke tabel perusahaan) -- sebelumnya field teks bebas. Yang
                ditampilkan di opsi adalah nama perusahaan, yang dikirim ke
                backend tetap id-nya. */}
            <Field label="Perusahaan">
              <SelectField
                value={form.perusahaan_id ?? ''}
                disabled={loadingPerusahaan}
                onChange={(v) => setField('perusahaan_id', v ? Number(v) : null)}
              >
                <option value="">{loadingPerusahaan ? 'Memuat perusahaan…' : 'Pilih perusahaan'}</option>
                {daftarPerusahaan.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Tanggal Pembelian">
              <input type="date" className={inputClass} value={form.tanggal_invoice || ''} onChange={(e) => setField('tanggal_invoice', e.target.value)} />
            </Field>

            <Field label="Tanggal Input">
              <input type="date" className={inputClass} value={form.tanggal_input || ''} onChange={(e) => setField('tanggal_input', e.target.value)} />
            </Field>

            <Field label="No Surat Jalan">
              <input
                className={\`\${inputClass} font-mono text-[13px]\`}
                value={form.no_surat_jalan}
                placeholder="Masukkan nomor surat jalan"
                onChange={(e) => setField('no_surat_jalan', e.target.value)}
              />
            </Field>

            <Field label="No Good Receive">
              <input
                className={\`\${inputClass} font-mono text-[13px]\`}
                value={form.no_good_receive}
                placeholder="Masukkan nomor good receive"
                onChange={(e) => setField('no_good_receive', e.target.value)}
              />
            </Field>
          </Section>

          {/* Section: Detail Tambahan */}
          <Section
            index={3}
            title="Detail Tambahan"
            icon={
              <path d="M2 12.5l3.3-3.3a1.4 1.4 0 012 0L10 11.9M8.7 10.6l1.6-1.6a1.4 1.4 0 012 0L14 10.7M2.5 3h11v10h-11V3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <div className="sm:col-span-2">
              <Field label="Keterangan">
                <div className="relative">
                  <textarea
                    className={\`\${inputClass} min-h-[80px] resize-none\`}
                    value={form.keterangan ?? ''}
                    placeholder="Tulis keterangan tambahan tentang inventory ini"
                    maxLength={KETERANGAN_MAX}
                    onChange={(e) => setField('keterangan', e.target.value)}
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] text-slate-300">
                    {(form.keterangan ?? '').length}/{KETERANGAN_MAX}
                  </span>
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <span className="block mb-1.5 text-sm font-medium text-slate-700">
                Foto {inventory?.foto ? '(ganti, opsional)' : '(opsional)'}
              </span>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleFotoDragEnter}
                onDragLeave={handleFotoDragLeave}
                onDrop={handleFotoDrop}
                className={\`flex items-center gap-4 rounded-xl border border-dashed p-3 cursor-pointer transition-all duration-150 \${
                  isDraggingFoto ? 'border-slate-900 bg-slate-900/[0.03] scale-[1.01]' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }\`}
              >
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleFotoChange} />
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Preview foto inventory" className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0 shadow-sm" />
                ) : (
                  <div className={\`grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-slate-400 shrink-0 transition-transform duration-150 \${isDraggingFoto ? 'scale-110' : ''}\`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16M13 13l1.6-1.6a2 2 0 0 1 2.8 0L20 14M4 6h16v14H4V6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="text-sm flex-1">
                  <p className="font-medium text-slate-700">
                    {isDraggingFoto ? 'Lepas untuk unggah' : fotoPreview ? 'Ganti foto' : 'Unggah foto'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">Klik atau seret file ke sini · PNG/JPG/WEBP · maks {MAX_FOTO_MB}MB</p>
                </div>
                {fotoPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      removeFoto();
                    }}
                    className="text-xs text-red-600 hover:text-red-700 shrink-0 transition-colors"
                  >
                    Hapus
                  </button>
                )}
              </label>
              {fotoError && <span className="block mt-1 text-xs text-red-600 animate-[fadeIn_120ms_ease-out]">{fotoError}</span>}
              {/* BARU: indikator kecil biar admin sadar foto bakal beneran
                  dihapus pas disimpan (bukan cuma preview lokal yang hilang). */}
              {fotoDihapus && (
                <p className="mt-1 text-xs text-amber-600 animate-[fadeIn_120ms_ease-out]">
                  Foto akan dihapus saat perubahan disimpan.
                </p>
              )}
            </div>
          </Section>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <ButtonCancel onClick={onClose} disabled={processing} />
          <ButtonSubmit type="submit" form="inventory-form" loading={processing} loadingLabel="Menyimpan...">
            {inventory ? 'Simpan Perubahan' : 'Tambah Inventory'}
          </ButtonSubmit>
        </div>
      </div>

      <style>{\`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
      \`}</style>
    </div>
  );
}

function Section({
  title,
  icon,
  index,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4 space-y-3.5 animate-[fadeInUp_260ms_ease-out_backwards]"
      style={{ animationDelay: \`\${(index ?? 0) * 50}ms\` }}
    >
      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60 dark:border-zinc-800/80">
        {icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 shadow-xs">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              {icon}
            </svg>
          </span>
        )}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">{title}</h4>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">{children}</div>
    </div>
  );
}`,
      },
    ],
  },
];

// ---------------------------------------------------------------- RUNTIME

const abs = (rel) => path.join(ROOT, ...rel.split('/'));
const log = (...a) => console.log(...a);
const toLF = (s) => s.replace(/\r\n/g, '\n');

function countOccurrences(hay, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

function fail(msg) {
  console.error('\n[BERHENTI] ' + msg);
  console.error('Tidak ada file yang diubah.');
  process.exit(1);
}

if (!fs.existsSync(abs('artisan')) || !fs.existsSync(abs('package.json'))) {
  fail('Jalankan dari root project (folder yang berisi `artisan` dan `package.json`). Sekarang di: ' + ROOT);
}

// ------------------------------------------------------------------ REVERT
if (REVERT) {
  if (!fs.existsSync(MANIFEST)) {
    log('Tidak ada manifest backup untuk ' + FASE + ' (belum pernah dijalankan, atau sudah di-revert). Selesai.');
    process.exit(0);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const restored = [];
  const removed = [];
  const undeleted = [];
  for (const rel of [...(m.modified || []), ...(m.deleted || [])]) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!fs.existsSync(bak)) fail('Backup hilang untuk ' + rel + ' (' + bak + '). Revert dibatalkan.');
  }
  for (const rel of m.modified || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) fs.copyFileSync(bak, abs(rel));
    restored.push(rel);
  }
  for (const rel of m.deleted || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) {
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
      fs.copyFileSync(bak, abs(rel));
    }
    undeleted.push(rel);
  }
  for (const rel of m.created || []) {
    if (fs.existsSync(abs(rel))) {
      if (!DRY) {
        fs.rmSync(abs(rel));
        // rapikan folder kosong yang tadinya dibuat F4 (berhenti di folder pertama yang masih berisi)
        let dir = path.dirname(abs(rel));
        while (dir.startsWith(ROOT) && dir !== ROOT && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        }
      }
      removed.push(rel);
    }
  }
  if (!DRY) fs.rmSync(MANIFEST);
  log((DRY ? '[DRY] ' : '') + 'REVERT ' + FASE.toUpperCase());
  restored.forEach((r) => log('  dikembalikan     : ' + r));
  undeleted.forEach((r) => log('  dipulihkan       : ' + r));
  removed.forEach((r) => log('  dihapus (baru)   : ' + r));
  process.exit(0);
}

// ------------------------------------------------------------ SYARAT: F1 + F2 + F3 SUDAH TERPASANG
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/CabangWebController.php')) ||
    !fs.existsSync(abs('resources/js/components/layout/FlashToaster.tsx'))) {
  fail('F4 butuh F1 yang sudah terpasang (CabangWebController.php / FlashToaster.tsx tidak ditemukan). Jalankan `node f1.mjs` dulu.');
}
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/SupplierWebController.php'))) {
  fail('F4 butuh F2 yang sudah terpasang (SupplierWebController.php tidak ditemukan). Jalankan `node f2.mjs` dulu.');
}
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/KaryawanWebController.php'))) {
  fail('F4 butuh F3 yang sudah terpasang (KaryawanWebController.php tidak ditemukan). Jalankan `node f3.mjs` dulu.');
}

// -------------------------------------------------------------------- PLAN
const problems = [];
const toCreate = []; // { rel, content }
const toModify = []; // { rel, original(raw), output(raw) }
const toDelete = []; // { rel, original(raw) }
const skipped = [];

for (const nf of NEW_FILES) {
  const p = abs(nf.path);
  if (fs.existsSync(p)) {
    const cur = fs.readFileSync(p, 'utf8');
    if (cur.includes('[F4-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F4, tidak ditimpa: ' + nf.path);
    continue;
  }
  toCreate.push({ rel: nf.path, content: nf.content });
}

for (const ed of EDITS) {
  const p = abs(ed.file);
  if (!fs.existsSync(p)) {
    problems.push('File tidak ditemukan: ' + ed.file);
    continue;
  }
  const raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let text = toLF(raw);

  if (text.includes(ed.marker)) {
    skipped.push(ed.file + ' (sudah terpasang)');
    continue;
  }

  let ok = true;
  ed.steps.forEach((st, i) => {
    const label = ed.file + ' langkah ' + (i + 1);
    if ('replaceAll' in st) {
      const sha = crypto.createHash('sha256').update(text).digest('hex');
      if (sha !== st.sha) {
        ok = false;
        problems.push(label + ': isi file lokal BERBEDA dari versi zip yang dipakai menyusun script ini (sha ' + sha.slice(0, 12) + ' != ' + st.sha.slice(0, 12) + '), tidak ditimpa.');
        return;
      }
      text = st.replaceAll;
      return;
    }
    if ('find' in st) {
      const c = countOccurrences(text, st.find);
      if (c !== 1) {
        ok = false;
        problems.push(label + ': anchor ' + (c === 0 ? 'TIDAK ketemu' : 'ketemu ' + c + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.find.slice(0, 90)));
        return;
      }
      text = text.replace(st.find, () => st.with);
    } else {
      const cs = countOccurrences(text, st.start);
      if (cs !== 1) {
        ok = false;
        problems.push(label + ': anchor awal ' + (cs === 0 ? 'TIDAK ketemu' : 'ketemu ' + cs + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.start.slice(0, 90)));
        return;
      }
      const a = text.indexOf(st.start);
      if (!('end' in st)) {
        // ganti dari anchor awal sampai akhir file
        text = text.slice(0, a) + st.with;
        return;
      }
      const b = text.indexOf(st.end, a + st.start.length);
      const ce = countOccurrences(text, st.end);
      if (b === -1 || ce !== 1) {
        ok = false;
        problems.push(label + ': anchor akhir ' + (b === -1 ? 'TIDAK ketemu setelah anchor awal' : 'ketemu ' + ce + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.end.slice(0, 90)));
        return;
      }
      // ganti [a, b) -- anchor akhir tetap dipertahankan
      text = text.slice(0, a) + st.with + text.slice(b);
    }
  });
  if (!ok) continue;

  const output = hadCRLF ? text.replace(/\n/g, '\r\n') : text;
  toModify.push({ rel: ed.file, original: raw, output });
}

for (const rel of DELETES) {
  const p = abs(rel);
  if (!fs.existsSync(p)) {
    skipped.push(rel + ' (sudah terhapus)');
    continue;
  }
  toDelete.push({ rel, original: fs.readFileSync(p, 'utf8') });
}

if (problems.length) {
  console.error('\nPre-check GAGAL:');
  problems.forEach((p) => console.error('  - ' + p));
  console.error('\nKemungkinan file lokal kamu sudah berbeda dari versi zip yang dipakai untuk menyusun script ini.');
  console.error('Kirim isi pesan ini + file terkait ke Claude untuk disesuaikan.');
  fail('Pre-check tidak lolos.');
}

// ------------------------------------------------------------------- APPLY
log((DRY ? '[DRY RUN] ' : '') + 'F4 - Inventory -> Inertia (props + modal)');
if (!DRY) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // Run baru (belum ada manifest, mis. sesudah --revert) -> backup SELALU diperbarui dari kondisi file sekarang,
  // supaya revert berikutnya tidak mengembalikan backup basi. Run lanjutan (manifest ada) -> backup asli dipertahankan.
  const freshRun = !fs.existsSync(MANIFEST);
  let manifest = { created: [], modified: [], deleted: [] };
  if (!freshRun) manifest = { created: [], modified: [], deleted: [], ...JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) };

  const backup = (rel, original) => {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (freshRun || !fs.existsSync(bak)) {
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.writeFileSync(bak, original, 'utf8');
    }
  };

  // 1) semua backup + manifest ditulis DULU sebelum ada file proyek yang disentuh
  for (const m of toModify) {
    backup(m.rel, m.original);
    if (!manifest.modified.includes(m.rel)) manifest.modified.push(m.rel);
  }
  for (const d of toDelete) {
    backup(d.rel, d.original);
    if (!manifest.deleted.includes(d.rel)) manifest.deleted.push(d.rel);
  }
  for (const c of toCreate) {
    if (!manifest.created.includes(c.rel)) manifest.created.push(c.rel);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  // 2) baru terapkan
  for (const m of toModify) fs.writeFileSync(abs(m.rel), m.output, 'utf8');
  for (const c of toCreate) {
    fs.mkdirSync(path.dirname(abs(c.rel)), { recursive: true });
    fs.writeFileSync(abs(c.rel), c.content, 'utf8');
  }
  for (const d of toDelete) fs.rmSync(abs(d.rel));
}

// ----------------------------------------------------------------- SUMMARY
log('');
log('Dibuat   (' + toCreate.length + ')');
toCreate.forEach((c) => log('  + ' + c.rel));
log('Diubah   (' + toModify.length + ')');
toModify.forEach((m) => log('  ~ ' + m.rel));
log('Dihapus  (' + toDelete.length + ')  -- dipindah ke backup, bisa dikembalikan dengan --revert');
toDelete.forEach((d) => log('  - ' + d.rel));
log('Dilewati (' + skipped.length + ')');
skipped.forEach((s) => log('  = ' + s));

if (DRY) {
  log('\nDry run selesai, tidak ada yang ditulis. Jalankan tanpa --dry untuk menerapkan.');
} else {
  log('\nBackup asli: .migrasi-backup/f4/   (kembalikan: node f4.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=master-data/inventory');
log('  npx tsc --noEmit');
log('  npm run build');
