<?php

namespace App\Console\Commands\Maintenance;

use App\Actions\Transaksi\InventoryPemakaiAction;
use App\Models\MasterData\Inventory;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Data lama bisa nyisain kelengkapan yang menempel ke induk yang lagi dipinjam tapi gak punya pemakaian aktif
 * (mis. dulu child rusak dilewati waktu serah-terima). Command ini bikinin pemakaiannya atas nama peminjam induk.
 */
#[Signature('app:sinkron-kelengkapan-pemakai {--dry-run : Cuma tampilin yang bakal dibenerin, gak nyimpen perubahan}')]
#[Description('Samakan peminjam kelengkapan yang menempel dengan peminjam induknya')]
class SinkronKelengkapanPemakai extends Command
{
    public function handle(InventoryPemakaiAction $aksi)
    {
        $dryRun = (bool) $this->option('dry-run');

        $induk = Inventory::query()
            ->whereNull('parent_id')
            ->whereHas('children')
            ->whereHas('pemakaiSaatIni')
            ->get();

        $total = 0;
        foreach ($induk as $i) {
            foreach ($aksi->sinkronkanKelengkapan($i, $dryRun) as $anak) {
                $this->line("- induk {$i->kode_inventory} -> kelengkapan {$anak->kode_inventory} (status: {$anak->status})");
                $total++;
            }
        }

        if ($total === 0) {
            $this->info('Semua kelengkapan sudah sinkron dengan induknya. Aman.');
            return;
        }

        $this->info($dryRun
            ? "$total kelengkapan bakal disinkronkan (dry-run, gak disimpen)."
            : "$total kelengkapan berhasil disinkronkan.");
    }
}
