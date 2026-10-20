<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Imports\MasterData\PerusahaanImport;
use App\Models\MasterData\Perusahaan;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
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
        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new PerusahaanImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data perusahaan.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} perusahaan baru"
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
