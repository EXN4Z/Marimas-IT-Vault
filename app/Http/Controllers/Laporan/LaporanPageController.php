<?php

namespace App\Http\Controllers\Laporan;

use App\Http\Controllers\Controller;
use App\Http\Controllers\MasterData\CabangWebController;
use App\Http\Controllers\MasterData\DepartemenWebController;
use App\Http\Controllers\MasterData\KategoriWebController;
use App\Http\Controllers\MasterData\PerusahaanWebController;
use App\Http\Controllers\MasterData\SupplierWebController;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\User;
use App\Queries\FotoInventoryQuery;
use App\Queries\InventoryQuery;
use App\Queries\KaryawanQuery;
use App\Queries\RiwayatInventoryQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;

// [F7-INERTIA] Halaman Laporan: SEMUA data tab dikirim sebagai props (tanpa axios / route /api).
//  - export_data       : `exportData` (deferred -> halaman tampil dulu, kartu export "Memuat data..." sampai datanya datang)
//  - foto_inventory    : `foto`    (1 sub-tab aktif, dipaginasi server; ?sub=&search=&page=)
//  - riwayat_inventory : `riwayat` (dipaginasi server; ?type=&search=&page=)
// Tab yang tidak aktif dikirim null (tidak dihitung). Aturan akses: route admin-only (routes/web.php) + scoping role di
// RiwayatInventoryQuery / FotoInventoryQuery dipindah apa adanya dari controller API-nya.
class LaporanPageController extends Controller
{
    private const TABS = ['export_data', 'foto_inventory', 'riwayat_inventory'];

    private const PER_HALAMAN = 10;

    private const RIWAYAT_TYPE = ['pinjam', 'kembali', 'lapor_rusak', 'mulai_perbaikan', 'selesai_perbaikan', 'dijual'];

    // GET /laporan?tab=export_data|foto_inventory|riwayat_inventory   (middleware: auth + role:admin, lihat routes/web.php)
    // Tab kosong / tidak dikenal -> redirect ke ?tab=export_data (dulu dilakukan effect di React lewat setSearchParams).
    public function __invoke(Request $request)
    {
        $tab = $request->query('tab');

        if (!in_array($tab, self::TABS, true)) {
            return redirect('/laporan?tab=export_data');
        }

        return Inertia::render('Laporan/Index', [
            'tab' => $tab,
            'exportData' => $tab === 'export_data' ? Inertia::defer(fn () => self::dataExport($request)) : null,
            'foto' => $tab === 'foto_inventory' ? fn () => self::foto($request) : null,
            'riwayat' => $tab === 'riwayat_inventory' ? fn () => self::riwayat($request) : null,
        ]);
    }

    // Semua data mentah buat modal Export (Excel/PDF dibuat di klien dari data ini). Bentuk SAMA dengan endpoint API-nya dulu:
    // inventory (induk saja), karyawan, kategori, departemen, cabang, perusahaan, supplier, pemakai inventory.
    private static function dataExport(Request $request): array
    {
        return [
            'inventory' => InventoryQuery::batasiUntuk(InventoryQuery::dasar()->latest()->indukSendiri(), $request->user())->get()->all(),
            'karyawan' => KaryawanQuery::filter(User::with('departemen', 'lokasiKantor', 'roleRef'))->latest()->get()->all(),
            'kategori' => KategoriWebController::daftar(),
            'departemen' => DepartemenWebController::daftar(),
            'cabang' => CabangWebController::daftar(),
            'perusahaan' => PerusahaanWebController::daftar(),
            'supplier' => SupplierWebController::daftar(),
            'pemakai' => InventoryPemakai::with(['inventory', 'user'])->orderByDesc('created_at')->get()->all(),
        ];
    }

    private static function foto(Request $request): array
    {
        $sub = (string) $request->query('sub', 'inventory');
        $sub = in_array($sub, FotoInventoryQuery::SUB_TAB, true) ? $sub : 'inventory';
        $search = trim((string) $request->query('search', ''));

        $p = FotoInventoryQuery::untukTab($sub, $request->user(), $search)->paginate(self::PER_HALAMAN);

        return [
            'sub' => $sub,
            'filters' => ['search' => $search],
            'data' => $p->items(),
            'current_page' => $p->currentPage(),
            'last_page' => $p->lastPage(),
            'total' => $p->total(),
            'per_page' => $p->perPage(),
        ];
    }

    private static function riwayat(Request $request): array
    {
        $type = $request->query('type');
        $type = in_array($type, self::RIWAYAT_TYPE, true) ? $type : null;
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));

        return RiwayatInventoryQuery::ambil($request->user(), $type, $search, $page, self::PER_HALAMAN)
            + ['filters' => ['type' => $type ?? 'semua', 'search' => $search]];
    }
}
