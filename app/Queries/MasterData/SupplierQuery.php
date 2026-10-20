<?php

namespace App\Queries\MasterData;

use App\Models\MasterData\Supplier;

// Dipindah dari SupplierController::daftar() -- isi query identik.
// Data tab Supplier untuk props halaman Master Data (juga dipakai dropdown di Inventory, Karyawan, Laporan).
class SupplierQuery
{
    public static function daftar(): array
    {
        return Supplier::orderBy('nama')->get()->all();
    }
}
