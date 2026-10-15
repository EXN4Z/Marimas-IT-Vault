#!/usr/bin/env node
// =============================================================================
// F7 - Migrasi ke Inertia: Laporan (Export Data, Foto Inventory, Riwayat Inventory) -> props server
//      (Audit Log sudah props sejak fase sebelumnya: AuditLogPageController + AuditLog/Index.tsx, tidak disentuh di sini)
//
// Syarat: F1 - F6 sudah terpasang.
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f7.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f7.mjs            terapkan
//   node f7.mjs --revert   kembalikan semua dari .migrasi-backup/f7/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x (atau file yang diganti total isinya beda dari
// versi zip), script berhenti SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// Langkah { find, with } = ganti teks (harus ketemu tepat 1x). { start, end, with } = ganti dari anchor awal sampai
// SEBELUM anchor akhir (tanpa end = sampai akhir file). { replaceAll, sha } = ganti seluruh isi file, hanya jika SHA-256 isi
// aslinya (line ending dinormalisasi ke LF) cocok dengan versi yang dipakai menyusun script ini.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FASE = 'f7';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    "path": "app/Queries/RiwayatInventoryQuery.php",
    "content": "<?php\n\nnamespace App\\Queries;\n\nuse App\\Models\\Transaksi\\InventoryPemakai;\nuse App\\Models\\Transaksi\\InventoryPenanganan;\nuse App\\Models\\Transaksi\\InventoryWriteoff;\nuse App\\Models\\User;\nuse Illuminate\\Http\\Request;\n\n/**\n * [F7-INERTIA] Riwayat aktivitas inventory (pinjam/kembali/lapor_rusak/mulai_perbaikan/selesai_perbaikan/dijual), dipakai bareng oleh:\n *  - API : App\\Http\\Controllers\\Transaksi\\InventoryPemakaiController::riwayat (JSON, masih dipakai Dashboard sampai F8; dihapus di F10)\n *  - Web : App\\Http\\Controllers\\Laporan\\LaporanPageController (props tab Riwayat Inventory)\n *\n * Isi ambil() dipindah APA ADANYA dari InventoryPemakaiController::riwayat():\n * admin = riwayat global; non-admin = cuma aktivitas yang terkait pemakaian dia sendiri (user_id == dia).\n */\nclass RiwayatInventoryQuery\n{\n    /** Parameter query string API lama: page, per_page (alias limit), type, search. */\n    public static function dariRequest(Request $request): array\n    {\n        $page = max(1, (int) $request->query('page', 1));\n        $perPage = max(10, (int) $request->query('per_page', $request->query('limit', 10)));\n        $typeFilter = $request->query('type');\n        $search = trim((string) $request->query('search', ''));\n\n        return self::ambil($request->user(), $typeFilter, $search, $page, $perPage);\n    }\n\n    /**\n     * @return array{data: array, current_page: int, last_page: int, total: int, per_page: int}\n     */\n    public static function ambil(?User $user, $typeFilter, string $search, int $page, int $perPage): array\n    {\n        $isAdmin = $user?->role === 'admin';\n\n        $ambil = $search !== '' ? 2000 : max(500, $page * $perPage * 2);\n\n        $events = collect();\n\n        $milikUser = function ($query) use ($user) {\n            $query->where('user_id', $user->id);\n        };\n\n        $pemakaiQuery = InventoryPemakai::with([\n            // parent_id WAJIB ikut di-select -- isChild() di bawah baca kolom\n            // ini, dan tanpa di-select Eloquent balikin null diam-diam\n            // (bukan exception), jadi isChild() bakal selalu false kalau\n            // kolomnya kelewat.\n            'inventory:id,kode_inventory,nama,kategori_id,parent_id',\n            'inventory.kategori:id,nama',\n            'user:id,name',\n        ])->where('status', 'disetujui');\n\n        if (!$isAdmin) {\n            $milikUser($pemakaiQuery);\n        }\n\n        $pemakaiQuery\n            ->latest('tanggal_penerimaan')\n            ->limit($ambil)\n            ->get()\n            ->each(function ($p) use (&$events) {\n                $nama = $p->user?->name ?? '-';\n                $tipeItem = $p->inventory?->isChild() ? 'kelengkapan' : 'barang_utama';\n\n                $events->push([\n                    'type' => 'pinjam',\n                    'waktu' => $p->diterima_at ?? $p->tanggal_penerimaan,\n                    'nama' => $nama,\n                    'inventory' => $p->inventory,\n                    'tipe_item' => $tipeItem,\n                ]);\n                if ($p->tanggal_pengembalian) {\n                    $events->push([\n                        'type' => 'kembali',\n                        'waktu' => $p->dikembalikan_at ?? $p->tanggal_pengembalian,\n                        'nama' => $nama,\n                        'inventory' => $p->inventory,\n                        'tipe_item' => $tipeItem,\n                    ]);\n                }\n            });\n\n        $penangananQuery = InventoryPenanganan::with([\n            // parent_id ditambahin biar isChild() di bawah (dipakai nentuin\n            // tipe_item lapor_rusak/mulai_perbaikan/selesai_perbaikan) punya\n            // data yang dibutuhkan -- sama kayak alasan di pemakaiQuery di atas.\n            'inventory:id,kode_inventory,nama,parent_id',\n            'pemakai.user:id,name',\n        ]);\n\n        if (!$isAdmin) {\n            // laporan kerusakan gak punya user_id langsung — nempel ke\n            // InventoryPemakai lewat inventory_pemakai_id, jadi filternya\n            // lewat relasi 'pemakai'. Laporan hasil audit gudang (pemakai\n            // null) otomatis kepotong karena whereHas butuh relasi itu ada.\n            $penangananQuery->whereHas('pemakai', $milikUser);\n        }\n\n        $penangananQuery\n            ->latest('tanggal_lapor')\n            ->limit($ambil)\n            ->get()\n            ->each(function ($pn) use (&$events) {\n                $namaPelapor = $pn->pemakai?->user?->name ?? null;\n                // REVISI: sejak Fase 2, alur InventoryPenanganan berlaku buat\n                // item apapun (induk maupun menempel), jadi tipe_item gak\n                // boleh hardcode -- diturunkan dari isChild() sama kayak\n                // block pinjam/kembali di atas.\n                $tipeItemPn = $pn->inventory?->isChild() ? 'kelengkapan' : 'barang_utama';\n\n                $events->push([\n                    'type' => 'lapor_rusak',\n                    'waktu' => $pn->lapor_at ?? $pn->tanggal_lapor,\n                    'nama' => $namaPelapor,\n                    'inventory' => $pn->inventory,\n                    'tipe_item' => $tipeItemPn,\n                    'keluhan' => $pn->keluhan,\n                ]);\n                if ($pn->tanggal_diterima) {\n                    $events->push([\n                        'type' => 'mulai_perbaikan',\n                        'waktu' => $pn->diterima_at ?? $pn->tanggal_diterima,\n                        'nama' => null,\n                        'inventory' => $pn->inventory,\n                        'tipe_item' => $tipeItemPn,\n                    ]);\n                }\n                if ($pn->tanggal_selesai) {\n                    $events->push([\n                        'type' => 'selesai_perbaikan',\n                        'waktu' => $pn->selesai_at ?? $pn->tanggal_selesai,\n                        'nama' => null,\n                        'inventory' => $pn->inventory,\n                        'tipe_item' => $tipeItemPn,\n                        'hasil' => $pn->hasil,\n                    ]);\n                }\n            });\n\n        // 'dijual' cuma buat admin — keputusan writeoff bukan aktivitas\n        // pribadi karyawan mana pun, gak relevan buat riwayat pribadinya.\n        // Writeoff/jual cuma dikenal buat Barang Utama.\n        if ($isAdmin) {\n            InventoryWriteoff::with(['inventory:id,kode_inventory,nama', 'penyetuju:id,name'])\n                ->latest('tanggal_writeoff')\n                ->limit($ambil)\n                ->get()\n                ->each(function ($w) use (&$events) {\n                    $events->push([\n                        'type' => 'dijual',\n                        'waktu' => $w->created_at ?? $w->tanggal_writeoff,\n                        'nama' => $w->penyetuju?->name,\n                        'inventory' => $w->inventory,\n                        'tipe_item' => 'barang_utama',\n                        'keluhan' => $w->alasan,\n                    ]);\n                });\n        }\n\n        $sorted = $events\n            ->sortByDesc(fn ($ev) => $ev['waktu'] instanceof \\Carbon\\Carbon ? $ev['waktu'] : \\Carbon\\Carbon::parse($ev['waktu']))\n            ->values();\n\n        if ($typeFilter) {\n            $sorted = $sorted->where('type', $typeFilter)->values();\n        }\n\n        if ($search !== '') {\n            $needle = mb_strtolower($search);\n            $sorted = $sorted->filter(function ($ev) use ($needle) {\n                $item = $ev['inventory'] ?? null;\n                $haystack = mb_strtolower(implode(' ', array_filter([\n                    $ev['nama'] ?? '',\n                    $item?->kode_inventory ?? '',\n                    $item?->nama ?? '',\n                ])));\n\n                return str_contains($haystack, $needle);\n            })->values();\n        }\n\n        $total = $sorted->count();\n        $lastPage = max(1, (int) ceil($total / $perPage));\n        $data = $sorted->forPage($page, $perPage)->values();\n\n        return [\n            'data' => $data->all(),\n            'current_page' => $page,\n            'last_page' => $lastPage,\n            'total' => $total,\n            'per_page' => $perPage,\n        ];\n    }\n}\n"
  },
  {
    "path": "app/Queries/FotoInventoryQuery.php",
    "content": "<?php\n\nnamespace App\\Queries;\n\nuse App\\Models\\MasterData\\Inventory;\nuse App\\Models\\Transaksi\\InventoryPemakai;\nuse App\\Models\\Transaksi\\InventoryPenanganan;\nuse App\\Models\\User;\nuse Illuminate\\Database\\Eloquent\\Builder;\n\n/**\n * [F7-INERTIA] Query galeri Foto Inventory (4 sub-tab), dipakai bareng oleh:\n *  - API : InventoryController::foto, InventoryPemakaiController::foto, InventoryPenangananController::foto (JSON, dihapus di F10)\n *  - Web : App\\Http\\Controllers\\Laporan\\LaporanPageController (props tab Foto Inventory)\n *\n * Isi dipindah APA ADANYA dari ketiga method foto() tsb (urutan, filter foto, pencarian kode/nama, scoping role).\n */\nclass FotoInventoryQuery\n{\n    public const SUB_TAB = ['inventory', 'peminjaman', 'pengembalian', 'rusak'];\n\n    /** Foto dasar barang (kolom inventory.foto). */\n    public static function inventory(?string $search): Builder\n    {\n        $query = Inventory::with('kategori')\n            ->whereNotNull('foto')\n            ->orderByDesc('created_at');\n\n        if ($search) {\n            $query->where(function ($qq) use ($search) {\n                $qq->where('kode_inventory', 'like', \"%{$search}%\")\n                    ->orWhere('nama', 'like', \"%{$search}%\");\n            });\n        }\n\n        return $query;\n    }\n\n    /** Foto serah-terima ($type 'peminjaman') / pengembalian ($type 'pengembalian'); admin lihat semua, role lain cuma miliknya. */\n    public static function pemakai(User $user, ?string $type, ?string $search): Builder\n    {\n        $isAdmin = $user->role === 'admin';\n\n        $query = InventoryPemakai::with(['inventory', 'user'])\n            ->when(\n                $type === 'peminjaman',\n                fn ($q) => $q->whereNotNull('foto_penerimaan'),\n                fn ($q) => $q->when(\n                    $type === 'pengembalian',\n                    fn ($q2) => $q2->whereNotNull('foto_pengembalian'),\n                    fn ($q2) => $q2->where(function ($qq) {\n                        $qq->whereNotNull('foto_penerimaan')\n                            ->orWhereNotNull('foto_pengembalian');\n                    })\n                )\n            )\n            ->orderByDesc('created_at');\n\n        if (!$isAdmin) {\n            $query->where('user_id', $user->id);\n        }\n\n        if ($search) {\n            $query->whereHas('inventory', function ($qq) use ($search) {\n                $qq->where('kode_inventory', 'like', \"%{$search}%\")\n                    ->orWhere('nama', 'like', \"%{$search}%\");\n            });\n        }\n\n        return $query;\n    }\n\n    /** Foto laporan kerusakan (inventory_penanganan.foto). */\n    public static function kerusakan(?string $search): Builder\n    {\n        $query = InventoryPenanganan::with(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name'])\n            ->whereNotNull('foto')\n            ->orderByDesc('tanggal_lapor');\n\n        if ($search) {\n            $query->whereHas('inventory', function ($q) use ($search) {\n                $q->where('kode_inventory', 'like', \"%{$search}%\")\n                    ->orWhere('nama', 'like', \"%{$search}%\");\n            });\n        }\n\n        return $query;\n    }\n\n    /** Query satu sub-tab galeri (`inventory`, `peminjaman`, `pengembalian`, `rusak`). */\n    public static function untukTab(string $tab, User $user, ?string $search): Builder\n    {\n        return match ($tab) {\n            'peminjaman', 'pengembalian' => self::pemakai($user, $tab, $search),\n            'rusak' => self::kerusakan($search),\n            default => self::inventory($search),\n        };\n    }\n}\n"
  },
  {
    "path": "resources/js/types/laporan.ts",
    "content": "// [F7-INERTIA] Bentuk data halaman Laporan dari server (LaporanPageController). Tab yang tidak aktif = null.\nimport type { Inventory } from '../api/masterData/inventory';\nimport type { Karyawan } from '../api/masterData/karyawan';\nimport type { Kategori } from '../api/masterData/kategori';\nimport type { Departemen } from '../api/masterData/departemen';\nimport type { Cabang } from '../api/masterData/cabang';\nimport type { Perusahaan } from '../api/masterData/perusahaan';\nimport type { Supplier } from '../api/masterData/supplier';\nimport type { InventoryPemakai, FotoPemakaiEntry, RiwayatInventoryEvent } from '../api/transaksi/inventoryPemakai';\nimport type { InventoryPenanganan } from '../api/transaksi/inventoryPenanganan';\n\n/** Props `exportData` (deferred; undefined/null = belum dimuat). */\nexport interface LaporanExportData {\n  inventory: Inventory[];\n  karyawan: Karyawan[];\n  kategori: Kategori[];\n  departemen: Departemen[];\n  cabang: Cabang[];\n  perusahaan: Perusahaan[];\n  supplier: Supplier[];\n  pemakai: InventoryPemakai[];\n}\n\nexport type FotoSub = 'inventory' | 'peminjaman' | 'pengembalian' | 'rusak';\n\ninterface Halaman<T> {\n  data: T[];\n  current_page: number;\n  last_page: number;\n  total: number;\n  per_page: number;\n}\n\n/** Props `foto`: satu halaman sub-tab aktif (query string = sumber kebenaran: ?sub=&search=&page=). */\nexport type LaporanFotoProps =\n  | (Halaman<Inventory> & { sub: 'inventory'; filters: { search: string } })\n  | (Halaman<FotoPemakaiEntry> & { sub: 'peminjaman' | 'pengembalian'; filters: { search: string } })\n  | (Halaman<InventoryPenanganan> & { sub: 'rusak'; filters: { search: string } });\n\n/** Props `riwayat` (?type=&search=&page=). type 'semua' = tanpa filter. */\nexport type LaporanRiwayatProps = Halaman<RiwayatInventoryEvent> & {\n  filters: { type: 'semua' | RiwayatInventoryEvent['type']; search: string };\n};\n"
  }
];

