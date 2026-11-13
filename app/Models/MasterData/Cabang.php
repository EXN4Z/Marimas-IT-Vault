<?php

namespace App\Models\MasterData;

use App\Support\Concerns\DapatDipulihkan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\User;

class Cabang extends Model
{
    use DapatDipulihkan;

    protected $table = 'cabang';

    protected $fillable = [
        'nama',
        'alamat',
        'telepon',
        'link',
    ];

    public function karyawan(): HasMany
    {
        return $this->hasMany(User::class, 'cabang_id');
    }

    // Semua akun yang nunjuk ke lokasi ini, termasuk akun cabang sendiri.
    // Superset dari karyawan().
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'cabang_id');
    }
    public function akunCabang(): HasOne
    {
        return $this->hasOne(User::class, 'cabang_id')
            ->whereHas('roleRef', fn ($q) => $q->where('nama', 'cabang'));
    }
}