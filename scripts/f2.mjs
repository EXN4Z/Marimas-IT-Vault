#!/usr/bin/env node
// =============================================================================
// F2 - Migrasi ke Inertia: Departemen + Kategori + Supplier (baca -> props, mutasi -> router, modal tetap overlay)
//
// Syarat: F1 sudah terpasang (pola acuan: CabangWebController, FlashToaster, grup route master-data).
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f2.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f2.mjs            terapkan
//   node f2.mjs --revert   kembalikan semua dari .migrasi-backup/f2/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x, script berhenti
// SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const FASE = 'f2';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    path: "app/Http/Controllers/MasterData/DepartemenWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Http\\Controllers\\Controller;
use App\\Imports\\MasterData\\DepartemenImport;
use App\\Models\\MasterData\\Departemen;
use Exception;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

// [F2-INERTIA] Versi Inertia dari DepartemenController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// DepartemenController (API) sengaja dibiarkan dulu: GET /api/departemen masih dipakai dropdown Karyawan & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class DepartemenWebController extends Controller
{
    // Data tab Departemen buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan DepartemenController::index() (API).
    public static function daftar(): array
    {
        return Departemen::orderBy('nama')->get()->all();
    }

    // POST /master-data/departemen
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|unique:departemen,nama',
        ]);

        Departemen::create($validated);

        return back()->with('success', 'Departemen berhasil ditambahkan.');
    }

    // PUT /master-data/departemen/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $departemen = Departemen::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'required|string|unique:departemen,nama,' . $departemen->id,
        ]);

        $departemen->update($validated);

        return back()->with('success', 'Departemen berhasil diperbarui.');
    }

    // DELETE /master-data/departemen/{id}
    // FK users.departemen_id = nullOnDelete, jadi hapus tidak pernah ditolak relasi (sama seperti versi API).
    public function destroy($id): RedirectResponse
    {
        Departemen::findOrFail($id)->delete();

        return back()->with('success', 'Departemen berhasil dihapus.');
    }

    // POST /master-data/departemen/import -- Excel (.xlsx/.xls). Kolom: Nama. Nama yang sudah ada dilewati.
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
            $import = new DepartemenImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data departemen.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} departemen baru"
                    . ($import->getSkippedCount() > 0 ? ", {$import->getSkippedCount()} dilewati (sudah ada)" : '');
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
    path: "app/Http/Controllers/MasterData/KategoriWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Http\\Controllers\\Controller;
use App\\Models\\MasterData\\Kategori;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\ValidationException;

