<?php

namespace App\Actions\Shared;

use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

// Dipindah dari blok import() yang identik di Cabang/Perusahaan/Departemen/Supplier/Inventory Controller.
// Semua-atau-tidak-sama-sekali (rollback). Gagal -> ValidationException dengan error bag key "file".
class ImportExcel
{
    /**
     * @param class-string $importClass  kelas import (diinstansiasi di dalam try, seperti sebelumnya)
     * @param string       $pesanErrorDefault  dipakai kalau getErrors()[0] kosong
     * @param \Closure     $pesanSukses  fn ($import): string -- membangun pesan sukses dari objek import
     */
    public static function dalamTransaksi(string $importClass, UploadedFile $file, string $pesanErrorDefault, \Closure $pesanSukses): string
    {
        $pesanError = null;
        $pesan = null;

        DB::beginTransaction();
        try {
            $import = new $importClass();
            Excel::import($import, $file);

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? $pesanErrorDefault);
            } else {
                DB::commit();
                $pesan = $pesanSukses($import);
            }
        } catch (Exception $e) {
            DB::rollBack();
            $pesanError = 'Gagal import: ' . $e->getMessage();
        }

        if ($pesanError !== null) {
            throw ValidationException::withMessages(['file' => $pesanError]);
        }

        return $pesan;
    }
}
