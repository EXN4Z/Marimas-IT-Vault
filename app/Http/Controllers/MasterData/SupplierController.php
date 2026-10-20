<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Imports\MasterData\SupplierImport;
use App\Models\MasterData\Supplier;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use App\Http\Requests\MasterData\StoreSupplierRequest;
use App\Http\Requests\MasterData\ImportSupplierRequest;

// [F2-INERTIA] Versi Inertia dari SupplierController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// SupplierController (API) sengaja dibiarkan dulu: GET /api/supplier masih dipakai Inventory & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class SupplierController extends Controller
{
    // Data tab Supplier buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan SupplierController::index() (API).
    public static function daftar(): array
    {
        return Supplier::orderBy('nama')->get()->all();
    }

    // POST /master-data/supplier
    public function store(StoreSupplierRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Supplier::create($validated);

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    // PUT /master-data/supplier/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'required|string|unique:supplier,nama,' . $supplier->id,
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ]);

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
        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new SupplierImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data supplier.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} supplier baru"
                    . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '');
            }
        } catch (Exception $e) {
            DB::rollBack();
            $pesanError = 'Gagal import: ' . $e->getMessage();
        }

        if ($pesanError !== null) {
            throw ValidationException::withMessages(['file' => $pesanError]);
        }

        return back()->with('success', $pesanSukses);
    }
}
