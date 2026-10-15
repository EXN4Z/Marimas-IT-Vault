#!/usr/bin/env node
// =============================================================================
// F6 - Migrasi ke Inertia: Penanganan Inventory (halaman: daftar/KPI/filter/pagination -> props; lapor kerusakan, terima,
//      tandai selesai, hapus, import -> router ke route web; usePenangananData dihapus)
//
// Syarat: F1 - F5 sudah terpasang (pola acuan: InventoryPemakaiAction / InventoryPemakaiWebController, FlashToaster, LogActivity).
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f6.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f6.mjs            terapkan
//   node f6.mjs --revert   kembalikan semua dari .migrasi-backup/f6/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x (atau file yang diganti total isinya beda dari
// versi zip), script berhenti SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// File yang dihapus DIPINDAH ke .migrasi-backup/f6/ (bukan dihapus permanen) dan dikembalikan oleh --revert.
// Langkah { find, with } = ganti teks (harus ketemu tepat 1x). { start, end, with } = ganti dari anchor awal sampai
// SEBELUM anchor akhir (tanpa end = sampai akhir file). { replaceAll, sha } = ganti seluruh isi file, hanya jika SHA-256 isi
// aslinya (line ending dinormalisasi ke LF) cocok dengan versi yang dipakai menyusun script ini.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FASE = 'f6';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    path: "app/Queries/InventoryPenangananQuery.php",
    content: `<?php

namespace App\\Queries;

use App\\Models\\Transaksi\\InventoryPenanganan;
use App\\Models\\User;
use Illuminate\\Database\\Eloquent\\Builder;

/**
 * [F6-INERTIA] Query dasar & aturan akses laporan penanganan inventory, dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\Transaksi\\InventoryPenangananController::index (JSON, sampai F10)
 *  - Web : App\\Http\\Controllers\\Transaksi\\InventoryPenangananWebController (props halaman Penanganan Inventory)
 *
 * Aturan scoping dipindah APA ADANYA dari InventoryPenangananController::index():
 * admin = semua laporan; non-admin = cuma laporan yang terkait pemakaian dia sendiri (inventory_pemakai.user_id == dia).
 */
class InventoryPenangananQuery
{
    public const STATUS = ['menunggu', 'diperbaiki', 'diperbaiki_selesai', 'rusak_berat'];

    /** Populasi yang boleh dilihat user (scoping role), tanpa eager-load & tanpa urutan (aman buat count). */
    public static function populasi(User $user): Builder
    {
        $query = InventoryPenanganan::query();

        if (!$user->isAdmin()) {
            $query->whereHas('pemakai', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            });
        }

        return $query;
    }

    /**
     * Eager-load + urutan standar (terbaru dulu; id sebagai pemecah seri supaya pagination stabil). Dipanggil SETELAH
     * count() kalau query-nya juga dihitung -- orderBy bikin count() gagal di PostgreSQL.
     */
    public static function muat(Builder $query): Builder
    {
        return $query
            ->with(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name'])
            ->orderByDesc('tanggal_lapor')
            ->orderByDesc('inventory_penanganan.id');
    }

    /**
     * Segmen status -- aturan SAMA dengan filter di halaman React lama:
     *  menunggu            : belum selesai & belum diterima
     *  diperbaiki          : belum selesai & sudah diterima
     *  diperbaiki_selesai  : sudah selesai & hasil bukan rusak_berat (hasil kosong ikut di sini)
     *  rusak_berat         : sudah selesai & hasil rusak_berat
     */
    public static function segmen(Builder $query, string $status): Builder
    {
        return match ($status) {
            'menunggu' => $query->whereNull('tanggal_selesai')->whereNull('tanggal_diterima'),
            'diperbaiki' => $query->whereNull('tanggal_selesai')->whereNotNull('tanggal_diterima'),
            'diperbaiki_selesai' => $query->whereNotNull('tanggal_selesai')
                ->where(fn ($q) => $q->whereNull('hasil')->orWhere('hasil', '!=', 'rusak_berat')),
            'rusak_berat' => $query->whereNotNull('tanggal_selesai')->where('hasil', 'rusak_berat'),
            default => $query,
        };
    }

    /** Jumlah laporan per segmen (kartu KPI) -- tidak terpengaruh pencarian/filter jenis. */
    public static function hitungSegmen(User $user): array
    {
        $hasil = [];
        foreach (self::STATUS as $status) {
            $hasil[$status] = self::segmen(self::populasi($user), $status)->count();
        }

        return $hasil;
    }

    /**
     * Pencarian + filter jenis kerusakan. Pencarian cocok ke: kode & nama inventory, jenis kerusakan, keluhan, catatan,
     * dan nama pelapor (dilaporkan_oleh, fallback ke pemakai saat itu -- sama seperti namaPelaporPenanganan() di klien).
     */
    public static function filter(Builder $query, ?string $search, ?string $jenis): Builder
    {
        if ($jenis !== null && $jenis !== '') {
            $query->where('inventory_penanganan.jenis_kerusakan', $jenis);
        }

        if ($search !== null && $search !== '') {
            // escape karakter wildcard LIKE supaya yang diketik dianggap teks biasa; LOWER() biar tidak peka huruf besar/kecil
            $kata = '%' . mb_strtolower(str_replace(['\\\\', '%', '_'], ['\\\\\\\\', '\\\\%', '\\\\_'], $search)) . '%';

            $query->where(function ($q) use ($kata) {
                $q->whereRaw('LOWER(inventory_penanganan.jenis_kerusakan) LIKE ?', [$kata])
                    ->orWhereRaw('LOWER(inventory_penanganan.keluhan) LIKE ?', [$kata])
                    ->orWhereRaw('LOWER(inventory_penanganan.catatan) LIKE ?', [$kata])
                    ->orWhereHas('inventory', function ($i) use ($kata) {
                        $i->whereRaw('LOWER(inventory.kode_inventory) LIKE ?', [$kata])
                            ->orWhereRaw('LOWER(inventory.nama) LIKE ?', [$kata]);
                    })
                    ->orWhereHas('dilaporkanOleh', fn ($u) => $u->whereRaw('LOWER(users.name) LIKE ?', [$kata]))
                    ->orWhere(function ($w) use ($kata) {
                        $w->whereNull('inventory_penanganan.dilaporkan_oleh_user_id')
                            ->whereHas('pemakai.user', fn ($u) => $u->whereRaw('LOWER(users.name) LIKE ?', [$kata]));
                    });
            });
        }

        return $query;
    }
}`,
  },
  {
    path: "app/Actions/Transaksi/InventoryPenangananAction.php",
    content: `<?php

namespace App\\Actions\\Transaksi;

use App\\Http\\Controllers\\Concerns\\GeneratesStrukNumber;
use App\\Imports\\Transaksi\\InventoryPenangananImport;
use App\\Models\\MasterData\\Inventory;
use App\\Models\\Transaksi\\InventoryPemakai;
use App\\Models\\Transaksi\\InventoryPenanganan;
use App\\Models\\User;
use App\\Notifications\\AsetKerusakanDilaporkan;
use App\\Notifications\\AsetKerusakanSelesai;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\UploadedFile;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Log;
use Illuminate\\Support\\Facades\\Notification;
use Illuminate\\Validation\\Rule;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

/**
 * [F6-INERTIA] Logika penanganan inventory (lapor kerusakan / terima / tandai selesai / hapus / import), dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\Transaksi\\InventoryPenangananController + ImportController (JSON, sampai F10)
 *  - Web : App\\Http\\Controllers\\Transaksi\\InventoryPenangananWebController (redirect back + flash)
 *
 * Aturan validasi & aturan bisnis dipindah APA ADANYA. Dulu pelanggaran non-field dibalas
 * response()->json(['message' => ...], 422); sekarang ValidationException supaya halaman web bisa menampilkannya di dalam
 * modal lewat error bag (API tetap membalas 422 dengan \`message\` yang sama).
 *
 * Kunci error non-field: lapor (store), terima.
 */
class InventoryPenangananAction
{
    use GeneratesStrukNumber;

    // ------------------------------------------------------------------ lapor kerusakan

    /**
     * Peminjam ATAU admin lapor kerusakan barang -- berlaku buat SEMUA item apapun kategori & posisinya (induk maupun
     * yang lagi menempel ke item lain). Alur: lapor -> menunggu_perbaikan -> terima -> diperbaiki -> selesai (hasil
     * 'diperbaiki' ATAU 'rusak_berat'). Kalau hasilnya 'rusak_berat', item yang lagi menempel ke induk TIDAK otomatis
     * dicopot -- itu tetap aksi manual admin lewat lepas-dari-induk.
     */
    public function lapor(Request $request): InventoryPenanganan
    {
        $request->validate([
            'inventory_id' => 'required|exists:inventory,id',
        ]);

        $user = $request->user();
        $inventory = Inventory::findOrFail($request->input('inventory_id'));

        // satu daftar jenis kerusakan buat semua item, apapun kategori atau posisinya (induk/menempel).
        $opsiJenisKerusakan = ['software', 'hardware', 'tidak_berfungsi', 'hancur', 'terputus_sobek'];

        $validated = $request->validate([
            'inventory_id' => 'required|exists:inventory,id',
            'jenis_kerusakan' => ['required', 'in:' . implode(',', $opsiJenisKerusakan)],
            'keluhan' => 'required|string',
            'foto' => 'required|image|mimes:jpg,jpeg,png,webp|max:1024',
        ], [
            'foto.required' => 'foto harus diisi',
            'foto.max' => 'Size foto maksimal 1MB',
            'foto.mimes' => 'foto harus berupa jpg,jpeg,png,webp',
            'jenis_kerusakan.in' => 'Jenis kerusakan tidak valid untuk kategori barang ini.',
        ]);

        // cegah lapor dobel kalau item ini masih ada laporan yang belum selesai ditangani (baik yang masih menunggu
        // diterima admin, maupun yang sudah diterima/sedang diperbaiki)
        if (in_array($inventory->status, ['menunggu_perbaikan', 'diperbaiki', 'rusak_berat'], true)) {
            $pesan = $inventory->status === 'rusak_berat'
                ? 'Barang ini sudah dinyatakan rusak berat, tidak bisa dilaporkan kerusakan lagi.'
                : 'Barang ini sudah dilaporkan rusak dan sedang dalam penanganan.';

            throw ValidationException::withMessages(['lapor' => [$pesan]]);
        }

        // cegah lapor 2x: kalau item ini masih ada laporan yang belum kelar (belum ditandai selesai), tolak laporan baru.
        $sudahAdaLaporanAktif = InventoryPenanganan::where('inventory_id', $validated['inventory_id'])
            ->whereNull('tanggal_selesai')
            ->exists();

        if ($sudahAdaLaporanAktif) {
            throw ValidationException::withMessages([
                'inventory_id' => 'Barang ini sudah ada laporan kerusakan yang masih diproses. Tunggu sampai selesai sebelum lapor lagi.',
            ]);
        }

        // cek user emang lagi pegang item ini via pemakaian aktif (status disetujui, belum dikembalikan).
        $pemakai = InventoryPemakai::where('inventory_id', $validated['inventory_id'])
            ->where('status', 'disetujui')
            ->whereNull('tanggal_pengembalian')
            ->where('user_id', $user->id)
            ->first();

        $penanganan = DB::transaction(function () use ($validated, $pemakai, $request) {
            $fotoPath = $request->file('foto')->store('inventory-penanganan', 'public');
            // nullable: laporan kerusakan bisa juga muncul pas item lagi nganggur (audit gudang)
            $penanganan = InventoryPenanganan::create([
                'inventory_id' => $validated['inventory_id'],
                'inventory_pemakai_id' => $pemakai->id ?? null,
                'dilaporkan_oleh_user_id' => $request->user()->id,
                'jenis_kerusakan' => $validated['jenis_kerusakan'],
                'keluhan' => $validated['keluhan'],
                'foto' => $fotoPath,
                'tanggal_lapor' => now(),
                'lapor_at' => now(),
            ]);

            // item langsung ganti status "menunggu_perbaikan" biar kelihatan di tabel (dan biar tombol "Lapor Kerusakan"
            // ilang, gak bisa dobel lapor). Kelengkapan yang nempel TIDAK ikut berubah -- tetap di status terakhirnya.
            Inventory::whereKey($validated['inventory_id'])->update(['status' => 'menunggu_perbaikan']);

            return $penanganan;
        });

        // notif ke admin tiap ada laporan kerusakan masuk. SEMUA admin (termasuk pelapor sendiri kalau dia admin) tetap
        // dapet baris di daftar notif (channel 'database'), tapi pelapor gak dapet alert real-time (broadcast/web push)
        // buat laporannya sendiri -- lihat AsetKerusakanDilaporkan::via().
        // try-catch: laporan yang SUDAH tersimpan di atas jangan ikut gagal kalau notif error.
        try {
            Notification::send(
                User::whereHas('roleRef', fn ($q) => $q->where('nama', 'admin'))
                    ->get(),
                new AsetKerusakanDilaporkan($penanganan->load(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name']), $user->name)
            );
        } catch (\\Throwable $e) {
            Log::error('Gagal mengirim notifikasi laporan kerusakan inventory', [
                'inventory_penanganan_id' => $penanganan->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $penanganan->load(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name']);
    }

    // ------------------------------------------------------------------ terima

    /** Admin: terima & mulai tangani laporan -> item jadi "diperbaiki" (sedang diperbaiki). */
    public function terima(InventoryPenanganan $inventoryPenanganan): InventoryPenanganan
    {
        if ($inventoryPenanganan->tanggal_diterima) {
            throw ValidationException::withMessages(['terima' => ['Laporan ini sudah diterima sebelumnya.']]);
        }

        if ($inventoryPenanganan->tanggal_selesai) {
            throw ValidationException::withMessages(['terima' => ['Laporan ini sudah selesai ditangani.']]);
        }

        DB::transaction(function () use ($inventoryPenanganan) {
            $inventoryPenanganan->update(['tanggal_diterima' => now(), 'diterima_at' => now()]);
            Inventory::whereKey($inventoryPenanganan->inventory_id)->update(['status' => 'diperbaiki']);
        });

        return $inventoryPenanganan->fresh()->load(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name']);
    }

    // ------------------------------------------------------------------ tandai selesai

    /** Admin: tandai penanganan selesai + isi hasil/biaya, generate no_struk. */
    public function selesaikan(Request $request, InventoryPenanganan $inventoryPenanganan): InventoryPenanganan
    {
        $validated = $request->validate([
            'tanggal_selesai' => 'nullable|date',
            'harga_jasa' => [
                'nullable', 'numeric', 'min:0',
                Rule::requiredIf(fn () => $request->input('hasil') === 'diperbaiki'),
            ],
            'biaya_komponen' => [
                'nullable', 'numeric', 'min:0',
                Rule::requiredIf(fn () => $request->input('hasil') === 'diperbaiki'),
            ],
            'hasil' => 'nullable|in:diperbaiki,rusak_berat',
            'catatan' => 'nullable|string',
        ], [
            'harga_jasa.required' => 'Biaya jasa wajib diisi kalau hasilnya diperbaiki.',
            'biaya_komponen.required' => 'Biaya komponen wajib diisi kalau hasilnya diperbaiki.',
        ]);

        // rusak berat = gak ada biaya perbaikan (emang gak diperbaiki), jadi paksa null di server juga -- jangan cuma
        // andelin frontend yang disable input-nya.
        if (($validated['hasil'] ?? null) === 'rusak_berat') {
            $validated['harga_jasa'] = null;
            $validated['biaya_komponen'] = null;
        }

        // kalau tanggal_selesai gak dikirim eksplisit, anggap "tandai selesai sekarang"
        if (!$request->has('tanggal_selesai')) {
            $validated['tanggal_selesai'] = now();
        }

        // simpan status sebelumnya, biar kita tau ini transisi PERTAMA kali ke "selesai" (bukan admin cuma edit catatan)
        $sudahSelesaiSebelumnya = (bool) $inventoryPenanganan->tanggal_selesai;

        DB::transaction(function () use ($inventoryPenanganan, $validated) {
            // struk cuma digenerate sekali, pas pertama kali ditandai selesai
            if (!$inventoryPenanganan->no_struk && ($validated['tanggal_selesai'] ?? null)) {
                $validated['no_struk'] = $this->generateNoStrukTahunan('inventory_penanganan', 'no_struk');
            }

            // waktu akurat buat riwayat -- selesai_at dicatat terpisah dari tanggal_selesai (yang cuma tanggal)
            if ($validated['tanggal_selesai'] ?? null) {
                $validated['selesai_at'] = now();
            }

            // jaga-jaga: kalau admin langsung tandai selesai tanpa lewat tombol "Terima" dulu, tetap isi tanggal_diterima
            if (($validated['tanggal_selesai'] ?? null) && !$inventoryPenanganan->tanggal_diterima) {
                $validated['tanggal_diterima'] = now();
                $validated['diterima_at'] = now();
            }

            $inventoryPenanganan->update($validated);

            // begitu ditandai selesai: kalau hasilnya rusak berat, item gak balik "tersedia" (status khusus 'rusak_berat').
            // Selain itu (diperbaiki), balikin status ke normal: kalau masih ada pemakai aktif yang belum ngembaliin ya
            // "dipakai" lagi, kalau enggak ya balik "tersedia". Kelengkapan yang nempel SAMA SEKALI tidak diubah.
            if ($validated['tanggal_selesai'] ?? null) {
                $hasilAkhir = $validated['hasil'] ?? $inventoryPenanganan->hasil;

                if ($hasilAkhir === 'rusak_berat') {
                    // Item yang masih menempel ke induk TIDAK dicopot otomatis walaupun hasilnya rusak_berat --
                    // parent_id cuma boleh diubah lewat aksi manual admin (lepas-dari-induk).
                    Inventory::whereKey($inventoryPenanganan->inventory_id)->update(['status' => 'rusak_berat']);

                    // rusak berat = item gak dipakai siapa-siapa lagi. Tutup paksa record inventory_pemakai yang masih
                    // aktif (belum dikembalikan) biar "Dipakai Oleh" & riwayat peminjaman ikut konsisten.
                    InventoryPemakai::where('inventory_id', $inventoryPenanganan->inventory_id)
                        ->where('status', 'disetujui')
                        ->whereNull('tanggal_pengembalian')
                        ->update([
                            'tanggal_pengembalian' => now(),
                            'dikembalikan_at' => now(),
                            'catatan_pengembalian' => 'Dikembalikan otomatis — barang dinyatakan rusak berat.',
                        ]);
                } else {
                    $masihDipakai = InventoryPemakai::where('inventory_id', $inventoryPenanganan->inventory_id)
                        ->where('status', 'disetujui')
                        ->whereNull('tanggal_pengembalian')
                        ->exists();

                    Inventory::whereKey($inventoryPenanganan->inventory_id)
                        ->update(['status' => $masihDipakai ? 'dipakai' : 'tersedia']);
                }
            }
        });

        $inventoryPenanganan->refresh();

        // notif ke pelapor begitu penanganan pertama kali ditandai selesai (baik diperbaiki maupun rusak_berat)
        if (($validated['tanggal_selesai'] ?? null) && !$sudahSelesaiSebelumnya) {
            try {
                // pelapor asli (dilaporkan_oleh_user_id) adalah sumber kebenaran; fallback ke pemakai->user cuma buat
                // baris lama yang dibuat sebelum kolom ini ada.
                $pelapor = $inventoryPenanganan->dilaporkanOleh ?? $inventoryPenanganan->pemakai?->user;

                if ($pelapor) {
                    $pelapor->notify(new AsetKerusakanSelesai(
                        $inventoryPenanganan->load(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name'])
                    ));
                }
            } catch (\\Throwable $e) {
                Log::error('Gagal mengirim notifikasi penanganan inventory selesai', [
                    'inventory_penanganan_id' => $inventoryPenanganan->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        return $inventoryPenanganan->fresh()->load(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name']);
    }

    // ------------------------------------------------------------------ hapus

    public function hapus(InventoryPenanganan $inventoryPenanganan): void
    {
        $inventoryPenanganan->delete();
    }

    // ------------------------------------------------------------------ import

    /**
     * Bulk import laporan penanganan yang SUDAH SELESAI (tombol Import di tab "Berhasil Diperbaiki" & "Rusak Berat").
     * Semua-atau-tidak-sama-sekali (rollback). Mengembalikan ['sukses' => bool, 'pesan' => string, 'errors' => array]
     * -- API memetakannya ke JSON lama, web ke flash / error bag "file".
     */
    public function import(UploadedFile $file): array
    {
        DB::beginTransaction();
        try {
            $import = new InventoryPenangananImport();
            Excel::import($import, $file);

            if (count($import->getErrors()) > 0) {
                DB::rollBack();

                return [
                    'sukses' => false,
                    'pesan' => (string) ($import->getErrors()[0] ?? 'Gagal import.'),
                    'errors' => $import->getErrors(),
                ];
            }

            if ($import->getRowCount() === 0) {
                DB::rollBack();

                return ['sukses' => false, 'pesan' => 'Tidak ada baris data yang berhasil dibaca dari file.', 'errors' => []];
            }

            DB::commit();

            return [
                'sukses' => true,
                'pesan' => "Berhasil import {$import->getRowCount()} laporan penanganan inventory",
                'errors' => [],
            ];
        } catch (\\Exception $e) {
            DB::rollBack();

            return ['sukses' => false, 'pesan' => 'Gagal import: ' . $e->getMessage(), 'errors' => []];
        }
    }
}`,
  },
  {
    path: "app/Http/Controllers/Transaksi/InventoryPenangananWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\Transaksi;

use App\\Actions\\Transaksi\\InventoryPenangananAction;
use App\\Http\\Controllers\\Controller;
use App\\Models\\Transaksi\\InventoryPenanganan;
use App\\Queries\\InventoryPenangananQuery;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\ValidationException;

// [F6-INERTIA] Versi Inertia dari InventoryPenangananController (API) untuk halaman Penanganan Inventory + aksi dari modal
// di tab Inventory (Master Data). Data baca (daftar / export) dipanggil PenangananInventoryPageController sebagai props;
// mutasi dipanggil lewat routes/web.php (session + CSRF), balasan = redirect back + flash (bukan JSON). Logika & aturan akses
// SAMA dengan versi API karena dipakai bareng lewat InventoryPenangananAction / InventoryPenangananQuery.
class InventoryPenangananWebController extends Controller
{
    private const PER_HALAMAN = 8;

    public function __construct(private InventoryPenangananAction $penanganan)
    {
    }

    // ================================================================== DATA BACA (props halaman)

    // Satu halaman laporan untuk tab aktif + jumlah per tab (kartu KPI). Pagination, pencarian, filter jenis kerusakan, dan
    // tab status dijalankan server; sumber kebenarannya query string (?tab=&search=&jenis=&page=). Scoping role (admin semua /
    // non-admin cuma miliknya) ada di InventoryPenangananQuery::populasi().
    public static function daftar(Request $request): array
    {
        $user = $request->user();
        $f = self::filterEfektif($request);

        $query = self::queryTerfilter($request, $f);

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / self::PER_HALAMAN));
        // halaman di luar jangkauan (mis. habis memproses item terakhir di halaman terakhir) -> geser ke halaman terakhir
        $page = min(max(1, (int) $request->query('page', 1)), $lastPage);

        $rows = InventoryPenangananQuery::muat($query)->forPage($page, self::PER_HALAMAN)->get();

        return [
            'data' => $rows->all(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => self::PER_HALAMAN,
            'counts' => InventoryPenangananQuery::hitungSegmen($user),
            'filters' => [
                'tab' => $f['tab'],
                'search' => $f['search'] ?? '',
                'jenis' => $f['jenis'] ?? 'all',
            ],
        ];
    }

    // SEMUA hasil filter aktif di tab aktif (bukan cuma halaman yang tampil) buat modal Export. Di PageController dikirim
    // sebagai optional prop: baru dihitung saat diminta lewat partial reload.
    public static function untukExport(Request $request): array
    {
        return InventoryPenangananQuery::muat(self::queryTerfilter($request, self::filterEfektif($request)))->get()->all();
    }

    // ================================================================== MUTASI (redirect back + flash)

    // POST /penanganan-inventory  (multipart: foto)  -- semua role yang login (peminjam / admin lapor kerusakan)
    // Gagal -> error bag key lapor / inventory_id / jenis_kerusakan / keluhan / foto.
    public function store(Request $request): RedirectResponse
    {
        $this->penanganan->lapor($request);

        return back()->with('success', 'Laporan kerusakan berhasil dikirim.');
    }

    // POST /penanganan-inventory/{inventoryPenanganan}/terima  -- admin-only. Gagal -> error bag key "terima".
    public function terima(InventoryPenanganan $inventoryPenanganan): RedirectResponse
    {
        $this->penanganan->terima($inventoryPenanganan);

        return back()->with('success', 'Laporan diterima, aset ditandai sedang diperbaiki.');
    }

    // PUT /penanganan-inventory/{inventoryPenanganan}  -- admin-only. Tandai selesai + hasil/biaya. Gagal -> error bag
    // biaya_komponen / harga_jasa / dst.
    public function update(Request $request, InventoryPenanganan $inventoryPenanganan): RedirectResponse
    {
        $this->penanganan->selesaikan($request, $inventoryPenanganan);

        return back()->with('success', 'Perbaikan selesai dicatat.');
    }

    // DELETE /penanganan-inventory/{inventoryPenanganan}  -- admin-only.
    public function destroy(InventoryPenanganan $inventoryPenanganan): RedirectResponse
    {
        $this->penanganan->hapus($inventoryPenanganan);

        return back()->with('success', 'Laporan penanganan berhasil dihapus.');
    }

    // POST /penanganan-inventory/import -- Excel (.xlsx/.xls), semua-atau-tidak-sama-sekali (rollback). Admin-only.
    // Gagal -> error bag key "file" (pesan pertama, sama seperti tampilan lama).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $hasil = $this->penanganan->import($request->file('file'));

        if (!$hasil['sukses']) {
            throw ValidationException::withMessages(['file' => $hasil['pesan']]);
        }

        return back()->with('success', $hasil['pesan']);
    }

    // ================================================================== helper

    // Parameter dari query string yang sudah "efektif": tab valid (default 'menunggu'), pencarian dirapikan, jenis 'all' = tanpa filter.
    private static function filterEfektif(Request $request): array
    {
        $tab = (string) $request->query('tab', '');
        $tab = in_array($tab, InventoryPenangananQuery::STATUS, true) ? $tab : 'menunggu';

        $search = trim((string) $request->query('search', ''));

        $jenis = (string) $request->query('jenis', '');
        $jenis = ($jenis !== '' && $jenis !== 'all') ? $jenis : null;

        return [
            'tab' => $tab,
            'search' => $search !== '' ? $search : null,
            'jenis' => $jenis,
        ];
    }

    // populasi (scoping role) + segmen tab + pencarian + filter jenis. Tanpa eager-load/orderBy (supaya aman dipakai count()).
    private static function queryTerfilter(Request $request, array $f)
    {
        $query = InventoryPenangananQuery::populasi($request->user());

        InventoryPenangananQuery::segmen($query, $f['tab']);

        return InventoryPenangananQuery::filter($query, $f['search'], $f['jenis']);
    }
}`,
  },
  {
    path: "resources/js/types/penanganan.ts",
    content: `import type { InventoryPenanganan } from '../api/transaksi/inventoryPenanganan';

