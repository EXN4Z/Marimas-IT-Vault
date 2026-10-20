<?php

namespace App\Actions\Transaksi;

use App\Support\Concerns\GeneratesStrukNumber;
use App\Support\Concerns\SimpanFotoBukti;
use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * [F5-INERTIA] Logika transaksi pemakai inventory (serah-terima / kembalikan / hapus riwayat), dipakai bareng oleh:
 *  - API : App\Http\Controllers\Legacy\Transaksi\InventoryPemakaiController (JSON, sampai F10)
 *  - Web : App\Http\Controllers\Transaksi\InventoryPemakaiController (redirect back + flash)
 *
 * Aturan validasi & aturan bisnis dipindah APA ADANYA dari InventoryPemakaiController. Dulu pelanggaran aturan
 * non-field dibalas response()->json(['message' => ...], 422); sekarang ValidationException supaya halaman web bisa
 * menampilkannya di dalam modal lewat error bag (API tetap membalas 422 dengan `message` yang sama).
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
}