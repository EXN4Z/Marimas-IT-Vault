<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\MasterData\InventoryAction;
use App\Http\Controllers\Controller;
use App\Models\MasterData\Inventory;
use App\Queries\InventoryQuery;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// [F4-INERTIA] Controller API inventory. Aturan akses/query dipindah ke App\Queries\InventoryQuery dan logika
// mutasi ke App\Actions\MasterData\InventoryAction (dipakai bareng InventoryWebController, halaman Inertia).
// Bentuk response JSON dipertahankan. Sampai F10 yang masih dipanggil frontend: index (Laporan/Dashboard) & foto (Laporan).
class InventoryController extends Controller
{
    public function __construct(private InventoryAction $inventory)
    {
    }

    /**
     * GET /api/inventory
     * Admin: daftar SEMUA inventory. Non-admin: dibatasi (lihat InventoryQuery::batasiUntuk()).
     * Filter opsional: ?kategori_id=, ?posisi=induk|menempel (struktur parent_id), ?parent_id=.
     */
    public function index(Request $request)
    {
        $query = InventoryQuery::dasar()->latest();

        if ($kategoriId = $request->query('kategori_id')) {
            $query->where('kategori_id', $kategoriId);
        }

        if ($posisi = $request->query('posisi')) {
            abort_unless(in_array($posisi, ['induk', 'menempel'], true), 422, 'Posisi tidak valid.');
            $posisi === 'induk' ? $query->indukSendiri() : $query->menempel();
        }

        if ($request->filled('parent_id')) {
            $query->where('parent_id', $request->query('parent_id'));
        }

        InventoryQuery::batasiUntuk($query, $request->user());

        return response()->json($query->get());
    }

    /**
     * GET /api/inventory/{inventory}
     * Detail satu item + riwayat lengkap. Non-admin dibatasi (InventoryQuery::bolehDilihat()).
     */
    public function show(Request $request, Inventory $inventory)
    {
        abort_unless(
            InventoryQuery::bolehDilihat($inventory, $request->user()),
            403,
            'Kamu tidak punya akses untuk melihat detail item ini.'
        );

        $inventory->load(InventoryQuery::relasiDetail());

        return response()->json($inventory);
    }

    /** POST /api/inventory -- kode_inventory digenerate otomatis lewat trigger DB. */
    public function store(Request $request)
    {
        $validated = $this->inventory->validasi($request);

        $inventory = $this->inventory->simpan($request, $validated);

        return response()->json(
            $inventory->load('kategori', 'supplier', 'parent', 'perusahaan'),
            201
        );
    }

    /** POST /api/inventory/{inventory} (+ _method=PUT dari frontend, krn ada file upload) */
    public function update(Request $request, Inventory $inventory)
    {
        $validated = $this->inventory->validasi($request, $inventory);

        $inventory = $this->inventory->perbarui($request, $inventory, $validated);

        return response()->json(
            $inventory->load('kategori', 'supplier', 'parent', 'perusahaan')
        );
    }

    /** DELETE /api/inventory/{inventory} -- ?force=1 lewatin guard riwayat. 422 membawa `force_available` kalau masih bisa dipaksa. */
    public function destroy(Request $request, Inventory $inventory)
    {
        try {
            $kodeInventory = $this->inventory->hapus($inventory, $request->boolean('force'));
        } catch (ValidationException $e) {
            $errors = $e->errors();

            $response = ['message' => $errors['delete'][0] ?? $e->getMessage()];
            if (isset($errors['force_available'])) {
                $response['force_available'] = true;
            }

            return response()->json($response, 422);
        }

        return response()->json(['message' => "Inventory {$kodeInventory} berhasil dihapus."]);
    }

    /** POST /api/inventory/{inventory}/jual */
    public function jual(Request $request, Inventory $inventory)
    {
        $inventory = $this->inventory->jual($request, $inventory);

        return response()->json($inventory->load([
            'kategori',
            'supplier',
            'pemakaiSaatIni',
            'writeoff.penyetuju:id,name',
        ]));
    }

    /** POST /api/inventory/{inventory}/pasang-pengganti-kelengkapan */
    public function pasangPenggantiKelengkapan(Request $request, Inventory $inventory)
    {
        $inventory = $this->inventory->pasangKeInduk($request, $inventory);

        return response()->json($inventory->load(['parent', 'supplier']));
    }

    /** POST /api/inventory/{inventory}/lepas-dari-induk */
    public function lepasDariInduk(Request $request, Inventory $inventory)
    {
        $inventory = $this->inventory->lepasDariInduk($request, $inventory);

        return response()->json($inventory->load(['kategori', 'supplier']));
    }

    /**
     * GET /api/inventory/foto — daftar item inventory yang punya foto DASAR
     * (diupload pas nambah/edit barang di Master Data, kolom `inventory.foto`).
     * Ini beda dari:
     * - /inventory-pemakai/foto (foto serah-terima & pengembalian)
     * - /inventory-penanganan/foto (foto laporan kerusakan)
     * ...yang keduanya foto TRANSAKSI. Ini foto BARANGNYA sendiri, buat tab
     * "Inventory" paling kiri di halaman Foto Inventory (Laporan).
     * Admin+hr only, sama kayak akses halaman Laporan di frontend.
     */
    // [F7-INERTIA] Query di App\Queries\FotoInventoryQuery (dipakai bareng tab Foto Inventory di halaman Laporan).
    public function foto(Request $request)
    {
        $query = \App\Queries\FotoInventoryQuery::inventory($request->input('search'));

        $perPage = max(10, (int) $request->input('per_page', 12));
        $data = $query->paginate($perPage);

        return response()->json($data);
    }
}