// [F2-INERTIA] Versi Inertia dari KategoriController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// KategoriController (API) sengaja dibiarkan dulu: GET /api/kategori masih dipakai Inventory & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class KategoriWebController extends Controller
{
    // Data tab Kategori buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan KategoriController::index() (API).
    public static function daftar(): array
    {
        return Kategori::orderBy('nama')->get()->all();
    }

    // POST /master-data/kategori
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|max:255',
        ]);

        Kategori::create($validated);

        return back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    // PUT /master-data/kategori/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $kategori = Kategori::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'required|string|max:255',
        ]);

        $kategori->update($validated);

        return back()->with('success', 'Kategori berhasil diperbarui.');
    }

    // DELETE /master-data/kategori/{id}
    // FK ke inventory.kategori_id = restrictOnDelete, jadi dicek manual dulu biar pesannya rapi.
    // Gagal -> error bag key "delete" (ditampilkan di dalam modal konfirmasi hapus).
    public function destroy($id): RedirectResponse
    {
        $kategori = Kategori::findOrFail($id);

        if ($kategori->inventory()->exists()) {
            throw ValidationException::withMessages([
                'delete' => 'Kategori ini masih dipakai oleh data Inventory dan tidak bisa dihapus.',
            ]);
        }

        $kategori->delete();

        return back()->with('success', 'Kategori berhasil dihapus.');
    }
}
`,
  },
  {
    path: "app/Http/Controllers/MasterData/SupplierWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Http\\Controllers\\Controller;
use App\\Imports\\MasterData\\SupplierImport;
use App\\Models\\MasterData\\Supplier;
use Exception;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

// [F2-INERTIA] Versi Inertia dari SupplierController (API). Dipanggil lewat routes/web.php (session + CSRF),
// balasan = redirect back + flash (bukan JSON). Aturan validasi & logika SAMA dengan versi API.
// SupplierController (API) sengaja dibiarkan dulu: GET /api/supplier masih dipakai Inventory & Laporan.
// Dihapus/dipangkas di F10 setelah tidak ada pemakainya.
class SupplierWebController extends Controller
{
    // Data tab Supplier buat props halaman Master Data (dipakai MasterDataPageController).
    // Bentuk sama dengan SupplierController::index() (API).
    public static function daftar(): array
    {
        return Supplier::orderBy('nama')->get()->all();
    }

    // POST /master-data/supplier
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nama' => 'required|string|unique:supplier,nama',
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ]);

        Supplier::create($validated);

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    // PUT /master-data/supplier/{id}
    public function update(Request $request, $id): RedirectResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'nama' => 'required|string|unique:supplier,nama,' . $supplier->id,
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ]);

        $supplier->update($validated);

        return back()->with('success', 'Supplier berhasil diperbarui.');
    }

    // DELETE /master-data/supplier/{id}
    // FK inventory.supplier_id = nullOnDelete, jadi hapus tidak pernah ditolak relasi (sama seperti versi API).
    public function destroy($id): RedirectResponse
    {
        Supplier::findOrFail($id)->delete();

        return back()->with('success', 'Supplier berhasil dihapus.');
    }

    // POST /master-data/supplier/import -- Excel (.xlsx/.xls). Kolom: Nama | Alamat | Telepon.
    // Nama yang sudah ada di-UPDATE (bukan dilewati). Gagal -> error bag key "file" (pesan pertama),
    // semua-atau-tidak-sama-sekali (rollback).
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $pesanError = null;
        $pesanSukses = null;

        DB::beginTransaction();
        try {
            $import = new SupplierImport();
            Excel::import($import, $request->file('file'));

            if (count($import->getErrors()) > 0) {
                DB::rollBack();
                $pesanError = (string) ($import->getErrors()[0] ?? 'Gagal import data supplier.');
            } else {
                DB::commit();
                $pesanSukses = "Berhasil import {$import->getCreatedCount()} supplier baru"
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
];

const EDITS = [
  // ------------------------------------------------------------------ TabDepartemen
  {
    file: "resources/js/components/masterData/TabDepartemen.tsx",
    marker: `router.post('/master-data/departemen'`,
    steps: [
      { find: `import { useCallback, useEffect, useRef, useState } from 'react';`,
        with: `import { useEffect, useRef, useState } from 'react';` },
      { find: `import { SkeletonTable } from '../shared/skeleton';
`,
        with: `` },
      { find: `import {
  getDepartemen,
  createDepartemen,
  updateDepartemen,
  deleteDepartemen,
  importDepartemen,
  type Departemen,
} from '../../api/masterData/departemen';`,
        with: `import { router, usePage } from '@inertiajs/react';
import type { Departemen } from '../../api/masterData/departemen';` },
      { find: `lewat getDepartemen(),`,
        with: `lewat props.departemen (server),` },
      { start: `  const [items, setItems] = useState<Departemen[]>([]);`,
        end: `  const [modalOpen, setModalOpen]`,
        with: `  // Data dari server: MasterDataPageController -> props.departemen (hanya dikirim saat tab "departemen" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const items: Departemen[] = (usePage().props as unknown as { departemen?: Departemen[] }).departemen ?? [];

` },
      { start: `  const loadData = useCallback(async () => {`,
        end: `  const filteredItems = items.filter((item) => {`,
        with: `` },
      { start: `  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {`,
        end: `  const handleExport = async () => {`,
        with: `  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    // Sukses -> toast dari flash server (FlashToaster). Gagal -> error bag "file".
    router.post('/master-data/departemen/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data departemen.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

` },
      { start: `    setSubmitting(true);
    setFormError('');
    try {
      const nama = formNama.trim();`,
        end: `  const handleDelete = async () => {`,
        with: `    setSubmitting(true);
    setFormError('');

    const payload = { nama: formNama.trim() };
    // Sukses -> toast dari flash server (FlashToaster). Gagal validasi -> error bag per field.
    const options = {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setModalOpen(false);
        if (!editing) setCurrentPage(1); // biar data baru langsung kelihatan
      },
      onError: (errors: Record<string, string>) => setFormError(errors.nama || 'Gagal menyimpan departemen.'),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(\`/master-data/departemen/\${editing.id}\`, payload, options);
    else router.post('/master-data/departemen', payload, options);
  };

` },
      { start: `  const handleDelete = async () => {`,
        end: `  return (
    <>
`,
        with: `  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Sukses -> toast dari flash server. Gagal -> toast error + tutup modal (perilaku lama).
    router.delete(\`/master-data/departemen/\${deleteTarget.id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => {
        toast.error(errors.delete || 'Gagal menghapus departemen.');
        setDeleteTarget(null);
      },
      onFinish: () => setDeleting(false),
    });
  };

` },
      { start: `            {loading && (`,
        end: `            {!loading && !error && items.length === 0 && (`,
        with: `` },
      { find: `{!loading && !error && items.length === 0 && (`,
        with: `{items.length === 0 && (` },
      { find: `{!loading && !error && items.length > 0 && filteredItems.length === 0 && (`,
        with: `{items.length > 0 && filteredItems.length === 0 && (` },
      { find: `{!loading && !error && filteredItems.length > 0 && (`,
        with: `{filteredItems.length > 0 && (` },
    ],
  },
  // ------------------------------------------------------------------ TabKategori
  {
    file: "resources/js/components/masterData/TabKategori.tsx",
    marker: `router.post('/master-data/kategori'`,
    steps: [
      { find: `import { SkeletonTable } from '../shared/skeleton';
`,
        with: `` },
      { find: `import {
  getKategori,
  createKategori,
  updateKategori,
  deleteKategori,
  type Kategori,
  type KategoriFormValues,
} from '../../api/masterData/kategori';`,
        with: `import { router, usePage } from '@inertiajs/react';
import type { Kategori } from '../../api/masterData/kategori';` },
      { find: `// getKategori(), jadi tinggal`,
        with: `// props.kategori dari server, jadi tinggal` },
      { start: `  const [items, setItems] = useState<Kategori[]>([]);`,
        end: `  const [modalOpen, setModalOpen]`,
        with: `  // Data dari server: MasterDataPageController -> props.kategori (hanya dikirim saat tab "kategori" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const items: Kategori[] = (usePage().props as unknown as { kategori?: Kategori[] }).kategori ?? [];

` },
      { start: `  const loadData = async () => {`,
        end: `  const filteredItems = items.filter(`,
        with: `` },
      { start: `    setSubmitting(true);
    setFormError('');
    try {
      const payload: KategoriFormValues = { nama: formNama.trim() };`,
        end: `  const handleDelete = async () => {`,
        with: `    setSubmitting(true);
    setFormError('');

    const payload = { nama: formNama.trim() };
    // Sukses -> toast dari flash server (FlashToaster). Gagal validasi -> error bag per field.
    const options = {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        setModalOpen(false);
        if (!editing) setCurrentPage(1); // biar kategori baru langsung kelihatan
      },
      onError: (errors: Record<string, string>) => setFormError(errors.nama || 'Gagal menyimpan kategori.'),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(\`/master-data/kategori/\${editing.id}\`, payload, options);
    else router.post('/master-data/kategori', payload, options);
  };

` },
      { start: `  const handleDelete = async () => {`,
        end: `  return (
    <>
`,
        with: `  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    // Sukses -> toast dari flash server. Gagal (masih dipakai Inventory) -> error bag "delete", tampil di modal.
    router.delete(\`/master-data/kategori/\${deleteTarget.id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => setDeleteError(errors.delete || 'Gagal menghapus kategori.'),
      onFinish: () => setDeleting(false),
    });
  };

` },
      { find: `            onClick={() => setShowExportModal(true)}
            disabled={loading || !!error}
`,
        with: `            onClick={() => setShowExportModal(true)}
` },
      { find: `            onClick={openCreateModal}
            disabled={loading || !!error}
`,
        with: `            onClick={openCreateModal}
` },
      { start: `          {loading && (`,
        end: `          {!loading && !error && items.length === 0 && (`,
        with: `` },
      { find: `{!loading && !error && items.length === 0 && (`,
        with: `{items.length === 0 && (` },
      { find: `{!loading && !error && items.length > 0 && filteredItems.length === 0 && (`,
        with: `{items.length > 0 && filteredItems.length === 0 && (` },
      { find: `{!loading && !error && filteredItems.length > 0 && (`,
        with: `{filteredItems.length > 0 && (` },
    ],
  },
  // ------------------------------------------------------------------ TabSupplier
  {
    file: "resources/js/components/masterData/TabSupplier.tsx",
    marker: `router.post('/master-data/supplier'`,
    steps: [
      { find: `import { useCallback, useEffect, useRef, useState } from 'react';`,
        with: `import { useEffect, useRef, useState } from 'react';` },
      { find: `import { SkeletonTable } from '../shared/skeleton';
`,
        with: `` },
      { find: `import {
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  importSupplier,
  type Supplier,
} from '../../api/masterData/supplier';`,
        with: `import { router, usePage } from '@inertiajs/react';
import type { Supplier } from '../../api/masterData/supplier';` },
      { find: `lewat getSupplier(),`,
        with: `lewat props.supplier (server),` },
      { start: `  const [items, setItems] = useState<Supplier[]>([]);`,
        end: `  const [modalOpen, setModalOpen]`,
        with: `  // Data dari server: MasterDataPageController -> props.supplier (hanya dikirim saat tab "supplier" aktif).
  // Otomatis ter-update tiap mutasi (router.post/put/delete) selesai & server redirect balik ke halaman ini.
  const items: Supplier[] = (usePage().props as unknown as { supplier?: Supplier[] }).supplier ?? [];

` },
      { start: `  const loadData = useCallback(async () => {`,
        end: `  const filteredItems = items.filter((item) => {`,
        with: `` },
      { start: `  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {`,
        end: `  const handleExport = async () => {`,
        with: `  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    // Sukses -> toast dari flash server (FlashToaster). Gagal -> error bag "file".
    router.post('/master-data/supplier/import', { file }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onError: (errors) => toast.error(errors.file || 'Gagal import data supplier.'),
      onFinish: () => {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset biar bisa upload file yang sama lagi
      },
    });
  };

` },
      { start: `    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        nama: formNama.trim(),`,
        end: `  const handleDelete = async () => {`,
        with: `    setSubmitting(true);
    setFormError('');

    const payload = {
      nama: formNama.trim(),
      alamat: formAlamat.trim(),
      telepon: formTelepon.trim(),
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
        setFormError(errors.nama || errors.alamat || errors.telepon || 'Gagal menyimpan supplier.'),
      onFinish: () => setSubmitting(false),
    };

    if (editing) router.put(\`/master-data/supplier/\${editing.id}\`, payload, options);
    else router.post('/master-data/supplier', payload, options);
  };

` },
      { start: `  const handleDelete = async () => {`,
        end: `  return (
    <>
`,
        with: `  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Sukses -> toast dari flash server. Gagal -> toast error + tutup modal (perilaku lama).
    router.delete(\`/master-data/supplier/\${deleteTarget.id}\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setDeleteTarget(null),
      onError: (errors) => {
        toast.error(errors.delete || 'Gagal menghapus supplier.');
        setDeleteTarget(null);
      },
      onFinish: () => setDeleting(false),
    });
  };

` },
      { start: `            {loading && (`,
        end: `            {!loading && !error && items.length === 0 && (`,
        with: `` },
      { find: `{!loading && !error && items.length === 0 && (`,
        with: `{items.length === 0 && (` },
      { find: `{!loading && !error && items.length > 0 && filteredItems.length === 0 && (`,
        with: `{items.length > 0 && filteredItems.length === 0 && (` },
      { find: `{!loading && !error && filteredItems.length > 0 && (`,
        with: `{filteredItems.length > 0 && (` },
    ],
  },
  // ------------------------------------------------------------------ routes/web.php
  {
    file: "routes/web.php",
    marker: `DepartemenWebController`,
    steps: [
      { find: `use App\\Http\\Controllers\\MasterData\\PerusahaanWebController;`,
        with: `use App\\Http\\Controllers\\MasterData\\PerusahaanWebController;
use App\\Http\\Controllers\\MasterData\\DepartemenWebController;
use App\\Http\\Controllers\\MasterData\\KategoriWebController;
use App\\Http\\Controllers\\MasterData\\SupplierWebController;` },
      { find: `    // Master Data: Cabang & Perusahaan (admin-only). Mutasi lewat Inertia (redirect back + flash).`,
        with: `    // Master Data: Cabang, Perusahaan, Departemen, Kategori, Supplier (admin-only). Mutasi lewat Inertia (redirect back + flash).` },
      { find: `        Route::delete('/perusahaan/{id}', [PerusahaanWebController::class, 'destroy'])->whereNumber('id');
`,
        with: `        Route::delete('/perusahaan/{id}', [PerusahaanWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/departemen/import', [DepartemenWebController::class, 'import']);
        Route::post('/departemen', [DepartemenWebController::class, 'store']);
        Route::put('/departemen/{id}', [DepartemenWebController::class, 'update'])->whereNumber('id');
        Route::delete('/departemen/{id}', [DepartemenWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/kategori', [KategoriWebController::class, 'store']);
        Route::put('/kategori/{id}', [KategoriWebController::class, 'update'])->whereNumber('id');
        Route::delete('/kategori/{id}', [KategoriWebController::class, 'destroy'])->whereNumber('id');

        Route::post('/supplier/import', [SupplierWebController::class, 'import']);
        Route::post('/supplier', [SupplierWebController::class, 'store']);
        Route::put('/supplier/{id}', [SupplierWebController::class, 'update'])->whereNumber('id');
        Route::delete('/supplier/{id}', [SupplierWebController::class, 'destroy'])->whereNumber('id');
` },
    ],
  },
  // ------------------------------------------------------------------ MasterDataPageController
  {
    file: "app/Http/Controllers/MasterData/MasterDataPageController.php",
    marker: `DepartemenWebController::daftar()`,
    steps: [
      { find: `            'perusahaan' => $tab === 'perusahaan' ? fn () => PerusahaanWebController::daftar() : null,`,
        with: `            'perusahaan' => $tab === 'perusahaan' ? fn () => PerusahaanWebController::daftar() : null,
            'departemen' => $tab === 'departemen' ? fn () => DepartemenWebController::daftar() : null,
            'kategori' => $tab === 'kategori' ? fn () => KategoriWebController::daftar() : null,
            'supplier' => $tab === 'supplier' ? fn () => SupplierWebController::daftar() : null,` },
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

// ------------------------------------------------------------ SYARAT: F1 SUDAH TERPASANG
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/CabangWebController.php')) ||
    !fs.existsSync(abs('resources/js/components/layout/FlashToaster.tsx'))) {
  fail('F2 butuh F1 yang sudah terpasang (CabangWebController.php / FlashToaster.tsx tidak ditemukan). Jalankan `node f1.mjs` dulu.');
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
    if (cur.includes('[F2-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F2, tidak ditimpa: ' + nf.path);
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
log((DRY ? '[DRY RUN] ' : '') + 'F2 - Departemen + Kategori + Supplier -> Inertia');
if (!DRY) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // Run baru (belum ada manifest, mis. sesudah --revert) -> backup SELALU diperbarui dari kondisi file sekarang,
  // supaya revert berikutnya tidak mengembalikan backup basi. Run lanjutan (manifest ada) -> backup asli dipertahankan.
  const freshRun = !fs.existsSync(MANIFEST);
  let manifest = { created: [], modified: [] };
  if (!freshRun) manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  for (const m of toModify) {
    const bak = path.join(BACKUP_DIR, ...m.rel.split('/'));
    if (freshRun || !fs.existsSync(bak)) {
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.writeFileSync(bak, m.original, 'utf8'); // backup asli (dalam satu siklus apply->revert tidak ditimpa lagi)
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
log('Dihapus  (0)  -- F2 tidak menghapus file apa pun (API lama dibiarkan sampai F10)');

if (DRY) {
  log('\nDry run selesai, tidak ada yang ditulis. Jalankan tanpa --dry untuk menerapkan.');
} else {
  log('\nBackup asli: .migrasi-backup/f2/   (kembalikan: node f2.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=master-data');
log('  npx tsc --noEmit');
log('  npm run build');
