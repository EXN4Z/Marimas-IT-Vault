<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\Shared\ImportExcel;
use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\UpdateSupplierRequest;
use App\Imports\MasterData\SupplierImport;
use App\Models\MasterData\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Http\Requests\MasterData\StoreSupplierRequest;
use App\Http\Requests\MasterData\ImportSupplierRequest;

// [F2-INERTIA] Versi Inertia dari SupplierController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// SupplierController (API) sengaja dibiarkan dulu: GET /api/supplier masih dipakai Inventory & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class SupplierController extends Controller
{
    // POST /master-data/supplier
    public function store(StoreSupplierRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Supplier::create($validated);

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    // PUT /master-data/supplier/{id}
    public function update(UpdateSupplierRequest $request, $id): RedirectResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validated();

        $supplier->update($validated);

        return back()->with('success', 'Supplier berhasil diperbarui.');
    }

    // DELETE /master-data/supplier/{id}
    // FK inventory.supplier_id = nullOnDelete, jadi hapus tidak pernah ditolak relasi (sama seperti versi API).
    public function destroy($id): RedirectResponse
    {
        Supplier::findOrFail($id)->delete();

        return back()->with('success', 'Supplier berhasil dihapus.');
    }

    // POST /master-data/supplier/import -- Excel (.xlsx/.xls). Kolom: Nama | Alamat | Telepon.
    // Nama yang sudah ada di-UPDATE (bukan dilewati). Gagal -> error bag key "file" (pesan pertama),
    // semua-atau-tidak-sama-sekali (rollback).
    public function import(ImportSupplierRequest $request): RedirectResponse
    {
        $pesan = ImportExcel::dalamTransaksi(
            SupplierImport::class,
            $request->file('file'),
            'Gagal import data supplier.',
            fn ($import) => "Berhasil import {$import->getCreatedCount()} supplier baru"
            . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '')
        );

        return back()->with('success', $pesan);
    }
}
