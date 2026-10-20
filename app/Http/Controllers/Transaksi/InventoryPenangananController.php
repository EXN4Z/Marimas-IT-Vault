<?php

namespace App\Http\Controllers\Transaksi;

use App\Actions\Transaksi\InventoryPenangananAction;
use App\Http\Controllers\Controller;
use App\Models\Transaksi\InventoryPenanganan;
use App\Queries\Transaksi\InventoryPenangananQuery;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// [F6-INERTIA] Versi Inertia dari InventoryPenangananController (API) untuk halaman Penanganan Inventory + aksi dari modal
// di tab Inventory (Master Data). Data baca (daftar / export) dipanggil PenangananPageController sebagai props;
// mutasi dipanggil lewat routes/web.php (session + CSRF), balasan = redirect back + flash (bukan JSON). Logika & aturan akses
// SAMA dengan versi API karena dipakai bareng lewat InventoryPenangananAction / InventoryPenangananQuery.
class InventoryPenangananController extends Controller
{
    private const PER_HALAMAN = 8;

    public function __construct(private InventoryPenangananAction $penanganan)
    {
    }

    // ================================================================== DATA BACA (props halaman)

    // Satu halaman laporan untuk tab aktif + jumlah per tab (kartu KPI). Pagination, pencarian, filter jenis kerusakan, dan
    // tab status dijalankan server; sumber kebenarannya query string (?tab=&search=&jenis=&page=). Scoping role (admin semua /
    // non-admin cuma miliknya) ada di InventoryPenangananQuery::populasi().
    public static function daftar(Request $request): array
    {
        $user = $request->user();
        $f = self::filterEfektif($request);

        $query = self::queryTerfilter($request, $f);

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / self::PER_HALAMAN));
        // halaman di luar jangkauan (mis. habis memproses item terakhir di halaman terakhir) -> geser ke halaman terakhir
        $page = min(max(1, (int) $request->query('page', 1)), $lastPage);

        $rows = InventoryPenangananQuery::muat($query)->forPage($page, self::PER_HALAMAN)->get();

        return [
            'data' => $rows->all(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => self::PER_HALAMAN,
            'counts' => InventoryPenangananQuery::hitungSegmen($user),
            'filters' => [
                'tab' => $f['tab'],
                'search' => $f['search'] ?? '',
                'jenis' => $f['jenis'] ?? 'all',
            ],
        ];
    }

    // SEMUA hasil filter aktif di tab aktif (bukan cuma halaman yang tampil) buat modal Export. Di PageController dikirim
    // sebagai optional prop: baru dihitung saat diminta lewat partial reload.
    public static function untukExport(Request $request): array
    {
        return InventoryPenangananQuery::muat(self::queryTerfilter($request, self::filterEfektif($request)))->get()->all();
    }

    // ================================================================== MUTASI (redirect back + flash)

    // POST /penanganan-inventory  (multipart: foto)  -- semua role yang login (peminjam / admin lapor kerusakan)
    // Gagal -> error bag key lapor / inventory_id / jenis_kerusakan / keluhan / foto.
    public function store(Request $request): RedirectResponse
    {
        $this->penanganan->lapor($request);

        return back()->with('success', 'Laporan kerusakan berhasil dikirim.');
    }

    // POST /penanganan-inventory/{inventoryPenanganan}/terima  -- admin-only. Gagal -> error bag key "terima".
    public function terima(InventoryPenanganan $inventoryPenanganan): RedirectResponse
    {
        $this->penanganan->terima($inventoryPenanganan);

        return back()->with('success', 'Laporan diterima, aset ditandai sedang diperbaiki.');
    }

    // PUT /penanganan-inventory/{inventoryPenanganan}  -- admin-only. Tandai selesai + hasil/biaya. Gagal -> error bag
    // biaya_komponen / harga_jasa / dst.
    public function update(Request $request, InventoryPenanganan $inventoryPenanganan): RedirectResponse
    {
        $this->penanganan->selesaikan($request, $inventoryPenanganan);

        return back()->with('success', 'Perbaikan selesai dicatat.');
    }

    // DELETE /penanganan-inventory/{inventoryPenanganan}  -- admin-only.
    public function destroy(InventoryPenanganan $inventoryPenanganan): RedirectResponse
    {
        $this->penanganan->hapus($inventoryPenanganan);

        return back()->with('success', 'Laporan penanganan berhasil dihapus.');
    }

    // POST /penanganan-inventory/import -- Excel (.xlsx/.xls), semua-atau-tidak-sama-sekali (rollback). Admin-only.
    // Gagal -> error bag key "file" (pesan pertama, sama seperti tampilan lama).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $hasil = $this->penanganan->import($request->file('file'));

        if (!$hasil['sukses']) {
            throw ValidationException::withMessages(['file' => $hasil['pesan']]);
        }

        return back()->with('success', $hasil['pesan']);
    }

    // ================================================================== helper

    // Parameter dari query string yang sudah "efektif": tab valid (default 'menunggu'), pencarian dirapikan, jenis 'all' = tanpa filter.
    private static function filterEfektif(Request $request): array
    {
        $tab = (string) $request->query('tab', '');
        $tab = in_array($tab, InventoryPenangananQuery::STATUS, true) ? $tab : 'menunggu';

        $search = trim((string) $request->query('search', ''));

        $jenis = (string) $request->query('jenis', '');
        $jenis = ($jenis !== '' && $jenis !== 'all') ? $jenis : null;

        return [
            'tab' => $tab,
            'search' => $search !== '' ? $search : null,
            'jenis' => $jenis,
        ];
    }

    // populasi (scoping role) + segmen tab + pencarian + filter jenis. Tanpa eager-load/orderBy (supaya aman dipakai count()).
    private static function queryTerfilter(Request $request, array $f)
    {
        $query = InventoryPenangananQuery::populasi($request->user());

        InventoryPenangananQuery::segmen($query, $f['tab']);

        return InventoryPenangananQuery::filter($query, $f['search'], $f['jenis']);
    }
}