<?php

namespace App\Http\Controllers\MasterData;

use App\Queries\MasterData\SupplierQuery;
use App\Queries\MasterData\KategoriQuery;
use App\Queries\MasterData\PerusahaanQuery;
use App\Actions\MasterData\InventoryAction;
use App\Actions\Shared\ImportExcel;
use App\Http\Controllers\Controller;
use App\Imports\MasterData\InventoryBuktiImport;
use App\Models\MasterData\Inventory;
use App\Queries\MasterData\InventoryQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Http\Requests\MasterData\ImportInventoryRequest;

// [F4-INERTIA] Versi Inertia dari InventoryController (API) untuk tab "Inventory" di Master Data.
// Data baca (daftar/dipakai/export/opsi/detail) dipanggil MasterDataPageController sebagai props; mutasi dipanggil
// lewat routes/web.php (session + CSRF, admin-only), balasan = redirect back + flash (bukan JSON).
// Logika mutasi & aturan akses SAMA dengan versi API karena dipakai bareng lewat InventoryAction / InventoryQuery.
// InventoryController (API) sengaja dibiarkan dulu: GET /api/inventory masih dipakai Laporan (F7) & Dashboard (F8).
class InventoryController extends Controller
{
    private const PER_HALAMAN = 10;

    private const STATUS = ['tersedia', 'dipakai', 'menunggu_perbaikan', 'diperbaiki', 'rusak_berat', 'dijual'];

    // Status yang cuma bisa dipunyai item yang BUKAN child (jual() menolak item yang punya parent_id).
    private const STATUS_KHUSUS_INDUK = ['dijual'];

    public function __construct(private InventoryAction $inventory)
    {
    }

    // ================================================================== DATA BACA (props halaman Master Data)

