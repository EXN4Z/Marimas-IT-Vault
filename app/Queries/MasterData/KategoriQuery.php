<?php

namespace App\Queries\MasterData;

use App\Models\MasterData\Kategori;

// Dipindah dari KategoriController::daftar() -- isi query identik.
// Data tab Kategori untuk props halaman Master Data (juga dipakai dropdown di Inventory, Karyawan, Laporan).
class KategoriQuery
{
    public static function daftar(): array
    {
        return Kategori::withCount('inventory')->orderBy('nama')->get()->all();
    }
}
