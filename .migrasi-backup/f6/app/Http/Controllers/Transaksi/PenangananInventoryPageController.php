<?php

namespace App\Http\Controllers\Transaksi;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class PenangananInventoryPageController extends Controller
{
    // GET /penanganan-inventory   (middleware: auth; semua role)
    // Scoping non-admin (hanya laporan terkait pemakaiannya) ada di InventoryPenangananController::index
    // (GET /api/inventory-penanganan) dan TIDAK diubah. Data masih lewat /api (axios) -- dipindah ke props di F6.
    public function __invoke()
    {
        return Inertia::render('PenangananInventory/Index');
    }
}
