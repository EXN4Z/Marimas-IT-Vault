#!/usr/bin/env node
// =============================================================================
// F1 - Migrasi ke Inertia: Cabang + Perusahaan (baca -> props, mutasi -> router, modal tetap overlay)
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f1.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f1.mjs            terapkan
//   node f1.mjs --revert   kembalikan semua dari .migrasi-backup/f1/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x, script berhenti
// SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const FASE = 'f1';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    path: "app/Http/Controllers/MasterData/CabangWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Http\\Controllers\\Controller;
use App\\Imports\\MasterData\\CabangImport;
use App\\Models\\MasterData\\LokasiKantor;
use Exception;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

// [F1-INERTIA] Versi Inertia dari CabangController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// CabangController (API) sengaja dibiarkan dulu; dihapus di F10 setelah tidak ada pemakainya.
class CabangWebController extends Controller
{
    // Data tab Cabang buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan CabangController::index() (API).
    public static function daftar(): array
    {
        return LokasiKantor::withCount(['karyawan as pekerja_count'])
            ->with('akunCabang')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'nama' => $item->nama,
                'alamat' => $item->alamat,
                'telepon' => $item->telepon,
                'link' => $item->link,
                'pekerja_count' => $item->pekerja_count,
                'email' => $item->akunCabang?->email,
            ])
            ->all();
    }

    // POST /master-data/cabang
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:150',
            'alamat' => 'required|string|max:1000|unique:lokasi_kantor,alamat',
            'telepon' => 'nullable|string|max:30',
            'link' => 'nullable|string|max:255|unique:lokasi_kantor,link',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
            'alamat.unique' => 'Alamat ini sudah terdaftar di cabang lain.',
            'link.unique'   => 'Link ini sudah digunakan oleh cabang lain.',
        ]);

        LokasiKantor::create($validated);

        return back()->with('success', 'Cabang baru berhasil ditambahkan.');
    }

    // PUT /master-data/cabang/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $cabang = LokasiKantor::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'sometimes|required|string|max:150',
            'alamat' => 'sometimes|required|string|max:1000',
            'telepon' => 'sometimes|nullable|string|max:30',
            'link' => 'sometimes|nullable|string|max:255',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
        ]);

        $cabang->update($validated);

        return back()->with('success', 'Data cabang berhasil diperbarui.');
    }

    // DELETE /master-data/cabang/{id}
    // Gagal -> error bag key "delete" (ditampilkan di dalam modal konfirmasi hapus).
    public function destroy($id): RedirectResponse
    {
        $cabang = LokasiKantor::withCount(['karyawan as pekerja_count'])->findOrFail($id);

        if ($cabang->pekerja_count > 0) {
            throw ValidationException::withMessages([
                'delete' => 'Cabang ini masih memiliki ' . $cabang->pekerja_count . ' pegawai. Pindahkan pegawai terlebih dahulu sebelum menghapus.',
            ]);
        }

        DB::transaction(function () use ($cabang) {
            // Hapus akun user (role cabang) yang terhubung ke lokasi ini dulu,
            // baru hapus cabangnya -- biar gak ada akun "nyantol" tanpa cabang
            $cabang->akunCabang?->delete();
            $cabang->delete();
        });

        return back()->with('success', 'Cabang berhasil dihapus.');
    }

    // POST /master-data/cabang/import -- Excel (.xlsx/.xls). Kolom: Nama | Alamat | Telepon | Link.
    // Gagal -> error bag key "file" (pesan pertama), semua-atau-tidak-sama-sekali (rollback).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new CabangImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data cabang.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} cabang baru"
                    . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '');
            }
        } catch (Exception $e) {
            DB::rollBack();
            $pesanError = 'Gagal import: ' . $e->getMessage();
        }

        if ($pesanError !== null) {
            throw ValidationException::withMessages(['file' => $pesanError]);
        }

        return back()->with('success', $pesanSukses);
    }
}
`,
  },
  {
    path: "app/Http/Controllers/MasterData/PerusahaanWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Http\\Controllers\\Controller;
use App\\Imports\\MasterData\\PerusahaanImport;
use App\\Models\\MasterData\\Perusahaan;
use Exception;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

// [F1-INERTIA] Versi Inertia dari PerusahaanController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// PerusahaanController (API) sengaja dibiarkan dulu; dihapus di F10 setelah tidak ada pemakainya.
class PerusahaanWebController extends Controller
{
    // Data tab Perusahaan buat props halaman Master Data (dipakai MasterDataPageController).
    public static function daftar(): array
    {
        return Perusahaan::orderBy('nama')->get()->all();
    }

    // POST /master-data/perusahaan
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:150',
            'alamat' => 'required|string|max:1000|unique:perusahaan,alamat',
            'telepon' => 'required|string|max:30',
            'link' => 'required|string|max:255|unique:perusahaan,link',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
            'telepon.required' => 'Kolom nomor telepon wajib diisi.',
            'link.required' => 'Kolom link wajib diisi.',
            'alamat.unique' => 'Alamat ini sudah terdaftar di cabang lain.',
            'link.unique'   => 'Link ini sudah digunakan oleh cabang lain.',
        ]);

        Perusahaan::create($validated);

        return back()->with('success', 'Perusahaan baru berhasil ditambahkan.');
    }

    // PUT /master-data/perusahaan/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $perusahaan = Perusahaan::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'sometimes|required|string|max:150',
            'alamat' => 'sometimes|required|string|max:1000',
            'telepon' => 'sometimes|required|string|max:30',
            'link' => 'sometimes|required|string|max:255',
        ], [
            'nama.required' => 'Kolom nama wajib diisi.',
            'alamat.required' => 'Kolom alamat wajib diisi.',
            'telepon.required' => 'Kolom nomor telepon wajib diisi.',
            'link.required' => 'Kolom link wajib diisi.',
        ]);

        $perusahaan->update($validated);

        return back()->with('success', 'Data perusahaan berhasil diperbarui.');
    }

    // DELETE /master-data/perusahaan/{id}
    public function destroy($id): RedirectResponse
    {
        Perusahaan::findOrFail($id)->delete();

        return back()->with('success', 'Perusahaan berhasil dihapus.');
    }

    // POST /master-data/perusahaan/import -- Excel (.xlsx/.xls). Kolom: Nama | Alamat | Telepon | Link.
    // Gagal -> error bag key "file" (pesan pertama), semua-atau-tidak-sama-sekali (rollback).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new PerusahaanImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data perusahaan.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} perusahaan baru"
                    . ($import->getUpdatedCount() > 0 ? ", {$import->getUpdatedCount()} diperbarui" : '');
            }
        } catch (Exception $e) {
            DB::rollBack();
            $pesanError = 'Gagal import: ' . $e->getMessage();
        }

        if ($pesanError !== null) {
            throw ValidationException::withMessages(['file' => $pesanError]);
        }

        return back()->with('success', $pesanSukses);
    }
}
`,
  },
  {
    path: "resources/js/components/layout/FlashToaster.tsx",
    content: `import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import type { Flash } from '../../types/inertia';

// [F1-INERTIA] Satu-satunya tempat yang menampilkan toast dari flash server (session success/error).
// Controller cukup \`back()->with('success', '...')\`; komponen tidak perlu toast manual setelah mutasi.
// Dipasang sekali di InertiaAppLayout (persistent layout). Pakai event 'success' per visit, jadi pesan yang
// sama dua kali berturut-turut tetap muncul dua kali.
export default function FlashToaster() {
  useEffect(() => {
    return router.on('success', (event) => {
      const flash = (event.detail.page.props as { flash?: Flash }).flash;
      if (flash?.success) toast.success(flash.success);
      if (flash?.error) toast.error(flash.error);
    });
  }, []);

  return null;
}
`,
  },
];

