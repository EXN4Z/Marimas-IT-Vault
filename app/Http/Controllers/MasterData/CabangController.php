<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;

use App\Imports\MasterData\CabangImport;
use App\Models\MasterData\LokasiKantor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
Use Illuminate\Mail\Mailable;
use App\Models\MasterData\Role;
use App\Mail\BranchCredentials;

class CabangController extends Controller
{
    // GET / — daftar cabang
    public function index()
    {
        return Inertia::render('MasterData/Index', [
            'cabangs' => LokasiKantor::withCount(['karyawan as pekerja_count'])
                ->with('akunCabang')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'nama' => $item->nama,
                        'alamat' => $item->alamat,
                        'telepon' => $item->telepon,
                        'link' => $item->link,
                        'pekerja_count' => $item->pekerja_count,
                        'email' => $item->akunCabang?->email,
                    ];
                }),
            'tab' => 'cabang'
        ]);
    }

    // POST /
    public function store(Request $request)
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

        return redirect()->back()->with('success', 'Cabang berhasil ditambahkan.');
    }

    // PUT /{id}
    public function update(Request $request, $id)
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

        return redirect()->back()->with('success', 'Cabang berhasil diperbarui.');
    }

    // DELETE /{id}
    public function destroy($id)
    {
        $cabang = LokasiKantor::withCount(['karyawan as pekerja_count'])->findOrFail($id);

        if ($cabang->pekerja_count > 0) {
            return redirect()->back()->with('error', 'Cabang ini masih memiliki ' . $cabang->pekerja_count . ' pegawai. Pindahkan pegawai terlebih dahulu.');
        }

        DB::transaction(function () use ($cabang) {
            $cabang->akunCabang?->delete();
            $cabang->delete();
        });

        return redirect()->back()->with('success', 'Cabang berhasil dihapus.');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        DB::beginTransaction();
        try {
            $import = new CabangImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                return redirect()->back()->with('error', 'Gagal import: ' . implode(', ', $import->getErrors()));
            }

            DB::commit();
            $message = "Berhasil import {$import->getCreatedCount()} cabang baru"
                . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '');
            return redirect()->back()->with('success', $message);
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Gagal import: ' . $e->getMessage());
        }
    }
}