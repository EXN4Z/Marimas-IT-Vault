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

// [F1-INERTIA] Versi Inertia dari PerusahaanController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// PerusahaanController (API) sengaja dibiarkan dulu; dihapus di F10 setelah tidak ada pemakainya.
class PerusahaanWebController extends Controller
{
    // Data tab Perusahaan buat props halaman Master Data (dipakai MasterDataPageController).
    public static function daftar(): array
    {
        return Perusahaan::orderBy('nama')->get()->all();
    }

    // POST /master-data/perusahaan
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:150',
            'alamat' => 'required|string|max:1000|unique:perusahaan,alamat',
            'telepon' => 'required|string|max:30',
            'link' => 'required|string|max:255|unique:perusahaan,link',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
            'telepon.required' => 'Kolom nomor telepon wajib diisi.',
            'link.required' => 'Kolom link wajib diisi.',
            'alamat.unique' => 'Alamat ini sudah terdaftar di cabang lain.',
            'link.unique'   => 'Link ini sudah digunakan oleh cabang lain.',
        ]);

        Perusahaan::create($validated);

        return back()->with('success', 'Perusahaan baru berhasil ditambahkan.');
    }

    // PUT /master-data/perusahaan/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $perusahaan = Perusahaan::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'sometimes|required|string|max:150',
            'alamat' => 'sometimes|required|string|max:1000',
            'telepon' => 'sometimes|required|string|max:30',
            'link' => 'sometimes|required|string|max:255',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
            'telepon.required' => 'Kolom nomor telepon wajib diisi.',
            'link.required' => 'Kolom link wajib diisi.',
        ]);

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
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

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
