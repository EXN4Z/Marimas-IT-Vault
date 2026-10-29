<?php

namespace App\Queries\MasterData;

use App\Models\MasterData\Departemen;

// Dipindah dari DepartemenController::daftar() -- isi query identik.
// Data tab Departemen untuk props halaman Master Data (juga dipakai dropdown di Inventory, Karyawan, Laporan).
class DepartemenQuery
{
    public static function daftar(): array
    {
        return Departemen::withCount('karyawan')->orderBy('nama')->get()->all();
    }
}
