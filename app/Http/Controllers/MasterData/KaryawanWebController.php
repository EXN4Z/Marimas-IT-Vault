<?php

namespace App\Http\Controllers\MasterData;

use App\Actions\MasterData\KaryawanAction;
use App\Http\Controllers\Controller;
use App\Imports\MasterData\KaryawanImport;
use App\Models\User;
use App\Queries\KaryawanQuery;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

// [F3-INERTIA] Versi Inertia dari UserController (API) untuk tab "Data User" (Karyawan) di Master Data.
// Dipanggil lewat routes/web.php (session + CSRF, admin-only), balasan = redirect back + flash (bukan JSON).
// Aturan validasi & logika bisnis SAMA dengan versi API karena dipakai bareng lewat KaryawanAction / KaryawanQuery.
// UserController (API) sengaja dibiarkan dulu: GET /api/karyawan masih dipakai autocomplete (inventoryPemakai) & Laporan.
// Halaman /karyawan/create, /{user}, /{user}/edit sudah dihapus: sekarang modal di dalam tab Karyawan.
class KaryawanWebController extends Controller
{
    private const PER_HALAMAN = 10;

    // Nilai filter role yang dikenal tab (sama dengan tab "Semua | User | Admin" di TabKaryawan).
    private const FILTER_ROLE = ['user', 'admin'];

    // Data tab Karyawan buat props halaman Master Data (dipakai MasterDataPageController).
    // Pagination, pencarian, dan filter role dijalankan server; sumber kebenarannya query string
    // (?search=&role=&page=). Tiap baris sudah lengkap (id relasi, tanggal_masuk, status, dst), jadi modal
    // detail & edit cukup pakai baris ini -- tidak perlu request tambahan.
    public static function daftar(Request $request): array
    {
        [$role, $search] = self::filterDariRequest($request);

        $query = KaryawanQuery::filter(self::queryDasar(), $role, null, $search, true);

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / self::PER_HALAMAN));
        // halaman di luar jangkauan (mis. habis hapus item terakhir di halaman terakhir) -> geser ke halaman terakhir
        $page = min(max(1, (int) $request->query('page', 1)), $lastPage);

        $rows = $query->latest()->orderByDesc('id')->forPage($page, self::PER_HALAMAN)->get();

        return [
            'data' => $rows->all(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => self::PER_HALAMAN,
            'filters' => [
                'search' => $search ?? '',
                'role' => $role ?? 'semua',
            ],
        ];
    }

    // SEMUA hasil filter aktif (bukan cuma halaman yang tampil) buat modal Export Excel/PDF.
    // Di MasterDataPageController dikirim sebagai optional prop: baru dihitung waktu diminta lewat partial reload.
    public static function untukExport(Request $request): array
    {
        [$role, $search] = self::filterDariRequest($request);

        return KaryawanQuery::filter(self::queryDasar(), $role, null, $search, true)
            ->latest()->orderByDesc('id')->get()->all();
    }

    // Pilihan dropdown di form Tambah/Edit user. Sumbernya sama dengan endpoint API-nya (daftar() tiap master).
    public static function opsi(): array
    {
        return [
            'departemen' => DepartemenWebController::daftar(),
            'cabang' => CabangWebController::daftar(),
            'perusahaan' => PerusahaanWebController::daftar(),
            'roles' => RoleController::daftar()->all(),
        ];
    }

    // POST /master-data/karyawan
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate(KaryawanAction::rulesBuat());

        KaryawanAction::buat($validated);

        return back()->with('success', 'User berhasil dibuat.');
    }

    // PUT /master-data/karyawan/{id}
    // Gagal karena masih ada pinjaman aktif -> error bag key "status" (tampil di field Status Akun).
    public function update(Request $request, $id): RedirectResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate(KaryawanAction::rulesUbah($user));

        KaryawanAction::perbarui($user, $validated);

        return back()->with('success', 'Perubahan berhasil disimpan.');
    }

    // DELETE /master-data/karyawan/{id}
    // Gagal -> error bag key "delete" (ditampilkan di dalam modal konfirmasi hapus).
    public function destroy($id): RedirectResponse
    {
        $user = User::findOrFail($id);

        KaryawanAction::hapus($user, 'delete');

        return back()->with('success', "User {$user->name} berhasil dihapus.");
    }

    // PUT /master-data/karyawan/{id}/password -- admin menentukan sendiri password baru.
    // Gagal validasi -> error bag key "password".
    public function setPassword(Request $request, $id): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'confirmed'],
        ]);

        KaryawanAction::ubahPassword(User::findOrFail($id), $validated['password']);

        return back()->with('success', 'Password berhasil diubah.');
    }

    // POST /master-data/karyawan/import -- Excel (.xlsx/.xls). Kolom: NIK, Nama, Email, Phone, Departemen, Tanggal Masuk.
    // Sama seperti versi API: tiap baris diproses sendiri-sendiri (baris valid tetap tersimpan walau baris lain
    // dilewati), jadi TIDAK ada rollback global. Kalau ada baris bermasalah -> error bag key "file" berisi daftar
    // pesan dipisah newline (ditampilkan sebagai list di modal import); halaman tetap ter-refresh oleh redirect.
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        try {
            $import = new KaryawanImport();
            Excel::import($import, $request->file('file'));
        } catch (Exception $e) {
            throw ValidationException::withMessages(['file' => 'Gagal import: ' . $e->getMessage()]);
        }

        if (count($import->getErrors()) > 0) {
            throw ValidationException::withMessages([
                'file' => implode("\n", array_map('strval', $import->getErrors())),
            ]);
        }

        return back()->with('success', "Berhasil import {$import->getRowCount()} baris data");
    }

    // ------------------------------------------------------------------ helper

    private static function queryDasar()
    {
        // roleRef WAJIB di-eager-load: accessor `role` (dipakai tabel & export) membacanya.
        return User::with('departemen', 'lokasiKantor', 'perusahaan', 'roleRef');
    }

    // [role (null = semua), search (null = kosong)] dari query string.
    private static function filterDariRequest(Request $request): array
    {
        $role = (string) $request->query('role', '');
        $role = in_array($role, self::FILTER_ROLE, true) ? $role : null;

        $search = trim((string) $request->query('search', ''));

        return [$role, $search !== '' ? $search : null];
    }
}