    // Satu halaman data tab Inventory. Pagination, pencarian, filter status, dan filter kategori dijalankan
    // server; sumber kebenarannya query string (?search=&status=&kategori[]=&page=). Urutan: kode_inventory
    // menaik. Tiap baris sudah lengkap (relasi list + children_count), jadi modal edit cukup pakai baris ini --
    // tidak perlu request tambahan.
    public static function daftar(Request $request): array
    {
        $f = self::filterEfektif($request);

        $query = self::queryTerfilter($request, $f);

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / self::PER_HALAMAN));

        // Jumlah per status di populasi filter kategori aktif (BUKAN filter status/pencarian) -> bar ringkasan status.
        $statusCounts = array_fill_keys(self::STATUS, 0);
        $perStatus = self::populasi($request, $f['kategori'])->toBase()
            ->selectRaw('inventory.status AS status, COUNT(*) AS n')
            ->groupBy('inventory.status')
            ->pluck('n', 'status');
        foreach ($perStatus as $st => $n) {
            if (array_key_exists($st, $statusCounts)) {
                $statusCounts[$st] = (int) $n;
            }
        }
        // halaman di luar jangkauan (mis. habis hapus item terakhir di halaman terakhir) -> geser ke halaman terakhir
        $page = min(max(1, (int) $request->query('page', 1)), $lastPage);

        $rows = self::urutkan($query->withCount('children'))
            ->forPage($page, self::PER_HALAMAN)
            ->get();

        return [
            'data' => $rows->all(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => self::PER_HALAMAN,
            // Ada item induk (parent_id kosong) di populasi filter kategori aktif? Menentukan tab status "Dijual" tampil.
            'ada_induk' => $f['ada_induk'],
            'status_counts' => $statusCounts,
            'filters' => [
                'search' => $f['search'] ?? '',
                'status' => $f['status'] ?? '',
                'kategori' => $f['kategori'],
            ],
        ];
    }

    // Non-admin: inventory yang LAGI dia pegang/ditangani (card "Sedang Anda Pakai"). Admin: kosong.
    public static function dipakai(Request $request): array
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            return [];
        }

        return InventoryQuery::batasiUntuk(InventoryQuery::dasar(), $user)
            ->whereHas('pemakaiSaatIni', fn ($q) => $q->where('user_id', $user->id))
            ->latest()
            ->get()
            ->all();
    }

    // SEMUA hasil filter aktif (bukan cuma halaman yang tampil) buat modal Export. Di MasterDataPageController
    // dikirim sebagai optional prop: baru dihitung waktu diminta lewat partial reload.
    public static function untukExport(Request $request): array
    {
        $f = self::filterEfektif($request);

        return self::urutkan(self::queryTerfilter($request, $f))->get()->all();
    }

    // Kandidat induk (item apapun yang berdiri sendiri) buat form "Pasang ke Induk" & modal Pasang ke Induk.
    // Optional prop: baru dimuat waktu modal dibuka.
    public static function indukOpsi(): array
    {
        return Inventory::indukSendiri()
            ->orderBy('kode_inventory')
            ->get(['id', 'kode_inventory', 'nama'])
            ->all();
    }

    // Pilihan dropdown form Tambah/Edit & filter kategori. Perilaku lama dipertahankan: kategori/supplier/perusahaan
    // dulu diambil lewat endpoint admin-only, jadi non-admin menerima daftar kosong.
    public static function opsi(Request $request): array
    {
        $admin = $request->user()->isAdmin();

        return [
            'kategori' => $admin ? KategoriQuery::daftar() : [],
            'supplier' => $admin ? SupplierQuery::daftar() : [],
            'perusahaan' => $admin ? PerusahaanQuery::daftar() : [],
        ];
    }

    // Detail satu item (?detail=<id>) lengkap dengan riwayat pemakai/penanganan + kelengkapan anak. null kalau
    // tidak ada / tidak boleh dilihat user ini (aturan sama dengan InventoryController::show(); tidak abort(403)
    // supaya visit-nya tidak jadi halaman error -- klien menampilkan toast).
    public static function detail(Request $request): ?Inventory
    {
        $id = (int) $request->query('detail', 0);
        if ($id <= 0) {
            return null;
        }

        $inventory = Inventory::find($id);
        if (!$inventory || !InventoryQuery::bolehDilihat($inventory, $request->user())) {
            return null;
        }

        return $inventory->load(InventoryQuery::relasiDetail());
    }

    // ================================================================== MUTASI (admin-only, redirect back + flash)

    // POST /master-data/inventory  (multipart: foto)
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->inventory->validasi($request);

        $this->inventory->simpan($request, $validated);

        return back()->with('success', 'Inventory baru berhasil ditambahkan.');
    }

    // PUT /master-data/inventory/{inventory}  (klien kirim POST + _method=put karena ada file; route didaftarkan PUT)
    public function update(Request $request, Inventory $inventory): RedirectResponse
    {
        $validated = $this->inventory->validasi($request, $inventory);

        $this->inventory->perbarui($request, $inventory, $validated);

        return back()->with('success', 'Perubahan inventory berhasil disimpan.');
    }

    // DELETE /master-data/inventory/{inventory}   (?force=1 / body force=true -> hapus paksa)
    // Gagal -> error bag key "delete" (+ "force_available" kalau masih bisa dipaksa), tampil di modal konfirmasi hapus.
    public function destroy(Request $request, Inventory $inventory): RedirectResponse
    {
        $kode = $this->inventory->hapus($inventory, $request->boolean('force'));

        return back()->with('success', "Inventory {$kode} berhasil dihapus.");
    }

    // POST /master-data/inventory/{inventory}/jual -- gagal -> error bag key "jual".
    public function jual(Request $request, Inventory $inventory): RedirectResponse
    {
        $this->inventory->jual($request, $inventory);

        return back()->with('success', 'Inventory berhasil ditandai sebagai dijual.');
    }

    // POST /master-data/inventory/{inventory}/pasang-ke-induk  (parent_id) -- gagal -> error bag "pasang"/"parent_id"/"foto_penerimaan".
    public function pasangKeInduk(Request $request, Inventory $inventory): RedirectResponse
    {
        $this->inventory->pasangKeInduk($request, $inventory);

        return back()->with('success', "{$inventory->kode_inventory} berhasil dipasang ke induk.");
    }

    // POST /master-data/inventory/{inventory}/lepas-dari-induk  (keterangan) -- gagal -> error bag key "lepas".
    public function lepasDariInduk(Request $request, Inventory $inventory): RedirectResponse
    {
        $this->inventory->lepasDariInduk($request, $inventory);

        return back()->with('success', "{$inventory->kode_inventory} berhasil dilepas dari induk.");
    }

    // POST /master-data/inventory/import -- Excel (.xlsx/.xls), semua-atau-tidak-sama-sekali (rollback).
    // Gagal -> error bag key "file" (pesan pertama, sama seperti tampilan lama).
    public function import(ImportInventoryRequest $request): RedirectResponse
    {
        $pesan = ImportExcel::dalamTransaksi(
            InventoryBuktiImport::class,
            $request->file('file'),
            'Gagal mengimport file',
            fn ($import) => "Berhasil import {$import->getRowCount()} baris data"
        );

        return back()->with('success', $pesan);
    }

    // ================================================================== helper

    // Parameter filter dari query string, sudah "efektif":
    //  - status & kategori[] valid saja (status cuma berlaku buat admin: tab status non-admin disembunyikan);
    //  - status khusus induk ("dijual") di-reset ke semua kalau populasi filter kategori tidak punya satu pun
    //    item induk (perilaku lama saat user mencentang kategori).
    private static function filterEfektif(Request $request): array
    {
        $admin = $request->user()->isAdmin();

        $search = trim((string) $request->query('search', ''));

        $status = (string) $request->query('status', '');
        $status = $admin && in_array($status, self::STATUS, true) ? $status : null;

        $kategori = collect((array) $request->query('kategori', []))
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values()
            ->all();

        $adaInduk = self::populasi($request, $kategori)->whereNull('parent_id')->exists();

        if ($status !== null && in_array($status, self::STATUS_KHUSUS_INDUK, true) && !$adaInduk) {
            $status = null;
        }

        return [
            'search' => $search !== '' ? $search : null,
            'status' => $status,
            'kategori' => $kategori,
            'ada_induk' => $adaInduk,
        ];
    }

    // Populasi yang boleh dilihat user (scoping role) + filter kategori. Non-admin: tabel selalu cuma
    // item 'tersedia' (yang lagi dia pakai tampil di card terpisah, lihat dipakai()).
    private static function populasi(Request $request, array $kategori): Builder
    {
        $user = $request->user();

        $query = InventoryQuery::batasiUntuk(InventoryQuery::dasar(), $user);

        if (!$user->isAdmin()) {
            $query->where('status', 'tersedia');
        }

        if ($kategori) {
            $query->whereIn('kategori_id', $kategori);
        }

        return $query;
    }

    // populasi + pencarian + filter status. Tanpa orderBy/withCount (supaya aman dipakai count()).
    private static function queryTerfilter(Request $request, array $f): Builder
    {
        $query = self::populasi($request, $f['kategori']);

        if ($f['status'] !== null) {
            $query->where('status', $f['status']);
        }

        if ($f['search'] !== null) {
            // escape karakter wildcard LIKE supaya yang diketik dianggap teks biasa; LOWER() biar tidak peka huruf besar/kecil
            $kata = '%' . mb_strtolower(str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $f['search'])) . '%';

            $query->where(function ($q) use ($kata) {
                $q->whereRaw('LOWER(inventory.kode_inventory) LIKE ?', [$kata])
                    ->orWhereRaw('LOWER(inventory.serial_number) LIKE ?', [$kata])
                    ->orWhereRaw('LOWER(inventory.nama) LIKE ?', [$kata])
                    // nama di kolom "Dipakai Oleh"; status 'dijual' dilewati (kolomnya ditampilkan "-")
                    ->orWhere(function ($qq) use ($kata) {
                        $qq->where('inventory.status', '!=', 'dijual')
                            ->whereHas('pemakaiSaatIni.user', fn ($u) => $u->whereRaw('LOWER(users.name) LIKE ?', [$kata]));
                    });
            });
        }

        return $query;
    }

    private static function urutkan(Builder $query): Builder
    {
        return $query
            ->orderBy('inventory.kode_inventory')
            ->orderBy('inventory.id');
    }
}
