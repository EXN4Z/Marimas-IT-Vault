<?php

namespace App\Models\MasterData;

use App\Support\Concerns\DapatDipulihkan;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\Transaksi\InventoryWriteoff;
use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    use DapatDipulihkan;

    protected $table = 'inventory';

    protected $fillable = [
        'kode_inventory',
        'parent_id',
        'kategori_id',
        'nama',
        'warna',
        'serial_number',
        'jumlah',
        'tanggal',
        'nik',
        'penerima',
        'tanggal_garansi',
        'tanggal_input',
        'tanggal_invoice',
        'merk',
        'type',
        'perusahaan_id',
        'keterangan',
        'diterima_oleh',
        'diketahui',
        'dibuat_oleh',
        'diketahui_hrd',
        'foto',
        'supplier_id',
        'no_surat_jalan',
        'no_good_receive',
        'status',
        'tanggal_rusak',
        
    ];

    protected $casts = [
        'tanggal' => 'date',
        'tanggal_garansi' => 'date',
        'tanggal_rusak' => 'datetime',
    ];

    /**
     * tanggal_input yang kosong otomatis diisi tanggal data ini dibuat:
     * saat create = hari ini, saat edit (dikosongkan) = tanggal created_at record.
     * tanggal_invoice (tanggal pembelian) SENGAJA tidak ikut diisi otomatis: kalau kosong tetap null,
     * dan dashboard tidak menghitungnya di grafik tren pembelian.
     */
    protected static function booted(): void
    {
        static::saving(function (self $inventory) {
            $fallback = ($inventory->created_at ?? now())->toDateString();

            if (empty($inventory->tanggal_input)) {
                $inventory->tanggal_input = $fallback;
            }
        });
    }

    // ================= Relasi kategori =================

    public function kategori()
    {
        return $this->belongsTo(Kategori::class, 'kategori_id');
    }

    public function perusahaan()
    {
        return $this->belongsTo(Perusahaan::class, 'perusahaan_id');
    }

    // ================= Self-relation (parent/anak) =================
    //
    // Status "induk" vs "nempel ke item lain" sekarang murni dari
    // parent_id, TIDAK lagi dari kategori (kategori cuma label jenis
    // barang, lihat Kategori.php). isInduk()/isChild() & scope di bawah
    // gantiin isBarangUtama()/isKelengkapan()/scopeBarangUtama()/
    // scopeKelengkapan() versi lama yang cek kategori->nama.

    // true kalau item ini berdiri sendiri / jadi induk (parent_id kosong)
    public function isInduk(): bool
    {
        return $this->parent_id === null;
    }

    // true kalau item ini nempel ke item lain (parent_id terisi)
    public function isChild(): bool
    {
        return $this->parent_id !== null;
    }

    public function scopeIndukSendiri($query)
    {
        return $query->whereNull('parent_id');
    }

    // item induk tempat baris ini menempel (null = berdiri sendiri ATAU
    // baris ini sendiri adalah induk)
    public function parent()
    {
        return $this->belongsTo(Inventory::class, 'parent_id');
    }

    // item yang menempel ke baris ini (cuma relevan kalau baris ini
    // berstatus induk -- item yang sudah punya child gak boleh punya
    // parent_id sendiri, ditegakkan di controller lewat validasiParent())
    public function children()
    {
        return $this->hasMany(Inventory::class, 'parent_id');
    }

    // ================= Relasi lain =================

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function pemakai()
    {
        return $this->hasMany(InventoryPemakai::class, 'inventory_id')->latest('diterima_at');
    }

    public function pemakaiSaatIni()
    {
        return $this->hasOne(InventoryPemakai::class, 'inventory_id')
            ->whereNull('dikembalikan_at')
            ->latest('diterima_at');
    }
    // riwayat lengkap perbaikan/penanganan kerusakan (semua status, terbaru
    // dulu). REVISI Fase 2: dulu cuma dipakai buat item induk (barang
    // utama) lewat sini, item yang nempel ke induk (eks-kelengkapan) lewat
    // alur laporRusakKelengkapan() terpisah yang langsung final -- endpoint
    // itu sudah dihapus total, sekarang SEMUA item (apapun posisinya) lapor
    // kerusakan lewat sini (InventoryPenanganan), satu alur seragam.
    public function penanganan()
    {
        return $this->hasMany(InventoryPenanganan::class, 'inventory_id')->latest('tanggal_lapor');
    }

    // laporan kerusakan yang belum ditangani (tanggal_selesai masih null)
    public function penangananAktif()
    {
        return $this->hasOne(InventoryPenanganan::class, 'inventory_id')
            ->whereNull('tanggal_selesai')
            ->latest('tanggal_lapor');
    }

    // catatan penjualan/writeoff (kalau statusnya udah 'dijual')
    public function writeoff()
    {
        return $this->hasOne(InventoryWriteoff::class, 'inventory_id');
    }
}