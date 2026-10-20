<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Imports\MasterData\CabangImport;
use App\Models\MasterData\LokasiKantor;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

// [F1-INERTIA] Versi Inertia dari CabangController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// CabangController (API) sengaja dibiarkan dulu; dihapus di F10 setelah tidak ada pemakainya.
class CabangController extends Controller
{
    // Data tab Cabang buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan CabangController::index() (API).
    public static function daftar(): array
    {
        return LokasiKantor::withCount(['karyawan as pekerja_count'])
            ->with('akunCabang')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'nama' => $item->nama,
                'alamat' => $item->alamat,
                'telepon' => $item->telepon,
                'link' => $item->link,
                'pekerja_count' => $item->pekerja_count,
                'email' => $item->akunCabang?->email,
            ])
            ->all();
    }

    // POST /master-data/cabang
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:150',
            'alamat' => 'required|string|max:1000|unique:lokasi_kantor,alamat',
            'telepon' => 'nullable|string|max:30',
            'link' => 'nullable|string|max:255|unique:lokasi_kantor,link',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
            'alamat.unique' => 'Alamat ini sudah terdaftar di cabang lain.',
            'link.unique'   => 'Link ini sudah digunakan oleh cabang lain.',
        ]);

        LokasiKantor::create($validated);

        return back()->with('success', 'Cabang baru berhasil ditambahkan.');
    }

    // PUT /master-data/cabang/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $cabang = LokasiKantor::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'sometimes|required|string|max:150',
            'alamat' => 'sometimes|required|string|max:1000',
            'telepon' => 'sometimes|nullable|string|max:30',
            'link' => 'sometimes|nullable|string|max:255',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
        ]);

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
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new CabangImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data cabang.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} cabang baru"
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
