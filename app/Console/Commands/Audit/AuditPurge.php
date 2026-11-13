<?php

namespace App\Console\Commands\Audit;

use App\Models\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class AuditPurge extends Command
{
    protected $signature = 'audit:purge';
    protected $description = 'Hapus permanen audit log yang umurnya sudah lebih dari 1 bulan sejak dibuat';

    public function handle(): void
    {
        // Total masa hidup audit log dibatasi 1 bulan (30 hari) sejak
        // dibuat: 1 minggu pertama aktif, sisanya (sekitar 3 minggu) ada
        // di trash lewat audit:cleanup, lalu dihapus permanen di sini
        // begitu umurnya lewat 30 hari sejak created_at.
        $batas = Carbon::now()->subDays(30);

        // Log penghapusan data yang MASIH bisa dipulihkan (subject_type terisi, belum dipulihkan) disimpan lebih
        // lama (180 hari) supaya tombol "Pulihkan" di Audit Log tidak hilang bareng log-nya.
        $batasBisaDipulihkan = Carbon::now()->subDays(180);

        $count = AuditLog::onlyTrashed()
            ->where('created_at', '<', $batas)
            ->where(function ($q) use ($batasBisaDipulihkan) {
                $q->whereNull('subject_type')
                    ->orWhereNotNull('dipulihkan_at')
                    ->orWhere('created_at', '<', $batasBisaDipulihkan);
            })
            ->forceDelete();

        $this->info("{$count} audit log dihapus permanen.");
    }
}