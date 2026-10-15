<?php

namespace App\Queries;

use App\Models\Transaksi\InventoryPenanganan;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * [F6-INERTIA] Query dasar & aturan akses laporan penanganan inventory, dipakai bareng oleh:
 *  - API : App\Http\Controllers\Transaksi\InventoryPenangananController::index (JSON, sampai F10)
 *  - Web : App\Http\Controllers\Transaksi\InventoryPenangananWebController (props halaman Penanganan Inventory)
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
            $kata = '%' . mb_strtolower(str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search)) . '%';

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
}