const DELETES = [];

const EDITS = [
  {
    "file": "app/Http/Controllers/Transaksi/InventoryPemakaiController.php",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "start": "    public function riwayat(Request $request)\n    {\n        $user = $request->user();",
        "end": "    /**\n     * GET /api/inventory-pemakai/foto",
        "with": "    // [F7-INERTIA] Logika di App\\Queries\\RiwayatInventoryQuery (dipakai bareng tab Riwayat Inventory di halaman Laporan).\n    // Endpoint ini masih dipanggil Dashboard sampai F8; dihapus di F10.\n    public function riwayat(Request $request)\n    {\n        return response()->json(RiwayatInventoryQuery::dariRequest($request));\n    }\n\n"
      },
      {
        "start": "    public function foto(Request $request)\n    {\n        $user = $request->user();\n        $isAdmin = $user->role === 'admin';",
        "end": "    /**\n     * POST /api/inventory/{inventory}/pemakai",
        "with": "    public function foto(Request $request)\n    {\n        // [F7-INERTIA] Query di App\\Queries\\FotoInventoryQuery (dipakai bareng tab Foto Inventory di halaman Laporan).\n        $query = FotoInventoryQuery::pemakai($request->user(), $request->input('type'), $request->input('search'));\n\n        $perPage = max(10, (int) $request->input('per_page', 12));\n        $data = $query->paginate($perPage);\n\n        return response()->json($data);\n    }\n\n"
      },
      {
        "find": "use App\\Actions\\Transaksi\\InventoryPemakaiAction;",
        "with": "use App\\Actions\\Transaksi\\InventoryPemakaiAction;\nuse App\\Queries\\FotoInventoryQuery;\nuse App\\Queries\\RiwayatInventoryQuery;"
      }
    ]
  },
  {
    "file": "app/Http/Controllers/Transaksi/InventoryPenangananController.php",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "start": "    public function foto(Request $request)\n    {\n        $query = InventoryPenanganan::with(['inventory', 'pemakai.user', 'dilaporkanOleh:id,name'])",
        "end": "    // POST /api/inventory-penanganan\n",
        "with": "    // [F7-INERTIA] Query di App\\Queries\\FotoInventoryQuery (dipakai bareng tab Foto Inventory di halaman Laporan).\n    public function foto(Request $request)\n    {\n        $query = \\App\\Queries\\FotoInventoryQuery::kerusakan($request->input('search'));\n\n        $perPage = max(10, (int) $request->input('per_page', 12));\n        $data = $query->paginate($perPage);\n\n        return response()->json($data);\n    }\n\n"
      }
    ]
  },
  {
    "file": "app/Http/Controllers/MasterData/InventoryController.php",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "start": "    public function foto(Request $request)\n    {\n        $query = Inventory::with('kategori')",
        "with": "    // [F7-INERTIA] Query di App\\Queries\\FotoInventoryQuery (dipakai bareng tab Foto Inventory di halaman Laporan).\n    public function foto(Request $request)\n    {\n        $query = \\App\\Queries\\FotoInventoryQuery::inventory($request->input('search'));\n\n        $perPage = max(10, (int) $request->input('per_page', 12));\n        $data = $query->paginate($perPage);\n\n        return response()->json($data);\n    }\n}\n"
      }
    ]
  },
  {
    "file": "app/Http/Controllers/Laporan/LaporanPageController.php",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "replaceAll": "<?php\n\nnamespace App\\Http\\Controllers\\Laporan;\n\nuse App\\Http\\Controllers\\Controller;\nuse App\\Http\\Controllers\\MasterData\\CabangWebController;\nuse App\\Http\\Controllers\\MasterData\\DepartemenWebController;\nuse App\\Http\\Controllers\\MasterData\\KategoriWebController;\nuse App\\Http\\Controllers\\MasterData\\PerusahaanWebController;\nuse App\\Http\\Controllers\\MasterData\\SupplierWebController;\nuse App\\Models\\Transaksi\\InventoryPemakai;\nuse App\\Models\\User;\nuse App\\Queries\\FotoInventoryQuery;\nuse App\\Queries\\InventoryQuery;\nuse App\\Queries\\KaryawanQuery;\nuse App\\Queries\\RiwayatInventoryQuery;\nuse Illuminate\\Http\\Request;\nuse Inertia\\Inertia;\n\n// [F7-INERTIA] Halaman Laporan: SEMUA data tab dikirim sebagai props (tanpa axios / route /api).\n//  - export_data       : `exportData` (deferred -> halaman tampil dulu, kartu export \"Memuat data...\" sampai datanya datang)\n//  - foto_inventory    : `foto`    (1 sub-tab aktif, dipaginasi server; ?sub=&search=&page=)\n//  - riwayat_inventory : `riwayat` (dipaginasi server; ?type=&search=&page=)\n// Tab yang tidak aktif dikirim null (tidak dihitung). Aturan akses: route admin-only (routes/web.php) + scoping role di\n// RiwayatInventoryQuery / FotoInventoryQuery dipindah apa adanya dari controller API-nya.\nclass LaporanPageController extends Controller\n{\n    private const TABS = ['export_data', 'foto_inventory', 'riwayat_inventory'];\n\n    private const PER_HALAMAN = 10;\n\n    private const RIWAYAT_TYPE = ['pinjam', 'kembali', 'lapor_rusak', 'mulai_perbaikan', 'selesai_perbaikan', 'dijual'];\n\n    // GET /laporan?tab=export_data|foto_inventory|riwayat_inventory   (middleware: auth + role:admin, lihat routes/web.php)\n    // Tab kosong / tidak dikenal -> redirect ke ?tab=export_data (dulu dilakukan effect di React lewat setSearchParams).\n    public function __invoke(Request $request)\n    {\n        $tab = $request->query('tab');\n\n        if (!in_array($tab, self::TABS, true)) {\n            return redirect('/laporan?tab=export_data');\n        }\n\n        return Inertia::render('Laporan/Index', [\n            'tab' => $tab,\n            'exportData' => $tab === 'export_data' ? Inertia::defer(fn () => self::dataExport($request)) : null,\n            'foto' => $tab === 'foto_inventory' ? fn () => self::foto($request) : null,\n            'riwayat' => $tab === 'riwayat_inventory' ? fn () => self::riwayat($request) : null,\n        ]);\n    }\n\n    // Semua data mentah buat modal Export (Excel/PDF dibuat di klien dari data ini). Bentuk SAMA dengan endpoint API-nya dulu:\n    // inventory (induk saja), karyawan, kategori, departemen, cabang, perusahaan, supplier, pemakai inventory.\n    private static function dataExport(Request $request): array\n    {\n        return [\n            'inventory' => InventoryQuery::batasiUntuk(InventoryQuery::dasar()->latest()->indukSendiri(), $request->user())->get()->all(),\n            'karyawan' => KaryawanQuery::filter(User::with('departemen', 'lokasiKantor', 'roleRef'))->latest()->get()->all(),\n            'kategori' => KategoriWebController::daftar(),\n            'departemen' => DepartemenWebController::daftar(),\n            'cabang' => CabangWebController::daftar(),\n            'perusahaan' => PerusahaanWebController::daftar(),\n            'supplier' => SupplierWebController::daftar(),\n            'pemakai' => InventoryPemakai::with(['inventory', 'user'])->orderByDesc('created_at')->get()->all(),\n        ];\n    }\n\n    private static function foto(Request $request): array\n    {\n        $sub = (string) $request->query('sub', 'inventory');\n        $sub = in_array($sub, FotoInventoryQuery::SUB_TAB, true) ? $sub : 'inventory';\n        $search = trim((string) $request->query('search', ''));\n\n        $p = FotoInventoryQuery::untukTab($sub, $request->user(), $search)->paginate(self::PER_HALAMAN);\n\n        return [\n            'sub' => $sub,\n            'filters' => ['search' => $search],\n            'data' => $p->items(),\n            'current_page' => $p->currentPage(),\n            'last_page' => $p->lastPage(),\n            'total' => $p->total(),\n            'per_page' => $p->perPage(),\n        ];\n    }\n\n    private static function riwayat(Request $request): array\n    {\n        $type = $request->query('type');\n        $type = in_array($type, self::RIWAYAT_TYPE, true) ? $type : null;\n        $search = trim((string) $request->query('search', ''));\n        $page = max(1, (int) $request->query('page', 1));\n\n        return RiwayatInventoryQuery::ambil($request->user(), $type, $search, $page, self::PER_HALAMAN)\n            + ['filters' => ['type' => $type ?? 'semua', 'search' => $search]];\n    }\n}\n",
        "sha": "63156cb73f0d08e7c0ee9958ec3849fdc56b15e3b403ecbf8d2f9f3febf928c9"
      }
    ]
  },
  {
    "file": "resources/js/inertia/pages/Laporan/Index.tsx",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "find": "import { useEffect, useState } from 'react';",
        "with": "import { useState } from 'react';"
      },
      {
        "find": "import { getInventory, type Inventory } from '../../../api/masterData/inventory';",
        "with": "import type { Inventory } from '../../../api/masterData/inventory';\nimport type { LaporanExportData } from '../../../types/laporan';"
      },
      {
        "find": "import { karyawanApi, type Karyawan } from '../../../api/masterData/karyawan';",
        "with": "import type { Karyawan } from '../../../api/masterData/karyawan';"
      },
      {
        "find": "import { getAllInventoryPemakai, type InventoryPemakai } from '../../../api/transaksi/inventoryPemakai';",
        "with": "import type { InventoryPemakai } from '../../../api/transaksi/inventoryPemakai';"
      },
      {
        "find": "import { getKategori, type Kategori } from '../../../api/masterData/kategori';",
        "with": "import type { Kategori } from '../../../api/masterData/kategori';"
      },
      {
        "find": "import { getDepartemen, type Departemen } from '../../../api/masterData/departemen';",
        "with": "import type { Departemen } from '../../../api/masterData/departemen';"
      },
      {
        "find": "import { getCabang, type Cabang } from '../../../api/masterData/cabang';",
        "with": "import type { Cabang } from '../../../api/masterData/cabang';"
      },
      {
        "find": "import { getPerusahaan, type Perusahaan } from '../../../api/masterData/perusahaan';",
        "with": "import type { Perusahaan } from '../../../api/masterData/perusahaan';"
      },
      {
        "find": "import { getSupplier, type Supplier } from '../../../api/masterData/supplier';",
        "with": "import type { Supplier } from '../../../api/masterData/supplier';"
      },
      {
        "find": "const pageProps = usePage().props as unknown as { tab?: string };",
        "with": "const pageProps = usePage().props as unknown as { tab?: string; exportData?: LaporanExportData | null };"
      },
      {
        "start": "  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);",
        "end": "  if (!isStaff) {",
        "with": "  // [F7-INERTIA] Data export datang lewat props `exportData` (deferred prop dari LaporanPageController); undefined/null = belum dimuat\n  // (kartu menampilkan \"Memuat data...\"). Tidak ada axios lagi di halaman ini. Cuma state buka/tutup modal yang lokal.\n  const exportData = pageProps.exportData ?? null;\n  const inventoryList: Inventory[] = exportData?.inventory ?? [];\n  const karyawanList: Karyawan[] = exportData?.karyawan ?? [];\n  const pemakaiList: InventoryPemakai[] = exportData?.pemakai ?? [];\n  const kategoriList: Kategori[] = exportData?.kategori ?? [];\n  const departemenList: Departemen[] = exportData?.departemen ?? [];\n  const cabangList: Cabang[] = exportData?.cabang ?? [];\n  const perusahaanList: Perusahaan[] = exportData?.perusahaan ?? [];\n  const supplierList: Supplier[] = exportData?.supplier ?? [];\n  const dataLoading = !exportData;\n  const inventoryLoading = dataLoading;\n  const karyawanLoading = dataLoading;\n  const pemakaiLoading = dataLoading;\n  const kategoriLoading = dataLoading;\n  const departemenLoading = dataLoading;\n  const cabangLoading = dataLoading;\n  const perusahaanLoading = dataLoading;\n  const supplierLoading = dataLoading;\n\n  const [exportInventoryOpen, setExportInventoryOpen] = useState(false);\n  const [exportKaryawanOpen, setExportKaryawanOpen] = useState(false);\n  const [exportPemakaiOpen, setExportPemakaiOpen] = useState(false);\n  const [exportKategoriOpen, setExportKategoriOpen] = useState(false);\n  const [exportDepartemenOpen, setExportDepartemenOpen] = useState(false);\n  const [exportCabangOpen, setExportCabangOpen] = useState(false);\n  const [exportPerusahaanOpen, setExportPerusahaanOpen] = useState(false);\n  const [exportSupplierOpen, setExportSupplierOpen] = useState(false);\n\n"
      }
    ]
  },
  {
    "file": "resources/js/components/laporan/TabRiwayatInventory.tsx",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "find": "import { useCallback, useEffect, useRef, useState, type JSX } from 'react';",
        "with": "import { useEffect, useRef, useState, type JSX } from 'react';\nimport { router, usePage } from '@inertiajs/react';"
      },
      {
        "find": "import { getRiwayatInventory, type RiwayatInventoryEvent } from '../../api/transaksi/inventoryPemakai';",
        "with": "import type { RiwayatInventoryEvent } from '../../api/transaksi/inventoryPemakai';\nimport type { LaporanRiwayatProps } from '../../types/laporan';"
      },
      {
        "start": "  const [riwayatInventory, setRiwayatInventory] = useState<RiwayatInventoryEvent[]>([]);",
        "end": "  return (\n    <div className=\"bg-white rounded-xl p-6 shadow-sm border border-slate-200\">\n      <h3",
        "with": "  // [F7-INERTIA] Data dari props `riwayat` (LaporanPageController -> RiwayatInventoryQuery), dipaginasi & difilter server.\n  // Filter jenis, pencarian, dan halaman hidup di query string (?tab=riwayat_inventory&type=&search=&page=); ganti -> router.get.\n  // Auto-refresh 5 detik = partial reload async (tanpa spinner), tetap di halaman/filter/kata kunci yang dibuka.\n  const riwayat = (usePage().props as unknown as { riwayat?: LaporanRiwayatProps | null }).riwayat ?? null;\n  const riwayatInventory: RiwayatInventoryEvent[] = riwayat?.data ?? [];\n  const riwayatFilter: RiwayatFilter = riwayat?.filters.type ?? 'semua';\n  const riwayatPage = riwayat?.current_page ?? 1;\n  const riwayatLastPage = riwayat?.last_page ?? 1;\n  const riwayatTotal = riwayat?.total ?? 0;\n\n  const [riwayatSearch, setRiwayatSearchState] = useState(riwayat?.filters.search ?? '');\n  const [riwayatInventoryLoading, setRiwayatInventoryLoading] = useState(false);\n  const riwayatSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n\n  const kunjungi = (params: { type: RiwayatFilter; search: string; page?: number }, replace = true) => {\n    const data: Record<string, string | number> = { tab: 'riwayat_inventory' };\n    if (params.type !== 'semua') data.type = params.type;\n    if (params.search) data.search = params.search;\n    if (params.page && params.page > 1) data.page = params.page;\n    router.get('/laporan', data, {\n      preserveState: true,\n      preserveScroll: true,\n      replace,\n      onStart: () => setRiwayatInventoryLoading(true),\n      onFinish: () => setRiwayatInventoryLoading(false),\n    });\n  };\n\n  const gantiRiwayatFilter = (filter: RiwayatFilter) => {\n    if (filter === riwayatFilter) return;\n    if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);\n    kunjungi({ type: filter, search: riwayatSearch });\n  };\n\n  const gantiRiwayatHalaman = (target: number) => {\n    if (target < 1 || target > riwayatLastPage || target === riwayatPage) return;\n    kunjungi({ type: riwayatFilter, search: riwayat?.filters.search ?? '', page: target }, false);\n  };\n\n  // Ketik di search -> debounce 400ms baru visit (reset ke halaman 1), biar gak nembak server tiap huruf.\n  const setRiwayatSearch = (value: string) => {\n    setRiwayatSearchState(value);\n    if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);\n    riwayatSearchDebounceRef.current = setTimeout(() => kunjungi({ type: riwayatFilter, search: value }), 400);\n  };\n\n  useEffect(() => {\n    return () => {\n      if (riwayatSearchDebounceRef.current) clearTimeout(riwayatSearchDebounceRef.current);\n    };\n  }, []);\n\n  // auto-refresh tiap 5 detik biar riwayat langsung update tanpa perlu F5 (diam kalau tab browser disembunyikan)\n  useEffect(() => {\n    const interval = setInterval(() => {\n      if (document.hidden) return;\n      router.reload({ only: ['riwayat'], async: true, showProgress: false });\n    }, 5000);\n    return () => clearInterval(interval);\n  }, []);\n\n"
      }
    ]
  },
  {
    "file": "resources/js/components/laporan/TabFotoInventory.tsx",
    "marker": "[F7-INERTIA]",
    "steps": [
      {
        "find": "import { useEffect, useRef, useState } from 'react';",
        "with": "import { useEffect, useRef, useState } from 'react';\nimport { router, usePage } from '@inertiajs/react';"
      },
      {
        "find": "import { getFotoDasarInventory, type Inventory } from '../../api/masterData/inventory';",
        "with": "import type { Inventory } from '../../api/masterData/inventory';\nimport type { LaporanFotoProps } from '../../types/laporan';"
      },
      {
        "find": "import { getFotoPemakaiInventory, type FotoPemakaiEntry } from '../../api/transaksi/inventoryPemakai';",
        "with": "import type { FotoPemakaiEntry } from '../../api/transaksi/inventoryPemakai';"
      },
      {
        "find": "import { getFotoKerusakanInventory, type InventoryPenanganan } from '../../api/transaksi/inventoryPenanganan';",
        "with": "import type { InventoryPenanganan } from '../../api/transaksi/inventoryPenanganan';"
      },
      {
        "start": "// State generik yang sama bentuknya buat ketiga tab",
        "end": "  const bukaDetail = (d: FotoDetail) => setDetail(d);",
        "with": "// [F7-INERTIA] Data dari props `foto` (LaporanPageController -> FotoInventoryQuery): server cuma mengirim SATU sub-tab (yang\n// aktif) per halaman, dipaginasi server. Sub-tab, pencarian, dan halaman hidup di query string (?tab=foto_inventory&sub=&search=&page=).\n// Sub-tab lain tidak punya data di klien (state-nya kosong), jadi pindah sub-tab = visit baru (pencarian & halaman direset).\ninterface TabState<T> {\n  entries: T[];\n  loading: boolean;\n  search: string;\n  page: number;\n  lastPage: number;\n  total: number;\n}\n\nconst kosong = <T,>(): TabState<T> => ({ entries: [], loading: false, search: '', page: 1, lastPage: 1, total: 0 });\n\nexport default function TabFotoInventory() {\n  const foto = (usePage().props as unknown as { foto?: LaporanFotoProps | null }).foto ?? null;\n  const activeTab: FotoTab = foto?.sub ?? 'inventory';\n  const appliedSearch = foto?.filters.search ?? '';\n\n  const [searchInput, setSearchInput] = useState(appliedSearch);\n  const [loading, setLoading] = useState(false);\n  const [detail, setDetail] = useState<FotoDetail | null>(null);\n  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n\n  useEffect(() => {\n    return () => {\n      if (debounceRef.current) clearTimeout(debounceRef.current);\n    };\n  }, []);\n\n  const aktif = <T,>(): TabState<T> => ({\n    entries: (foto?.data ?? []) as unknown as T[],\n    loading,\n    search: appliedSearch,\n    page: foto?.current_page ?? 1,\n    lastPage: foto?.last_page ?? 1,\n    total: foto?.total ?? 0,\n  });\n\n  const inventory = activeTab === 'inventory' ? aktif<Inventory>() : kosong<Inventory>();\n  const peminjaman = activeTab === 'peminjaman' ? aktif<FotoPemakaiEntry>() : kosong<FotoPemakaiEntry>();\n  const pengembalian = activeTab === 'pengembalian' ? aktif<FotoPemakaiEntry>() : kosong<FotoPemakaiEntry>();\n  const rusak = activeTab === 'rusak' ? aktif<InventoryPenanganan>() : kosong<InventoryPenanganan>();\n\n  const kunjungi = (params: { sub: FotoTab; search?: string; page?: number }, replace = true) => {\n    const data: Record<string, string | number> = { tab: 'foto_inventory' };\n    if (params.sub !== 'inventory') data.sub = params.sub;\n    if (params.search) data.search = params.search;\n    if (params.page && params.page > 1) data.page = params.page;\n    router.get('/laporan', data, {\n      preserveState: true,\n      preserveScroll: true,\n      replace,\n      onStart: () => setLoading(true),\n      onFinish: () => setLoading(false),\n    });\n  };\n\n  const setActiveTab = (tab: FotoTab) => {\n    if (tab === activeTab) return;\n    if (debounceRef.current) clearTimeout(debounceRef.current);\n    setSearchInput('');\n    kunjungi({ sub: tab });\n  };\n\n  const currentSearch = searchInput;\n\n  const handleSearchChange = (value: string) => {\n    setSearchInput(value);\n    if (debounceRef.current) clearTimeout(debounceRef.current);\n    debounceRef.current = setTimeout(() => kunjungi({ sub: activeTab, search: value }), 400);\n  };\n\n  const gantiHalaman = (target: number) => {\n    const s = aktif<unknown>();\n    if (target < 1 || target > s.lastPage || target === s.page) return;\n    kunjungi({ sub: activeTab, search: appliedSearch, page: target }, false);\n  };\n\n"
      }
    ]
  }
];

