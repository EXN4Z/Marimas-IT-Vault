<?php

namespace App\Queries\MasterData;

use App\Models\MasterData\Perusahaan;

// Dipindah dari PerusahaanController::daftar() -- isi query identik.
// Data tab Perusahaan untuk props halaman Master Data (juga dipakai dropdown di Inventory, Karyawan, Laporan).
class PerusahaanQuery
{
    public static function daftar(): array
    {
        return Perusahaan::orderBy('nama')->get()->all();
    }
}
