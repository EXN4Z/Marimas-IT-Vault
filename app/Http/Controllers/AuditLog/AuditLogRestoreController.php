<?php

namespace App\Http\Controllers\AuditLog;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MasterData\Inventory;
use App\Support\AuditSubject;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * POST /audit-log/{id}/pulihkan  (middleware: auth + role:admin + LogActivity, lihat routes/web/audit-log.php)
 *
 * Memulihkan data yang dihapus (soft delete) berdasarkan entri Audit Log penghapusannya. Data utama
 * dipulihkan dulu, lalu data yang ikut terhapus di aksi yang sama (meta.ikut_terhapus). Gagal -> error bag
 * key "pulihkan" (tampil sebagai toast di halaman Audit Log); semua-atau-tidak-sama-sekali (transaksi).
 */
class AuditLogRestoreController extends Controller
{
    /** Relasi yang harus aktif (tidak sedang terhapus) sebelum data boleh dipulihkan: relasi => label. */
    private const DEPENDENSI = [
        'inventory' => ['kategori' => 'Kategori', 'perusahaan' => 'Perusahaan', 'supplier' => 'Supplier', 'parent' => 'Induk'],
        'inventory_pemakai' => ['inventory' => 'Inventory', 'user' => 'User'],
        'inventory_penanganan' => ['inventory' => 'Inventory'],
        'user' => ['cabang' => 'Cabang', 'departemen' => 'Departemen', 'perusahaan' => 'Perusahaan'],
    ];

    public function __invoke(Request $request, int $id): RedirectResponse
    {
        $log = AuditLog::withTrashed()->findOrFail($id);

        if (!$log->subject_type || !$log->subject_id) {
            $this->tolak('Log ini tidak punya data yang bisa dipulihkan (dihapus sebelum fitur pemulihan dipasang, atau bukan aksi hapus).');
        }

        if ($log->dipulihkan_at) {
            $this->tolak('Data dari log ini sudah dipulihkan.');
        }

        $meta = $log->meta ?? [];
        $daftar = array_merge(
            [['type' => $log->subject_type, 'id' => $log->subject_id]],
            $meta['ikut_terhapus'] ?? []
        );

        $label = '';

        DB::transaction(function () use ($daftar, $meta, $log, $request, &$label) {
            foreach ($daftar as $urutan => $item) {
                $jenis = (string) $item['type'];
                $utama = $urutan === 0;
                $model = AuditSubject::cari($jenis, (int) $item['id']);

                if (!$model) {
                    if ($utama) {
                        $this->tolak('Data aslinya sudah tidak ada (terhapus permanen), jadi tidak bisa dipulihkan.');
                    }
                    continue;
                }

                if (!$model->trashed()) {
                    if ($utama) {
                        $this->tolak('Data ini sudah aktif kembali.');
                    }
                    continue;
                }

                $this->pastikanAmanDipulihkan($jenis, $model);
                $this->pastikanDependensiAktif($jenis, $model);
                $model->restore();

                if ($utama) {
                    $this->pasangKembaliAnak($jenis, $model, $meta);
                    $label = (AuditSubject::LABEL[$jenis] ?? $jenis) . ' ' . self::namaData($model);
                }
            }

            $log->forceFill([
                'dipulihkan_at' => now(),
                'dipulihkan_oleh' => $request->user()?->id,
            ])->save();
        });

        $nama = $request->user()?->name ?? 'Admin';
        // Dibaca LogActivity supaya entri audit-nya jelas, bukan "membuat data baru di /audit-log/..".
        $request->attributes->set('audit_deskripsi', "{$nama} memulihkan {$label} dari Audit Log");

        return back()->with('success', "{$label} berhasil dipulihkan.");
    }

    /**
     * Menghapus riwayat pemakaian yang MASIH aktif (belum dikembalikan) mereset status inventory-nya jadi 'tersedia'
     * dan menutup pinjaman kelengkapannya. Membuka kembali barisnya saja akan membuat status inventory tidak sinkron
     * dengan riwayat, jadi ditolak.
     */
    private function pastikanAmanDipulihkan(string $jenis, Model $model): void
    {
        if ($jenis === 'inventory_pemakai' && $model->getAttribute('dikembalikan_at') === null) {
            $this->tolak('Riwayat pemakaian ini dihapus saat barangnya masih berstatus dipinjam, jadi tidak bisa dipulihkan otomatis (status inventory sudah di-reset). Catat ulang lewat Serah Terima.');
        }
    }

    private function pastikanDependensiAktif(string $jenis, Model $model): void
    {
        foreach (self::DEPENDENSI[$jenis] ?? [] as $relasi => $nama) {
            if (!method_exists($model, $relasi)) {
                continue;
            }

            $terkait = $model->{$relasi}()->withTrashed()->first();

            if ($terkait && $terkait->trashed()) {
                $this->tolak('Tidak bisa dipulihkan: ' . $nama . ' "' . self::namaData($terkait) . '" yang terhubung masih terhapus. Pulihkan ' . $nama . ' itu dulu lewat Audit Log.');
            }
        }
    }

    /**
     * Hapus Paksa melepas kelengkapan (anak) dari induknya sebelum induk dihapus; ids + statusnya disimpan di
     * meta.anak. Saat induk dipulihkan, kelengkapan yang MASIH lepas & belum disentuh dipasang lagi.
     */
    private function pasangKembaliAnak(string $jenis, Model $model, array $meta): void
    {
        if ($jenis !== 'inventory' || empty($meta['anak'])) {
            return;
        }

        foreach ($meta['anak'] as $anak) {
            Inventory::whereKey($anak['id'])
                ->whereNull('parent_id')
                ->where('status', 'tersedia')
                ->update([
                    'parent_id' => $model->getKey(),
                    'status' => $anak['status'] ?? 'tersedia',
                ]);
        }
    }

    private static function namaData(Model $model): string
    {
        $atribut = $model->getAttributes();

        return (string) ($atribut['kode_inventory'] ?? $atribut['nama'] ?? $atribut['name'] ?? ('#' . $model->getKey()));
    }

    private function tolak(string $pesan): never
    {
        throw ValidationException::withMessages(['pulihkan' => $pesan]);
    }
}
