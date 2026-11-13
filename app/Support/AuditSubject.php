<?php

namespace App\Support;

use App\Models\MasterData\Cabang;
use App\Models\MasterData\Departemen;
use App\Models\MasterData\Inventory;
use App\Models\MasterData\Kategori;
use App\Models\MasterData\Perusahaan;
use App\Models\MasterData\Supplier;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Penghubung antara model yang di-soft-delete dan Audit Log.
 *
 * Selama satu request, tiap model yang di-soft-delete dicatat di request()->attributes
 * ('audit_terhapus'); LogActivity lalu menulisnya ke audit_logs (subject_type, subject_id, meta).
 * Yang dihapus TERAKHIR dianggap data utama (yang dituju aksi), sisanya masuk meta.ikut_terhapus
 * dan ikut dipulihkan bersama data utama.
 */
class AuditSubject
{
    /** kunci pendek (disimpan di audit_logs.subject_type) => kelas model */
    public const KELAS = [
        'inventory' => Inventory::class,
        'cabang' => Cabang::class,
        'perusahaan' => Perusahaan::class,
        'departemen' => Departemen::class,
        'kategori' => Kategori::class,
        'supplier' => Supplier::class,
        'user' => User::class,
        'inventory_pemakai' => InventoryPemakai::class,
        'inventory_penanganan' => InventoryPenanganan::class,
    ];

    public const LABEL = [
        'inventory' => 'Inventory',
        'cabang' => 'Cabang',
        'perusahaan' => 'Perusahaan',
        'departemen' => 'Departemen',
        'kategori' => 'Kategori',
        'supplier' => 'Supplier',
        'user' => 'User',
        'inventory_pemakai' => 'Riwayat pemakaian',
        'inventory_penanganan' => 'Riwayat penanganan',
    ];

    public static function kunci(Model $model): ?string
    {
        $kunci = array_search($model::class, self::KELAS, true);

        return $kunci === false ? null : $kunci;
    }

    /** Dipanggil dari event 'deleted' trait DapatDipulihkan. */
    public static function catat(Model $model): void
    {
        $kunci = self::kunci($model);
        if ($kunci === null || !app()->bound('request')) {
            return;
        }

        $request = request();
        $daftar = $request->attributes->get('audit_terhapus', []);
        $daftar[] = ['type' => $kunci, 'id' => (int) $model->getKey()];
        $request->attributes->set('audit_terhapus', $daftar);
    }

    /** Info tambahan yang dibutuhkan saat pemulihan (mis. anak-anak inventory pada Hapus Paksa). */
    public static function meta(array $meta): void
    {
        if (!app()->bound('request')) {
            return;
        }

        $request = request();
        $request->attributes->set('audit_meta', array_merge($request->attributes->get('audit_meta', []), $meta));
    }

    /**
     * Dibaca LogActivity setelah aksi selesai.
     *
     * @return array{type: string, id: int, meta: ?array}|null  null kalau request ini tidak menghapus apa-apa
     */
    public static function dariRequest(): ?array
    {
        if (!app()->bound('request')) {
            return null;
        }

        $request = request();
        $daftar = $request->attributes->get('audit_terhapus', []);
        if ($daftar === []) {
            return null;
        }

        $utama = array_pop($daftar);
        $meta = $request->attributes->get('audit_meta', []);
        if ($daftar !== []) {
            $meta['ikut_terhapus'] = array_values($daftar);
        }

        return ['type' => $utama['type'], 'id' => $utama['id'], 'meta' => $meta !== [] ? $meta : null];
    }

    /** Cari data (termasuk yang sudah di-soft-delete). */
    public static function cari(string $kunci, int $id): ?Model
    {
        $kelas = self::KELAS[$kunci] ?? null;

        return $kelas ? $kelas::withTrashed()->find($id) : null;
    }
}