const EDITS = [
  {
    file: "resources/js/components/masterData/TabCabang.tsx",
    marker: `router.post('/master-data/cabang'`,
    steps: [
      { find: `import { getCabang, createCabang, updateCabang, deleteCabang, importCabang, type Cabang } from '../../api/masterData/cabang';`,
        with: `import { router, usePage } from '@inertiajs/react';
import type { Cabang } from '../../api/masterData/cabang';` },
      { find: `import { Skeleton } from '../shared/skeleton';
`,
        with: `` },
      { find: `// getCabang(), tinggal dipotong per halaman di sini`,
        with: `// props.cabang dari server, tinggal dipotong per halaman di sini` },
      { start: `  const [cabangList, setCabangList] = useState<Cabang[]>([]);`,
        end: `  const [modalOpen, setModalOpen]`,
        with: `  // Data dari server: MasterDataPageController -> props.cabang (hanya dikirim saat tab "cabang" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const cabangList: Cabang[] = (usePage().props as unknown as { cabang?: Cabang[] }).cabang ?? [];

` },
      { start: `  const loadData = async () => {`,
        end: `  const filteredCabang = `,
        with: `` },
      { start: `  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {`,
        end: `  const handleExport = async () => {`,
        with: `  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    // Sukses -> toast dari flash server (FlashToaster). Gagal -> error bag "file".
    router.post('/master-data/cabang/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data cabang.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

` },
      { start: `    setSubmitting(true);
    setFormErrors({});`,
        end: `  const handleDelete = async () => {`,
        with: `    setSubmitting(true);
    setFormErrors({});

    const payload = {
      nama: formNama.trim(),
      alamat: formAlamat.trim(),
      telepon: formTelepon.trim(),
      link: formLink.trim(),
    };
    // Sukses -> toast dari flash server (FlashToaster). Gagal validasi -> error bag per field.
    const options = {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setModalOpen(false);
        if (!editing) setCurrentPage(1); // biar data baru langsung kelihatan
      },
      onError: (errors: Record<string, string>) =>
        setFormErrors({
          nama: errors.nama,
          alamat: errors.alamat,
          telepon: errors.telepon,
          link: errors.link,
        }),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(\`/master-data/cabang/\${editing.id}\`, payload, options);
    else router.post('/master-data/cabang', payload, options);
  };

` },
      { start: `  const handleDelete = async () => {`,
        end: `  if (!isStaff) {`,
        with: `  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    // Sukses -> toast dari flash server. Gagal (mis. masih ada relasi) -> error bag "delete", tampil di modal.
    router.delete(\`/master-data/cabang/\${deleteTarget.id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => setDeleteError(errors.delete || 'Gagal menghapus cabang.'),
      onFinish: () => setDeleting(false),
    });
  };

` },
      { start: `        {loading && (`,
        end: `        {!loading && !error && cabangList.length === 0 && (`,
        with: `` },
      { find: `{!loading && !error && cabangList.length === 0 && (`,
        with: `{cabangList.length === 0 && (` },
      { find: `{!loading && !error && cabangList.length > 0 && filteredCabang.length === 0 && (`,
        with: `{cabangList.length > 0 && filteredCabang.length === 0 && (` },
      { find: `{!loading && !error && filteredCabang.length > 0 && (`,
        with: `{filteredCabang.length > 0 && (` },
    ],
  },
  {
    file: "resources/js/components/masterData/TabPerusahaan.tsx",
    marker: `router.post('/master-data/perusahaan'`,
    steps: [
      { find: `import { getPerusahaan, createPerusahaan, updatePerusahaan, deletePerusahaan, importPerusahaan, type Perusahaan } from '../../api/masterData/perusahaan';`,
        with: `import { router, usePage } from '@inertiajs/react';
import type { Perusahaan } from '../../api/masterData/perusahaan';` },
      { find: `import { Skeleton } from '../shared/skeleton';
`,
        with: `` },
      { find: `// getPerusahaan(), tinggal dipotong per halaman di sini`,
        with: `// props.perusahaan dari server, tinggal dipotong per halaman di sini` },
      { start: `  const [perusahaanList, setPerusahaanList] = useState<Perusahaan[]>([]);`,
        end: `  const [modalOpen, setModalOpen]`,
        with: `  // Data dari server: MasterDataPageController -> props.perusahaan (hanya dikirim saat tab "perusahaan" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const perusahaanList: Perusahaan[] = (usePage().props as unknown as { perusahaan?: Perusahaan[] }).perusahaan ?? [];

` },
      { start: `  const loadData = async () => {`,
        end: `  const filteredPerusahaan = `,
        with: `` },
      { start: `  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {`,
        end: `  const handleExport = async () => {`,
        with: `  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    // Sukses -> toast dari flash server (FlashToaster). Gagal -> error bag "file".
    router.post('/master-data/perusahaan/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data perusahaan.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

` },
      { start: `    setSubmitting(true);
    setFormErrors({});`,
        end: `  const handleDelete = async () => {`,
        with: `    setSubmitting(true);
    setFormErrors({});

    const payload = {
      nama: formNama.trim(),
      alamat: formAlamat.trim(),
      telepon: formTelepon.trim(),
      link: formLink.trim(),
    };
    // Sukses -> toast dari flash server (FlashToaster). Gagal validasi -> error bag per field.
    const options = {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setModalOpen(false);
        if (!editing) setCurrentPage(1); // biar data baru langsung kelihatan
      },
      onError: (errors: Record<string, string>) =>
        setFormErrors({
          nama: errors.nama,
          alamat: errors.alamat,
          telepon: errors.telepon,
          link: errors.link,
        }),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(\`/master-data/perusahaan/\${editing.id}\`, payload, options);
    else router.post('/master-data/perusahaan', payload, options);
  };

` },
      { start: `  const handleDelete = async () => {`,
        end: `  if (!isStaff) {`,
        with: `  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    // Sukses -> toast dari flash server. Gagal (mis. masih ada relasi) -> error bag "delete", tampil di modal.
    router.delete(\`/master-data/perusahaan/\${deleteTarget.id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => setDeleteError(errors.delete || 'Gagal menghapus perusahaan.'),
      onFinish: () => setDeleting(false),
    });
  };

` },
      { start: `        {loading && (`,
        end: `        {!loading && !error && perusahaanList.length === 0 && (`,
        with: `` },
      { find: `{!loading && !error && perusahaanList.length === 0 && (`,
        with: `{perusahaanList.length === 0 && (` },
      { find: `{!loading && !error && perusahaanList.length > 0 && filteredPerusahaan.length === 0 && (`,
        with: `{perusahaanList.length > 0 && filteredPerusahaan.length === 0 && (` },
      { find: `{!loading && !error && filteredPerusahaan.length > 0 && (`,
        with: `{filteredPerusahaan.length > 0 && (` },
    ],
  },
  {
    file: "routes/web.php",
    marker: `CabangWebController`,
    steps: [
      { find: `use App\\Http\\Controllers\\MasterData\\MasterDataPageController;`,
        with: `use App\\Http\\Controllers\\MasterData\\MasterDataPageController;
use App\\Http\\Controllers\\MasterData\\CabangWebController;
use App\\Http\\Controllers\\MasterData\\PerusahaanWebController;
use App\\Http\\Middleware\\LogActivity;` },
      { find: `    // Karyawan: create / detail / edit (admin-only;`,
        with: `    // Master Data: Cabang & Perusahaan (admin-only). Mutasi lewat Inertia (redirect back + flash).
    // LogActivity dipasang manual di sini karena di bootstrap/app.php audit log cuma nempel di grup 'api'.
    // Route statis (/import) HARUS di atas route {id}.
    Route::middleware(['role:admin', LogActivity::class])->prefix('master-data')->group(function () {
        Route::post('/cabang/import', [CabangWebController::class, 'import']);
        Route::post('/cabang', [CabangWebController::class, 'store']);
        Route::put('/cabang/{id}', [CabangWebController::class, 'update'])->whereNumber('id');
        Route::delete('/cabang/{id}', [CabangWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/perusahaan/import', [PerusahaanWebController::class, 'import']);
        Route::post('/perusahaan', [PerusahaanWebController::class, 'store']);
        Route::put('/perusahaan/{id}', [PerusahaanWebController::class, 'update'])->whereNumber('id');
        Route::delete('/perusahaan/{id}', [PerusahaanWebController::class, 'destroy'])->whereNumber('id');
    });

    // Karyawan: create / detail / edit (admin-only;` },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/MasterDataPageController.php",
    marker: `CabangWebController::daftar()`,
    steps: [
      { find: `        return Inertia::render('MasterData/Index', [
            'tab' => in_array($tab, $allowed, true) ? $tab : 'inventory',
        ]);`,
        with: `        $tab = in_array($tab, $allowed, true) ? $tab : 'inventory';

        return Inertia::render('MasterData/Index', [
            'tab' => $tab,
            // Data tab dikirim hanya saat tab itu aktif (closure = lazy; null = tidak dikirim isinya).
            'cabang' => $tab === 'cabang' ? fn () => CabangWebController::daftar() : null,
            'perusahaan' => $tab === 'perusahaan' ? fn () => PerusahaanWebController::daftar() : null,
        ]);` },
    ],
  },
  {
    file: "resources/js/components/layout/InertiaAppLayout.tsx",
    marker: `FlashToaster`,
    steps: [
      { find: `import InertiaAuthSync from './InertiaAuthSync';`,
        with: `import InertiaAuthSync from './InertiaAuthSync';
import FlashToaster from './FlashToaster';` },
      { find: `      <InertiaAuthSync />`,
        with: `      <InertiaAuthSync />
      <FlashToaster />` },
    ],
  },
  {
    file: "resources/js/inertia/pages/Settings/Index.tsx",
    marker: `FlashToaster`,
    steps: [
      { find: `      onSuccess: () => toast.success('Profil berhasil diperbarui.'),
`,
        with: `      // Toast sukses datang dari flash server (FlashToaster).
` },
      { find: `        password.reset();
        toast.success('Password berhasil diperbarui.');`,
        with: `        password.reset(); // toast sukses datang dari flash server (FlashToaster)` },
    ],
  },
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
  for (const rel of m.modified || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!fs.existsSync(bak)) fail('Backup hilang untuk ' + rel + ' (' + bak + '). Revert dibatalkan.');
  }
  for (const rel of m.modified || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) fs.copyFileSync(bak, abs(rel));
    restored.push(rel);
  }
  for (const rel of m.created || []) {
    if (fs.existsSync(abs(rel))) {
      if (!DRY) fs.rmSync(abs(rel));
      removed.push(rel);
    }
  }
  if (!DRY) fs.rmSync(MANIFEST);
  log((DRY ? '[DRY] ' : '') + 'REVERT ' + FASE.toUpperCase());
  restored.forEach((r) => log('  dikembalikan : ' + r));
  removed.forEach((r) => log('  dihapus      : ' + r));
  process.exit(0);
}

