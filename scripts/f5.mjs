#!/usr/bin/env node
// =============================================================================
// F5 - Migrasi ke Inertia: Transaksi pemakai (serah-terima, kembalikan, hapus riwayat pemakaian -> router.post|delete
//      ke route web, modal tetap overlay di tab Inventory; struk dicetak dari flash.struk)
//
// Syarat: F1 + F2 + F3 + F4 sudah terpasang (pola acuan: InventoryWebController / InventoryAction, FlashToaster, grup route master-data).
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f5.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f5.mjs            terapkan
//   node f5.mjs --revert   kembalikan semua dari .migrasi-backup/f5/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x, script berhenti SEBELUM menulis apa pun.
// Aman dijalankan dua kali (yang sudah terpasang dilewati). File yang dihapus DIPINDAH ke .migrasi-backup/f5/ (tidak ada di F5).
// Langkah { find, with } = ganti teks (harus ketemu tepat 1x). { start, end, with } = ganti dari anchor awal sampai
// SEBELUM anchor akhir (tanpa end = sampai akhir file).
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FASE = 'f5';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    path: "app/Actions/Transaksi/InventoryPemakaiAction.php",
    content: `<?php

namespace App\\Actions\\Transaksi;

use App\\Http\\Controllers\\Concerns\\GeneratesStrukNumber;
use App\\Http\\Controllers\\Concerns\\SimpanFotoBukti;
use App\\Models\\MasterData\\Inventory;
use App\\Models\\Transaksi\\InventoryPemakai;
use App\\Models\\Transaksi\\InventoryPenanganan;
use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;

/**
 * [F5-INERTIA] Logika transaksi pemakai inventory (serah-terima / kembalikan / hapus riwayat), dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\Transaksi\\InventoryPemakaiController (JSON, sampai F10)
 *  - Web : App\\Http\\Controllers\\Transaksi\\InventoryPemakaiWebController (redirect back + flash)
 *
 * Aturan validasi & aturan bisnis dipindah APA ADANYA dari InventoryPemakaiController. Dulu pelanggaran aturan
 * non-field dibalas response()->json(['message' => ...], 422); sekarang ValidationException supaya halaman web bisa
 * menampilkannya di dalam modal lewat error bag (API tetap membalas 422 dengan \`message\` yang sama).
 *
 * Kunci error untuk pelanggaran non-field: serah_terima, hapus (kembalikan sudah memakai status / no_struk_penerimaan /
 * penanganan seperti sebelumnya).
 *
 * Otorisasi "admin ATAU pemilik" TIDAK di sini: dicek di controller lewat pastikanBolehKembalikan() (satu aturan,
 * dipanggil dari controller API maupun web sebelum kembalikan()).
 */
class InventoryPemakaiAction
{
    use GeneratesStrukNumber;
    use SimpanFotoBukti;

    // ------------------------------------------------------------------ otorisasi

    /**
     * Kembalikan: admin ATAU pemakainya sendiri (karyawan/cabang yang lagi pegang item ini).
     * Dipanggil dari controller (bukan dari kembalikan()), jadi otorisasi tetap terlihat di lapisan controller.
     */
    public function pastikanBolehKembalikan(User $user, InventoryPemakai $inventoryPemakai): void
    {
        $isPemilikPemakaian = $inventoryPemakai->user_id === $user->id;

        abort_unless(
            $user->isAdmin() || $isPemilikPemakaian,
            403,
            'Kamu tidak punya akses untuk mengembalikan item ini.'
        );
    }

    // ------------------------------------------------------------------ serah-terima

    /**
     * Admin serah-terima item langsung ke karyawan ATAU akun cabang (tanpa lewat alur request/approve). Bisa dipakai
     * buat item apapun kategorinya selama dia berdiri sendiri (parent_id null) -- item yang sudah menempel ke item lain
     * (parent_id terisi) DITOLAK, karena dia cuma boleh ikut pinjam bareng induknya.
     */
    public function serahTerima(Request $request, Inventory $inventory): InventoryPemakai
    {
        // item yang lagi menempel ke item lain (parent_id terisi) gak boleh dipinjam sendirian -- cuma boleh ikut
        // pinjam bareng induknya.
        if ($inventory->parent_id) {
            throw ValidationException::withMessages([
                'serah_terima' => ['Kelengkapan ini menempel ke barang utama dan tidak bisa dipinjam sendirian. Pinjamkan barang utamanya -- kelengkapan yang tersedia akan otomatis ikut dipinjamkan.'],
            ]);
        }

        if ($inventory->status !== 'tersedia') {
            throw ValidationException::withMessages([
                'serah_terima' => ['Item ini sedang tidak tersedia untuk diserahkan.'],
            ]);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'tanggal_penerimaan' => 'required|date',
            'catatan_penerimaan' => 'nullable|string',
            'foto_penerimaan' => 'required|array|min:3|max:3',
            'foto_penerimaan.*' => 'image|mimes:jpg,jpeg,png,webp|max:1024',
        ], [
            'foto_penerimaan.required' => 'Foto bukti serah terima wajib diisi (minimal 3 foto).',
            'foto_penerimaan.min' => 'Foto bukti serah terima minimal 3 foto.',
            'foto_penerimaan.max' => 'Foto bukti serah terima maksimal 3 foto.',
            'foto_penerimaan.*.max' => 'Maksimal size foto adalah 1MB',
        ]);

        return DB::transaction(function () use ($inventory, $request, $validated) {
            $noStruk = $this->generateNoStruk('STJ', 'inventory_pemakai', 'no_struk_penerimaan');

            $fotoPaths = $this->simpanFotoBukti($request, 'foto_penerimaan', 'inventory-pemakai/penerimaan');

            $pemakai = InventoryPemakai::create([
                'inventory_id' => $inventory->id,
                'user_id' => $validated['user_id'],
                'status' => 'disetujui',
                'requested_by_user_id' => $request->user()?->id,
                'no_struk_penerimaan' => $noStruk,
                'tanggal_penerimaan' => $validated['tanggal_penerimaan'],
                'diterima_at' => now(),
                'catatan_penerimaan' => $validated['catatan_penerimaan'] ?? null,
                'foto_penerimaan' => $fotoPaths,
            ]);

            $inventory->update(['status' => 'dipakai']);

            // Item yang menempel (children) ikut induknya -- begitu induk dipinjamkan, semua item yang menempel
            // padanya dan belum punya pemakaian aktif sendiri otomatis ikut dipinjamkan ke pemakai yang sama, pakai
            // foto bukti & tanggal serah-terima yang sama juga (satu kejadian serah-terima fisik).
            // Kalau $inventory ini sendiri lagi menempel ke item lain, children() selalu kosong (item yang sudah punya
            // parent gak boleh sekaligus punya child sendiri), jadi aman dipanggil tanpa pengecekan tambahan.
            //
            // Patokan "belum dipinjam" = tidak punya pemakaian aktif (whereDoesntHave pemakaiSaatIni), BUKAN kolom
            // status: status kelengkapan bisa sudah 'dipakai' karena structural attach ke induk yang belum
            // dipinjamkan siapa-siapa. Item yang lagi dalam penanganan/rusak tetap dikecualikan.
            $inventory->children()
                ->whereNotIn('status', ['rusak', 'menunggu_perbaikan', 'diperbaiki', 'rusak_berat'])
                ->whereDoesntHave('pemakaiSaatIni')
                ->get()
                ->each(function ($anak) use ($validated, $fotoPaths, $request) {
                    $noStrukAnak = $this->generateNoStruk('STJ', 'inventory_pemakai', 'no_struk_penerimaan');

                    InventoryPemakai::create([
                        'inventory_id' => $anak->id,
                        'user_id' => $validated['user_id'],
                        'status' => 'disetujui',
                        'requested_by_user_id' => $request->user()?->id,
                        'no_struk_penerimaan' => $noStrukAnak,
                        'tanggal_penerimaan' => $validated['tanggal_penerimaan'],
                        'diterima_at' => now(),
                        'catatan_penerimaan' => 'Dipinjamkan otomatis -- mengikuti barang utama.',
                        'foto_penerimaan' => $fotoPaths,
                    ]);

                    $anak->update(['status' => 'dipakai']);
                });

            return $pemakai;
        });
    }

    // ------------------------------------------------------------------ kembalikan

    /**
     * Terima kembali item dari pemakai. Wajib sertain no_struk_penerimaan (struk asli pas serah-terima) sebagai bukti
     * pengembalian ini benar, dan foto_pengembalian (3 foto) sebagai bukti kondisi fisik item. Ditolak kalau masih ada
     * laporan penanganan/perbaikan yang belum selesai. Otorisasi (admin ATAU pemilik) dicek lewat
     * pastikanBolehKembalikan() di controller SEBELUM method ini dipanggil.
     */
    public function kembalikan(Request $request, InventoryPemakai $inventoryPemakai): InventoryPemakai
    {
        $validated = $request->validate([
            'no_struk_penerimaan' => 'required|string',
            'tanggal_pengembalian' => 'required|date',
            'catatan_pengembalian' => 'nullable|string',
            'foto_pengembalian' => 'required|array|min:3|max:3',
            'foto_pengembalian.*' => 'image|mimes:jpg,jpeg,png,webp|max:1024',
        ], [
            'foto_pengembalian.required' => 'Foto bukti pengembalian wajib diisi (minimal 3 foto).',
            'foto_pengembalian.min' => 'Foto bukti pengembalian minimal 3 foto.',
            'foto_pengembalian.max' => 'Foto bukti pengembalian maksimal 3 foto.',
            'foto_pengembalian.*.max' => 'Maksimal size foto adalah 1MB',
        ]);

        if ($inventoryPemakai->status !== 'disetujui') {
            throw ValidationException::withMessages([
                'status' => ['Data pemakaian ini bukan pemakaian aktif yang bisa dikembalikan.'],
            ]);
        }

        if ($validated['no_struk_penerimaan'] !== $inventoryPemakai->no_struk_penerimaan) {
            throw ValidationException::withMessages([
                'no_struk_penerimaan' => ['Nomor struk penerimaan tidak cocok. Pengembalian wajib menyertakan bukti serah-terima yang benar.'],
            ]);
        }

        $adaPenangananBelumSelesai = InventoryPenanganan::where('inventory_pemakai_id', $inventoryPemakai->id)
            ->whereNull('tanggal_selesai')
            ->exists();

        if ($adaPenangananBelumSelesai) {
            throw ValidationException::withMessages([
                'penanganan' => ['Masih ada laporan penanganan/perbaikan yang belum diselesaikan untuk pemakaian ini.'],
            ]);
        }

        DB::transaction(function () use ($inventoryPemakai, $request, $validated) {
            $noStruk = $this->generateNoStruk('KBL', 'inventory_pemakai', 'no_struk_pengembalian');

            // 'rusak_berat' cuma dikenal di status Barang Utama -- Kelengkapan cuma punya tersedia/dipakai/rusak, jadi
            // gak ada state permanen yang perlu di-guard buat Kelengkapan.
            $catatanDefault = $inventoryPemakai->catatan_pengembalian;
            if ($inventoryPemakai->inventory?->status === 'rusak_berat') {
                $catatanDefault = 'Dikembalikan dalam kondisi rusak berat (tidak bisa diperbaiki).';
            }

            $fotoPaths = $this->simpanFotoBukti($request, 'foto_pengembalian', 'inventory-pemakai/pengembalian');

            $inventoryPemakai->update([
                'no_struk_pengembalian' => $noStruk,
                'tanggal_pengembalian' => $validated['tanggal_pengembalian'],
                'dikembalikan_at' => now(),
                'catatan_pengembalian' => $validated['catatan_pengembalian'] ?? $catatanDefault,
                'foto_pengembalian' => $fotoPaths,
            ]);

            // jangan paksa balik 'tersedia' kalau lagi rusak_berat -- dia tetep gak boleh dipinjemin lagi walau
            // pemakaiannya udah ditutup. Kelengkapan gak punya state itu, jadi selalu balik normal ke 'tersedia'.
            $inventoryPemakai->inventory()
                ->where('status', '!=', 'rusak_berat')
                ->update(['status' => 'tersedia']);

            // Kelengkapan yang nempel (children dari item yang dikembalikan ini) ikut balik juga -- semua yang masih
            // aktif dipinjam (disetujui, belum ada tanggal_pengembalian) ditutup bareng, pakai foto & tanggal
            // pengembalian yang sama dengan induknya (satu kejadian serah-terima fisik). Kalau item ini berdiri
            // sendiri, query di bawah otomatis gak nemu apa-apa.
            $noStrukIndukKembali = $inventoryPemakai->no_struk_pengembalian;
            InventoryPemakai::whereIn('inventory_id', function ($q) use ($inventoryPemakai) {
                $q->select('id')
                    ->from('inventory')
                    ->where('parent_id', $inventoryPemakai->inventory_id);
            })
                ->where('status', 'disetujui')
                ->whereNull('tanggal_pengembalian')
                ->get()
                ->each(function ($anakPemakai) use ($validated, $fotoPaths, $noStrukIndukKembali) {
                    $noStrukAnak = $this->generateNoStruk('KBL', 'inventory_pemakai', 'no_struk_pengembalian');

                    $anakPemakai->update([
                        'no_struk_pengembalian' => $noStrukAnak,
                        'tanggal_pengembalian' => $validated['tanggal_pengembalian'],
                        'dikembalikan_at' => now(),
                        'catatan_pengembalian' => 'Dikembalikan otomatis -- mengikuti barang utama (' . $noStrukIndukKembali . ').',
                        'foto_pengembalian' => $fotoPaths,
                    ]);

                    $anakPemakai->inventory()->update(['status' => 'tersedia']);
                });
        });

        return $inventoryPemakai->fresh();
    }

    // ------------------------------------------------------------------ hapus riwayat

    /**
     * Admin: hapus satu entri riwayat pemakaian (Barang Utama maupun Kelengkapan). Ditolak kalau entri ini punya
     * laporan penanganan/perbaikan yang nempel. Kalau entri yang dihapus ini pemakaian yang masih aktif (belum
     * dikembalikan), status item-nya dikembalikan ke 'tersedia' dulu (kecuali lagi rusak_berat).
     */
    public function hapus(InventoryPemakai $inventoryPemakai): void
    {
        if (InventoryPenanganan::where('inventory_pemakai_id', $inventoryPemakai->id)->exists()) {
            throw ValidationException::withMessages([
                'hapus' => ['Riwayat pemakaian ini punya laporan perbaikan terkait dan tidak bisa dihapus.'],
            ]);
        }

        $masihDipakai = $inventoryPemakai->status === 'disetujui' && !$inventoryPemakai->tanggal_pengembalian;

        DB::transaction(function () use ($inventoryPemakai, $masihDipakai) {
            if ($masihDipakai) {
                $inventoryPemakai->inventory()
                    ->where('status', '!=', 'rusak_berat')
                    ->update(['status' => 'tersedia']);

                // Sama seperti kembalikan(): entri kelengkapan yang masih aktif ikut item ini juga ikut dilepas &
                // ditutup statusnya (bukan dihapus, biar riwayatnya tetap ada), biar gak nyangkut "dipakai" padahal
                // riwayat pinjam induknya udah dihapus.
                InventoryPemakai::whereIn('inventory_id', function ($q) use ($inventoryPemakai) {
                    $q->select('id')
                        ->from('inventory')
                        ->where('parent_id', $inventoryPemakai->inventory_id);
                })
                    ->where('status', 'disetujui')
                    ->whereNull('tanggal_pengembalian')
                    ->get()
                    ->each(function ($anakPemakai) {
                        $anakPemakai->update([
                            'tanggal_pengembalian' => now()->toDateString(),
                            'dikembalikan_at' => now(),
                            'catatan_pengembalian' => 'Dikembalikan otomatis -- riwayat pinjam barang utama dihapus.',
                        ]);
                        $anakPemakai->inventory()->update(['status' => 'tersedia']);
                    });
            }
            $inventoryPemakai->delete();
        });
    }
}`,
  },
  {
    path: "app/Http/Controllers/Transaksi/InventoryPemakaiWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\Transaksi;

use App\\Actions\\Transaksi\\InventoryPemakaiAction;
use App\\Http\\Controllers\\Controller;
use App\\Models\\MasterData\\Inventory;
use App\\Models\\Transaksi\\InventoryPemakai;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;

// [F5-INERTIA] Versi Inertia dari aksi transaksi pemakai di InventoryPemakaiController (API): serah-terima, kembalikan,
// hapus riwayat pemakaian. Dipanggil dari modal di tab Inventory (Master Data) lewat routes/web.php (session + CSRF);
// balasan = redirect back + flash (bukan JSON). Logika & aturan SAMA dengan versi API karena dipakai bareng lewat
// InventoryPemakaiAction. Endpoint baca (riwayat/foto/index) tetap di InventoryPemakaiController sampai F7.
//
// Flash \`struk\` (selain success): data pemakai terbaru buat cetak struk di klien. Dulu klien memakai body response JSON;
// sekarang redirect tidak membawa body, jadi datanya ikut lewat shared prop flash (lihat HandleInertiaRequests).
class InventoryPemakaiWebController extends Controller
{
    public function __construct(private InventoryPemakaiAction $pemakai)
    {
    }

    // POST /master-data/inventory/{inventory}/pemakai  (multipart: foto_penerimaan[])   -- admin-only
    // Gagal -> error bag key "serah_terima" / user_id / foto_penerimaan(.n) / tanggal_penerimaan.
    public function store(Request $request, Inventory $inventory): RedirectResponse
    {
        $pemakai = $this->pemakai->serahTerima($request, $inventory)->load('user', 'inventory');

        return back()
            ->with('success', 'Serah terima inventory berhasil dicatat.')
            ->with('struk', [
                'tipe' => 'serah_terima',
                'results' => [[
                    'inventory' => $inventory->only(['id', 'kode_inventory', 'nama']),
                    'pemakai' => $pemakai->toArray(),
                ]],
            ]);
    }

    // POST /master-data/inventory-pemakai/{inventoryPemakai}/kembalikan  (multipart: foto_pengembalian[])
    // Admin ATAU pemilik pemakaian (bukan admin-only) -- otorisasi dicek di sini, sama seperti versi API.
    // Gagal -> error bag key status / no_struk_penerimaan / penanganan / foto_pengembalian(.n) / tanggal_pengembalian.
    public function kembalikan(Request $request, InventoryPemakai $inventoryPemakai): RedirectResponse
    {
        $this->pemakai->pastikanBolehKembalikan($request->user(), $inventoryPemakai);

        $hasil = $this->pemakai->kembalikan($request, $inventoryPemakai)->load('user', 'inventory');

        return back()
            ->with('success', 'Pengembalian inventory berhasil diproses.')
            ->with('struk', [
                'tipe' => 'pengembalian',
                'pemakai' => $hasil->toArray(),
            ]);
    }

    // DELETE /master-data/inventory-pemakai/{inventoryPemakai}   -- admin-only
    // Gagal -> error bag key "hapus".
    public function destroy(InventoryPemakai $inventoryPemakai): RedirectResponse
    {
        $this->pemakai->hapus($inventoryPemakai);

        return back()->with('success', 'Riwayat pemakaian berhasil dihapus.');
    }
}`,
  },
];

const DELETES = [];

const EDITS = [
  {
    file: "app/Http/Controllers/Transaksi/InventoryPemakaiController.php",
    marker: "[F5-INERTIA]",
    steps: [
      { start: `use App\\Http\\Controllers\\Controller;

use App\\Http\\Controllers\\Concerns\\GeneratesStrukNumber;`, end: `    /**
     * GET /api/inventory-pemakai/riwayat`, with: `use App\\Actions\\Transaksi\\InventoryPemakaiAction;
use App\\Http\\Controllers\\Controller;
use App\\Models\\MasterData\\Inventory;
use App\\Models\\Transaksi\\InventoryPemakai;
use App\\Models\\Transaksi\\InventoryPenanganan;
use App\\Models\\Transaksi\\InventoryWriteoff;
use Illuminate\\Http\\Request;

class InventoryPemakaiController extends Controller
{
    // [F5-INERTIA] store / kembalikan / destroy dipakai bareng dengan InventoryPemakaiWebController lewat Action.
    public function __construct(private InventoryPemakaiAction $pemakai)
    {
    }

` },
      { start: `    /**
     * POST /api/inventory/{inventory}/pemakai`, with: `    /**
     * POST /api/inventory/{inventory}/pemakai
     * [F5-INERTIA] Logika di InventoryPemakaiAction::serahTerima() (dipakai bareng versi web). Frontend halaman sudah
     * pindah ke POST /master-data/inventory/{inventory}/pemakai; endpoint ini dihapus di F10.
     */
    public function store(Request $request, Inventory $inventory)
    {
        $pemakai = $this->pemakai->serahTerima($request, $inventory);

        return response()->json($pemakai->load('user', 'inventory'), 201);
    }

    /**
     * POST /api/inventory-pemakai/{inventoryPemakai}/kembalikan
     * Admin ATAU pemakainya sendiri. Otorisasi tetap dicek di sini (controller); logika di
     * InventoryPemakaiAction::kembalikan().
     */
    public function kembalikan(Request $request, InventoryPemakai $inventoryPemakai)
    {
        $this->pemakai->pastikanBolehKembalikan($request->user(), $inventoryPemakai);

        $hasil = $this->pemakai->kembalikan($request, $inventoryPemakai);

        return response()->json($hasil->load('user', 'inventory'));
    }

    /**
     * DELETE /api/inventory-pemakai/{inventoryPemakai}
     * Admin: hapus satu entri riwayat pemakaian. Logika di InventoryPemakaiAction::hapus().
     */
    public function destroy(InventoryPemakai $inventoryPemakai)
    {
        $this->pemakai->hapus($inventoryPemakai);

        return response()->json(['message' => 'Riwayat pemakaian berhasil dihapus.']);
    }
}` },
    ],
  },
  {
    file: "routes/web.php",
    marker: "[F5-INERTIA]",
    steps: [
      { find: `use App\\Http\\Controllers\\Transaksi\\PenangananInventoryPageController;`, with: `use App\\Http\\Controllers\\Transaksi\\PenangananInventoryPageController;
