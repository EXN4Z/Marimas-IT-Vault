<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\Shared\ImportExcel;
use App\Http\Controllers\Controller;
use App\Imports\MasterData\PerusahaanImport;
use App\Models\MasterData\Perusahaan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Http\Requests\MasterData\StorePerusahaanRequest;
use App\Http\Requests\MasterData\UpdatePerusahaanRequest;
use App\Http\Requests\MasterData\ImportPerusahaanRequest;

// [F1-INERTIA] Versi Inertia dari PerusahaanController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// PerusahaanController (API) sengaja dibiarkan dulu; dihapus di F10 setelah tidak ada pemakainya.
class PerusahaanController extends Controller
{
    // POST /master-data/perusahaan
    public function store(StorePerusahaanRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Perusahaan::create($validated);

        return back()->with('success', 'Perusahaan baru berhasil ditambahkan.');
    }

    // PUT /master-data/perusahaan/{id}
    public function update(UpdatePerusahaanRequest $request, $id): RedirectResponse
    {
        $perusahaan = Perusahaan::findOrFail($id);

        $validated = $request->validated();

        $perusahaan->update($validated);

        return back()->with('success', 'Data perusahaan berhasil diperbarui.');
    }

    // DELETE /master-data/perusahaan/{id}
    public function destroy($id): RedirectResponse
    {
        Perusahaan::findOrFail($id)->delete();

        return back()->with('success', 'Perusahaan berhasil dihapus.');
    }

    // POST /master-data/perusahaan/import -- Excel (.xlsx/.xls). Kolom: Nama | Alamat | Telepon | Link.
    // Gagal -> error bag key "file" (pesan pertama), semua-atau-tidak-sama-sekali (rollback).
    public function import(ImportPerusahaanRequest $request): RedirectResponse
    {
        $pesan = ImportExcel::dalamTransaksi(
            PerusahaanImport::class,
            $request->file('file'),
            'Gagal import data perusahaan.',
            fn ($import) => "Berhasil import {$import->getCreatedCount()} perusahaan baru"
            . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '')
        );

        return back()->with('success', $pesan);
    }
}
