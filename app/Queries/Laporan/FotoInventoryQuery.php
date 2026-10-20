<?php

namespace App\Queries\Laporan;

use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * [F7-INERTIA] Query galeri Foto Inventory (4 sub-tab), dipakai bareng oleh:
 *  - API : InventoryController::foto, InventoryPemakaiController::foto, InventoryPenangananController::foto (JSON, dihapus di F10)
 *  - Web : App\Http\Controllers\Laporan\LaporanPageController (props tab Foto Inventory)
 *
 * Isi dipindah APA ADANYA dari ketiga method foto() tsb (urutan, filter foto, pencarian kode/nama, scoping role).
 */
class FotoInventoryQuery
{
    public const SUB_TAB = ['inventory', 'peminjaman', 'pengembalian', 'rusak'];

    /** Foto dasar barang (kolom inventory.foto). */
    public static function inventory(?string $search): Builder
    {
        $query = Inventory::with('kategori')
            ->whereNotNull('foto')
            ->orderByDesc('created_at');

        if ($search) {
            $query->where(function ($qq) use ($search) {
                $qq->where('kode_inventory', 'like', "%{$search}%")
                    ->orWhere('nama', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    /** Foto serah-terima ($type 'peminjaman') / pengembalian ($type 'pengembalian'); admin lihat semua, role lain cuma miliknya. */
    public static function pemakai(User $user, ?string $type, ?string $search): Builder
    {
        $isAdmin = $user->role === 'admin';

        $query = InventoryPemakai::with(['inventory', 'user'])
            ->when(
                $type === 'peminjaman',
                fn ($q) => $q->whereNotNull('foto_penerimaan'),
                fn ($q) => $q->when(
                    $type === 'pengembalian',
                    fn ($q2) => $q2->whereNotNull('foto_pengembalian'),
                    fn ($q2) => $q2->where(function ($qq) {
                        $qq->whereNotNull('foto_penerimaan')
                            ->orWhereNotNull('foto_pengembalian');
                    })
                )
            )
            ->orderByDesc('created_at');

        if (!$isAdmin) {
            $query->where('user_id', $user->id);
        }

        if ($search) {
            $query->whereHas('inventory', function ($qq) use ($search) {
                $qq->where('kode_inventory', 'like', "%{$search}%")
                    ->orWhere('nama', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    /** Foto laporan kerusakan (inventory_penanganan.foto). */
    public static function kerusakan(?string $search): Builder
    {
        $query = InventoryPenanganan::with(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name'])
            ->whereNotNull('foto')
            ->orderByDesc('tanggal_lapor');

        if ($search) {
            $query->whereHas('inventory', function ($q) use ($search) {
                $q->where('kode_inventory', 'like', "%{$search}%")
                    ->orWhere('nama', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    /** Query satu sub-tab galeri (`inventory`, `peminjaman`, `pengembalian`, `rusak`). */
    public static function untukTab(string $tab, User $user, ?string $search): Builder
    {
        return match ($tab) {
            'peminjaman', 'pengembalian' => self::pemakai($user, $tab, $search),
            'rusak' => self::kerusakan($search),
            default => self::inventory($search),
        };
    }
}
