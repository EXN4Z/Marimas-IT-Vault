<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\Shared\ImportExcel;
use App\Http\Controllers\Controller;
use App\Http\Requests\MasterData\UpdateDepartemenRequest;
use App\Imports\MasterData\DepartemenImport;
use App\Models\MasterData\Departemen;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Http\Requests\MasterData\StoreDepartemenRequest;
use App\Http\Requests\MasterData\ImportDepartemenRequest;

// [F2-INERTIA] Versi Inertia dari DepartemenController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// DepartemenController (API) sengaja dibiarkan dulu: GET /api/departemen masih dipakai dropdown Karyawan & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class DepartemenController extends Controller
{
    // POST /master-data/departemen
    public function store(StoreDepartemenRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Departemen::create($validated);

        return back()->with('success', 'Departemen berhasil ditambahkan.');
    }

    // PUT /master-data/departemen/{id}
    public function update(UpdateDepartemenRequest $request, $id): RedirectResponse
    {
        $departemen = Departemen::findOrFail($id);

        $validated = $request->validated();

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
    public function import(ImportDepartemenRequest $request): RedirectResponse
    {
        $pesan = ImportExcel::dalamTransaksi(
            DepartemenImport::class,
            $request->file('file'),
            'Gagal import data departemen.',
            fn ($import) => "Berhasil import {$import->getCreatedCount()} departemen baru"
            . ($import->getSkippedCount() > 0 ? ", {$import->getSkippedCount()} dilewati (sudah ada)" : '')
        );

        return back()->with('success', $pesan);
    }
}
