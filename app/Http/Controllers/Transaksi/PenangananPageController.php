<?php

namespace App\Http\Controllers\Transaksi;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PenangananPageController extends Controller
{
    // GET /penanganan-inventory?tab=menunggu|diperbaiki|diperbaiki_selesai|rusak_berat&search=&jenis=&page=   (middleware: auth; semua role)
    // [F6-INERTIA] Data baca dikirim sebagai props (tadinya axios + polling): satu halaman laporan + jumlah per tab, dan SEMUA
    // hasil filter buat Export (optional = baru dihitung saat diminta lewat partial reload `only: ['penangananExport']`).
    // Scoping non-admin (hanya laporan terkait pemakaiannya) ada di InventoryPenangananQuery::populasi() dan TIDAK diubah.
    public function __invoke(Request $request)
    {
        return Inertia::render('PenangananInventory/Index', [
            'penanganan' => fn () => InventoryPenangananController::daftar($request),
            'penangananExport' => Inertia::optional(fn () => InventoryPenangananController::untukExport($request)),
        ]);
    }
}
