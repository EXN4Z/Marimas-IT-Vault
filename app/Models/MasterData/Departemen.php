<?php

namespace App\Models\MasterData;

use App\Support\Concerns\DapatDipulihkan;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class Departemen extends Model
{
    use DapatDipulihkan;

    protected $table = 'departemen';
    protected $fillable = ['nama'];

    // BARU (eks-pekerja): karyawan sekarang langsung di tabel users.
    public function karyawan()
    {
        return $this->hasMany(User::class, 'departemen_id');
    }
}