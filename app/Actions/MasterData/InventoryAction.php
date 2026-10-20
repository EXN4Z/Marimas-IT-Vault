<?php

namespace App\Actions\MasterData;

use App\Http\Controllers\Concerns\GeneratesStrukNumber;
use App\Http\Controllers\Concerns\SimpanFotoBukti;
use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryWriteoff;
use App\Models\User;
use App\Notifications\KelengkapanDilepasDariInduk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * [F4-INERTIA] Logika mutasi inventory (simpan / perbarui / hapus / jual / pasang ke induk / lepas dari induk),
 * dipakai bareng oleh:
 *  - API : App\Http\Controllers\Legacy\MasterData\InventoryController (JSON, sampai F10)
 *  - Web : App\Http\Controllers\MasterData\InventoryController (redirect back + flash)
 *
 * Aturan validasi & aturan bisnis dipindah APA ADANYA dari InventoryController. Dulu pelanggaran aturan
 * dilempar lewat abort(422, ...); sekarang ValidationException supaya halaman web bisa menampilkannya
 * di dalam modal lewat error bag (API tetap membalas 422 dengan `message` yang sama).
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
     *    atau punya riwayat peminjaman (error ini membawa key `force_available`).
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
        } catch (\Throwable $e) {
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

    /** Penolakan hapus yang masih bisa dipaksa: `force_available` ikut dikirim supaya modal menawarkan "Hapus Paksa". */
    private function tolakHapusBisaPaksa(string $pesan): never
    {
        throw ValidationException::withMessages(['delete' => $pesan, 'force_available' => '1']);
    }
}
