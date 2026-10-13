<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Imports\MasterData\DepartemenImport;
use App\Models\MasterData\Departemen;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

// [F2-INERTIA] Versi Inertia dari DepartemenController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// DepartemenController (API) sengaja dibiarkan dulu: GET /api/departemen masih dipakai dropdown Karyawan & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class DepartemenWebController extends Controller
{
    // Data tab Departemen buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan DepartemenController::index() (API).
    public static function daftar(): array
    {
        return Departemen::orderBy('nama')->get()->all();
    }

    // POST /master-data/departemen
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|unique:departemen,nama',
        ]);

        Departemen::create($validated);

        return back()->with('success', 'Departemen berhasil ditambahkan.');
    }

    // PUT /master-data/departemen/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $departemen = Departemen::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'required|string|unique:departemen,nama,' . $departemen->id,
        ]);

        $departemen->update($validated);

        return back()->with('success', 'Departemen berhasil diperbarui.');
    }

    // DELETE /master-data/departemen/{id}
    // FK users.departemen_id = nullOnDelete, jadi hapus tidak pernah ditolak relasi (sama seperti versi API).
    public function destroy($id): RedirectResponse
    {
        Departemen::findOrFail($id)->delete();

        return back()->with('success', 'Departemen berhasil dihapus.');
    }

    // POST /master-data/departemen/import -- Excel (.xlsx/.xls). Kolom: Nama. Nama yang sudah ada dilewati.
    // Gagal -> error bag key "file" (pesan pertama), semua-atau-tidak-sama-sekali (rollback).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new DepartemenImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data departemen.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} departemen baru"
                    . ($import->getSkippedCount() > 0 ? ", {$import->getSkippedCount()} dilewati (sudah ada)" : '');
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
