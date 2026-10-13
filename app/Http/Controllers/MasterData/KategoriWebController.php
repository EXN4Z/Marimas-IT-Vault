<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Models\MasterData\Kategori;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// [F2-INERTIA] Versi Inertia dari KategoriController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// KategoriController (API) sengaja dibiarkan dulu: GET /api/kategori masih dipakai Inventory & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class KategoriWebController extends Controller
{
    // Data tab Kategori buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan KategoriController::index() (API).
    public static function daftar(): array
    {
        return Kategori::orderBy('nama')->get()->all();
    }

    // POST /master-data/kategori
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:255',
        ]);

        Kategori::create($validated);

        return back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    // PUT /master-data/kategori/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $kategori = Kategori::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'required|string|max:255',
        ]);

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
}
