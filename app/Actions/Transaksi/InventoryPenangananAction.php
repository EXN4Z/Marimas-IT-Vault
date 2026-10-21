<?php

namespace App\Actions\Transaksi;

use App\Support\Concerns\GeneratesStrukNumber;
use App\Imports\Transaksi\InventoryPenangananImport;
use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\User;
use App\Notifications\AsetKerusakanDilaporkan;
use App\Notifications\AsetKerusakanSelesai;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * [F6-INERTIA] Logika penanganan inventory (lapor kerusakan / terima / tandai selesai / hapus / import), dipakai bareng oleh:
 *  - Web : App\Http\Controllers\Transaksi\InventoryPenangananController (redirect back + flash)
 *
 * Aturan validasi & aturan bisnis dipindah APA ADANYA. Dulu pelanggaran non-field dibalas
 * response()->json(['message' => ...], 422); sekarang ValidationException supaya halaman web bisa menampilkannya di dalam
 * modal lewat error bag (API tetap membalas 422 dengan `message` yang sama).
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
        } catch (\Throwable $e) {
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
            } catch (\Throwable $e) {
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
        } catch (\Exception $e) {
            DB::rollBack();

            return ['sukses' => false, 'pesan' => 'Gagal import: ' . $e->getMessage(), 'errors' => []];
        }
    }
}