use App\\Http\\Controllers\\Transaksi\\InventoryPemakaiWebController;` },
      { find: `        Route::delete('/inventory/{inventory}', [InventoryWebController::class, 'destroy'])->whereNumber('inventory');
    });
`, with: `        Route::delete('/inventory/{inventory}', [InventoryWebController::class, 'destroy'])->whereNumber('inventory');

        // [F5-INERTIA] Transaksi pemakai (admin-only): serah-terima (multipart foto_penerimaan[]) & hapus riwayat pemakaian.
        // {inventory} = route model binding (LogActivity butuh model-nya buat deskripsi audit "meminjamkan aset <kode>").
        Route::post('/inventory/{inventory}/pemakai', [InventoryPemakaiWebController::class, 'store'])->whereNumber('inventory');
        Route::delete('/inventory-pemakai/{inventoryPemakai}', [InventoryPemakaiWebController::class, 'destroy'])->whereNumber('inventoryPemakai');
    });

    // [F5-INERTIA] Kembalikan inventory: BUKAN admin-only. Admin ATAU pemakai yang lagi pegang item ini (karyawan/cabang) --
    // sama seperti route API aslinya (cuma auth). Otorisasi "admin atau pemilik" dicek di InventoryPemakaiWebController::kembalikan().
    Route::middleware(LogActivity::class)->prefix('master-data')->group(function () {
        Route::post('/inventory-pemakai/{inventoryPemakai}/kembalikan', [InventoryPemakaiWebController::class, 'kembalikan'])->whereNumber('inventoryPemakai');
    });
