<?php

namespace App\Queries\Dashboard;

use App\Models\MasterData\Inventory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use App\Queries\MasterData\InventoryQuery;
use App\Queries\Laporan\RiwayatInventoryQuery;

/**
 * [F8-INERTIA] Data dashboard (dulu dihitung di klien dari beberapa request axios), sekarang dihitung server dan dikirim
 * sebagai props oleh App\Http\Controllers\Dashboard\DashboardController. Angka & aturan dipindah APA ADANYA dari
 * pages/dashboard/useDashboardData.ts (bucket status, 6 bulan terakhir, garansi <= 30 hari, dst).
 *  - departemen() juga dipakai API lama DashboardController::KaryawanPerDepart (dihapus di F10).
 */
class DashboardQuery
{
    private const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    private const STATUS_LABEL = [
        'tersedia' => 'Tersedia',
        'dipakai' => 'Dipakai',
        'menunggu_perbaikan' => 'Menunggu Perbaikan',
        'diperbaiki' => 'Diperbaiki',
        'rusak_berat' => 'Rusak Berat',
        'dijual' => 'Dijual',
    ];

    private const GARANSI_WARNING_HARI = 30;

    /** Jumlah karyawan per departemen (+ percent terhadap departemen terbesar). */
    public static function departemen()
    {
        $query = User::join('departemen', 'users.departemen_id', '=', 'departemen.id')
            ->select(
                'departemen.nama as departemen',
                DB::raw('COUNT(users.id) as jumlah')
            );

        $karyawan = $query->groupBy('departemen.nama')->get();

        $maxJumlah = $karyawan->max('jumlah') ?: 1; // fallback 1 biar ga divide by zero

        $karyawan = $karyawan->map(function ($item) use ($maxJumlah) {
            $item->percent = round(($item->jumlah / $maxJumlah) * 100);
            return $item;
        });

        return $karyawan;
    }

    /** Props dashboard ADMIN (lintas-perusahaan). Inventory = SEMUA item, termasuk kelengkapan. */
    public static function admin(User $user): array
    {
        $list = Inventory::query()->get(['id', 'status', 'nama', 'tanggal_invoice', 'tanggal_garansi']);

        $tersedia = $dipakai = $rusakBerat = $dijual = 0;
        $rusak = $dalamPenanganan = $garansiSegeraHabis = 0;
        $perNama = [];
        $perStatus = [];
        $now = time();
        $batas = self::GARANSI_WARNING_HARI * 24 * 60 * 60;

        // 6 bulan terakhir (termasuk bulan ini), jumlah inventory yang tanggal_invoice-nya jatuh di bulan itu
        $bulan = [];
        for ($i = 5; $i >= 0; $i--) {
            $d = Carbon::now()->startOfMonth()->subMonthsNoOverflow($i);
            $bulan[$d->format('Y-n')] = ['bulan' => self::BULAN_ID[$d->month - 1], 'jumlah' => 0];
        }

        foreach ($list as $a) {
            switch ($a->status) {
                case 'tersedia': $tersedia++; break;
                case 'dipakai': case 'menunggu_perbaikan': case 'diperbaiki': $dipakai++; break;
                case 'rusak_berat': $rusakBerat++; break;
                case 'dijual': $dijual++; break;
            }

            if ($a->status === 'rusak_berat') $rusak++;
            if ($a->status === 'menunggu_perbaikan' || $a->status === 'diperbaiki') $dalamPenanganan++;

            if ($a->tanggal_garansi) {
                $sisa = Carbon::parse($a->tanggal_garansi)->getTimestamp() - $now;
                if ($sisa >= 0 && $sisa <= $batas) $garansiSegeraHabis++;
            }

            $nama = trim((string) $a->nama) ?: 'Tanpa Nama';
            $perNama[$nama] = ($perNama[$nama] ?? 0) + 1;

            $label = self::STATUS_LABEL[$a->status] ?? $a->status;
            $perStatus[$label] = ($perStatus[$label] ?? 0) + 1;

            if ($a->tanggal_invoice) {
                $key = Carbon::parse($a->tanggal_invoice)->format('Y-n');
                if (isset($bulan[$key])) $bulan[$key]['jumlah']++;
            }
        }

        arsort($perNama); // urutan stabil: yang jumlahnya sama tetap urut kemunculan
        $inventoryPerMerek = [];
        foreach ($perNama as $nama => $jumlah) {
            $inventoryPerMerek[] = ['nama' => (string) $nama, 'jumlah' => $jumlah];
        }

        $statusDistribusi = [];
        foreach (self::STATUS_LABEL as $label) {
            if (($perStatus[$label] ?? 0) > 0) $statusDistribusi[] = ['status' => $label, 'jumlah' => $perStatus[$label]];
        }

        return [
            'ringkasanInventory' => [
                'total' => $list->count(),
                'tersedia' => $tersedia,
                'dipakai' => $dipakai,
                'rusakBerat' => $rusakBerat,
                'dijual' => $dijual,
            ],
            'inventoryPerMerek' => $inventoryPerMerek,
            'inventoryPerhatian' => ['rusak' => $rusak, 'dalamPenanganan' => $dalamPenanganan, 'garansiSegeraHabis' => $garansiSegeraHabis],
            'trenPembelianInventory' => array_values($bulan),
            'statusInventoryDistribusi' => $statusDistribusi,
            'aktivitasKalender' => self::aktivitas($user),
            'departemen' => self::departemen()->all(),
        ];
    }

    /**
     * Props dashboard NON-ADMIN: cuma data milik user sendiri. Daftar inventory dibatasi InventoryQuery::batasiUntuk()
     * (item 'tersedia' + yang lagi dipegang user), riwayat dibatasi RiwayatInventoryQuery (milik sendiri).
     */
    public static function pribadi(User $user): array
    {
        $list = InventoryQuery::batasiUntuk(InventoryQuery::dasar(), $user)->get();

        $sedangDipinjam = 0;
        $totalTersedia = 0;
        $sedangDipegang = [];
        foreach ($list as $a) {
            if ($a->pemakaiSaatIni?->user_id === $user->id) {
                $sedangDipinjam++;
                $sedangDipegang[] = [
                    'id' => $a->id,
                    'kode_inventory' => $a->kode_inventory,
                    'nama' => $a->nama,
                    'sejak' => ($a->pemakaiSaatIni->diterima_at ?? $a->pemakaiSaatIni->tanggal_penerimaan)?->toIso8601String(),
                ];
            }
            if ($a->status === 'tersedia') $totalTersedia++;
        }

        $kalender = self::aktivitas($user);

        return [
            'sedangDipinjam' => $sedangDipinjam,
            'sedangDipegang' => $sedangDipegang,
            'totalTersedia' => $totalTersedia,
            'totalPernahDipinjam' => RiwayatInventoryQuery::ambil($user, 'pinjam', '', 1, 10)['total'],
            'totalLaporRusak' => RiwayatInventoryQuery::ambil($user, 'lapor_rusak', '', 1, 10)['total'],
            'aktivitasTerbaru' => array_slice($kalender, 0, 5), // feed yang sama (halaman 1, urutan terbaru), dipotong 5
            'aktivitasKalender' => $kalender,
        ];
    }

    /** 200 aktivitas inventory terbaru (sumber sama dengan tab Riwayat Inventory, scoping role di RiwayatInventoryQuery). */
    private static function aktivitas(User $user): array
    {
        return RiwayatInventoryQuery::ambil($user, null, '', 1, 200)['data'];
    }
}
