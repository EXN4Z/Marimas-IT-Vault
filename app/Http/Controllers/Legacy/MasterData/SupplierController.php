<?php

namespace App\Http\Controllers\Legacy\MasterData;

use App\Http\Controllers\Controller;

use App\Imports\MasterData\SupplierImport;
use App\Models\MasterData\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class SupplierController extends Controller
{
    public function index()
    {
        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    /**
     * POST /api/supplier/import -- import massal data Supplier dari file
     * Excel (.xlsx/.xls). Format kolom: Nama | Alamat | Telepon. Baris
     * dengan nama yang sudah ada di-UPDATE (bukan dilewati) -- lihat
     * SupplierImport.
     */
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        DB::beginTransaction();
        try {
            $import = new SupplierImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'errors'  => $import->getErrors(),
                ], 422);
            }

            DB::commit();
            return response()->json([
                'success' => true,
                'message' => "Berhasil import {$import->getCreatedCount()} supplier baru"
                    . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : ''),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal import: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nama' => 'required|string|unique:supplier,nama',
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ]);

        $supplier = Supplier::create($validated);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    public function update(Request $request, Supplier $supplier)
    {
        $validated = $request->validate([
            'nama' => 'required|string|unique:supplier,nama,' . $supplier->id,
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ]);

        $supplier->update($validated);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->delete();

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }
}