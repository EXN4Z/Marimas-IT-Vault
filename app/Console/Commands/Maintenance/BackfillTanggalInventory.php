<?php

namespace App\Console\Commands\Maintenance;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillTanggalInventory extends Command
{
    protected $signature = 'inventory:backfill-tanggal';
    protected $description = 'Isi tanggal_input yang masih kosong dengan tanggal created_at inventory';

    public function handle(): int
    {
        $input = DB::table('inventory')
            ->whereNull('tanggal_input')
            ->whereNotNull('created_at')
            ->update(['tanggal_input' => DB::raw('CAST(created_at AS DATE)')]);

        $this->info("tanggal_input diisi: {$input} baris.");

        return self::SUCCESS;
    }
}