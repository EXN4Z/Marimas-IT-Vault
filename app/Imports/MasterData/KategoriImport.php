<?php

namespace App\Imports\MasterData;

use App\Models\MasterData\Kategori;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;

/**
 * Import Excel data referensi Kategori (Master Data).
 *
 * Format kolom yang diharapkan (baris pertama = header, nama kolom bebas
 * huruf besar/kecil & spasi, dinormalisasi otomatis ke snake_case):
 *   Nama  (atau "Nama Kategori" -- header yang dipakai fitur Export
 *   Excel Kategori sendiri, supaya file hasil export bisa diimport balik)
 *
 * Nama dicocokkan tanpa membedakan huruf besar/kecil. Kalau kategori dengan
 * nama itu sudah ada (di database atau di baris sebelumnya pada file yang
 * sama), baris dilewati (dihitung "dilewati", BUKAN error) supaya import
 * ulang file yang sama aman/idempotent.
 */
class KategoriImport implements ToCollection
{
    private const KOLOM_PENANDA_HEADER = 'nama';
    private const ALIAS_KOLOM_NAMA = ['nama', 'nama_kategori'];
    private const MAX_BARIS_DISCAN = 10;
    private const MAX_PANJANG_NAMA = 255;

    protected int $createdCount = 0;
    protected int $skippedCount = 0;
    protected array $errors = [];

    public function collection(Collection $rows)
    {
        $indexHeader = $this->cariBarisHeader($rows);

        if ($indexHeader === null) {
            $this->errors[] = 'Tidak menemukan baris header (kolom "Nama") di ' . self::MAX_BARIS_DISCAN . ' baris pertama.';
            return;
        }

        $headers = $rows[$indexHeader]
            ->map(fn ($h) => $this->normalisasiHeader((string) $h))
            ->map(fn ($h) => in_array($h, self::ALIAS_KOLOM_NAMA, true) ? self::KOLOM_PENANDA_HEADER : $h)
            ->toArray();

        // Daftar nama yang sudah ada (huruf kecil) -- dimuat sekali, lalu ditambah tiap kategori baru
        // supaya nama kembar di file yang sama juga terdeteksi.
        $sudahAda = Kategori::pluck('nama')
            ->map(fn ($n) => mb_strtolower(trim((string) $n)))
            ->flip()
            ->all();

        foreach ($rows->slice($indexHeader + 1) as $index => $rawRow) {
            $rowArray = $rawRow->toArray();

            if (count(array_filter($rowArray, fn ($v) => $v !== null && $v !== '')) === 0) {
                continue; // baris kosong, lewati diam-diam
            }

            if ($this->adalahBarisFooter($rowArray)) {
                continue; // baris footer disclaimer hasil Export Excel, lewati diam-diam
            }

            $row = array_combine($headers, array_pad($rowArray, count($headers), null));
            $nama = trim((string) ($row['nama'] ?? ''));

            if ($nama === '') {
                $this->errors[] = 'Baris data ke-' . ($index + 1) . ': kolom Nama kosong, dilewati.';
                continue;
            }

            if (mb_strlen($nama) > self::MAX_PANJANG_NAMA) {
                $this->errors[] = 'Baris data ke-' . ($index + 1) . ': nama kategori lebih dari ' . self::MAX_PANJANG_NAMA . ' karakter.';
                continue;
            }

            $kunci = mb_strtolower($nama);

            if (isset($sudahAda[$kunci])) {
                $this->skippedCount++;
                continue;
            }

            try {
                Kategori::create(['nama' => $nama]);
                $sudahAda[$kunci] = true;
                $this->createdCount++;
            } catch (\Exception $e) {
                $this->errors[] = 'Baris data ke-' . ($index + 1) . ' ("' . $nama . '"): ' . $e->getMessage();
            }
        }
    }

    // Footer disclaimer otomatis dari fitur Export Excel ("Dokumen digenerate otomatis oleh ...").
    private function adalahBarisFooter(array $rowArray): bool
    {
        $gabungan = strtolower(implode(' ', array_map('strval', $rowArray)));

        return str_contains($gabungan, 'digenerate otomatis');
    }

    private function cariBarisHeader(Collection $rows): ?int
    {
        $batas = min(self::MAX_BARIS_DISCAN, $rows->count());

        for ($i = 0; $i < $batas; $i++) {
            $selDinormalisasi = $rows[$i]->map(fn ($v) => $this->normalisasiHeader((string) $v));

            if ($selDinormalisasi->intersect(self::ALIAS_KOLOM_NAMA)->isNotEmpty()) {
                return $i;
            }
        }

        return null;
    }

    private function normalisasiHeader(string $header): string
    {
        // Buang BOM & samakan spasi "tak kelihatan" (NBSP, zero-width, dsb) jadi spasi biasa.
        $header = str_replace("\xEF\xBB\xBF", '', $header);
        $header = preg_replace('/[\x{00A0}\x{200B}\x{FEFF}]/u', ' ', $header);

        $header = trim($header);
        $header = strtolower($header);
        $header = preg_replace('/[\s\-]+/', '_', $header);
        $header = preg_replace('/[^a-z0-9_]/', '', $header);
        return trim($header, '_');
    }

    public function getCreatedCount(): int
    {
        return $this->createdCount;
    }

    public function getSkippedCount(): int
    {
        return $this->skippedCount;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}