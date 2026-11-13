<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pemulihan data dari Audit Log:
 *  - deleted_at (soft delete) di tabel yang datanya bisa dihapus lewat aplikasi;
 *  - audit_logs: subject_type/subject_id/meta (data apa yang terhapus) + dipulihkan_at/dipulihkan_oleh.
 */
return new class extends Migration
{
    private const TABEL = [
        'cabang',
        'perusahaan',
        'departemen',
        'kategori',
        'supplier',
        'users',
        'inventory',
        'inventory_pemakai',
        'inventory_penanganan',
    ];

    public function up(): void
    {
        foreach (self::TABEL as $tabel) {
            if (Schema::hasTable($tabel) && !Schema::hasColumn($tabel, 'deleted_at')) {
                Schema::table($tabel, function (Blueprint $table) {
                    $table->softDeletes();
                });
            }
        }

        if (!Schema::hasColumn('audit_logs', 'subject_type')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->string('subject_type', 40)->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('dipulihkan_at')->nullable();
                $table->foreignId('dipulihkan_oleh')->nullable()->constrained('users')->nullOnDelete();

                $table->index(['subject_type', 'subject_id']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('audit_logs', 'subject_type')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->dropIndex(['subject_type', 'subject_id']);
                $table->dropConstrainedForeignId('dipulihkan_oleh');
                $table->dropColumn(['subject_type', 'subject_id', 'meta', 'dipulihkan_at']);
            });
        }

        foreach (self::TABEL as $tabel) {
            if (Schema::hasTable($tabel) && Schema::hasColumn($tabel, 'deleted_at')) {
                Schema::table($tabel, function (Blueprint $table) {
                    $table->dropSoftDeletes();
                });
            }
        }
    }
};
