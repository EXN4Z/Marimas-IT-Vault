<?php

namespace App\Models\MasterData;

use App\Support\Concerns\DapatDipulihkan;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use DapatDipulihkan;

    protected $table = 'supplier';

    protected $fillable = ['nama', 'alamat', 'telepon'];

    public function inventory()
    {
        return $this->hasMany(Inventory::class, 'supplier_id');
    }
}