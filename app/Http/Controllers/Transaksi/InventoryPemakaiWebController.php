<?php

namespace App\Http\Controllers\Transaksi;

use App\Actions\Transaksi\InventoryPemakaiAction;
use App\Http\Controllers\Controller;
use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

// [F5-INERTIA] Versi Inertia dari aksi transaksi pemakai di InventoryPemakaiController (API): serah-terima, kembalikan,
// hapus riwayat pemakaian. Dipanggil dari modal di tab Inventory (Master Data) lewat routes/web.php (session + CSRF);
// balasan = redirect back + flash (bukan JSON). Logika & aturan SAMA dengan versi API karena dipakai bareng lewat
// InventoryPemakaiAction. Endpoint baca (riwayat/foto/index) tetap di InventoryPemakaiController sampai F7.
//
// Flash `struk` (selain success): data pemakai terbaru buat cetak struk di klien. Dulu klien memakai body response JSON;
// sekarang redirect tidak membawa body, jadi datanya ikut lewat shared prop flash (lihat HandleInertiaRequests).
class InventoryPemakaiWebController extends Controller
{
    public function __construct(private InventoryPemakaiAction $pemakai)
    {
    }

    // POST /master-data/inventory/{inventory}/pemakai  (multipart: foto_penerimaan[])   -- admin-only
    // Gagal -> error bag key "serah_terima" / user_id / foto_penerimaan(.n) / tanggal_penerimaan.
    public function store(Request $request, Inventory $inventory): RedirectResponse
    {
        $pemakai = $this->pemakai->serahTerima($request, $inventory)->load('user', 'inventory');

        return back()
            ->with('success', 'Serah terima inventory berhasil dicatat.')
            ->with('struk', [
                'tipe' => 'serah_terima',
                'results' => [[
                    'inventory' => $inventory->only(['id', 'kode_inventory', 'nama']),
                    'pemakai' => $pemakai->toArray(),
                ]],
            ]);
    }

    // POST /master-data/inventory-pemakai/{inventoryPemakai}/kembalikan  (multipart: foto_pengembalian[])
    // Admin ATAU pemilik pemakaian (bukan admin-only) -- otorisasi dicek di sini, sama seperti versi API.
    // Gagal -> error bag key status / no_struk_penerimaan / penanganan / foto_pengembalian(.n) / tanggal_pengembalian.
    public function kembalikan(Request $request, InventoryPemakai $inventoryPemakai): RedirectResponse
    {
        $this->pemakai->pastikanBolehKembalikan($request->user(), $inventoryPemakai);

        $hasil = $this->pemakai->kembalikan($request, $inventoryPemakai)->load('user', 'inventory');

        return back()
            ->with('success', 'Pengembalian inventory berhasil diproses.')
            ->with('struk', [
                'tipe' => 'pengembalian',
                'pemakai' => $hasil->toArray(),
            ]);
    }

    // DELETE /master-data/inventory-pemakai/{inventoryPemakai}   -- admin-only
    // Gagal -> error bag key "hapus".
    public function destroy(InventoryPemakai $inventoryPemakai): RedirectResponse
    {
        $this->pemakai->hapus($inventoryPemakai);

        return back()->with('success', 'Riwayat pemakaian berhasil dihapus.');
    }
}