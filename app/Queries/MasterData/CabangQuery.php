<?php

namespace App\Queries\MasterData;

use App\Models\MasterData\Cabang;

// Dipindah dari CabangController::daftar() -- isi query identik.
// Data tab Cabang untuk props halaman Master Data (juga dipakai dropdown di Inventory, Karyawan, Laporan).
class CabangQuery
{
    public static function daftar(): array
    {
        return Cabang::withCount(['karyawan as pekerja_count'])
            ->with('akunCabang')
            ->orderBY('nama')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'nama' => $item->nama,
                'alamat' => $item->alamat,
                'telepon' => $item->telepon,
                'link' => $item->link,
                'pekerja_count' => $item->pekerja_count,
                'email' => $item->akunCabang?->email,
            ])
            ->all();
    }
}