` },
    ],
  },
  {
    file: "app/Http/Middleware/HandleInertiaRequests.php",
    marker: "[F5-INERTIA]",
    steps: [
      { find: `                'error' => $request->hasSession() ? $request->session()->get('error') : null,
`, with: `                'error' => $request->hasSession() ? $request->session()->get('error') : null,
                // [F5-INERTIA] Data struk (serah-terima / pengembalian) buat dicetak klien setelah mutasi sukses -- redirect tidak
                // membawa body JSON seperti API dulu. Dibaca onSuccess modal (page.props.flash.struk), BUKAN oleh FlashToaster.
                'struk' => $request->hasSession() ? $request->session()->get('struk') : null,
` },
    ],
  },
  {
    file: "resources/js/types/inertia.ts",
    marker: "[F5-INERTIA]",
    steps: [
      { find: `import type { User } from './user';

export interface Flash {
  success?: string | null;
  error?: string | null;
}`, with: `import type { User } from './user';
import type { Inventory } from '../api/masterData/inventory';
import type { InventoryPemakai } from '../api/transaksi/inventoryPemakai';

// [F5-INERTIA] Data struk yang dikirim server lewat flash setelah serah-terima / pengembalian sukses (lihat
// InventoryPemakaiWebController). \`inventory\` pada serah_terima cuma berisi id, kode_inventory, nama -- klien menggabungkannya
// dengan baris inventory yang sudah dia punya.
export type StrukFlash =
  | { tipe: 'serah_terima'; results: { inventory: Pick<Inventory, 'id' | 'kode_inventory' | 'nama'>; pemakai: InventoryPemakai }[] }
  | { tipe: 'pengembalian'; pemakai: InventoryPemakai };

