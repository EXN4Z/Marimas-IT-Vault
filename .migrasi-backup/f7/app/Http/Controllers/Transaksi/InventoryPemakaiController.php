<?php

namespace App\Http\Controllers\Transaksi;

use App\Actions\Transaksi\InventoryPemakaiAction;
use App\Http\Controllers\Controller;
use App\Models\MasterData\Inventory;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\Transaksi\InventoryWriteoff;
use Illuminate\Http\Request;

class InventoryPemakaiController extends Controller
{
    // [F5-INERTIA] store / kembalikan / destroy dipakai bareng dengan InventoryPemakaiWebController lewat Action.
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

        return response()->json($data);
    }

    public function riwayat(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user?->role === 'admin';

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(10, (int) $request->query('per_page', $request->query('limit', 10)));
        $typeFilter = $request->query('type');
        $search = trim((string) $request->query('search', ''));

        $ambil = $search !== '' ? 2000 : max(500, $page * $perPage * 2);

        $events = collect();

        $milikUser = function ($query) use ($user) {
            $query->where('user_id', $user->id);
        };

        $pemakaiQuery = InventoryPemakai::with([
            // parent_id WAJIB ikut di-select -- isChild() di bawah baca kolom
            // ini, dan tanpa di-select Eloquent balikin null diam-diam
            // (bukan exception), jadi isChild() bakal selalu false kalau
            // kolomnya kelewat.
            'inventory:id,kode_inventory,nama,kategori_id,parent_id',
            'inventory.kategori:id,nama',
            'user:id,name',
        ])->where('status', 'disetujui');

        if (!$isAdmin) {
            $milikUser($pemakaiQuery);
        }

        $pemakaiQuery
            ->latest('tanggal_penerimaan')
            ->limit($ambil)
            ->get()
            ->each(function ($p) use (&$events) {
                $nama = $p->user?->name ?? '-';
                $tipeItem = $p->inventory?->isChild() ? 'kelengkapan' : 'barang_utama';

                $events->push([
                    'type' => 'pinjam',
                    'waktu' => $p->diterima_at ?? $p->tanggal_penerimaan,
                    'nama' => $nama,
                    'inventory' => $p->inventory,
                    'tipe_item' => $tipeItem,
                ]);
                if ($p->tanggal_pengembalian) {
                    $events->push([
                        'type' => 'kembali',
                        'waktu' => $p->dikembalikan_at ?? $p->tanggal_pengembalian,
                        'nama' => $nama,
                        'inventory' => $p->inventory,
                        'tipe_item' => $tipeItem,
                    ]);
                }
            });

        $penangananQuery = InventoryPenanganan::with([
            // parent_id ditambahin biar isChild() di bawah (dipakai nentuin
            // tipe_item lapor_rusak/mulai_perbaikan/selesai_perbaikan) punya
            // data yang dibutuhkan -- sama kayak alasan di pemakaiQuery di atas.
            'inventory:id,kode_inventory,nama,parent_id',
            'pemakai.user:id,name',
        ]);

        if (!$isAdmin) {
            // laporan kerusakan gak punya user_id langsung — nempel ke
            // InventoryPemakai lewat inventory_pemakai_id, jadi filternya
            // lewat relasi 'pemakai'. Laporan hasil audit gudang (pemakai
            // null) otomatis kepotong karena whereHas butuh relasi itu ada.
            $penangananQuery->whereHas('pemakai', $milikUser);
        }

        $penangananQuery
            ->latest('tanggal_lapor')
            ->limit($ambil)
            ->get()
            ->each(function ($pn) use (&$events) {
                $namaPelapor = $pn->pemakai?->user?->name ?? null;
                // REVISI: sejak Fase 2, alur InventoryPenanganan berlaku buat
                // item apapun (induk maupun menempel), jadi tipe_item gak
                // boleh hardcode -- diturunkan dari isChild() sama kayak
                // block pinjam/kembali di atas.
                $tipeItemPn = $pn->inventory?->isChild() ? 'kelengkapan' : 'barang_utama';

                $events->push([
                    'type' => 'lapor_rusak',
                    'waktu' => $pn->lapor_at ?? $pn->tanggal_lapor,
                    'nama' => $namaPelapor,
                    'inventory' => $pn->inventory,
                    'tipe_item' => $tipeItemPn,
                    'keluhan' => $pn->keluhan,
                ]);
                if ($pn->tanggal_diterima) {
                    $events->push([
                        'type' => 'mulai_perbaikan',
                        'waktu' => $pn->diterima_at ?? $pn->tanggal_diterima,
                        'nama' => null,
                        'inventory' => $pn->inventory,
                        'tipe_item' => $tipeItemPn,
                    ]);
                }
                if ($pn->tanggal_selesai) {
                    $events->push([
                        'type' => 'selesai_perbaikan',
                        'waktu' => $pn->selesai_at ?? $pn->tanggal_selesai,
                        'nama' => null,
                        'inventory' => $pn->inventory,
                        'tipe_item' => $tipeItemPn,
                        'hasil' => $pn->hasil,
                    ]);
                }
            });

        // 'dijual' cuma buat admin — keputusan writeoff bukan aktivitas
        // pribadi karyawan mana pun, gak relevan buat riwayat pribadinya.
        // Writeoff/jual cuma dikenal buat Barang Utama.
        if ($isAdmin) {
            InventoryWriteoff::with(['inventory:id,kode_inventory,nama', 'penyetuju:id,name'])
                ->latest('tanggal_writeoff')
                ->limit($ambil)
                ->get()
                ->each(function ($w) use (&$events) {
                    $events->push([
                        'type' => 'dijual',
                        'waktu' => $w->created_at ?? $w->tanggal_writeoff,
                        'nama' => $w->penyetuju?->name,
                        'inventory' => $w->inventory,
                        'tipe_item' => 'barang_utama',
                        'keluhan' => $w->alasan,
                    ]);
                });
        }

        $sorted = $events
            ->sortByDesc(fn ($ev) => $ev['waktu'] instanceof \Carbon\Carbon ? $ev['waktu'] : \Carbon\Carbon::parse($ev['waktu']))
            ->values();

        if ($typeFilter) {
            $sorted = $sorted->where('type', $typeFilter)->values();
        }

        if ($search !== '') {
            $needle = mb_strtolower($search);
            $sorted = $sorted->filter(function ($ev) use ($needle) {
                $item = $ev['inventory'] ?? null;
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $ev['nama'] ?? '',
                    $item?->kode_inventory ?? '',
                    $item?->nama ?? '',
                ])));

                return str_contains($haystack, $needle);
            })->values();
        }

        $total = $sorted->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $data = $sorted->forPage($page, $perPage)->values();

        return response()->json([
            'data' => $data,
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'per_page' => $perPage,
        ]);
    }

    /**
     * GET /api/inventory-pemakai/foto — list semua record serah-terima/
     * pengembalian yang punya foto, buat halaman galeri. Admin lihat semua;
     * role lain cuma punya sendiri.
     */
    public function foto(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user->role === 'admin';

        $type = $request->input('type');

        $query = InventoryPemakai::with(['inventory', 'user'])
            ->when(
                $type === 'peminjaman',
                fn ($q) => $q->whereNotNull('foto_penerimaan'),
                fn ($q) => $q->when(
                    $type === 'pengembalian',
                    fn ($q2) => $q2->whereNotNull('foto_pengembalian'),
                    fn ($q2) => $q2->where(function ($qq) {
                        $qq->whereNotNull('foto_penerimaan')
                            ->orWhereNotNull('foto_pengembalian');
                    })
                )
            )
            ->orderByDesc('created_at');

        if (!$isAdmin) {
            $query->where('user_id', $user->id);
        }

        if ($search = $request->input('search')) {
            $query->whereHas('inventory', function ($qq) use ($search) {
                $qq->where('kode_inventory', 'like', "%{$search}%")
                    ->orWhere('nama', 'like', "%{$search}%");
            });
        }

        $perPage = max(10, (int) $request->input('per_page', 12));
        $data = $query->paginate($perPage);

        return response()->json($data);
    }

    /**
     * POST /api/inventory/{inventory}/pemakai
     * [F5-INERTIA] Logika di InventoryPemakaiAction::serahTerima() (dipakai bareng versi web). Frontend halaman sudah
     * pindah ke POST /master-data/inventory/{inventory}/pemakai; endpoint ini dihapus di F10.
     */
    public function store(Request $request, Inventory $inventory)
    {
        $pemakai = $this->pemakai->serahTerima($request, $inventory);

        return response()->json($pemakai->load('user', 'inventory'), 201);
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

        return response()->json($hasil->load('user', 'inventory'));
    }

    /**
     * DELETE /api/inventory-pemakai/{inventoryPemakai}
     * Admin: hapus satu entri riwayat pemakaian. Logika di InventoryPemakaiAction::hapus().
     */
    public function destroy(InventoryPemakai $inventoryPemakai)
    {
        $this->pemakai->hapus($inventoryPemakai);

        return response()->json(['message' => 'Riwayat pemakaian berhasil dihapus.']);
    }
}