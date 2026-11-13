<?php

namespace App\Imports\MasterData;

use App\Support\Concerns\GeneratesStrukNumber;
use App\Models\MasterData\Inventory;
use App\Models\MasterData\Kategori;
use App\Models\MasterData\Departemen;
use App\Models\MasterData\Supplier;
use App\Models\Transaksi\InventoryPemakai;
use App\Models\User;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InventoryBuktiImport implements ToCollection, WithCalculatedFormulas
{
    use GeneratesStrukNumber;

    protected $rowCount = 0;
    protected $errors = [];

    private const MAX_BARIS_DISCAN = 10;

    /**
     * Nama kolom (setelah dinormalisasi) yang menandai baris header --
     * dicek pakai OR (baris dianggap header kalau salah satu dari kolom ini
     * ada). 'kode_inventory' ditambahkan supaya file dengan format lain
     * (mis. hasil export "Data Inventory" yang gak punya kolom "No Bukti",
     * tapi punya "Kode Inventory") tetap kedetect headernya.
     */
    private const KOLOM_PENANDA_HEADER = ['no_bukti', 'kode_inventory'];

    /**
     * Nama kolom (setelah dinormalisasi) yang menandai FORMAT FLAT --
     * 1 baris = 1 barang langsung (kolom "Nama" tunggal), dipakai kalau
     * file gak punya kolom "Nama Barang 1", "Nama Barang 2", dst (format
     * Bukti Serah Terima yang lama). Lihat procesBarisFlat().
     */
    private const KOLOM_NAMA_FLAT = 'nama';

    private array $perusahaanIdCache = [];

    /**
     * Daftar kode_inventory yang sudah ada di database (huruf kecil), dimuat
     * SEKALI di awal lewat kodeSudahAda() -- bukan query per baris. Kode yang
     * baru berhasil diimport di file ini juga ditambahkan ke sini, supaya kode
     * kembar di dalam file yang sama gak masuk dua kali.
     */
    private array $kodeSudahAda = [];
    private bool $kodeSudahAdaDimuat = false;

    /** Jumlah baris format flat yang dilewati karena kode_inventory sudah ada. */
    private int $jumlahDilewati = 0;

    private const PETA_KATEGORI_KEYWORDS = [
        'Baterai'         => ['baterai', 'battery', 'lithium'],
        'Bag'             => ['backpack', 'slingbag', 'tas '],
        'Drawing Pad'     => ['wacom', 'intuos', 'drawing pad'],
        'Docking'         => ['wall mount', 'docking', 'modular'],
        'Hdd External'    => ['my passport', 'hdd', 'hard disk', 'external'],
        'Modem'           => ['modem', 'orbit', 'mifi', 'router'],
        'Proyektor'       => ['proyektor', 'projector', 'eb-x', 'view sonic', 'viewsonic'],
        'Speaker'         => ['speaker', 'soundbar'],
        'Scanner Barcode' => ['scanner', 'barcode', 'pm450', 'point mobile'],
        'Case'            => ['case'],
        'Charger'         => ['charger', 'adaptor', 'adapter'],
        'Pointer'         => ['pointer', 'presenter'],
        'Laptop'          => [
            'ideapad', 'notebook', 'thinkpad', 'zenbook', 'vivobook',
            'probook', 'elitebook', 'macbook', 'v14', 'v15', 'legion',
            'yoga', 'inspiron', 'latitude', 'pavilion', 'envy', 'spectre',
            '14s-', 'a1400ea',
        ],
    ];

    private array $kategoriIdCache = [];

    /**
     * REVISI (refactor kategori bebas): dulu di sini ada 2 konstanta nama
     * kategori ("Barang Utama"/"Kelengkapan") yang dipakai buat nge-lookup
     * kategori_id lewat Kategori::where('nama', ...)->firstOrFail(). Sejak
     * migration `reset_and_seed_kategori_baru` (Fase 0 refactor kategori
     * bebas), 2 baris kategori itu SUDAH DIHAPUS dari tabel `kategori` --
     * jadi kode lama itu bakal selalu throw ModelNotFoundException tiap
     * baris diimport (bug, sudah kejadian, sekarang difix).
     *
     * Excel sumber file bukti serah-terima gak punya kolom "Kategori" sama
     * sekali -- struktur induk/kelengkapan cuma bisa ditentukan dari POSISI
     * KOLOM (lihat NOMOR_KOLOM_ASET_UTAMA), bukan dari nama kategori. Karena
     * kategori sekarang cuma label bebas yang gak menentukan struktur data
     * apa pun, dan kita gak punya info kategori sebenarnya dari Excel-nya,
     * semua baris hasil import (barang utama maupun kelengkapan) untuk
     * sementara ditaruh di 1 kategori fallback ini (get-or-create, gak akan
     * pernah throw). Admin bisa recategorize manual belakangan lewat
     * halaman Inventory kalau perlu.
     */
    private const NAMA_KATEGORI_FALLBACK_IMPORT = 'Belum Dikategorikan';

    private const PETA_PERUSAHAAN_SINGKATAN = [
        'MPK' => 'PT. Marimas Putera Kencana',
        'UTH' => 'PT. Ulam Tiba Halim',
    ];

    /**
     * Nomor kolom "Nama Barang N" yang dianggap BARANG UTAMA. Semua kolom
     * "Nama Barang" dengan nomor lain (2, 3, dst) otomatis dianggap
     * KELENGKAPAN dari barang utama terakhir yang diproses di baris yang
     * sama -- terlepas dari isi namanya ("Charger", "Tas", "Modem",
     * apapun). Ini gantiin deteksi berbasis kata kunci (cocokAksesoris)
     * yang dulu dipakai, karena posisi kolom di Excel sumber sudah pasti
     * konsisten: kolom pertama = barang utama, kolom berikutnya = barang
     * yang menyertai/melengkapi barang utama itu.
     */
    private const NOMOR_KOLOM_ASET_UTAMA = 1;

    private const WARNA_KEYWORDS = [
        'black', 'white', 'silver', 'grey', 'gray', 'blue', 'red', 'green',
        'yellow', 'pink', 'purple', 'gold', 'navy', 'cream', 'orange',
        'coklat', 'cokelat', 'putih', 'hitam', 'merah', 'biru', 'kuning',
        'hijau', 'ungu', 'abu-abu', 'abu',
    ];

    private const KETERANGAN_PREFIX_DIABAIKAN = '/^\s*(model|imei|p\s*\/?\s*n)\b/i';

    /**
     * Nilai yang sering dipakai di Excel sumber buat nandain "tidak ada
     * data" di kolom Nama Barang (mis. sel cuma diisi "-" biar nggak
     * kosong secara visual / gampang ke-scroll), TAPI bukan nama barang
     * beneran. Tanpa ditangani khusus, nilai-nilai ini lolos empty() check
     * (string non-kosong) dan kebikin jadi baris Inventory dengan nama
     * literal "-" dsb. Dicocokkan case-insensitive & setelah di-trim
     * lewat namaBarangKosong().
     */
    private const NILAI_PLACEHOLDER_NAMA_KOSONG = ['-', '--', '---', 'n/a', 'na', '.', 'kosong'];

    /**
     * Cache id kategori fallback (NAMA_KATEGORI_FALLBACK_IMPORT) supaya gak
     * query/create ke tabel kategori berulang-ulang tiap baris/kolom yang
     * diproses dalam satu proses import. Diisi lazy lewat kategoriIdFallback().
     */
    private ?int $kategoriIdFallbackCache = null;

    /**
     * Titik masuk dari Maatwebsite Excel. Pekerjaan sebenarnya ada di
     * prosesSemua(); di sini hanya ditambah RINGKASAN HASIL ke
     * storage/logs/laravel.log supaya kelihatan berapa baris yang masuk,
     * berapa yang dilewati, dan apa saja error-nya -- walaupun controller
     * tidak menampilkannya di layar.
     */
    public function collection(Collection $rows)
    {
        $this->prosesSemua($rows);

        Log::info('IMPORT selesai', [
            'ditambahkan'             => $this->rowCount,
            'dilewati_kode_sudah_ada' => $this->jumlahDilewati,
            'jumlah_error'            => count($this->errors),
            'errors'                  => $this->errors,
        ]);
    }

    private function prosesSemua(Collection $rows): void
    {
        $indexHeader = $this->cariBarisHeader($rows);

        if ($indexHeader === null) {
            $this->errors[] = 'Tidak menemukan baris header (kolom "No Bukti" atau "Kode Inventory") di ' . self::MAX_BARIS_DISCAN . ' baris pertama.';
            return;
        }

        $headers = $rows[$indexHeader]
            ->map(fn ($h) => $this->normalisasiHeader((string) $h))
            ->toArray();

        Log::info('Header Excel Bukti Inventory terbaca:', $headers);

        $nomorBarang = $this->cariNomorBarang($headers);
        $dataRows = $rows->slice($indexHeader + 1);

        Log::info('IMPORT: jumlah baris data = ' . $dataRows->count());

        // Format lama (Bukti Serah Terima) -- ada kolom "Nama Barang 1",
        // "Nama Barang 2", dst.
        if (!empty($nomorBarang)) {
            $this->procesBarisBuktiSerahTerima($dataRows, $headers, $nomorBarang);
            return;
        }

        // Format flat -- gak ada "Nama Barang N", tapi ada kolom "Nama"
        // tunggal (1 baris = 1 barang, mis. hasil export "Data Inventory").
        // Lihat procesBarisFlat() untuk detail asumsi pemetaan kolomnya.
        if (in_array(self::KOLOM_NAMA_FLAT, $headers, true)) {
            $this->procesBarisFlat($dataRows, $headers);
            return;
        }

        $this->errors[] = 'Tidak menemukan kolom barang (pola "Nama Barang 1", "Nama Barang 2", dst) maupun kolom "Nama" (format flat).';
    }

    /**
     * Proses baris data format LAMA (Bukti Serah Terima) -- 1 baris bisa
     * berisi beberapa barang lewat kolom "Nama Barang 1", "Nama Barang 2",
     * dst, dengan info bukti (No Bukti, Departemen, Penerima, dst) yang
     * sama buat semua barang di baris itu. Logic-nya SAMA PERSIS seperti
     * sebelum ditambahkannya format flat -- cuma dipindah ke method sendiri
     * biar collection() bisa cabang ke 2 format tanpa isinya campur aduk.
     */
    private function procesBarisBuktiSerahTerima(Collection $dataRows, array $headers, array $nomorBarang): void
    {
        foreach ($dataRows as $index => $rawRow) {
            try {
                DB::transaction(function () use ($rawRow, $headers, $nomorBarang, $index) {
                    $rowArray = $rawRow->toArray();

                    if (count(array_filter($rowArray, fn ($v) => $v !== null && $v !== '')) === 0) {
                        return;
                    }

                    if ($this->adalahBarisFooter($rowArray)) {
                        return; // baris footer disclaimer hasil Export Excel, lewati diam-diam
                    }

                    $row = array_combine(
                        $headers,
                        array_pad($rowArray, count($headers), null)
                    );

                    if (empty($row['no_bukti'])) {
                        return;
                    }

                    $namaDepartemen = $this->nilaiAtauNull($row['departemen'] ?? null);
                    $departemenId = null;

                    if ($namaDepartemen !== null) {
                        $departemenId = Departemen::firstOrCreate(['nama' => $namaDepartemen])->id;
                    }

                    $infoBukti = [
                        'kode_inventory' => $row['kode_inventory'] ?? null,
                        'tanggal'        => $this->parseTanggal($row['tanggal'] ?? null),
                        'perusahaan_id'  => $this->perusahaanIdDariSingkatan($row['perusahaan'] ?? null, $index + 1),
                        'nik'            => $row['nik'] ?? null,
                        'penerima'       => $row['penerima'] ?? null,
                        'diterima_oleh'  => $row['diterima_oleh'] ?? null,
                        'diketahui'      => $row['diketahui'] ?? null,
                        'dibuat_oleh'    => $row['dibuat_oleh'] ?? null,
                        'diketahui_hrd'  => $row['diketahui_hrd'] ?? null,
                    ];

                    $namaSupplier = $this->nilaiAtauNull($row['supplier'] ?? null);
                    $supplierId = null;

                    if ($namaSupplier !== null) {
                        $supplierId = Supplier::firstOrCreate(['nama' => $namaSupplier])->id;
                    }

                    $namaPenerima = trim((string) ($row['penerima'] ?? ''));
                    $nikPenerima = trim((string) ($row['nik'] ?? ''));
                    $penerimaUser = null;

                    if ($namaPenerima !== '') {
                        if ($nikPenerima !== '') {
                            $penerimaUser = User::where('nik', $nikPenerima)->first();

                            if (!$penerimaUser) {
                                // Pekerja::create() dulu bikin row minimal tanpa akun
                                // login/password. Sekarang pekerja = users, jadi
                                // User::create() butuh email/password (kolom wajib) --
                                // email diisi dummy unik. Password dibuat dari
                                // nama (huruf kecil, spasi jadi underscore), bukan
                                // random, biar user hasil import juga bisa login.
                                $penerimaUser = User::create([
                                    'name'          => $namaPenerima,
                                    'email'         => 'nik' . $nikPenerima . '@placeholder.local',
                                    'password'      => explode(' ', trim($namaPenerima))[0],
                                    'role'          => 'user',
                                    'nik'           => $nikPenerima,
                                    'departemen_id' => $departemenId,
                                ]);
                            }
                        } else {
                            $this->errors[] = 'Baris data ke-' . ($index + 1) . ': ada nama penerima ("' . $namaPenerima . '") tapi NIK kosong, inventory dibuat tanpa data pemakai.';
                        }
                    }

                    $statusInventory = $penerimaUser ? 'dipakai' : 'tersedia';

                    $adaBarangDiproses = false;

                    // Barang utama terakhir yang berhasil dibuat di baris ini
                    // (parent_id = null) -- barang di kolom Nama Barang N
                    // (N != NOMOR_KOLOM_ASET_UTAMA) yang muncul SETELAHNYA
                    // jadi baris Inventory dengan parent_id nunjuk ke sini,
                    // dan status-nya ngikutin baris ini (lihat
                    // buatInventoryKelengkapan()).
                    $indukTerakhir = null;

                    foreach ($nomorBarang as $n) {
                        $namaBarang = $row["nama_barang_{$n}"] ?? null;

                        if ($this->namaBarangKosong($namaBarang)) {
                            continue;
                        }

                        $adaBarangDiproses = true;
                        $namaBarangTrim = trim($namaBarang);
                        $keteranganAsli = $row["keterangan_{$n}"] ?? null;

                        // Kolom Nama Barang selain kolom barang utama (mis.
                        // Nama Barang 2, 3, dst) SELALU dianggap kelengkapan
                        // dari barang utama terakhir yang sudah dibuat di
                        // baris yang sama -- ditentukan murni dari POSISI
                        // KOLOM, bukan dari kata dalam namanya.
                        if ($n !== self::NOMOR_KOLOM_ASET_UTAMA) {
                            if ($indukTerakhir) {
                                $kelengkapan = $this->buatInventoryKelengkapan(
                                    $indukTerakhir,
                                    $infoBukti,
                                    $supplierId,
                                    $namaBarangTrim,
                                    $keteranganAsli
                                );

                                if ($penerimaUser) {
                                    $this->buatInventoryPemakai($kelengkapan, $penerimaUser, $infoBukti['tanggal']);
                                }
                            } else {
                                // Kolom kelengkapan terisi tapi kolom barang
                                // utama (Nama Barang 1) di baris ini kosong --
                                // tidak ada induk buat dijadikan acuan
                                // status/parent_id, jadi dilewati (dicatat
                                // sebagai warning, bukan bikin baris
                                // kelengkapan tanpa induk).
                                $this->errors[] = 'Baris data ke-' . ($index + 1) . ': barang "' . $namaBarangTrim . '" (Nama Barang ' . $n . ') dilewati karena kolom Nama Barang ' . self::NOMOR_KOLOM_ASET_UTAMA . ' (barang utama) di baris yang sama kosong.';
                            }
                            continue;
                        }

                        // Jenis Aset (enum lama) sudah dihapus. Struktur
                        // induk/kelengkapan sekarang murni dari parent_id
                        // (ditentukan dari posisi kolom, lihat komentar
                        // NOMOR_KOLOM_ASET_UTAMA), BUKAN dari kategori_id --
                        // kategori_id di sini cuma fallback karena Excel
                        // sumber gak punya info kategori sebenarnya (lihat
                        // komentar NAMA_KATEGORI_FALLBACK_IMPORT). Nama
                        // barang ("Laptop", "Modem Telkomsel", dst) disimpan
                        // seragam ke kolom `nama`, sama seperti baris
                        // kelengkapan, karena sekarang keduanya baris di
                        // tabel `inventory` yang sama.
                        $hasilParse = $this->parseKeterangan($keteranganAsli);

                        $inventory = Inventory::create(array_merge($infoBukti, [
                            'kode_inventory'    => $row['kode_inventory'] ?? null,
                            'nama'              => $namaBarangTrim,
                            'kategori_id'       => $this->kategoriIdFallback(),
                            'parent_id'         => null,
                            'supplier_id'       => $supplierId,
                            'perusahaan_id'     => $infoBukti['perusahaan_id'] ?? null,
                            'jumlah'            => $row["jumlah_{$n}"] ?? null,
                            'keterangan'        => $keteranganAsli,
                            'serial_number'     => $hasilParse['serial_number'],
                            'warna'             => $hasilParse['warna'],
                            'status'            => $statusInventory,
                        ]));

                        $indukTerakhir = $inventory;

                        if ($penerimaUser) {
                            $this->buatInventoryPemakai($inventory, $penerimaUser, $infoBukti['tanggal']);
                        }

                        // Nama kelengkapan yang ke-parse dari teks Keterangan
                        // (mis. "(charger, tas)") -- sama seperti kolom Nama
                        // Barang N lainnya, tiap nama jadi baris Inventory
                        // ber-kategori kelengkapan yang parent_id-nya
                        // nunjuk ke barang utama ini, status-nya ngikutin
                        // barang utama ini.
                        foreach ($hasilParse['kelengkapan'] as $namaKelengkapan) {
                            $kelengkapan = $this->buatInventoryKelengkapan(
                                $inventory,
                                $infoBukti,
                                $supplierId,
                                $namaKelengkapan,
                                null
                            );

                            if ($penerimaUser) {
                                $this->buatInventoryPemakai($kelengkapan, $penerimaUser, $infoBukti['tanggal']);
                            }
                        }
                    }

                    if (!$adaBarangDiproses) {
                        $this->errors[] = 'Baris data ke-' . ($index + 1) . ': tidak ada barang yang diisi.';
                        return;
                    }

                    $this->rowCount++;
                });
            } catch (\Exception $e) {
                $this->errors[] = 'Baris data ke-' . ($index + 1) . ': ' . $e->getMessage();
            }
        }
    }

    /**
     * Proses baris data format FLAT -- 1 baris = 1 barang langsung, gak ada
     * pengelompokan "Nama Barang 1/2/3" kayak format Bukti Serah Terima.
     * Semua baris dianggap BARANG UTAMA (gak ada kelengkapan terpisah),
     * sesuai struktur file "Data Inventory" (Kode Inventory, Kategori,
     * Merk, Type, Warna, Nama, Serial Number, Keterangan, Jumlah, Status,
     * Pemakai Saat Ini, Tanggal Garansi, Supplier, Tanggal Pembelian, Tanggal
     * Input, Perusahaan, dst).
     *
     * ATURAN PEMETAAN:
     * - "Kode Inventory" dipakai APA ADANYA ke field `kode_inventory`.
     *   Kalau kode itu SUDAH ADA di database (atau sudah diimport di file
     *   yang sama), barisnya DILEWATI -- jadi file yang sama bisa diupload
     *   ulang dan hanya baris dengan kode baru yang masuk. Baris tanpa kode
     *   tidak bisa dicek dan selalu diimport.
     * - "Kategori" dipakai sebagai nama kategori; kalau kosong, ditebak dari
     *   merk/type/nama (lihat kategoriIdOtomatis()).
     * - "Status" dibaca lewat statusDariLabel() (kosong/tidak dikenali =
     *   'tersedia'). Kalau statusnya "Dipakai", kolom "Pemakai Saat Ini"
     *   WAJIB diisi dan harus cocok dengan tepat 1 user (nama, tidak peduli
     *   huruf besar/kecil) -- user TIDAK dibuat otomatis. Kalau pemakai
     *   kosong / tidak ditemukan / nama kembar, baris itu TIDAK ditambahkan
     *   dan alasannya dicatat di getErrors(). Kalau cocok, dibuatkan baris
     *   inventory_pemakai.
     * - "Serial Number" & "Warna" diambil LANGSUNG dari kolomnya masing-masing
     *   (BUKAN di-parse dari teks Keterangan seperti format lama).
     * - "Tanggal Garansi", "No. Surat Jalan", "No. Good Receive" DIABAIKAN --
     *   tidak diisi oleh import ini.
     * - `no_bukti`, `nik`, `penerima`, dst dibiarkan null -- memang gak
     *   ada datanya di format ini.
     */
    private function procesBarisFlat(Collection $dataRows, array $headers): void
    {
        foreach ($dataRows as $index => $rawRow) {
            try {
                DB::transaction(function () use ($rawRow, $headers, $index) {
                    $rowArray = $rawRow->toArray();

                    if (count(array_filter($rowArray, fn ($v) => $v !== null && $v !== '')) === 0) {
                        return;
                    }

                    if ($this->adalahBarisFooter($rowArray)) {
                        return; // baris footer disclaimer hasil Export Excel, lewati diam-diam
                    }

                    $row = array_combine(
                        $headers,
                        array_pad($rowArray, count($headers), null)
                    );

                    // Kode sudah ada di database -> baris ini dilewati
                    $kodeInventory = trim((string) ($row['kode_inventory'] ?? ''));

                    if ($kodeInventory !== '' && $this->kodeSudahAda($kodeInventory)) {
                        $this->jumlahDilewati++;
                        return;
                    }

                    $namaBarang = $row[self::KOLOM_NAMA_FLAT] ?? null;

                    if ($this->namaBarangKosong($namaBarang)) {
                        $this->errors[] = 'Baris data ke-' . ($index + 1) . ': kolom "Nama" kosong, baris dilewati.';
                        return;
                    }

                    // Status dipakai -> pemakai wajib ada. Dicek SEBELUM ada
                    // yang dibuat, supaya baris yang gagal tidak meninggalkan
                    // data setengah jadi.
                    $statusFile = $this->statusDariLabel($row['status'] ?? null);
                    $pemakai = null;

                    if ($statusFile === 'dipakai') {
                        $namaPemakai = $this->nilaiAtauNull($row['pemakai_saat_ini'] ?? null);
                        $labelBaris = 'Baris data ke-' . ($index + 1)
                            . ' (' . ($kodeInventory !== '' ? $kodeInventory : trim($namaBarang)) . ')';

                        if ($namaPemakai === null) {
                            $this->errors[] = $labelBaris . ' tidak ditambahkan: status "Dipakai" tapi kolom "Pemakai Saat Ini" kosong.';
                            return;
                        }

                        [$pemakai, $alasan] = $this->cariPemakaiDariNama($namaPemakai);

                        if ($pemakai === null) {
                            $this->errors[] = $labelBaris . ' tidak ditambahkan: ' . $alasan . '.';
                            return;
                        }
                    }

                    $namaSupplier = $this->nilaiAtauNull($row['supplier'] ?? null);
                    $supplierId = null;

                    if ($namaSupplier !== null) {
                        $supplierId = Supplier::firstOrCreate(['nama' => $namaSupplier])->id;
                    }

                    $tanggalInput = $this->parseTanggal($row['tanggal_input'] ?? null);
                    $tanggalInvoice = $this->parseTanggal($row['tanggal_invoice'] ?? $row['tanggal_pembelian'] ?? null);

                    $inventory = Inventory::create([
                        'kode_inventory'    => $kodeInventory !== '' ? $kodeInventory : null,
                        'nama'              => trim($namaBarang),
                        'kategori_id'       => $this->kategoriIdOtomatis(
                            $row['kategori'] ?? null,
                            $row['merk'] ?? null,
                            $row['type'] ?? null,
                            $namaBarang,
                        ),
                        'merk'              => $this->nilaiAtauNull($row['merk'] ?? null),
                        'type'              => $this->nilaiAtauNull($row['type'] ?? null),
                        'parent_id'         => null,
                        'supplier_id'       => $supplierId,
                        'jumlah'            => $row['jumlah'] ?? null,
                        'keterangan'        => $row['keterangan'] ?? null,
                        'serial_number'     => $this->nilaiAtauNull($row['serial_number'] ?? null),
                        'warna'             => $this->nilaiAtauNull($row['warna'] ?? null),
                        'status'            => $statusFile,
                        'perusahaan_id'     => $this->perusahaanIdDariSingkatan($row['perusahaan'] ?? null, $index + 1),
                        'tanggal_input'     => $tanggalInput,
                        'tanggal_invoice'   => $tanggalInvoice,
                    ]);

                    if ($pemakai) {
                        $this->buatInventoryPemakai($inventory, $pemakai, $tanggalInput);
                    }

                    // Tandai kode ini sudah dipakai, supaya kode kembar di file
                    // yang sama tidak masuk dua kali
                    if ($kodeInventory !== '') {
                        $this->tandaiKodeAda($kodeInventory);
                    }

                    $this->rowCount++;
                });
            } catch (\Exception $e) {
                $this->errors[] = 'Baris data ke-' . ($index + 1) . ': ' . $e->getMessage();
            }
        }
    }

    /**
     * Ubah isi kolom "Status" (label hasil export, mis. "Dipakai",
     * "Menunggu Perbaikan") jadi nilai enum status. Kosong / tidak
     * dikenali -> 'tersedia'.
     */
    private function statusDariLabel(?string $label): string
    {
        $kunci = $this->normalisasiHeader((string) $label); // "Menunggu Perbaikan" -> menunggu_perbaikan

        return match ($kunci) {
            'dipakai'                         => 'dipakai',
            'menunggu_perbaikan'              => 'menunggu_perbaikan',
            'diperbaiki', 'sedang_diperbaiki' => 'diperbaiki',
            'rusak_berat'                     => 'rusak_berat',
            'dijual'                          => 'dijual',
            default                           => 'tersedia',
        };
    }

    /**
     * Cari 1 user dari nama (case-insensitive). User TIDAK dibuat otomatis.
     * Return [User|null, alasan|null]: null + alasan kalau tidak ada user
     * dengan nama itu, atau namanya cocok dengan lebih dari 1 user.
     */
    private function cariPemakaiDariNama(string $nama): array
    {
        $cocok = User::whereRaw('LOWER(name) = ?', [strtolower(trim($nama))])->get();

        if ($cocok->count() === 1) {
            return [$cocok->first(), null];
        }

        return [
            null,
            $cocok->isEmpty()
                ? 'pemakai "' . $nama . '" tidak ada di data user'
                : 'pemakai "' . $nama . '" cocok dengan ' . $cocok->count() . ' user (nama kembar)',
        ];
    }

    /**
     * True kalau kode inventory sudah ada di database atau sudah diimport di
     * file yang sedang diproses. Semua kode dimuat sekali saja di awal.
     * Kalau model Inventory memakai SoftDeletes dan kode barang yang sudah
     * dihapus juga dianggap "sudah ada", ganti Inventory:: di bawah jadi
     * Inventory::withTrashed()->.
     */
    private function kodeSudahAda(string $kode): bool
    {
        if (!$this->kodeSudahAdaDimuat) {
            Inventory::whereNotNull('kode_inventory')
                ->pluck('kode_inventory')
                ->each(function ($k) {
                    $this->kodeSudahAda[strtolower(trim((string) $k))] = true;
                });

            $this->kodeSudahAdaDimuat = true;

            Log::info('IMPORT: kode di database dimuat = ' . count($this->kodeSudahAda));
        }

        return isset($this->kodeSudahAda[strtolower($kode)]);
    }

    private function tandaiKodeAda(string $kode): void
    {
        $this->kodeSudahAda[strtolower($kode)] = true;
    }

    /**
     * Sama seperti namaBarangKosong() tapi buat kolom selain Nama Barang
     * (mis. Serial Number, Warna di format flat) -- balikin null kalau
     * isinya kosong atau cuma placeholder ("-", "n/a", dst), supaya field
     * kayak serial_number/warna gak kesimpen literal "-" di database.
     */
    private function nilaiAtauNull(?string $nilai): ?string
    {
        if ($this->namaBarangKosong($nilai)) {
            return null;
        }

        return trim($nilai);
    }

    /**
     * Bikin 1 nama barang kelengkapan (mis. "Charger", "Tas", atau apapun
     * isi kolom Nama Barang selain kolom barang utama) jadi baris
     * `inventory` dengan parent_id nunjuk ke $indukInventory (kategori_id
     * cuma fallback, lihat NAMA_KATEGORI_FALLBACK_IMPORT) -- BUKAN
     * tabel/model terpisah lagi seperti dulu
     * (AsetKelengkapan sudah dihapus). $keterangan (kalau ada) di-parse
     * ulang lewat parseKeterangan() buat coba tarik serial_number & warna-
     * nya juga, sama seperti yang dilakukan buat barang utama. Info bukti
     * (perusahaan, tanggal) & supplier disamakan dengan induknya lewat
     * $infoBukti/$supplierId yang dioper dari caller. status-nya ikut
     * status induk saat baris ini diproses (bukan status 'tersedia'
     * hardcode).
     */
    private function buatInventoryKelengkapan(Inventory $indukInventory, array $infoBukti, ?int $supplierId, string $namaBarang, ?string $keterangan): Inventory
    {
        $hasilParse = $this->parseKeterangan($keterangan);

        return Inventory::create(array_merge([
            'parent_id'         => $indukInventory->id,
            'kategori_id'       => $this->kategoriIdFallback(),
            'nama'              => $namaBarang,
            'warna'             => $hasilParse['warna'],
            'serial_number'     => $hasilParse['serial_number'],
            'keterangan'        => $keterangan,
            'supplier_id'       => $supplierId,
            'perusahaan_id'     => $infoBukti['perusahaan_id'] ?? null,
            'status'            => $indukInventory->status,
        ], $this->timestampsDariTanggal($infoBukti['tanggal'] ?? null)));
    }

    /**
     * Buat 1 baris inventory_pemakai buat 1 baris Inventory (barang utama
     * ATAUPUN kelengkapan -- sekarang gak perlu dibedakan lagi karena
     * keduanya sama-sama baris tabel `inventory`, cukup 1 kolom
     * inventory_id, gak perlu lagi kolom aset_kelengkapan_id terpisah
     * seperti dulu). Sama seperti InventoryPemakaiController::store() --
     * setiap InventoryPemakai WAJIB punya nomor_penerimaan sendiri
     * (unik per baris, di-generate ulang tiap panggilan), karena
     * kembalikan() nanti mencocokkan input nomor_penerimaan persis
     * dengan kolom ini. Tanpa di-generate di sini, data hasil import
     * punya nomor_penerimaan = null, dan barang itu jadi TIDAK BISA
     * PERNAH dikembalikan lewat endpoint kembalikan() (gak ada string
     * yang bisa cocok dengan null).
     *
     * 'diterima_at' SENGAJA tidak diisi now() -- beda dari store() yang
     * isi now() karena itu aksi live. Di sini datanya historis (dari
     * bukti serah-terima lama), jadi biarkan riwayat() fallback ke
     * diterima_at (lihat komentar fallback *_at di riwayat())
     * supaya pengurutan waktu di Riwayat Inventory tetap benar sesuai
     * tanggal transaksi asli, bukan tanggal import dijalankan.
     */
    private function buatInventoryPemakai(Inventory $item, User $penerimaUser, ?string $tanggalPenerimaan): void
    {
        $noStruk = $this->generateNoStrukRandom('inventory_pemakai', 'nomor_penerimaan');

        InventoryPemakai::create(array_merge([
            'inventory_id'     => $item->id,
            'user_id'          => $penerimaUser->id,
            'nomor_penerimaan' => $noStruk,
            'diterima_at'      => $tanggalPenerimaan,
        ], $this->timestampsDariTanggal($tanggalPenerimaan)));
    }

    private function perusahaanIdDariSingkatan(?string $singkatan, int $nomorBaris): ?int
    {
        $nilaiAsli = trim((string) $singkatan);
        $singkatanTrim = strtoupper($nilaiAsli);

        if ($singkatanTrim === '' || $this->namaBarangKosong($singkatanTrim)) {
            return null;
        }

        if (array_key_exists($singkatanTrim, $this->perusahaanIdCache)) {
            return $this->perusahaanIdCache[$singkatanTrim];
        }

        $namaLengkap = self::PETA_PERUSAHAAN_SINGKATAN[$singkatanTrim] ?? null;

        // Kolom "Perusahaan" bisa berisi SINGKATAN (format Bukti Serah
        // Terima, mis. "MPK") ATAU NAMA LENGKAP (format flat/"Data
        // Inventory" -- kolom Perusahaan di export-nya nulis
        // `perusahaan.nama` apa adanya, mis. "PT. Marimas Putera Kencana",
        // BUKAN singkatan). Kalau gak ketemu di peta singkatan, coba
        // cocokkan langsung sebagai nama lengkap (case-insensitive) dulu
        // sebelum dianggap "tidak dikenali" -- biar hasil export flat bisa
        // diimport balik tanpa perusahaan_id kosong.
        if ($namaLengkap === null) {
            $id = \App\Models\MasterData\Perusahaan::whereRaw('LOWER(nama) = ?', [strtolower($nilaiAsli)])->first()?->id;

            if ($id !== null) {
                return $this->perusahaanIdCache[$singkatanTrim] = $id;
            }

            $this->errors[] = 'Baris data ke-' . $nomorBaris . ': singkatan perusahaan "' . $singkatan . '" tidak dikenali, perusahaan_id dikosongkan.';
            return $this->perusahaanIdCache[$singkatanTrim] = null;
        }

        $id = \App\Models\MasterData\Perusahaan::where('nama', $namaLengkap)->first()?->id;

        if ($id === null) {
            $this->errors[] = 'Baris data ke-' . $nomorBaris . ': perusahaan "' . $namaLengkap . '" (dari singkatan "' . $singkatan . '") belum ada di tabel perusahaan.';
        }

        return $this->perusahaanIdCache[$singkatanTrim] = $id;
    }

    private function kategoriId(string $nama): int
    {
        if (!array_key_exists($nama, $this->kategoriIdCache)) {
            $this->kategoriIdCache[$nama] = Kategori::firstOrCreate(['nama' => $nama])->id;
        }

        return $this->kategoriIdCache[$nama];
    }

    /**
     * Ambil id kategori fallback (NAMA_KATEGORI_FALLBACK_IMPORT), bikin
     * kalau belum ada (firstOrCreate -- BEDA dari firstOrFail versi lama
     * yang throw kalau kategori gak ketemu). Ini kategori bebas biasa,
     * bukan lagi baris "spesial" yang divalidasi khusus di tempat lain,
     * jadi aman dibikin otomatis di sini.
     */
    private function kategoriIdFallback(): int
    {
        if ($this->kategoriIdFallbackCache === null) {
            $this->kategoriIdFallbackCache = Kategori::firstOrCreate(
                ['nama' => self::NAMA_KATEGORI_FALLBACK_IMPORT]
            )->id;
        }

        return $this->kategoriIdFallbackCache;
    }

    /**
     * `created_at`/`updated_at` bawaan Eloquent selalu ke-set ke waktu
     * import dijalankan (now()) -- padahal data ini historis (bukti lama
     * yang baru sekarang di-import), jadi urutan "created_at" di riwayat
     * harusnya ngikutin tanggal bukti serah-terima yang sebenarnya, bukan
     * kapan tombol import ditekan.
     *
     * Eloquent gak nimpa created_at/updated_at yang udah di-set manual di
     * attributes sebelum save() -- updateTimestamps() cuma ngisi kalau
     * kolomnya belum "dirty" -- jadi cukup masukin dua kolom ini ke array
     * create() buat override default now()-nya.
     *
     * Kalau $tanggal null (baris gak punya kolom Tanggal terisi), return
     * array kosong supaya Eloquent tetap fallback ke default now() dia,
     * daripada maksa created_at jadi null.
     */
    private function timestampsDariTanggal(?string $tanggal): array
    {
        if (empty($tanggal)) {
            return [];
        }

        return [
            'created_at' => $tanggal,
            'updated_at' => $tanggal,
        ];
    }

    private function kategoriIdOtomatis(?string $kategoriExcel, ?string $merk, ?string $type, ?string $nama): int
    {
        $kategoriExcelTrim = trim((string) $kategoriExcel);

        if (!$this->namaBarangKosong($kategoriExcelTrim)) {
            return $this->kategoriId($kategoriExcelTrim);
        }

        $teks = strtolower(trim(($merk ?? '') . ' ' . ($type ?? '') . ' ' . ($nama ?? '')));

        foreach (self::PETA_KATEGORI_KEYWORDS as $namaKategori => $kataKunci) {
            foreach ($kataKunci as $kunci) {
                if (str_contains($teks, $kunci)) {
                    return $this->kategoriId($namaKategori);
                }
            }
        }

        if (preg_match('/\b\d+\s*(gb|tb)\b/i', $teks)) {
            return $this->kategoriId('Hdd External');
        }

        return $this->kategoriIdFallback();
    }

    /**
     * True kalau isi kolom "Nama Barang N" harus dianggap TIDAK ADA data
     * beneran -- baik karena benar-benar kosong (null/''), maupun karena
     * cuma placeholder yang lazim dipakai di Excel sumber buat nandain
     * "sel ini sengaja gak diisi" (mis. "-"). Tanpa ini, nilai seperti "-"
     * lolos empty() check (string "-" itu non-empty di PHP) dan kepakai
     * apa adanya sebagai `nama` baris Inventory (barang utama maupun
     * kelengkapan), sehingga muncul barang dengan nama literal "-". Dipakai
     * juga buat kolom lain di format flat (Serial Number, Warna) lewat
     * nilaiAtauNull().
     */
    private function namaBarangKosong(?string $nama): bool
    {
        if (empty($nama)) {
            return true;
        }

        return in_array(strtolower(trim($nama)), self::NILAI_PLACEHOLDER_NAMA_KOSONG, true);
    }

    private function cariNomorBarang(array $headers): array
    {
        $nomor = [];

        foreach ($headers as $header) {
            if (preg_match('/^nama_barang_(\d+)$/', $header, $match)) {
                $nomor[] = (int) $match[1];
            }
        }

        sort($nomor);

        return $nomor;
    }

    /**
     * Baris dianggap header kalau mengandung SALAH SATU (OR) dari nama
     * kolom di KOLOM_PENANDA_HEADER -- misalnya file lama pakai "No Bukti",
     * file lain pakai "Kode Inventory". Berhenti di kecocokan pertama yang
     * ditemukan (baik penanda maupun barisnya), gak perlu semua penanda
     * ada sekaligus.
     */
    private function cariBarisHeader(Collection $rows): ?int
    {
        $batas = min(self::MAX_BARIS_DISCAN, $rows->count());

        for ($i = 0; $i < $batas; $i++) {
            $selDinormalisasi = $rows[$i]->map(fn ($v) => $this->normalisasiHeader((string) $v));

            foreach (self::KOLOM_PENANDA_HEADER as $penanda) {
                if ($selDinormalisasi->contains($penanda)) {
                    return $i;
                }
            }
        }

        return null;
    }

    /**
     * Deteksi baris footer disclaimer yang otomatis ditambahkan fitur Export
     * Excel ("Dokumen digenerate otomatis oleh Marimas IT Vault ..."). Kalau file
     * hasil export diimpor balik tanpa diedit, baris ini ikut kebaca sebagai
     * baris data (nyangkut di kolom pertama karena aslinya merged cell) dan
     * bikin entri palsu -- makanya harus disaring.
     */
    private function adalahBarisFooter(array $rowArray): bool
    {
        $gabungan = strtolower(implode(' ', array_map('strval', $rowArray)));

        return str_contains($gabungan, 'digenerate otomatis');
    }

    private function normalisasiHeader(string $header): string
    {
        $header = str_replace("\xEF\xBB\xBF", '', $header);
        $header = preg_replace('/[\x{00A0}\x{200B}\x{FEFF}]/u', ' ', $header);

        $header = trim($header);
        $header = strtolower($header);
        $header = preg_replace('/[\s\-]+/', '_', $header);
        $header = preg_replace('/[^a-z0-9_]/', '', $header);
        $header = trim($header, '_');
        return $header;
    }

    private function parseKeterangan(?string $teks): array
    {
        $hasil = ['serial_number' => null, 'warna' => null, 'kelengkapan' => []];

        if (empty(trim((string) $teks))) {
            return $hasil;
        }

        $sisaTeks = (string) $teks;

        if (preg_match('/\bS\s*\/?\s*N\s*:?\s*([A-Za-z0-9\-]+)/i', $sisaTeks, $match, PREG_OFFSET_CAPTURE)) {
            $hasil['serial_number'] = trim($match[1][0]);
            $panjangMatch = strlen($match[0][0]);
            $posisiMatch = $match[0][1];
            $sisaTeks = substr($sisaTeks, 0, $posisiMatch) . substr($sisaTeks, $posisiMatch + $panjangMatch);
        }

        if (preg_match_all('/\(([^)]*)\)/', $sisaTeks, $matchKurung)) {
            foreach ($matchKurung[1] as $isiKurung) {
                $hasil['kelengkapan'] = array_merge($hasil['kelengkapan'], $this->pisahDaftar($isiKurung));
            }
            $sisaTeks = preg_replace('/\(([^)]*)\)/', '', $sisaTeks);
        }

        foreach ($this->pisahDaftar($sisaTeks) as $token) {
            if (preg_match(self::KETERANGAN_PREFIX_DIABAIKAN, $token)) {
                continue;
            }

            if ($hasil['warna'] === null && preg_match('/\b(' . implode('|', self::WARNA_KEYWORDS) . ')\b/i', $token)) {
                $hasil['warna'] = $token;
                continue;
            }

            $hasil['kelengkapan'][] = $token;
        }

        return $hasil;
    }

    private function pisahDaftar(string $teks): array
    {
        $hasil = [];

        foreach (preg_split('/[;,]/', $teks) as $bagian) {
            foreach (preg_split('/\s+dan\s+/i', $bagian) as $token) {
                $token = trim($token);
                if ($token !== '') {
                    $hasil[] = $token;
                }
            }
        }

        return $hasil;
    }

    private const BULAN_INDONESIA_KE_INGGRIS = [
        'september' => 'September', 'november' => 'November', 'desember' => 'December',
        'januari' => 'January', 'februari' => 'February', 'agustus' => 'August',
        'oktober' => 'October',
        'maret' => 'March', 'april' => 'April',
        'juli' => 'July', 'juni' => 'June',
        'agt' => 'August', 'agu' => 'August', 'okt' => 'October', 'des' => 'December',
        'jan' => 'January', 'feb' => 'February', 'mar' => 'March', 'apr' => 'April',
        'jun' => 'June', 'jul' => 'July', 'sep' => 'September', 'sept' => 'September',
        'nov' => 'November', 'oct' => 'October', 'dec' => 'December', 'aug' => 'August',
        'mei' => 'May',
    ];

    private function parseTanggal($value)
    {
        // Anggap kosong juga kalau isinya placeholder seperti "-", "n/a", dst
        if ($value === null || $this->namaBarangKosong((string) $value)) {
            return null;
        }

        if (is_numeric($value)) {
            return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value)->format('Y-m-d');
        }

        $teks = (string) $value;

        foreach (self::BULAN_INDONESIA_KE_INGGRIS as $indo => $inggris) {
            $teks = preg_replace('/\b' . preg_quote($indo, '/') . '\b/i', $inggris, $teks);
        }

        // Kalau format tanggalnya tetap tidak dikenali, jangan gagalkan seluruh baris
        try {
            return \Carbon\Carbon::parse($teks)->format('Y-m-d');
        } catch (\Exception $e) {
            $this->errors[] = 'Tanggal "' . $value . '" tidak dapat dibaca, dikosongkan.';
            return null;
        }
    }

    public function getRowCount()
    {
        return $this->rowCount;
    }

    public function getJumlahDilewati(): int
    {
        return $this->jumlahDilewati;
    }

    /**
     * Daftar peringatan/error. Kalau ada baris yang dilewati karena
     * kode_inventory sudah ada, satu baris ringkasan ditaruh paling atas:
     * berapa baris yang ditambahkan dan berapa yang dilewati (bukan satu
     * pesan per baris, supaya daftar tidak penuh).
     */
    public function getErrors()
    {
        return $this->errors;
    }
}