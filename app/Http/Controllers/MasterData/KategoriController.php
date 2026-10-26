<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\Shared\ImportExcel;
use App\Http\Controllers\Controller;
use App\Imports\MasterData\KategoriImport;
use App\Models\MasterData\Kategori;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use App\Http\Requests\MasterData\StoreKategoriRequest;
use App\Http\Requests\MasterData\ImportKategoriRequest;
use App\Http\Requests\MasterData\UpdateKategoriRequest;

// [F2-INERTIA] Versi Inertia dari KategoriController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// KategoriController (API) sengaja dibiarkan dulu: GET /api/kategori masih dipakai Inventory & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class KategoriController extends Controller
{
    // POST /master-data/kategori
    public function store(StoreKategoriRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Kategori::create($validated);

        return back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    // PUT /master-data/kategori/{id}
    public function update(UpdateKategoriRequest $request, $id): RedirectResponse
    {
        $kategori = Kategori::findOrFail($id);

        $validated = $request->validated();

        $kategori->update($validated);

        return back()->with('success', 'Kategori berhasil diperbarui.');
    }

    // DELETE /master-data/kategori/{id}
    // FK ke inventory.kategori_id = restrictOnDelete, jadi dicek manual dulu biar pesannya rapi.
    // Gagal -> error bag key "delete" (ditampilkan di dalam modal konfirmasi hapus).
    public function destroy($id): RedirectResponse
    {
        $kategori = Kategori::findOrFail($id);

        if ($kategori->inventory()->exists()) {
            throw ValidationException::withMessages([
                'delete' => 'Kategori ini masih dipakai oleh data Inventory dan tidak bisa dihapus.',
            ]);
        }

        $kategori->delete();

        return back()->with('success', 'Kategori berhasil dihapus.');
    }

    // POST /master-data/kategori/import -- Excel (.xlsx/.xls). Kolom: Nama. Nama yang sudah ada dilewati.
    // Gagal -> error bag key "file" (pesan pertama), semua-atau-tidak-sama-sekali (rollback).
    public function import(ImportKategoriRequest $request): RedirectResponse
    {
        $pesan = ImportExcel::dalamTransaksi(
            KategoriImport::class,
            $request->file('file'),
            'Gagal import data kategori.',
            fn ($import) => "Berhasil import {$import->getCreatedCount()} kategori baru"
            . ($import->getSkippedCount() > 0 ? ", {$import->getSkippedCount()} dilewati (sudah ada)" : '')
        );

        return back()->with('success', $pesan);
    }
}