// -------------------------------------------------------------------- PLAN
const problems = [];
const toCreate = []; // { rel, content }
const toModify = []; // { rel, original(raw), output(raw) }
const skipped = [];

for (const nf of NEW_FILES) {
  const p = abs(nf.path);
  if (fs.existsSync(p)) {
    const cur = fs.readFileSync(p, 'utf8');
    if (cur.includes('[F1-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F1, tidak ditimpa: ' + nf.path);
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

if (problems.length) {
  console.error('\nPre-check GAGAL:');
  problems.forEach((p) => console.error('  - ' + p));
  console.error('\nKemungkinan file lokal kamu sudah berbeda dari versi zip yang dipakai untuk menyusun script ini.');
  console.error('Kirim isi pesan ini + file terkait ke Claude untuk disesuaikan.');
  fail('Pre-check tidak lolos.');
}

// ------------------------------------------------------------------- APPLY
log((DRY ? '[DRY RUN] ' : '') + 'F1 - Cabang + Perusahaan -> Inertia');
if (!DRY) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  let manifest = { created: [], modified: [] };
  if (fs.existsSync(MANIFEST)) manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  for (const m of toModify) {
    const bak = path.join(BACKUP_DIR, ...m.rel.split('/'));
    if (!fs.existsSync(bak)) {
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.writeFileSync(bak, m.original, 'utf8'); // backup asli, tidak pernah ditimpa lagi
    }
    if (!manifest.modified.includes(m.rel)) manifest.modified.push(m.rel);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  for (const m of toModify) fs.writeFileSync(abs(m.rel), m.output, 'utf8');
  for (const c of toCreate) {
    fs.mkdirSync(path.dirname(abs(c.rel)), { recursive: true });
    fs.writeFileSync(abs(c.rel), c.content, 'utf8');
    if (!manifest.created.includes(c.rel)) manifest.created.push(c.rel);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

// ----------------------------------------------------------------- SUMMARY
log('');
log('Dibuat   (' + toCreate.length + ')');
toCreate.forEach((c) => log('  + ' + c.rel));
log('Diubah   (' + toModify.length + ')');
toModify.forEach((m) => log('  ~ ' + m.rel));
log('Dilewati (' + skipped.length + ')');
skipped.forEach((s) => log('  = ' + s));
log('Dihapus  (0)  -- F1 tidak menghapus file apa pun (API lama dibiarkan sampai F10)');

if (DRY) {
  log('\nDry run selesai, tidak ada yang ditulis. Jalankan tanpa --dry untuk menerapkan.');
} else {
  log('\nBackup asli: .migrasi-backup/f1/   (kembalikan: node f1.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=master-data');
log('  npx tsc --noEmit');
log('  npm run build');
