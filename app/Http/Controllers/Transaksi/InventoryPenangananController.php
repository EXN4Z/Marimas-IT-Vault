<?php

namespace App\Http\Controllers\Transaksi;

use App\Actions\Transaksi\InventoryPenangananAction;
use App\Http\Controllers\Controller;
use App\Models\Transaksi\InventoryPenanganan;
use App\Queries\InventoryPenangananQuery;
use Illuminate\Http\Request;

class InventoryPenangananController extends Controller
{
    // [F6-INERTIA] index / store / terima / update / destroy dipakai bareng dengan InventoryPenangananWebController lewat
    // InventoryPenangananQuery & InventoryPenangananAction.
    public function __construct(private InventoryPenangananAction $penanganan)
    {
    }

    /**
     * GET /api/inventory-penanganan
     * Admin: semua laporan penanganan, lintas karyawan.
     * Non-admin (karyawan/manajer/hr/cabang -- semua disetarakan, lihat
     * User::$roleLevels): dibatasi cuma laporan yang terkait pemakaian dia
     * sendiri (inventory_pemakai.user_id == dia), biar karyawan gak bisa
     * lihat laporan kerusakan/riwayat perbaikan milik karyawan lain. HR
     * TIDAK LAGI dapat pengecualian khusus di sini -- hak aksesnya sama
     * persis seperti karyawan. Discoping DI SINI (bukan cuma di middleware
     * routes/api.php), soalnya middleware cuma ngatur SIAPA yang boleh
     * manggil endpoint-nya, bukan DATA APA yang boleh dia lihat.
     */
    public function index(Request $request)
    {
        // [F6-INERTIA] scoping (admin semua / non-admin miliknya) ada di InventoryPenangananQuery::populasi().
        return response()->json(
            InventoryPenangananQuery::muat(InventoryPenangananQuery::populasi($request->user()))->get()
        );
    }

    // Tab "Rusak" di halaman Foto Inventory — versi paginated & bisa
    // dicari, beda dari index() di atas yang narik SEMUA data buat halaman
    // penanganan/riwayat. foto di sini masih 1 file per laporan (bukan
    // array kayak foto_penerimaan/foto_pengembalian di InventoryPemakai).
    // [F7-INERTIA] Query di App\Queries\FotoInventoryQuery (dipakai bareng tab Foto Inventory di halaman Laporan).
    public function foto(Request $request)
    {
        $query = \App\Queries\FotoInventoryQuery::kerusakan($request->input('search'));

        $perPage = max(10, (int) $request->input('per_page', 12));
        $data = $query->paginate($perPage);

        return response()->json($data);
    }

    // POST /api/inventory-penanganan
    // [F6-INERTIA] Logika di InventoryPenangananAction::lapor(). Frontend halaman sudah pindah ke POST /penanganan-inventory;
    // endpoint ini dihapus di F10.
    public function store(Request $request)
    {
        return response()->json($this->penanganan->lapor($request), 201);
    }

    // admin: terima & mulai tangani laporan -> item jadi "diperbaiki" (sedang diperbaiki). Logika di Action::terima().
    public function terima(InventoryPenanganan $inventoryPenanganan)
    {
        return response()->json($this->penanganan->terima($inventoryPenanganan));
    }

    // admin: tandai penanganan selesai + isi hasil/biaya, generate no_struk. Logika di Action::selesaikan().
    public function update(Request $request, InventoryPenanganan $inventoryPenanganan)
    {
        return response()->json($this->penanganan->selesaikan($request, $inventoryPenanganan));
    }

    public function destroy(InventoryPenanganan $inventoryPenanganan)
    {
        $this->penanganan->hapus($inventoryPenanganan);

        return response()->json(['message' => 'Laporan penanganan berhasil dihapus.']);
    }
}