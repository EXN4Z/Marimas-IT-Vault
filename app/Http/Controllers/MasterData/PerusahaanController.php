<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;

use App\Imports\MasterData\PerusahaanImport;
use App\Models\MasterData\Perusahaan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

// Mirror dari CabangController -- struktur & validasi field sama persis,
// tapi TANPA cek "masih ada pegawai/relasi" sebelum hapus, karena
// Perusahaan sengaja belum dikaitkan ke tabel lain (lihat model Perusahaan).
class PerusahaanController extends Controller
{
    // GET / — daftar perusahaan
    public function index()
    {
        return Inertia::render('MasterData/Index', [
            'perusahaans' => Perusahaan::orderBy('nama')->get(),
            'tab' => 'perusahaan'
        ]);
    }

    // POST /
    public function store(Request $request)
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
            'alamat.unique' => 'Alamat ini sudah terdaftar.',
            'link.unique'   => 'Link ini sudah digunakan.',
        ]);

        Perusahaan::create($validated);

        return redirect()->back()->with('success', 'Perusahaan berhasil ditambahkan.');
    }

    // PUT /{id}
    public function update(Request $request, $id)
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

        return redirect()->back()->with('success', 'Perusahaan berhasil diperbarui.');
    }

    // DELETE /{id}
    public function destroy($id)
    {
        Perusahaan::findOrFail($id)->delete();
        return redirect()->back()->with('success', 'Perusahaan berhasil dihapus.');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        DB::beginTransaction();
        try {
            $import = new PerusahaanImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                return redirect()->back()->with('error', 'Gagal import: ' . implode(', ', $import->getErrors()));
            }

            DB::commit();
            $message = "Berhasil import {$import->getCreatedCount()} perusahaan baru"
                . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '');
            return redirect()->back()->with('success', $message);
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Gagal import: ' . $e->getMessage());
        }
    }
}