export interface Flash {
  success?: string | null;
  error?: string | null;
  struk?: StrukFlash | null;
}` },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/InventorySerahTerimaModal.tsx",
    marker: "[F5-INERTIA]",
    steps: [
      { find: `import { serahTerimaInventory, searchKaryawan, type InventoryPemakai, type KaryawanUser } from '../../../api/transaksi/inventoryPemakai';`, with: `import { router } from '@inertiajs/react';
// [F5-INERTIA] Submit lewat router.post ke /master-data/inventory/{id}/pemakai (bukan axios). searchKaryawan TETAP axios:
// autocomplete per ketikan (JSON ringan), tidak cocok jadi visit Inertia.
import { searchKaryawan, type InventoryPemakai, type KaryawanUser } from '../../../api/transaksi/inventoryPemakai';
import type { Flash } from '../../../types/inertia';` },
      { find: `  const handleSubmit = async () => {
    const newErrors: { penerima?: string; foto?: string } = {};`, with: `  const handleSubmit = () => {
    const newErrors: { penerima?: string; foto?: string } = {};` },
      { start: `    // Cuma inventory utama yang diserahkan lewat sini -- kelengkapan yang masih`, end: `  return (
    <div
      className="fixed inset-0`, with: `    // Cuma inventory utama yang diserahkan lewat sini -- kelengkapan yang masih 'tersedia' otomatis ikut diserahkan di
    // backend (satu struk & foto yang sama), gak perlu request terpisah dari sini lagi.
    // Sukses -> toast dari flash server (FlashToaster) + data struk di flash.struk buat dicetak parent. Gagal validasi ->
    // pesan tampil di dalam modal ini.
    const data: Record<string, string | number | File[]> = {
      user_id: selected!.id,
      tanggal_penerimaan: tanggalPenerimaan,
      foto_penerimaan: fotoPenerimaan,
    };
    if (catatan.trim()) data.catatan_penerimaan = catatan.trim();

    router.post(\`/master-data/inventory/\${inventory.id}/pemakai\`, data, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onSuccess: (page) => {
        const struk = (page.props as { flash?: Flash }).flash?.struk;
        const results =
          struk?.tipe === 'serah_terima'
            ? struk.results.map((r) => ({ inventory: { ...inventory, ...r.inventory }, pemakai: r.pemakai }))
            : [];
        onSuccess(results);
      },
      onError: (errors) => {
        const msg =
          errors.user_id ||
          errors.foto_penerimaan ||
          errors.serah_terima ||
          Object.values(errors)[0] ||
          'Gagal mencatat serah-terima. Coba lagi.';
        setServerError(msg);
        toast.error(msg);
      },
      onFinish: () => setSubmitting(false),
    });
  };

` },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/InventoryPengembalianModal.tsx",
    marker: "[F5-INERTIA]",
    steps: [
      { find: `import { kembalikanInventory, type InventoryPemakai } from '../../../api/transaksi/inventoryPemakai';`, with: `import { router } from '@inertiajs/react';
import type { InventoryPemakai } from '../../../api/transaksi/inventoryPemakai';
import type { Flash } from '../../../types/inertia';` },
      { find: `  const handleSubmit = async () => {
    const newErrors: { kodeStruk?: string; foto?: string } = {};`, with: `  const handleSubmit = () => {
    const newErrors: { kodeStruk?: string; foto?: string } = {};` },
      { start: `    try {
      // pakai FormData (bukan JSON) karena ada file foto yang diunggah`, end: `  return (
    <div
      className="fixed inset-0`, with: `    // [F5-INERTIA] router.post + forceFormData (ada file foto). Sukses -> toast dari flash server (FlashToaster) + data struk
    // pengembalian di flash.struk buat dicetak parent. Gagal validasi -> pesan tampil di dalam modal ini.
    const data: Record<string, string | File[]> = {
      no_struk_penerimaan: kodeStruk.trim(),
      tanggal_pengembalian: tanggalPengembalian,
      foto_pengembalian: fotoPengembalian,
    };
    if (catatan.trim()) data.catatan_pengembalian = catatan.trim();

    router.post(\`/master-data/inventory-pemakai/\${pemakai.id}/kembalikan\`, data, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onSuccess: (page) => {
        const struk = (page.props as { flash?: Flash }).flash?.struk;
        onSuccess(struk?.tipe === 'pengembalian' ? struk.pemakai : pemakai);
      },
      onError: (errors) => {
        const msg =
          errors.no_struk_penerimaan ||
          errors.foto_pengembalian ||
          Object.values(errors)[0] ||
          'Gagal memproses pengembalian.';
        setServerError(msg);
        toast.error(msg);
      },
      onFinish: () => setSubmitting(false),
    });
  };

` },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/TabInventory/index.tsx",
    marker: "[F5-INERTIA]",
    steps: [
      { find: `import { deletePemakaiInventory, type InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';`, with: `import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';` },
      { find: `// Aksi serah-terima / pengembalian / lapor kerusakan / penanganan masih lewat axios (dipindah di F5/F6); setelah
// sukses, tab ini cukup memuat ulang props lewat segarkan().`, with: `// [F5-INERTIA] Serah-terima / pengembalian / hapus riwayat pemakaian = Inertia (router.post|delete ke /master-data/inventory*, toast dari
// flash server, struk dicetak dari flash.struk). Lapor kerusakan / penanganan masih lewat axios (dipindah di F6); setelah
// sukses, tab ini cukup memuat ulang props lewat segarkan().` },
      { find: `  // Serah-terima 1 inventory utama (checklist kelengkapan ada di dalam modalnya), pengembalian, lapor kerusakan,
  // dan penanganan selesai: masih axios (F5/F6).`, with: `  // Serah-terima 1 inventory utama (kelengkapan ikut otomatis di server) & pengembalian: modal -> router.post (F5).
  // Lapor kerusakan & penanganan selesai: masih axios (F6).` },
      { find: `  // ------------------------------------------------------------------ aksi riwayat di modal detail (axios sampai F5/F6)`, with: `  // ------------------------------------------------------------------ aksi riwayat di modal detail
  // (hapus riwayat pemakaian = Inertia [F5-INERTIA]; terima/hapus penanganan = axios sampai F6)` },
      { start: `  async function handleDeletePemakai(id: number) {`, end: `  // ------------------------------------------------------------------ filter (adapter ke komponen filter lama)`, with: `  function handleDeletePemakai(id: number) {
    if (!confirm('Hapus riwayat pemakaian ini?')) return;
    setHistoryActionError('');
    setDeletingPemakaiId(id);
    // Sukses -> toast dari flash server; gagal (mis. ada laporan perbaikan terkait) -> error bag "hapus" tampil di modal detail.
    router.delete(\`/master-data/inventory-pemakai/\${id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => segarkan(),
      onError: (errors) => setHistoryActionError(errors.hapus || 'Gagal menghapus riwayat pemakaian.'),
      onFinish: () => setDeletingPemakaiId(null),
    });
  }

` },
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
        // rapikan folder kosong yang tadinya dibuat F5 (berhenti di folder pertama yang masih berisi)
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

// ------------------------------------------------------------ SYARAT: F1-F4 SUDAH TERPASANG
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/CabangWebController.php')) ||
    !fs.existsSync(abs('resources/js/components/layout/FlashToaster.tsx'))) {
  fail('F5 butuh F1 yang sudah terpasang (CabangWebController.php / FlashToaster.tsx tidak ditemukan). Jalankan `node f1.mjs` dulu.');
}
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/KaryawanWebController.php'))) {
  fail('F5 butuh F3 yang sudah terpasang (KaryawanWebController.php tidak ditemukan).');
}
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/InventoryWebController.php')) ||
    !fs.existsSync(abs('app/Actions/MasterData/InventoryAction.php'))) {
  fail('F5 butuh F4 yang sudah terpasang (InventoryWebController.php / InventoryAction.php tidak ditemukan). Jalankan `node f4.mjs` dulu.');
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
    if (cur.includes('[F5-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F5, tidak ditimpa: ' + nf.path);
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
log((DRY ? '[DRY RUN] ' : '') + 'F5 - Inventory -> Inertia (props + modal)');
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
  log('\nBackup asli: .migrasi-backup/f5/   (kembalikan: node f5.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=master-data/inventory');
log('  php artisan route:list --path=master-data/inventory-pemakai');
log('  npx tsc --noEmit');
log('  npm run build');
