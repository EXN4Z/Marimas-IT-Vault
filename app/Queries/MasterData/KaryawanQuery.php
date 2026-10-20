<?php

namespace App\Queries\MasterData;

use Illuminate\Database\Eloquent\Builder;

/**
 * [F3-INERTIA] Filter daftar karyawan (role / status / pencarian), dipakai bareng oleh:
 *  - API : App\Http\Controllers\MasterData\UserController::index (GET /api/karyawan, masih dipakai autocomplete)
 *  - Web : App\Http\Controllers\MasterData\KaryawanController (props tab Karyawan di Master Data)
 *
 * $abaikanHuruf = true  -> pencarian tidak peka huruf besar/kecil (perilaku filter client-side lama di TabKaryawan).
 * $abaikanHuruf = false -> LIKE biasa, persis perilaku lama endpoint API.
 */
class KaryawanQuery
{
    public static function filter(
        Builder $query,
        ?string $role = null,
        ?string $status = null,
        ?string $search = null,
        bool $abaikanHuruf = false
    ): Builder {
        if ($role !== null && $role !== '' && $role !== 'all') {
            $query->whereHas('roleRef', fn ($q) => $q->where('nama', $role));
        }

        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($search !== null && $search !== '') {
            $query->where(function ($q) use ($search, $abaikanHuruf) {
                if ($abaikanHuruf) {
                    // escape karakter wildcard LIKE supaya yang diketik dianggap teks biasa
                    $kata = '%' . mb_strtolower(str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search)) . '%';
                    $q->whereRaw('LOWER(users.name) LIKE ?', [$kata])
                        ->orWhereRaw('LOWER(users.email) LIKE ?', [$kata]);
                } else {
                    $q->where('name', 'like', '%' . $search . '%')
                        ->orWhere('email', 'like', '%' . $search . '%');
                }
            });
        }

        return $query;
    }
}
