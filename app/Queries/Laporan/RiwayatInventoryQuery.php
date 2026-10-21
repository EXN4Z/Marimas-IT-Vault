<?php

namespace App\Queries\Laporan;

use App\Models\Transaksi\InventoryPemakai;
use App\Models\Transaksi\InventoryPenanganan;
use App\Models\Transaksi\InventoryWriteoff;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * [F7-INERTIA] Riwayat aktivitas inventory (pinjam/kembali/lapor_rusak/mulai_perbaikan/selesai_perbaikan/dijual), dipakai bareng oleh:
 *  - Web : App\Http\Controllers\Laporan\LaporanPageController (props tab Riwayat Inventory)
 *
 * Isi ambil() dipindah APA ADANYA dari InventoryPemakaiController::riwayat():
 * admin = riwayat global; non-admin = cuma aktivitas yang terkait pemakaian dia sendiri (user_id == dia).
 */
class RiwayatInventoryQuery
{
    /** Parameter query string API lama: page, per_page (alias limit), type, search. */
    public static function dariRequest(Request $request): array
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(10, (int) $request->query('per_page', $request->query('limit', 10)));
        $typeFilter = $request->query('type');
        $search = trim((string) $request->query('search', ''));

        return self::ambil($request->user(), $typeFilter, $search, $page, $perPage);
    }

    /**
     * @return array{data: array, current_page: int, last_page: int, total: int, per_page: int}
     */
    public static function ambil(?User $user, $typeFilter, string $search, int $page, int $perPage): array
    {
        $isAdmin = $user?->role === 'admin';

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

        return [
            'data' => $data->all(),
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'per_page' => $perPage,
        ];
    }
}
