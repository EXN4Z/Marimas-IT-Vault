<?php

namespace App\Queries;

use App\Models\MasterData\Inventory;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * [F4-INERTIA] Query dasar & aturan akses inventory, dipakai bareng oleh:
 *  - API : App\Http\Controllers\MasterData\InventoryController (index, show -- masih dipakai Laporan/Dashboard sampai F7/F8)
 *  - Web : App\Http\Controllers\MasterData\InventoryWebController (props tab Inventory di Master Data)
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