// ---------------------------------------------------------------- RUNTIME

const abs = (rel) => path.join(ROOT, ...rel.split('/'));
const log = (...a) => console.log(...a);
const toLF = (s) => s.replace(/\r\n/g, '\n');

function countOccurrences(hay, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

function fail(msg) {
  console.error('\n[BERHENTI] ' + msg);
  console.error('Tidak ada file yang diubah.');
  process.exit(1);
}

if (!fs.existsSync(abs('artisan')) || !fs.existsSync(abs('package.json'))) {
  fail('Jalankan dari root project (folder yang berisi `artisan` dan `package.json`). Sekarang di: ' + ROOT);
}

// ------------------------------------------------------------------ REVERT
if (REVERT) {
  if (!fs.existsSync(MANIFEST)) {
    log('Tidak ada manifest backup untuk ' + FASE + ' (belum pernah dijalankan, atau sudah di-revert). Selesai.');
    process.exit(0);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const restored = [];
  const removed = [];
  const undeleted = [];
  for (const rel of [...(m.modified || []), ...(m.deleted || [])]) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!fs.existsSync(bak)) fail('Backup hilang untuk ' + rel + ' (' + bak + '). Revert dibatalkan.');
  }
  for (const rel of m.modified || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) fs.copyFileSync(bak, abs(rel));
    restored.push(rel);
  }
  for (const rel of m.deleted || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) {
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
      fs.copyFileSync(bak, abs(rel));
    }
    undeleted.push(rel);
  }
  for (const rel of m.created || []) {
    if (fs.existsSync(abs(rel))) {
      if (!DRY) {
        fs.rmSync(abs(rel));
        // rapikan folder kosong yang tadinya dibuat F7 (berhenti di folder pertama yang masih berisi)
        let dir = path.dirname(abs(rel));
        while (dir.startsWith(ROOT) && dir !== ROOT && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        }
      }
      removed.push(rel);
    }
  }
  if (!DRY) fs.rmSync(MANIFEST);
  log((DRY ? '[DRY] ' : '') + 'REVERT ' + FASE.toUpperCase());
  restored.forEach((r) => log('  dikembalikan     : ' + r));
  undeleted.forEach((r) => log('  dipulihkan       : ' + r));
  removed.forEach((r) => log('  dihapus (baru)   : ' + r));
  process.exit(0);
}

