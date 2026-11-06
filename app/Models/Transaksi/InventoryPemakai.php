<?php

namespace App\Models\Transaksi;

use App\Models\MasterData\Inventory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class InventoryPemakai extends Model
{
    protected $table = 'inventory_pemakai';

    protected $fillable = [
        'inventory_id',
        'user_id',
        'status',
        'diserahkan_oleh',
        'nomor_penerimaan',
        'nomor_penerimaan',
        'diterima_at',
        'foto_penerimaan',
        'catatan_penerimaan',
        'nomor_pengembalian',
        'nomor_pengembalian',
        'foto_pengembalian',
        'dikembalikan_at',
        'catatan_pengembalian',
    ];

    // *_at (datetime lengkap jam-menit-detik) — dipakai buat riwayat
    // aktivitas yang butuh waktu akurat. Beda sama tanggal_* (cuma tanggal).
    protected $casts = [
        'diterima_at' => 'datetime',
        'dikembalikan_at' => 'datetime',
        'foto_penerimaan' => 'array',
        'foto_pengembalian' => 'array',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function penanganan()
    {
        return $this->hasMany(InventoryPenanganan::class, 'inventory_pemakai_id');
    }
}