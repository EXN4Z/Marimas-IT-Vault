<?php

namespace App\Support\Concerns;

use App\Support\AuditSubject;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Soft delete + pencatatan "data apa yang terhapus" supaya bisa dipulihkan dari halaman Audit Log.
 * Dipakai di model yang datanya boleh dihapus lewat aplikasi (lihat AuditSubject::KELAS).
 */
trait DapatDipulihkan
{
    use SoftDeletes;

    public static function bootDapatDipulihkan(): void
    {
        static::deleted(function ($model) {
            // Hapus permanen (forceDelete) memang tidak bisa dipulihkan -> tidak dicatat.
            if ($model->isForceDeleting()) {
                return;
            }

            AuditSubject::catat($model);
        });
    }
}