// [F6-INERTIA] Bentuk data halaman Penanganan Inventory dari server (InventoryPenangananWebController, lewat
// PenangananInventoryPageController).

export type PenangananTab = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';

// Props \`penanganan\`: satu halaman laporan untuk tab aktif + jumlah per tab (kartu KPI) + filter aktif
// (query string = sumber kebenaran).
export interface PenangananList {
  data: InventoryPenanganan[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  counts: Record<PenangananTab, number>;
  filters: { tab: PenangananTab; search: string; jenis: string };
}`,
  },
];

const DELETES = [
  "resources/js/pages/transaksi/PenangananInventory/usePenangananData.ts"
];

const EDITS = [
  {
    file: "app/Http/Controllers/Transaksi/InventoryPenangananController.php",
    marker: "[F6-INERTIA]",
    steps: [
      { start: `use App\\Http\\Controllers\\Controller;

use App\\Http\\Controllers\\Concerns\\GeneratesStrukNumber;`, end: `    /**
     * GET /api/inventory-penanganan
`, with: `use App\\Actions\\Transaksi\\InventoryPenangananAction;
use App\\Http\\Controllers\\Controller;
use App\\Models\\Transaksi\\InventoryPenanganan;
use App\\Queries\\InventoryPenangananQuery;
use Illuminate\\Http\\Request;

class InventoryPenangananController extends Controller
{
    // [F6-INERTIA] index / store / terima / update / destroy dipakai bareng dengan InventoryPenangananWebController lewat
    // InventoryPenangananQuery & InventoryPenangananAction.
    public function __construct(private InventoryPenangananAction $penanganan)
    {
    }

` },
      { find: `        $user = $request->user();
        $isAdmin = $user?->role === 'admin';

        $query = InventoryPenanganan::with(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name'])
            ->orderByDesc('tanggal_lapor');

        if (!$isAdmin) {
            $query->whereHas('pemakai', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            });
        }

        return response()->json($query->get());`, with: `        // [F6-INERTIA] scoping (admin semua / non-admin miliknya) ada di InventoryPenangananQuery::populasi().
        return response()->json(
            InventoryPenangananQuery::muat(InventoryPenangananQuery::populasi($request->user()))->get()
        );` },
      { start: `    // peminjam ATAU admin lapor kerusakan barang -- berlaku buat SEMUA item`, with: `    // POST /api/inventory-penanganan
    // [F6-INERTIA] Logika di InventoryPenangananAction::lapor(). Frontend halaman sudah pindah ke POST /penanganan-inventory;
    // endpoint ini dihapus di F10.
    public function store(Request $request)
    {
        return response()->json($this->penanganan->lapor($request), 201);
    }

    // admin: terima & mulai tangani laporan -> item jadi "diperbaiki" (sedang diperbaiki). Logika di Action::terima().
    public function terima(InventoryPenanganan $inventoryPenanganan)
    {
        return response()->json($this->penanganan->terima($inventoryPenanganan));
    }

    // admin: tandai penanganan selesai + isi hasil/biaya, generate no_struk. Logika di Action::selesaikan().
    public function update(Request $request, InventoryPenanganan $inventoryPenanganan)
    {
        return response()->json($this->penanganan->selesaikan($request, $inventoryPenanganan));
    }

    public function destroy(InventoryPenanganan $inventoryPenanganan)
    {
        $this->penanganan->hapus($inventoryPenanganan);

        return response()->json(['message' => 'Laporan penanganan berhasil dihapus.']);
    }
}` },
    ],
  },
  {
    file: "app/Http/Controllers/ImportController.php",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `use App\\Imports\\Transaksi\\InventoryPenangananImport;`, with: `use App\\Actions\\Transaksi\\InventoryPenangananAction;` },
      { start: `    public function importAsetPenanganan(Request $request)
    {`, with: `    public function importAsetPenanganan(Request $request, InventoryPenangananAction $penanganan)
    {
        // [F6-INERTIA] Logika import di InventoryPenangananAction::import() (dipakai bareng versi web).
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $hasil = $penanganan->import($request->file('file'));

        if (!$hasil['sukses']) {
            return response()->json([
                'success' => false,
                ...($hasil['errors'] ? ['errors' => $hasil['errors']] : []),
                'message' => $hasil['pesan'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $hasil['pesan'],
        ]);
    }
}` },
    ],
  },
  {
    file: "app/Http/Controllers/Transaksi/PenangananInventoryPageController.php",
    marker: "[F6-INERTIA]",
    steps: [
      { replaceAll: `<?php

namespace App\\Http\\Controllers\\Transaksi;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Inertia\\Inertia;

class PenangananInventoryPageController extends Controller
{
    // GET /penanganan-inventory?tab=menunggu|diperbaiki|diperbaiki_selesai|rusak_berat&search=&jenis=&page=   (middleware: auth; semua role)
    // [F6-INERTIA] Data baca dikirim sebagai props (tadinya axios + polling): satu halaman laporan + jumlah per tab, dan SEMUA
    // hasil filter buat Export (optional = baru dihitung saat diminta lewat partial reload \`only: ['penangananExport']\`).
    // Scoping non-admin (hanya laporan terkait pemakaiannya) ada di InventoryPenangananQuery::populasi() dan TIDAK diubah.
    public function __invoke(Request $request)
    {
        return Inertia::render('PenangananInventory/Index', [
            'penanganan' => fn () => InventoryPenangananWebController::daftar($request),
            'penangananExport' => Inertia::optional(fn () => InventoryPenangananWebController::untukExport($request)),
        ]);
    }
}
`, sha: "d20fc134f9685fb180f71c513f51e79144af26528fb8c8a366c7ce68738319ed" },
    ],
  },
  {
    file: "routes/web.php",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `use App\\Http\\Controllers\\Transaksi\\InventoryPemakaiWebController;`, with: `use App\\Http\\Controllers\\Transaksi\\InventoryPemakaiWebController;
use App\\Http\\Controllers\\Transaksi\\InventoryPenangananWebController;` },
      { find: `    // Penanganan Inventory (semua role; non-admin hanya lihat laporan miliknya -- scoping di controller API)
    Route::get('/penanganan-inventory', PenangananInventoryPageController::class);
`, with: `    // Penanganan Inventory (semua role; non-admin hanya lihat laporan miliknya -- scoping di InventoryPenangananQuery::populasi())
    Route::get('/penanganan-inventory', PenangananInventoryPageController::class);

    // [F6-INERTIA] Mutasi penanganan (redirect back + flash). LogActivity dipasang manual (audit log cuma nempel di grup 'api'); prefix
    // penanganan-inventory dipetakan ke pola URI API-nya di LogActivity supaya deskripsi audit tetap sama.
    // POST / (lapor kerusakan, multipart foto) = semua role yang login -- dipicu dari modal di tab Inventory (Master Data),
    // sama seperti route API aslinya (cuma auth). Sisanya admin-only. Route statis (/import) HARUS di atas {inventoryPenanganan}.
    Route::middleware(LogActivity::class)->prefix('penanganan-inventory')->group(function () {
        Route::post('/', [InventoryPenangananWebController::class, 'store']);

        Route::middleware('role:admin')->group(function () {
            Route::post('/import', [InventoryPenangananWebController::class, 'import']);
            Route::post('/{inventoryPenanganan}/terima', [InventoryPenangananWebController::class, 'terima'])->whereNumber('inventoryPenanganan');
            Route::put('/{inventoryPenanganan}', [InventoryPenangananWebController::class, 'update'])->whereNumber('inventoryPenanganan');
            Route::delete('/{inventoryPenanganan}', [InventoryPenangananWebController::class, 'destroy'])->whereNumber('inventoryPenanganan');
        });
    });
` },
    ],
  },
  {
    file: "app/Http/Middleware/LogActivity.php",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `        $uri = preg_replace('#^master-data/#', '', $route->uri()); // contoh: "inventory/{inventory}/pemakai"
`, with: `        $uri = preg_replace('#^master-data/#', '', $route->uri()); // contoh: "inventory/{inventory}/pemakai"
        // [F6-INERTIA] Route web penanganan ada di bawah prefix penanganan-inventory/ (mis. "penanganan-inventory/{inventoryPenanganan}/terima");
        // dipetakan ke pola URI API-nya supaya deskripsi audit sama.
        $uri = preg_replace('#^penanganan-inventory(?=/|$)#', 'inventory-penanganan', $uri);
` },
    ],
  },
  {
    file: "resources/js/inertia/pages/PenangananInventory/Index.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `// Tahap P11: SHELL doang. Isi halaman (usePenangananData: axios + polling 10 detik, modal, tabel) TETAP di
// pages/transaksi/PenangananInventory/. Props Inertia sengaja tidak diteruskan (halaman lama punya prop
// \`onCount\` sendiri, tidak ada hubungannya dengan props server).`, with: `// [F6-INERTIA] SHELL: komponen halaman (pages/transaksi/PenangananInventory/) membaca props server sendiri lewat usePage()
// (props.penanganan / props.penangananExport dari PenangananInventoryPageController), jadi tidak ada props yang diteruskan.` },
    ],
  },
  {
    file: "resources/js/pages/transaksi/PenangananInventory/index.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { replaceAll: `import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import Pagination from '../../../components/shared/Pagination';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import type { PenangananList, PenangananTab } from '../../../types/penanganan';
import {
  formatTanggalId,
  formatJenisKerusakan,
  formatDurasi,
} from '../../../utils/inventoryHelpers';
import ScrollableTabBar from '../../../components/shared/ScrollableTabBar';
import { printStruk } from '../../../utils/printStruk';
import InventoryPenangananExportModal from '../../../components/transaksi/InventoryPenangananExportModal';
import { useAuth } from '../../../context/AuthContext';
import { formatRupiah } from './helpers';
import PenangananSkeleton from './PenangananSkeleton';
import PenangananHeader from './PenangananHeader';
import PenangananKpiCards from './PenangananKpiCards';
import PenangananFilterBar from './PenangananFilterBar';
import PenangananCardList from './PenangananCardList';
import PenangananTable from './PenangananTable';
import FormPerbaikanModal from './FormPerbaikanModal';
import DetailPenangananModal from './DetailPenangananModal';
import TerimaLaporanModal from './TerimaLaporanModal';

// [F6-INERTIA] Halaman Penanganan Inventory (tadinya usePenangananData: axios + polling + filter/pagination di klien). Sekarang:
//  - data dari props server (PenangananInventoryPageController -> props.penanganan);
//  - tab status, pencarian, filter jenis kerusakan, dan pagination dijalankan server lewat router.get (query string = sumber kebenaran);
//  - Terima / Selesai / Detail = modal overlay dengan state lokal; mutasi lewat router.* ke /penanganan-inventory*, hasilnya toast dari
//    flash server (FlashToaster);
//  - Export = partial reload props.penangananExport (SEMUA hasil filter tab aktif) tiap tombol Export diklik;
//  - auto-refresh 10 detik = partial reload async (props.penanganan).
interface PageProps {
  penanganan?: PenangananList;
  penangananExport?: InventoryPenanganan[];
}

interface FilterBaru {
  tab?: PenangananTab;
  search?: string;
  jenis?: string;
  page?: number;
}

const TAB_LABEL: Record<PenangananTab, string> = {
  menunggu: 'Menunggu Terima',
  diperbaiki: 'Sedang Diperbaiki',
  diperbaiki_selesai: 'Berhasil Diperbaiki',
  rusak_berat: 'Rusak Berat',
};

const COUNTS_KOSONG: Record<PenangananTab, number> = { menunggu: 0, diperbaiki: 0, diperbaiki_selesai: 0, rusak_berat: 0 };

export default function PenangananInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const pageProps = usePage().props as unknown as PageProps;
  const list = pageProps.penanganan;
  const rows = list?.data ?? [];
  const counts = list?.counts ?? COUNTS_KOSONG;
  const activeTab: PenangananTab = list?.filters.tab ?? 'menunggu';
  const serverSearch = list?.filters.search ?? '';
  const filterKerusakan = list?.filters.jenis ?? 'all';
  const currentPage = list?.current_page ?? 1;
  const lastPage = list?.last_page ?? 1;
  const total = list?.total ?? 0;

  const [searchInput, setSearchInput] = useState<string>(serverSearch);
  const [listLoading, setListLoading] = useState(false);

  // Modals
  const [activePenanganan, setActivePenanganan] = useState<InventoryPenanganan | null>(null);
  const [detailModalTarget, setDetailModalTarget] = useState<InventoryPenanganan | null>(null);
  const [terimaTarget, setTerimaTarget] = useState<InventoryPenanganan | null>(null);
  const [terimaLoadingId, setTerimaLoadingId] = useState<number | null>(null);

  // Export & Import
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canImportExport = isAdmin && (activeTab === 'diperbaiki_selesai' || activeTab === 'rusak_berat');

  // ------------------------------------------------------------------ request ke server

  // Query string dari filter. Nilai default (tab menunggu, search kosong, jenis semua, halaman 1) tidak ikut di URL.
  function bangunData(f: Required<FilterBaru>): Record<string, string | number> {
    const data: Record<string, string | number> = {};
    if (f.tab !== 'menunggu') data.tab = f.tab;
    if (f.search) data.search = f.search;
    if (f.jenis && f.jenis !== 'all') data.jenis = f.jenis;
    if (f.page > 1) data.page = f.page;
    return data;
  }

  // Pindah tab / halaman / ganti filter = visit ringan ke /penanganan-inventory (partial reload cuma props.penanganan), URL ikut berubah.
  function visitList(next: FilterBaru) {
    const f: Required<FilterBaru> = {
      tab: next.tab ?? activeTab,
      search: (next.search ?? searchInput).trim(),
      jenis: next.jenis ?? filterKerusakan,
      page: next.page ?? 1,
    };

    setListLoading(true);
    router.get('/penanganan-inventory', bangunData(f), {
      only: ['penanganan'],
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onFinish: () => setListLoading(false),
    });
  }

  // Auto-refresh 10 detik (async, tanpa progress bar). Memuat ulang URL yang sedang aktif, jadi filter tetap terjaga.
  // Dilewati kalau tab browser lagi disembunyikan.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      router.reload({ only: ['penanganan'], async: true, showProgress: false });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Pencarian: tunggu user berhenti mengetik sebentar sebelum minta data ke server.
  useEffect(() => {
    if (searchInput.trim() === serverSearch) return;
    const timer = setTimeout(() => visitList({ search: searchInput, page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Adapter ke komponen filter: pencarian = state lokal (debounce di atas), jenis & reset = visit ke server.
  const handleJenisChange = (v: string) => visitList({ jenis: v, page: 1 });
  const handleResetFilter = () => {
    setSearchInput('');
    visitList({ search: '', jenis: 'all', page: 1 });
  };

  const handleTabChange = (tab: PenangananTab) => {
    setImportError('');
    visitList({ tab, page: 1 });
  };

  // ------------------------------------------------------------------ export / import

  // Tombol Export: ambil dulu datanya dari server (SEMUA hasil filter tab aktif), baru buka modal.
  const bukaExport = (open: boolean) => {
    if (!open) {
      setExportModalOpen(false);
      return;
    }
    router.reload({
      only: ['penangananExport'],
      onSuccess: () => setExportModalOpen(true),
      onError: () => toast.error('Gagal menyiapkan data export. Coba lagi.'),
    });
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    // Sukses -> toast dari flash server. Gagal -> pesan error inline (key "file").
    router.post('/penanganan-inventory/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => setImportError(String(errors.file || 'Gagal mengimport file')),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  // ------------------------------------------------------------------ mutasi (Inertia)

  const handleTerima = (p: InventoryPenanganan) => {
    setTerimaLoadingId(p.id);
    router.post(\`/penanganan-inventory/\${p.id}/terima\`, {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setTerimaTarget(null),
      onError: (errors) => toast.error(errors.terima || String(Object.values(errors)[0] || 'Gagal menerima laporan.')),
      onFinish: () => setTerimaLoadingId(null),
    });
  };

  const handlePrintStruk = (p: InventoryPenanganan) => {
    if (!p.no_struk) return;
    const rusakBerat = p.hasil === 'rusak_berat';

    if (rusakBerat) {
      printStruk({
        judul: 'Bukti Penanganan Inventory',
        noStruk: p.no_struk,
        tanggal: formatTanggalId(p.tanggal_selesai),
        rows: [
          { label: 'Hasil', value: 'Rusak Berat (tidak bisa diperbaiki)' },
          { label: 'Durasi', value: formatDurasi(p.durasi_detik) },
        ],
        catatan: p.catatan,
      });
      return;
    }

    const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
    printStruk({
      judul: 'Bukti Penanganan Inventory',
      noStruk: p.no_struk,
      tanggal: formatTanggalId(p.tanggal_selesai),
      rows: [
        { label: 'Inventory', value: p.inventory?.kode_inventory || '-' },
        { label: 'Jenis Kerusakan', value: formatJenisKerusakan(p.jenis_kerusakan) },
        { label: 'Keluhan', value: p.keluhan },
        { label: 'Hasil', value: p.hasil || '-' },
        { label: 'Tanggal Lapor', value: formatTanggalId(p.tanggal_lapor) },
        { label: 'Durasi', value: formatDurasi(p.durasi_detik) },
        { label: 'Biaya Komponen', value: formatRupiah(p.biaya_komponen) },
        { label: 'Biaya Jasa', value: formatRupiah(p.harga_jasa) },
      ],
      totalLabel: 'Total Biaya',
      totalValue: formatRupiah(totalBiaya),
      catatan: p.catatan,
    });
  };

  const tabs: { key: PenangananTab; label: string }[] = (Object.keys(TAB_LABEL) as PenangananTab[]).map((key) => ({
    key,
    label: TAB_LABEL[key],
  }));

  if (!list) return <PenangananSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PenangananHeader
        isAdmin={isAdmin}
        canImportExport={canImportExport}
        setExportModalOpen={bukaExport}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        importLoading={importLoading}
      />

      {/* KPI Overview Cards */}
      <PenangananKpiCards handleTabChange={handleTabChange} activeTab={activeTab} counts={counts} />

      {importError && <p className="text-sm text-red-600">{importError}</p>}

      {/* Main Content Box */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        {/* Navigation Tabs */}
        <ScrollableTabBar className="mb-5" activeTab={activeTab} onChange={handleTabChange} tabs={tabs} />

        {/* Filter & Search Bar */}
        <PenangananFilterBar
          search={searchInput}
          setSearch={setSearchInput}
          filterKerusakan={filterKerusakan}
          setFilterKerusakan={handleJenisChange}
          onReset={handleResetFilter}
        />

        <p className="text-xs text-slate-500 mb-4">
          Total {TAB_LABEL[activeTab]}: <span className="font-semibold text-slate-900">{total}</span> laporan
        </p>

        <div className={\`transition-opacity \${listLoading ? 'opacity-60' : ''}\`}>
          {/* Tab 1 & Tab 2: Work Order Cards */}
          {activeTab === 'menunggu' || activeTab === 'diperbaiki' ? (
            <PenangananCardList
              displayedList={rows}
              activeTab={activeTab}
              search={serverSearch}
              filterKerusakan={filterKerusakan}
              paginatedList={rows}
              setDetailModalTarget={setDetailModalTarget}
              isAdmin={isAdmin}
              setTerimaTarget={setTerimaTarget}
              setActivePenanganan={setActivePenanganan}
            />
          ) : (
            /* Tab 3 & Tab 4: Clean Data Table */
            <PenangananTable
              paginatedList={rows}
              handlePrintStruk={handlePrintStruk}
              setDetailModalTarget={setDetailModalTarget}
              displayedList={rows}
              search={serverSearch}
              filterKerusakan={filterKerusakan}
              activeTab={activeTab}
            />
          )}
        </div>

        {/* Pagination (server) */}
        {total > list.per_page && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Pagination
              currentPage={currentPage}
              totalPages={lastPage}
              onPageChange={(p) => visitList({ page: p })}
              totalItems={total}
              itemLabel="laporan"
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {activePenanganan && (
        <FormPerbaikanModal
          penanganan={activePenanganan}
          onClose={() => setActivePenanganan(null)}
          onSuccess={() => setActivePenanganan(null)}
        />
      )}

      {detailModalTarget && (
        <DetailPenangananModal
          penanganan={detailModalTarget}
          onClose={() => setDetailModalTarget(null)}
          onPrint={handlePrintStruk}
        />
      )}

      {terimaTarget && (
        <TerimaLaporanModal
          penanganan={terimaTarget}
          loading={terimaLoadingId === terimaTarget.id}
          onClose={() => setTerimaTarget(null)}
          onConfirm={() => handleTerima(terimaTarget)}
        />
      )}

      {canImportExport && (
        <InventoryPenangananExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          data={pageProps.penangananExport ?? []}
          tabLabel={TAB_LABEL[activeTab]}
        />
      )}
    </div>
  );
}
`, sha: "0a78154e9194e0e6313923f5934d8b35a32891d37476782da006ff173ebc04b8" },
    ],
  },
  {
    file: "resources/js/pages/transaksi/PenangananInventory/PenangananFilterBar.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { replaceAll: `import { RotateCcw } from 'lucide-react';
import Select from '../../../components/shared/Select';
import { JENIS_KERUSAKAN_OPTIONS } from '../../../utils/inventoryHelpers';
import SearchInput from '../../../components/shared/SearchInput';

// [F6-INERTIA] Filter dijalankan server: \`search\` = input lokal (debounce -> visit di halaman), \`setFilterKerusakan\` & \`onReset\`
// = visit ke /penanganan-inventory. Pindah ke halaman 1 diurus halaman (visitList), jadi tidak ada setPage di sini lagi.
interface PenangananFilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  filterKerusakan: string;
  setFilterKerusakan: (value: string) => void;
  onReset: () => void;
}

