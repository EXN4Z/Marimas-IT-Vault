<?php

namespace App\Http\Controllers;

use App\Imports\MasterData\InventoryBuktiImport;
use App\Actions\Transaksi\InventoryPenangananAction;
use App\Imports\MasterData\KaryawanImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class ImportController extends Controller
{
    public function importKaryawan(Request $request)
        {
            $request->validate([
                'file' => 'required|file|mimes:xlsx,xls|max:10240',
            ]);

            try {
                $import = new KaryawanImport();
                Excel::import($import, $request->file('file'));

                return response()->json([
                    'success' => count($import->getErrors()) === 0,
                    'message' => "Berhasil import {$import->getRowCount()} baris data",
                    'errors'  => $import->getErrors(), // tetap ditampilkan meski sebagian sukses
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal import: ' . $e->getMessage(),
                ], 422);
            }
        }

    /** POST /api/inventory/import */
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        DB::beginTransaction();
        try {
            $import = new InventoryBuktiImport();
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
                'message' => "Berhasil import {$import->getRowCount()} baris data",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal import: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * POST /api/inventory-penanganan/import
     * Bulk import laporan penanganan yang SUDAH SELESAI — tombol Import
     * di tab "Berhasil Diperbaiki" & "Rusak Berat".
     */
    public function importAsetPenanganan(Request $request, InventoryPenangananAction $penanganan)
    {
        // [F6-INERTIA] Logika import di InventoryPenangananAction::import() (dipakai bareng versi web).
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $hasil = $penanganan->import($request->file('file'));

        if (!$hasil['sukses']) {
            return response()->json([
                'success' => false,
                ...($hasil['errors'] ? ['errors' => $hasil['errors']] : []),
                'message' => $hasil['pesan'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $hasil['pesan'],
        ]);
    }
}