// ------------------------------------------------------------ SYARAT: F1-F7 SUDAH TERPASANG
for (const rel of [
  'app/Http/Controllers/MasterData/InventoryWebController.php',
  'app/Http/Controllers/MasterData/CabangWebController.php',
  'app/Http/Controllers/MasterData/PerusahaanWebController.php',
  'app/Http/Controllers/MasterData/SupplierWebController.php',
  'app/Queries/KaryawanQuery.php',
  'app/Queries/InventoryQuery.php',
  'app/Queries/InventoryPenangananQuery.php',
  'resources/js/components/layout/FlashToaster.tsx',
]) {
  if (!fs.existsSync(abs(rel))) fail('F7 butuh F1-F7 yang sudah terpasang (' + rel + ' tidak ditemukan). Jalankan fase sebelumnya dulu.');
}

// -------------------------------------------------------------------- PLAN
const problems = [];
const toCreate = []; // { rel, content }
const toModify = []; // { rel, original(raw), output(raw) }
const toDelete = []; // { rel, original(raw) }
const skipped = [];

for (const nf of NEW_FILES) {
  const p = abs(nf.path);
  if (fs.existsSync(p)) {
    const cur = fs.readFileSync(p, 'utf8');
    if (cur.includes('[F7-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F7, tidak ditimpa: ' + nf.path);
    continue;
  }
  toCreate.push({ rel: nf.path, content: nf.content });
}

for (const ed of EDITS) {
  const p = abs(ed.file);
  if (!fs.existsSync(p)) {
    problems.push('File tidak ditemukan: ' + ed.file);
    continue;
  }
  const raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let text = toLF(raw);

  if (text.includes(ed.marker)) {
    skipped.push(ed.file + ' (sudah terpasang)');
    continue;
  }

  let ok = true;
  ed.steps.forEach((st, i) => {
    const label = ed.file + ' langkah ' + (i + 1);
    if ('replaceAll' in st) {
      const sha = crypto.createHash('sha256').update(text).digest('hex');
      if (sha !== st.sha) {
        ok = false;
        problems.push(label + ': isi file lokal BERBEDA dari versi zip yang dipakai menyusun script ini (sha ' + sha.slice(0, 12) + ' != ' + st.sha.slice(0, 12) + '), tidak ditimpa.');
        return;
      }
      text = st.replaceAll;
      return;
    }
    if ('find' in st) {
      const c = countOccurrences(text, st.find);
      if (c !== 1) {
        ok = false;
        problems.push(label + ': anchor ' + (c === 0 ? 'TIDAK ketemu' : 'ketemu ' + c + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.find.slice(0, 90)));
        return;
      }
      text = text.replace(st.find, () => st.with);
    } else {
      const cs = countOccurrences(text, st.start);
      if (cs !== 1) {
        ok = false;
        problems.push(label + ': anchor awal ' + (cs === 0 ? 'TIDAK ketemu' : 'ketemu ' + cs + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.start.slice(0, 90)));
        return;
      }
      const a = text.indexOf(st.start);
      if (!('end' in st)) {
        // ganti dari anchor awal sampai akhir file
        text = text.slice(0, a) + st.with;
        return;
      }
      const b = text.indexOf(st.end, a + st.start.length);
      const ce = countOccurrences(text, st.end);
      if (b === -1 || ce !== 1) {
        ok = false;
        problems.push(label + ': anchor akhir ' + (b === -1 ? 'TIDAK ketemu setelah anchor awal' : 'ketemu ' + ce + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.end.slice(0, 90)));
        return;
      }
      // ganti [a, b) -- anchor akhir tetap dipertahankan
      text = text.slice(0, a) + st.with + text.slice(b);
    }
  });
  if (!ok) continue;

  const output = hadCRLF ? text.replace(/\n/g, '\r\n') : text;
  toModify.push({ rel: ed.file, original: raw, output });
}

for (const rel of DELETES) {
  const p = abs(rel);
  if (!fs.existsSync(p)) {
    skipped.push(rel + ' (sudah terhapus)');
    continue;
  }
  toDelete.push({ rel, original: fs.readFileSync(p, 'utf8') });
}

if (problems.length) {
  console.error('\nPre-check GAGAL:');
  problems.forEach((p) => console.error('  - ' + p));
  console.error('\nKemungkinan file lokal kamu sudah berbeda dari versi zip yang dipakai untuk menyusun script ini.');
  console.error('Kirim isi pesan ini + file terkait ke Claude untuk disesuaikan.');
  fail('Pre-check tidak lolos.');
}

// ------------------------------------------------------------------- APPLY
log((DRY ? '[DRY RUN] ' : '') + 'F7 - Laporan (Export Data, Foto Inventory, Riwayat Inventory) -> Inertia props');
if (!DRY) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // Run baru (belum ada manifest, mis. sesudah --revert) -> backup SELALU diperbarui dari kondisi file sekarang,
  // supaya revert berikutnya tidak mengembalikan backup basi. Run lanjutan (manifest ada) -> backup asli dipertahankan.
  const freshRun = !fs.existsSync(MANIFEST);
  let manifest = { created: [], modified: [], deleted: [] };
  if (!freshRun) manifest = { created: [], modified: [], deleted: [], ...JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) };

  const backup = (rel, original) => {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (freshRun || !fs.existsSync(bak)) {
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.writeFileSync(bak, original, 'utf8');
    }
  };

  // 1) semua backup + manifest ditulis DULU sebelum ada file proyek yang disentuh
  for (const m of toModify) {
    backup(m.rel, m.original);
    if (!manifest.modified.includes(m.rel)) manifest.modified.push(m.rel);
  }
  for (const d of toDelete) {
    backup(d.rel, d.original);
    if (!manifest.deleted.includes(d.rel)) manifest.deleted.push(d.rel);
  }
  for (const c of toCreate) {
    if (!manifest.created.includes(c.rel)) manifest.created.push(c.rel);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  // 2) baru terapkan
  for (const m of toModify) fs.writeFileSync(abs(m.rel), m.output, 'utf8');
  for (const c of toCreate) {
    fs.mkdirSync(path.dirname(abs(c.rel)), { recursive: true });
    fs.writeFileSync(abs(c.rel), c.content, 'utf8');
  }
  for (const d of toDelete) fs.rmSync(abs(d.rel));
}

// ----------------------------------------------------------------- SUMMARY
log('');
log('Dibuat   (' + toCreate.length + ')');
toCreate.forEach((c) => log('  + ' + c.rel));
log('Diubah   (' + toModify.length + ')');
toModify.forEach((m) => log('  ~ ' + m.rel));
log('Dihapus  (' + toDelete.length + ')  -- dipindah ke backup, bisa dikembalikan dengan --revert');
toDelete.forEach((d) => log('  - ' + d.rel));
log('Dilewati (' + skipped.length + ')');
skipped.forEach((s) => log('  = ' + s));

if (DRY) {
  log('\nDry run selesai, tidak ada yang ditulis. Jalankan tanpa --dry untuk menerapkan.');
} else {
  log('\nBackup asli: .migrasi-backup/f7/   (kembalikan: node f7.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=laporan');
log('  npx tsc --noEmit');
log('  npm run build');