export default function PenangananFilterBar({ search, setSearch, filterKerusakan, setFilterKerusakan, onReset }: PenangananFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Cari kode inventory, nama barang, keluhan, pelapor..."
        className="flex-1"
      />

      <div className="w-full sm:w-56 shrink-0">
        <Select
          value={filterKerusakan}
          onChange={setFilterKerusakan}
          options={[
            { value: 'all', label: 'Semua Jenis Kerusakan' },
            ...JENIS_KERUSAKAN_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />
      </div>

      {(search || filterKerusakan !== 'all') && (
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1.5 shrink-0 self-center"
        >
          <RotateCcw size={13} />
          Reset Filter
        </button>
      )}
    </div>
  );
}
`, sha: "7fdeaa3524656d8c8f35d788c33e2c9067c50b962eae1c390b1ea3611bf5cf19" },
    ],
  },
  {
    file: "resources/js/pages/transaksi/PenangananInventory/PenangananKpiCards.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
`, with: `` },
      { find: `  menungguList: InventoryPenanganan[];
  diperbaikiList: InventoryPenanganan[];
  diperbaikiSelesaiList: InventoryPenanganan[];
  rusakBeratList: InventoryPenanganan[];
}`, with: `  // [F6-INERTIA] jumlah per tab dari server (props.penanganan.counts), bukan panjang list di klien.
  counts: Record<TabStatus, number>;
}` },
      { find: `export default function PenangananKpiCards({ handleTabChange, activeTab, menungguList, diperbaikiList, diperbaikiSelesaiList, rusakBeratList }: PenangananKpiCardsProps) {`, with: `export default function PenangananKpiCards({ handleTabChange, activeTab, counts }: PenangananKpiCardsProps) {` },
      { find: `{menungguList.length}`, with: `{counts.menunggu}` },
      { find: `{diperbaikiList.length}`, with: `{counts.diperbaiki}` },
      { find: `{diperbaikiSelesaiList.length}`, with: `{counts.diperbaiki_selesai}` },
      { find: `{rusakBeratList.length}`, with: `{counts.rusak_berat}` },
    ],
  },
  {
    file: "resources/js/pages/transaksi/PenangananInventory/FormPerbaikanModal.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `import { selesaikanPenangananInventory, type InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';`, with: `import { router } from '@inertiajs/react';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';` },
      { find: `  onSuccess: (updated: InventoryPenanganan) => void;`, with: `  onSuccess: () => void;` },
      { find: `  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');`, with: `  const handleSubmit = () => {
    setSubmitting(true);
    setError('');` },
      { start: `    try {
      const updated = await selesaikanPenangananInventory(penanganan.id, {`, end: `  return (
    <div
      className="fixed inset-0`, with: `    // [F6-INERTIA] router.put ke /penanganan-inventory/{id}. Sukses -> toast dari flash server (FlashToaster) + modal ditutup parent;
    // gagal validasi -> pesan tampil di dalam modal ini.
    router.put(\`/penanganan-inventory/\${penanganan.id}\`, {
      tanggal_selesai: tanggalSelesai,
      biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
      harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
      hasil,
      catatan: catatan.trim() || null,
    }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) =>
        setError(errors.biaya_komponen || errors.harga_jasa || String(Object.values(errors)[0] || 'Gagal menyimpan perbaikan.')),
      onFinish: () => setSubmitting(false),
    });
  };

` },
    ],
  },
  {
    file: "resources/js/components/transaksi/InventoryPenangananSelesaiModal.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `import { selesaikanPenangananInventory } from '../../api/transaksi/inventoryPenanganan';`, with: `import { router } from '@inertiajs/react';` },
      { find: `  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');`, with: `  const handleSubmit = () => {
    setSubmitting(true);
    setError('');` },
      { start: `    try {
      await selesaikanPenangananInventory(penanganan.id, {`, end: `  return (
    <div
      className="fixed inset-0`, with: `    // [F6-INERTIA] router.put ke /penanganan-inventory/{id}. Sukses -> toast dari flash server (FlashToaster); gagal -> pesan di modal.
    router.put(\`/penanganan-inventory/\${penanganan.id}\`, {
      tanggal_selesai: tanggalSelesai,
      harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
      biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
      hasil,
      catatan: catatan.trim() || null,
    }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) =>
        setError(errors.biaya_komponen || errors.harga_jasa || String(Object.values(errors)[0] || 'Gagal menandai penanganan selesai.')),
      onFinish: () => setSubmitting(false),
    });
  };

` },
    ],
  },
  {
    file: "resources/js/components/masterData/inventory/InventoryLaporKerusakanModal.tsx",
    marker: "[F6-INERTIA]",
    steps: [
      { find: `import { laporKerusakanInventory } from '../../../api/transaksi/inventoryPenanganan';`, with: `import { router } from '@inertiajs/react';` },
      { find: `  const handleSubmit = async () => {
    const newErrors: { jenis_kerusakan?: string; keluhan?: string; foto?: string } = {};`, with: `  const handleSubmit = () => {
    const newErrors: { jenis_kerusakan?: string; keluhan?: string; foto?: string } = {};` },
      { start: `    try {
      await laporKerusakanInventory({`, end: `  return (
    <div
      className="fixed inset-0`, with: `    // [F6-INERTIA] router.post + forceFormData (1 file foto) ke /penanganan-inventory. Sukses -> toast dari flash server (FlashToaster);
    // gagal validasi -> pesan tampil di dalam modal ini.
    router.post('/penanganan-inventory', {
      inventory_id: inventory.id,
      jenis_kerusakan: jenisKerusakan,
      keluhan: keluhan.trim(),
      foto: fotoKerusakan[0], // ambil 1 file pertama, sesuai kolom foto di backend
    }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) => {
        const msg =
          errors.jenis_kerusakan ||
          errors.foto ||
          errors.lapor ||
          errors.inventory_id ||
          Object.values(errors)[0] ||
          'Gagal mengirim laporan. Coba lagi.';
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
    marker: "[F6-INERTIA]",
    steps: [
      { find: `import {
  deletePenangananInventory,
  terimaPenangananInventory,
  type InventoryPenanganan,
} from '../../../../api/transaksi/inventoryPenanganan';`, with: `import type { InventoryPenanganan } from '../../../../api/transaksi/inventoryPenanganan';` },
      { find: `// flash server, struk dicetak dari flash.struk). Lapor kerusakan / penanganan masih lewat axios (dipindah di F6); setelah`, with: `// flash server, struk dicetak dari flash.struk). [F6-INERTIA] Lapor kerusakan / terima / selesai / hapus penanganan = Inertia juga
// (router.* ke /penanganan-inventory*, toast dari flash server) -- tidak ada axios lagi di tab ini; setelah` },
      { find: `  // Lapor kerusakan & penanganan selesai: masih axios (F6).`, with: `  // Lapor kerusakan & penanganan selesai: modal -> router.post|put ke /penanganan-inventory* (F6).` },
      { find: `  // (hapus riwayat pemakaian = Inertia [F5-INERTIA]; terima/hapus penanganan = axios sampai F6)`, with: `  // (hapus riwayat pemakaian [F5-INERTIA], terima/hapus penanganan [F6-INERTIA] = router.* ke route web, toast dari flash server)` },
      { start: `  async function handleTerimaPenanganan(id: number) {`, end: `  function handleDeletePemakai(id: number) {`, with: `  function handleTerimaPenanganan(id: number) {
    setHistoryActionError('');
    setTerimaLoadingId(id);
    // Sukses -> toast dari flash server; gagal -> error bag "terima" tampil di modal detail.
    router.post(\`/penanganan-inventory/\${id}/terima\`, {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => segarkan(),
      onError: (errors) => setHistoryActionError(errors.terima || 'Gagal menerima laporan penanganan.'),
      onFinish: () => setTerimaLoadingId(null),
    });
  }

  function handleDeletePenanganan(id: number) {
    if (!confirm('Hapus riwayat penanganan ini?')) return;
    setHistoryActionError('');
    router.delete(\`/penanganan-inventory/\${id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => segarkan(),
      onError: (errors) => setHistoryActionError(String(Object.values(errors)[0] || 'Gagal menghapus riwayat penanganan.')),
    });
  }

` },
      { find: `            setPerbaikanInventoryTarget(null);
            toast.success('Laporan kerusakan berhasil dikirim.');
            segarkan();`, with: `            setPerbaikanInventoryTarget(null); // toast sukses dari flash server (FlashToaster)
            segarkan();` },
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
        // rapikan folder kosong yang tadinya dibuat F6 (berhenti di folder pertama yang masih berisi)
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

// ------------------------------------------------------------ SYARAT: F1-F5 SUDAH TERPASANG
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/InventoryWebController.php')) ||
    !fs.existsSync(abs('resources/js/components/layout/FlashToaster.tsx'))) {
  fail('F6 butuh F1-F4 yang sudah terpasang (InventoryWebController.php / FlashToaster.tsx tidak ditemukan).');
}
if (!fs.existsSync(abs('app/Http/Controllers/Transaksi/InventoryPemakaiWebController.php')) ||
    !fs.existsSync(abs('app/Actions/Transaksi/InventoryPemakaiAction.php'))) {
  fail('F6 butuh F5 yang sudah terpasang (InventoryPemakaiWebController.php / InventoryPemakaiAction.php tidak ditemukan). Jalankan `node f5.mjs` dulu.');
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
    if (cur.includes('[F6-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F6, tidak ditimpa: ' + nf.path);
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
log((DRY ? '[DRY RUN] ' : '') + 'F6 - Penanganan Inventory -> Inertia (props + modal)');
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
  log('\nBackup asli: .migrasi-backup/f6/   (kembalikan: node f6.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=penanganan-inventory');
log('  npx tsc --noEmit');
log('  npm run build');
