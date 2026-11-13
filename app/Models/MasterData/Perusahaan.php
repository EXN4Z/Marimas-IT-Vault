<?php

namespace App\Models\MasterData;

use App\Support\Concerns\DapatDipulihkan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;

// Menu "Perusahaan" di Master Data -- struktur field sama persis kaya
// Cabang (menu "Cabang"), tapi sengaja belum dikasih relasi ke
// tabel lain (beda dari Cabang::karyawan()/users()).
class Perusahaan extends Model
{
    use DapatDipulihkan;

    protected $table = 'perusahaan';

    protected $fillable = [
        'nama',
        'alamat',
        'telepon',
        'link',
    ];

    public function inventory()
    {
        return $this->hasMany(Inventory::class, 'perusahaan_id');
    }
        public function users(): HasMany
    {
        return $this->hasMany(User::class, 'cabang_id');
    }
}