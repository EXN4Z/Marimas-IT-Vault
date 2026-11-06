<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Versi SQUASHED. Kolom `aset_kelengkapan_id` dan `pekerja_id` yang ada
 * di riwayat migrasi lama sudah di-drop lagi belakangan (lihat
 * App\Models\Transaksi\InventoryPemakai) -- tidak ikut dibuat di sini.
 *
 * inventory_id dibuat nullable + nullOnDelete (bukan cascadeOnDelete
 * seperti pembuatan awal di riwayat lama) supaya konsisten dengan niat
 * akhir yang eksplisit ditulis di migration rename kolomnya dulu -- kalau
 * baris inventory dihapus, riwayat pemakaian TIDAK ikut kehapus, cuma
 * inventory_id-nya jadi null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_pemakai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->nullable()->constrained('inventory')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('diserahkan_oleh')->nullable()->constrained('users')->nullOnDelete();

            $table->string('nomor_penerimaan')->nullable();
            $table->json('foto_penerimaan')->nullable();
            $table->dateTime('diterima_at')->nullable();
            $table->text('catatan_penerimaan')->nullable();

            $table->string('nomor_pengembalian')->nullable();
            $table->json('foto_pengembalian')->nullable();
            $table->dateTime('dikembalikan_at')->nullable();
            $table->text('catatan_pengembalian')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_pemakai');
    }
};
