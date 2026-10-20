<?php

namespace App\Http\Controllers\Legacy\Transaksi;

use App\Actions\Transaksi\InventoryPemakaiAction;
use App\Queries\Laporan\FotoInventoryQuery;
use App\Queries\Laporan\RiwayatInventoryQuery;
use App\Http\Controllers\Controller;
use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\Transaksi\InventoryWriteoff;
use Illuminate\Http\Request;

class InventoryPemakaiController extends Controller
{
    // [F5-INERTIA] store / kembalikan / destroy dipakai bareng dengan InventoryPemakaiController lewat Action.
    public function __construct(private InventoryPemakaiAction $pemakai)
    {
    }

    /**
     * GET /api/inventory-pemakai/riwayat
     * Admin: riwayat GLOBAL semua aktivitas inventory — pinjam, kembali,
     * lapor kerusakan, mulai perbaikan, selesai perbaikan, sampai dijual.
     * Karyawan/manajer/hr: riwayat DIBATASI cuma yang berhubungan sama diri
     * sendiri — pemakaian (pinjam/kembali) yang dia lakukan, plus laporan
     * kerusakan yang nempel di pemakaian dia. Event 'dijual' gak pernah
     * personal ke satu karyawan (itu keputusan admin di level barang), jadi
     * cuma muncul buat admin.
     *
     * Event pinjam/kembali mencakup semua item lewat satu relasi
     * `inventory` yang sama (dulu dipisah lewat kolom aset_kelengkapan_id)
     * -- `tipe_item` di payload diturunkan dari posisi struktural item itu
     * sendiri (induk vs menempel/parent_id, BUKAN lagi dari kategori).
     * Event lapor_rusak/mulai_perbaikan/selesai_perbaikan/dijual: REVISI
     * Fase 2 -- dulu ("khusus Barang Utama saja", Kelengkapan yang rusak
     * diubah statusnya lewat InventoryController::laporRusakKelengkapan()
     * yang langsung final tanpa opsi "diperbaiki") sudah tidak berlaku.
     * laporRusakKelengkapan() sudah dihapus total; sekarang SEMUA item lewat
     * satu alur yang sama (InventoryPenanganan, lihat
     * InventoryPenangananController::store()), apapun kategori/posisinya.
     *
     * PENTING soal waktu: kolom tanggal_penerimaan/tanggal_pengembalian dan
     * tanggal_lapor/tanggal_diterima/tanggal_selesai cuma nyimpen TANGGAL
     * (jam-menit-detik selalu 00:00:00) — kalau dipakai langsung buat waktu
     * relatif ("X jam lalu") hasilnya ngaco. Makanya di sini kita pakai
     * kolom *_at (diterima_at, dikembalikan_at, lapor_at, dst — datetime
     * lengkap) yang dicatat programnya sendiri, dengan fallback ke kolom
     * tanggal_* lama buat data lama yang belum punya *_at.
     */

    public function index()
    {
        $data = InventoryPemakai::with(['inventory', 'user'])
            ->orderByDesc('created_at')
            ->get();

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    // [F7-INERTIA] Logika di App\Queries\Laporan\RiwayatInventoryQuery (dipakai bareng tab Riwayat Inventory di halaman Laporan).
    // Endpoint ini masih dipanggil Dashboard sampai F8; dihapus di F10.
    public function riwayat(Request $request)
    {
        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    /**
     * GET /api/inventory-pemakai/foto — list semua record serah-terima/
     * pengembalian yang punya foto, buat halaman galeri. Admin lihat semua;
     * role lain cuma punya sendiri.
     */
    public function foto(Request $request)
    {
        // [F7-INERTIA] Query di App\Queries\Laporan\FotoInventoryQuery (dipakai bareng tab Foto Inventory di halaman Laporan).
        $query = FotoInventoryQuery::pemakai($request->user(), $request->input('type'), $request->input('search'));

        $perPage = max(10, (int) $request->input('per_page', 12));
        $data = $query->paginate($perPage);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    /**
     * POST /api/inventory/{inventory}/pemakai
     * [F5-INERTIA] Logika di InventoryPemakaiAction::serahTerima() (dipakai bareng versi web). Frontend halaman sudah
     * pindah ke POST /master-data/inventory/{inventory}/pemakai; endpoint ini dihapus di F10.
     */
    public function store(Request $request, Inventory $inventory)
    {
        $pemakai = $this->pemakai->serahTerima($request, $inventory);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    /**
     * POST /api/inventory-pemakai/{inventoryPemakai}/kembalikan
     * Admin ATAU pemakainya sendiri. Otorisasi tetap dicek di sini (controller); logika di
     * InventoryPemakaiAction::kembalikan().
     */
    public function kembalikan(Request $request, InventoryPemakai $inventoryPemakai)
    {
        $this->pemakai->pastikanBolehKembalikan($request->user(), $inventoryPemakai);

        $hasil = $this->pemakai->kembalikan($request, $inventoryPemakai);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }

    /**
     * DELETE /api/inventory-pemakai/{inventoryPemakai}
     * Admin: hapus satu entri riwayat pemakaian. Logika di InventoryPemakaiAction::hapus().
     */
    public function destroy(InventoryPemakai $inventoryPemakai)
    {
        $this->pemakai->hapus($inventoryPemakai);

        return redirect()->back()->with('success', 'Operasi berhasil.');
    }
}