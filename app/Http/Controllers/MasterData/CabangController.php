<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\Shared\ImportExcel;
use App\Http\Controllers\Controller;
use App\Imports\MasterData\CabangImport;
use App\Models\MasterData\LokasiKantor;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Http\Requests\MasterData\StoreCabangRequest;
use App\Http\Requests\MasterData\UpdateCabangRequest;
use App\Http\Requests\MasterData\ImportCabangRequest;

// [F1-INERTIA] Versi Inertia dari CabangController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// CabangController (API) sengaja dibiarkan dulu; dihapus di F10 setelah tidak ada pemakainya.
class CabangController extends Controller
{
    // POST /master-data/cabang
    public function store(StoreCabangRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        LokasiKantor::create($validated);

        return back()->with('success', 'Cabang baru berhasil ditambahkan.');
    }

    // PUT /master-data/cabang/{id}
    public function update(UpdateCabangRequest $request, $id): RedirectResponse
    {
        $cabang = LokasiKantor::findOrFail($id);

        $validated = $request->validated();

        $cabang->update($validated);

        return back()->with('success', 'Data cabang berhasil diperbarui.');
    }

    // DELETE /master-data/cabang/{id}
    // Gagal -> error bag key "delete" (ditampilkan di dalam modal konfirmasi hapus).
    public function destroy($id): RedirectResponse
    {
        $cabang = LokasiKantor::withCount(['karyawan as pekerja_count'])->findOrFail($id);

        if ($cabang->pekerja_count > 0) {
            throw ValidationException::withMessages([
                'delete' => 'Cabang ini masih memiliki ' . $cabang->pekerja_count . ' pegawai. Pindahkan pegawai terlebih dahulu sebelum menghapus.',
            ]);
        }

        DB::transaction(function () use ($cabang) {
            // Hapus akun user (role cabang) yang terhubung ke lokasi ini dulu,
            // baru hapus cabangnya -- biar gak ada akun "nyantol" tanpa cabang
            $cabang->akunCabang?->delete();
            $cabang->delete();
        });

        return back()->with('success', 'Cabang berhasil dihapus.');
    }

    // POST /master-data/cabang/import -- Excel (.xlsx/.xls). Kolom: Nama | Alamat | Telepon | Link.
    // Gagal -> error bag key "file" (pesan pertama), semua-atau-tidak-sama-sekali (rollback).
    public function import(ImportCabangRequest $request): RedirectResponse
    {
        $pesan = ImportExcel::dalamTransaksi(
            CabangImport::class,
            $request->file('file'),
            'Gagal import data cabang.',
            fn ($import) => "Berhasil import {$import->getCreatedCount()} cabang baru"
            . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '')
        );

        return back()->with('success', $pesan);
    }
}
