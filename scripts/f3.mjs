#!/usr/bin/env node
// =============================================================================
// F3 - Migrasi ke Inertia: Karyawan (list -> props, mutasi -> router, Create/Edit/Show -> modal di tab Karyawan)
//
// Syarat: F1 + F2 sudah terpasang (pola acuan: CabangWebController, FlashToaster, grup route master-data).
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f3.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f3.mjs            terapkan
//   node f3.mjs --revert   kembalikan semua dari .migrasi-backup/f3/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x, script berhenti
// SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// File yang dihapus DIPINDAH ke .migrasi-backup/f3/ (bukan dihapus permanen) dan dikembalikan oleh --revert.
// Langkah tipe { start, with } (tanpa `end`) = ganti dari anchor awal sampai AKHIR file.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const FASE = 'f3';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    path: "app/Queries/KaryawanQuery.php",
    content: `<?php

namespace App\\Queries;

use Illuminate\\Database\\Eloquent\\Builder;

/**
 * [F3-INERTIA] Filter daftar karyawan (role / status / pencarian), dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\MasterData\\UserController::index (GET /api/karyawan, masih dipakai autocomplete)
 *  - Web : App\\Http\\Controllers\\MasterData\\KaryawanWebController (props tab Karyawan di Master Data)
 *
 * $abaikanHuruf = true  -> pencarian tidak peka huruf besar/kecil (perilaku filter client-side lama di TabKaryawan).
 * $abaikanHuruf = false -> LIKE biasa, persis perilaku lama endpoint API.
 */
class KaryawanQuery
{
    public static function filter(
        Builder $query,
        ?string $role = null,
        ?string $status = null,
        ?string $search = null,
        bool $abaikanHuruf = false
    ): Builder {
        if ($role !== null && $role !== '' && $role !== 'all') {
            $query->whereHas('roleRef', fn ($q) => $q->where('nama', $role));
        }

        if ($status !== null && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($search !== null && $search !== '') {
            $query->where(function ($q) use ($search, $abaikanHuruf) {
                if ($abaikanHuruf) {
                    // escape karakter wildcard LIKE supaya yang diketik dianggap teks biasa
                    $kata = '%' . mb_strtolower(str_replace(['\\\\', '%', '_'], ['\\\\\\\\', '\\\\%', '\\\\_'], $search)) . '%';
                    $q->whereRaw('LOWER(users.name) LIKE ?', [$kata])
                        ->orWhereRaw('LOWER(users.email) LIKE ?', [$kata]);
                } else {
                    $q->where('name', 'like', '%' . $search . '%')
                        ->orWhere('email', 'like', '%' . $search . '%');
                }
            });
        }

        return $query;
    }
}
`,
  },
  {
    path: "app/Actions/MasterData/KaryawanAction.php",
    content: `<?php

namespace App\\Actions\\MasterData;

use App\\Models\\MasterData\\Role;
use App\\Models\\Transaksi\\InventoryPemakai;
use App\\Models\\User;
use Illuminate\\Support\\Facades\\Hash;
use Illuminate\\Validation\\ValidationException;

/**
 * [F3-INERTIA] Logika mutasi karyawan (user), dipakai bareng oleh:
 *  - API : App\\Http\\Controllers\\MasterData\\UserController (store/update/destroy) + AdminUserController (set-password)
 *  - Web : App\\Http\\Controllers\\MasterData\\KaryawanWebController (modal Tambah/Edit/Hapus/Ubah Password)
 *
 * Aturan validasi dan aturan bisnis dipindah APA ADANYA dari UserController. Pelanggaran dilempar sebagai
 * ValidationException; API membungkusnya jadi JSON 422, web membiarkannya jadi redirect back + error bag.
 * (Pemanggil yang validasi: pakai rulesBuat() / rulesUbah() dulu.)
 */
class KaryawanAction
{
    public static function rulesBuat(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:users,email',
            'phone' => 'nullable|string|unique:users,phone',
            'password' => 'required|string',
            'role_id' => 'required|integer|exists:roles,id',
            'nik' => 'nullable|string|unique:users,nik',
            'departemen_id' => 'nullable|exists:departemen,id',
            'lokasi_kantor_id' => 'nullable|exists:lokasi_kantor,id',
            'tanggal_masuk' => 'nullable|date',
            'perusahaan_id' => 'nullable|exists:perusahaan,id',
            'status' => 'sometimes|in:aktif,nonaktif',
        ];
    }

    public static function rulesUbah(User $user): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|unique:users,phone,' . $user->id,
            'role_id' => 'required|integer|exists:roles,id',
            'nik' => 'nullable|string|unique:users,nik,' . $user->id,
            'departemen_id' => 'nullable|exists:departemen,id',
            'perusahaan_id' => 'nullable|exists:perusahaan,id',
            'lokasi_kantor_id' => 'nullable|exists:lokasi_kantor,id',
            'tanggal_masuk' => 'nullable|date',
            'status' => 'sometimes|in:aktif,nonaktif',
        ];
    }

    /** Buat user baru. $validated = hasil validate(rulesBuat()). */
    public static function buat(array $validated): User
    {
        $role = Role::findOrFail($validated['role_id']);
        if ($role->nama === 'cabang') {
            throw ValidationException::withMessages(['role_id' => 'Role cabang sudah tidak digunakan.']);
        }

        if (empty($validated['nik'])) {
            throw ValidationException::withMessages(['nik' => 'NIK karyawan wajib diisi.']);
        }
        if (User::where('nik', $validated['nik'])->exists()) {
            throw ValidationException::withMessages(['nik' => 'NIK sudah digunakan.']);
        }

        return User::create([
            'name' => $validated['name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($validated['password']),
            'role_id' => $validated['role_id'],
            'lokasi_kantor_id' => $validated['lokasi_kantor_id'] ?? null,
            'nik' => $validated['nik'],
            'departemen_id' => $validated['departemen_id'] ?? null,
            'perusahaan_id' => $validated['perusahaan_id'] ?? null,
            'tanggal_masuk' => $validated['tanggal_masuk'] ?? null,
            'status' => $validated['status'] ?? 'aktif',
        ]);
    }

    /** Ubah data user. $validated = hasil validate(rulesUbah($user)). */
    public static function perbarui(User $user, array $validated): User
    {
        $role = Role::findOrFail($validated['role_id']);
        if ($role->nama === 'cabang') {
            throw ValidationException::withMessages(['role_id' => 'Role cabang sudah tidak digunakan.']);
        }

        if (empty($validated['nik'])) {
            throw ValidationException::withMessages(['nik' => 'NIK karyawan wajib diisi.']);
        }

        // Nonaktifkan akun cuma boleh kalau user gak lagi punya pinjaman
        // inventory yang aktif (disetujui/pending & belum dikembalikan).
        $mauNonaktif = ($validated['status'] ?? $user->status) === 'nonaktif'
            && $user->status !== 'nonaktif';

        if ($mauNonaktif) {
            self::pastikanTanpaPinjamanAktif($user, 'menonaktifkan');
        }

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'role_id' => $validated['role_id'],
            'lokasi_kantor_id' => $validated['lokasi_kantor_id'] ?? null,
            'nik' => $validated['nik'],
            'departemen_id' => $validated['departemen_id'] ?? null,
            'perusahaan_id' => $validated['perusahaan_id'] ?? null,
            'tanggal_masuk' => $validated['tanggal_masuk'] ?? null,
            'status' => $validated['status'] ?? $user->status,
        ]);

        // Akun baru saja dinonaktifkan -- cabut semua token login-nya.
        if ($mauNonaktif) {
            $user->tokens()->delete();
        }

        return $user;
    }

    /**
     * Hapus user. Ditolak kalau masih punya pinjaman inventory aktif.
     * $kunciError = key error bag: 'status' (API, sama seperti dulu) atau 'delete' (web, tampil di modal konfirmasi hapus).
     */
    public static function hapus(User $user, string $kunciError = 'status'): void
    {
        self::pastikanTanpaPinjamanAktif($user, 'menghapus akun', $kunciError);

        $user->delete();
    }

    /** Admin menentukan sendiri password baru untuk user. */
    public static function ubahPassword(User $user, string $password): void
    {
        $user->update([
            'password' => Hash::make($password),
        ]);
    }

    /**
     * Lempar ValidationException kalau user masih punya pinjaman inventory aktif
     * (status disetujui/pending dan belum ada tanggal_pengembalian).
     * Default key \`status\` biar langsung muncul di field "Status Akun" di form edit.
     */
    private static function pastikanTanpaPinjamanAktif(User $user, string $aksi, string $kunciError = 'status'): void
    {
        $pinjaman = InventoryPemakai::with('inventory:id,kode_inventory')
            ->where('user_id', $user->id)
            ->whereIn('status', ['disetujui', 'pending'])
            ->whereNull('tanggal_pengembalian')
            ->get();

        if ($pinjaman->isEmpty()) {
            return;
        }

        $daftar = $pinjaman->map(fn ($p) => $p->inventory?->kode_inventory)
            ->filter()
            ->unique()
            ->implode(', ');

        $detail = $daftar !== '' ? " ($daftar)" : '';

        $pesan = "Karyawan masih punya {$pinjaman->count()} pinjaman inventory{$detail}. Selesaikan/kembalikan dulu sebelum {$aksi}.";

        throw ValidationException::withMessages([$kunciError => $pesan]);
    }
}
`,
  },
  {
    path: "app/Http/Controllers/MasterData/KaryawanWebController.php",
    content: `<?php

namespace App\\Http\\Controllers\\MasterData;

use App\\Actions\\MasterData\\KaryawanAction;
use App\\Http\\Controllers\\Controller;
use App\\Imports\\MasterData\\KaryawanImport;
use App\\Models\\User;
use App\\Queries\\KaryawanQuery;
use Exception;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

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
                'file' => implode("\\n", array_map('strval', $import->getErrors())),
            ]);
        }

        return back()->with('success', "Berhasil import {$import->getRowCount()} baris data");
    }

    // ------------------------------------------------------------------ helper

    private static function queryDasar()
    {
        // roleRef WAJIB di-eager-load: accessor \`role\` (dipakai tabel & export) membacanya.
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
`,
  },
  {
    path: "resources/js/types/karyawan.ts",
    content: `import type { Karyawan } from '../api/masterData/karyawan';

// [F3-INERTIA] Bentuk data tab Karyawan dari server (KaryawanWebController). Satu baris = satu user, sudah
// lengkap untuk list, modal detail, dan modal edit (id relasi + tanggal_masuk 'Y-m-d' + status).
export type KaryawanRow = Karyawan & {
  departemen_id?: number | null;
  lokasi_kantor_id?: number | null;
  perusahaan_id?: number | null;
};

export interface KaryawanOpsiItem {
  id: number;
  nama: string;
}

// Pilihan dropdown form Tambah/Edit (props \`karyawanOpsi\`).
export interface KaryawanOpsi {
  departemen: KaryawanOpsiItem[];
  cabang: KaryawanOpsiItem[];
  perusahaan: KaryawanOpsiItem[];
  roles: KaryawanOpsiItem[];
}

export type KaryawanFilterRole = 'semua' | 'user' | 'admin';

// Props \`karyawan\`: satu halaman data + filter aktif (query string = sumber kebenaran).
export interface KaryawanList {
  data: KaryawanRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  filters: { search: string; role: KaryawanFilterRole };
}
`,
  },
  {
    path: "resources/js/components/masterData/karyawan/KaryawanFormModal.tsx",
    content: `import { useState, type FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { User as UserIcon, Lock, Building2, Eye, EyeOff, KeyRound } from 'lucide-react';
import RouteModal from '../../shared/RouteModal';
import Select from '../../shared/Select';
import SearchableSelect from '../../shared/SearchableSelect';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../../shared/FormControls';
import KaryawanPasswordModal from './KaryawanPasswordModal';
import type { KaryawanOpsi, KaryawanRow } from '../../../types/karyawan';

interface Props {
  /** null = mode Tambah, baris user = mode Edit. */
  user: KaryawanRow | null;
  opsi: KaryawanOpsi;
  onClose: () => void;
  /** Mode Edit: minta parent membuka konfirmasi hapus (modal ini ditutup dulu oleh parent). */
  onDelete: (user: KaryawanRow) => void;
}

interface FormFields {
  name: string;
  email: string;
  phone: string;
  password: string; // hanya dipakai mode Tambah
  role_id: string; // string karena dipakai langsung sebagai value <Select>
  nik: string;
  departemen_id: string;
  perusahaan_id: string;
  lokasi_kantor_id: string;
  tanggal_masuk: string;
  status: 'aktif' | 'nonaktif'; // hanya dipakai mode Edit
}

const STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nonaktif', label: 'Nonaktif' },
];

// Label tampilan tiap role. Role baru yang tidak ada di sini jatuh ke nama aslinya (huruf pertama kapital).
const ROLE_DISPLAY_LABEL: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
};

function roleLabel(nama: string): string {
  return ROLE_DISPLAY_LABEL[nama] ?? nama.charAt(0).toUpperCase() + nama.slice(1);
}

const sectionClass =
  'rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4 space-y-3.5';
const sectionTitleClass =
  'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400';

// [F3-INERTIA] Form Tambah / Edit User sebagai modal overlay di tab Karyawan (gabungan Create.tsx + Edit.tsx lama).
// Data baris dari props list (tidak ada request tambahan), pilihan dropdown dari props \`karyawanOpsi\`.
// Submit pakai useForm: preserveState + preserveScroll, sukses -> modal ditutup, error validasi tampil di field.
export default function KaryawanFormModal({ user, opsi, onClose, onDelete }: Props) {
  const isEdit = user !== null;

  const { data, setData, post, put, processing, errors, setError, clearErrors, transform } = useForm<FormFields>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
    role_id: user?.role_id != null ? String(user.role_id) : '',
    nik: user?.nik ?? '',
    departemen_id: user?.departemen_id ? String(user.departemen_id) : '',
    perusahaan_id: user?.perusahaan_id ? String(user.perusahaan_id) : '',
    lokasi_kantor_id: user?.lokasi_kantor_id ? String(user.lokasi_kantor_id) : '',
    tanggal_masuk: user?.tanggal_masuk ?? '',
    status: user?.status === 'nonaktif' ? 'nonaktif' : 'aktif',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);

  const selectableRoles = opsi.roles.filter((r) => r.nama !== 'cabang');

  // Esc / klik backdrop / tombol X: diabaikan selama submit berjalan atau modal "Ubah Password" sedang terbuka
  // di atas form ini (supaya isian form tidak ikut kebuang).
  function handleClose() {
    if (processing || showSetPassword) return;
    onClose();
  }

  function change<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) clearErrors(key);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const clientErrors: Partial<Record<keyof FormFields, string>> = {};
    if (!data.name.trim()) clientErrors.name = 'Nama lengkap wajib diisi.';
    if (!isEdit && !data.password.trim()) clientErrors.password = 'Password awal wajib diisi.';
    if (!data.role_id) clientErrors.role_id = 'Role wajib dipilih.';
    if (!data.nik.trim()) clientErrors.nik = 'NIK karyawan wajib diisi.';

    if (Object.keys(clientErrors).length > 0) {
      setError(clientErrors);
      toast.error('Mohon lengkapi kolom yang bertanda bintang (*).');
      return;
    }

    // Kolom opsional kosong dikirim null. Tambah: kirim password awal (tanpa status). Edit: kirim status (tanpa password).
    transform((d) => {
      const base = {
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        role_id: Number(d.role_id),
        nik: d.nik,
        departemen_id: d.departemen_id || null,
        perusahaan_id: d.perusahaan_id || null,
        lokasi_kantor_id: d.lokasi_kantor_id || null,
        tanggal_masuk: d.tanggal_masuk || null,
      };
      return isEdit ? { ...base, status: d.status } : { ...base, password: d.password };
    });

    const options = {
      preserveScroll: true,
      preserveState: true,
      // Sukses -> toast dari flash server (FlashToaster).
      onSuccess: () => onClose(),
      // Pesan spesifik dari server (mis. masih ada pinjaman inventory) ikut ditampilkan sebagai toast.
      onError: (errs: Record<string, string>) => {
        toast.error(errs.status || 'Ada data yang belum sesuai dengan format server.');
      },
    };

    if (user) put(\`/master-data/karyawan/\${user.id}\`, options);
    else post('/master-data/karyawan', options);
  }

  return (
    <>
      <RouteModal title={isEdit ? 'Edit User' : 'Tambah User'} onClose={handleClose} maxWidthClassName="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Identitas & Kontak */}
          <div className={sectionClass}>
            <div className={sectionTitleClass}>
              <UserIcon size={14} className="text-slate-400 dark:text-zinc-500" />
              <span>1. Identitas & Kontak</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Nama Lengkap" error={errors.name} required>
                <TextInput
                  value={data.name}
                  onChange={(v) => change('name', v)}
                  placeholder="Masukkan nama lengkap user"
                  error={!!errors.name}
                  autoFocus
                />
              </Field>

              <Field label="NIK Karyawan" error={errors.nik} required>
                <TextInput
                  value={data.nik}
                  onChange={(v) => change('nik', v)}
                  placeholder="Masukkan NIK karyawan"
                  error={!!errors.nik}
                />
              </Field>

              <Field label="Alamat Email" error={errors.email}>
                <TextInput
                  type="email"
                  value={data.email}
                  onChange={(v) => change('email', v)}
                  placeholder="Masukkan alamat email"
                  error={!!errors.email}
                />
              </Field>

              <Field label="Nomor Telepon / WhatsApp" error={errors.phone}>
                <TextInput
                  value={data.phone}
                  onChange={(v) => change('phone', v)}
                  placeholder="Masukkan nomor telepon atau WhatsApp"
                  error={!!errors.phone}
                />
              </Field>
            </div>
          </div>

          {/* Section 2: Keamanan Akun & Hak Akses */}
          <div className={sectionClass}>
            <div className={sectionTitleClass}>
              <Lock size={14} className="text-slate-400 dark:text-zinc-500" />
              <span>2. Keamanan Akun & Hak Akses</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Role Akses" error={errors.role_id} required>
                <Select
                  value={data.role_id}
                  onChange={(v) => change('role_id', v)}
                  placeholder="Pilih role akses"
                  error={!!errors.role_id}
                  options={selectableRoles.map((r) => ({ value: String(r.id), label: roleLabel(r.nama) }))}
                />
              </Field>

              {isEdit ? (
                <Field label="Status Akun Login" error={errors.status}>
                  <Select
                    value={data.status}
                    onChange={(v) => change('status', v as FormFields['status'])}
                    error={!!errors.status}
                    options={STATUS_OPTIONS}
                  />
                </Field>
              ) : (
                <Field label="Password Awal" error={errors.password} required>
                  <div className="relative">
                    <TextInput
                      type={showPassword ? 'text' : 'password'}
                      value={data.password}
                      onChange={(v) => change('password', v)}
                      placeholder="Masukkan password awal"
                      error={!!errors.password}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 transition cursor-pointer"
                      title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              )}
            </div>
          </div>

          {/* Section 3: Penempatan Kerja & Organisasi */}
          <div className={sectionClass}>
            <div className={sectionTitleClass}>
              <Building2 size={14} className="text-slate-400 dark:text-zinc-500" />
              <span>3. Penempatan Kerja & Organisasi</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Departemen" error={errors.departemen_id}>
                <SearchableSelect
                  value={data.departemen_id}
                  onChange={(v) => change('departemen_id', v)}
                  placeholder="Pilih departemen..."
                  error={!!errors.departemen_id}
                  options={opsi.departemen.map((d) => ({ value: String(d.id), label: d.nama }))}
                />
              </Field>

              <Field label="Cabang / Lokasi Kantor" error={errors.lokasi_kantor_id}>
                <SearchableSelect
                  value={data.lokasi_kantor_id}
                  onChange={(v) => change('lokasi_kantor_id', v)}
                  placeholder="Pilih kantor cabang..."
                  error={!!errors.lokasi_kantor_id}
                  options={opsi.cabang.map((c) => ({ value: String(c.id), label: c.nama }))}
                />
              </Field>

              <Field label="Perusahaan" error={errors.perusahaan_id}>
                <SearchableSelect
                  value={data.perusahaan_id}
                  onChange={(v) => change('perusahaan_id', v)}
                  placeholder="Pilih perusahaan..."
                  error={!!errors.perusahaan_id}
                  options={opsi.perusahaan.map((p) => ({ value: String(p.id), label: p.nama }))}
                />
              </Field>

              <Field label="Tanggal Masuk Kerja" error={errors.tanggal_masuk}>
                <TextInput
                  type="date"
                  value={data.tanggal_masuk}
                  onChange={(v) => change('tanggal_masuk', v)}
                  error={!!errors.tanggal_masuk}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSetPassword(true)}
                    disabled={processing}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={14} />
                    Ubah Password
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(user)}
                    disabled={processing}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer disabled:opacity-50"
                  >
                    Hapus User
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <ButtonCancel onClick={handleClose} disabled={processing} />
              <ButtonSubmit type="submit" loading={processing} loadingLabel="Menyimpan...">
                {isEdit ? 'Simpan Perubahan' : 'Simpan User'}
              </ButtonSubmit>
            </div>
          </div>
        </form>
      </RouteModal>

      {showSetPassword && user && (
        <KaryawanPasswordModal userId={user.id} userName={user.name} onClose={() => setShowSetPassword(false)} />
      )}
    </>
  );
}
`,
  },
  {
    path: "resources/js/components/masterData/karyawan/KaryawanDetailModal.tsx",
    content: `import type { ReactNode } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import RouteModal from '../../shared/RouteModal';
import type { KaryawanRow } from '../../../types/karyawan';

interface Props {
  user: KaryawanRow;
  onClose: () => void;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator Sistem',
  user: 'Pengguna / Karyawan',
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTanggal(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

// [F3-INERTIA] Detail User sebagai modal overlay di tab Karyawan (dulu halaman /karyawan/{id}, Show.tsx).
// Murni tampilan: datanya baris dari props list, tidak ada request.
export default function KaryawanDetailModal({ user, onClose }: Props) {
  const isAktif = user.status !== 'nonaktif';

  return (
    <RouteModal
      title="Detail Karyawan"
      description="Informasi profil dan penempatan kerja karyawan."
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200 dark:border-zinc-800">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-lg font-bold text-slate-800 dark:text-zinc-200 shrink-0">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 leading-tight truncate">
                {user.name}
              </h3>
              <span
                className={\`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold \${
                  user.role === 'admin'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                    : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                }\`}
              >
                <ShieldCheck size={12} />
                {roleLabels[user.role] ?? user.role}
              </span>
              <span
                className={\`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold \${
                  isAktif
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                }\`}
              >
                <CheckCircle2 size={12} />
                {isAktif ? 'Akun Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">
              {user.departemen?.nama || 'Tanpa Departemen'}
              {user.lokasi_kantor?.nama ? \` · \${user.lokasi_kantor.nama}\` : ''}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
            Identitas & Kontak
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            <DetailRow label="NIK Karyawan" value={user.nik} />
            <DetailRow label="Nama Lengkap" value={user.name} />
            <DetailRow label="Alamat Email" value={user.email} />
            <DetailRow label="Nomor Telepon / WhatsApp" value={user.phone} />
            <DetailRow label="Tanggal Masuk" value={formatTanggal(user.tanggal_masuk)} />
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
            Penempatan Kerja
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            <DetailRow label="Departemen" value={user.departemen?.nama} />
            <DetailRow label="Perusahaan" value={user.perusahaan?.nama} />
            <DetailRow label="Cabang / Lokasi Kantor" value={user.lokasi_kantor?.nama} />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-xs transition cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </RouteModal>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 text-sm">
      <span className="w-52 text-slate-500 dark:text-zinc-400 text-xs sm:text-sm font-medium shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-zinc-100 font-semibold break-words mt-0.5 sm:mt-0 flex-1">
        {value || '-'}
      </span>
    </div>
  );
}
`,
  },
  {
    path: "resources/js/components/masterData/karyawan/KaryawanPasswordModal.tsx",
    content: `import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { KeyRound, X } from 'lucide-react';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../../shared/FormControls';

interface Props {
  userId: number;
  userName: string;
  onClose: () => void;
}

// [F3-INERTIA] Modal admin menentukan sendiri password baru untuk karyawan (dulu SetPasswordModal di Edit.tsx).
// Submit lewat Inertia (PUT /master-data/karyawan/{id}/password); sukses -> toast dari flash server (FlashToaster).
export default function KaryawanPasswordModal({ userId, userName, onClose }: Props) {
  const { data, setData, put, processing, errors, setError, clearErrors } = useForm({
    password: '',
    password_confirmation: '',
  });

  function handleClose() {
    if (processing) return;
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const clientErrors: { password?: string; password_confirmation?: string } = {};
    if (!data.password.trim()) {
      clientErrors.password = 'Password baru wajib diisi.';
    }
    if (!data.password_confirmation.trim()) {
      clientErrors.password_confirmation = 'Konfirmasi password wajib diisi.';
    } else if (data.password && data.password !== data.password_confirmation) {
      clientErrors.password_confirmation = 'Konfirmasi password tidak cocok.';
    }

    if (Object.keys(clientErrors).length > 0) {
      setError(clientErrors);
      toast.error('Mohon periksa kembali isian password.');
      return;
    }

    put(\`/master-data/karyawan/\${userId}/password\`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onClose(),
      onError: (errs) => toast.error(errs.password || 'Password tidak memenuhi kriteria.'),
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <KeyRound size={22} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 leading-tight">Ubah Password</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">Untuk {userName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={processing}
            aria-label="Tutup"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Password Baru" error={errors.password} required>
            <TextInput
              type="password"
              autoFocus
              placeholder="Masukkan password baru"
              value={data.password}
              onChange={(v) => {
                setData('password', v);
                if (errors.password) clearErrors('password');
              }}
              error={!!errors.password}
            />
          </Field>

          <Field label="Konfirmasi Password Baru" error={errors.password_confirmation} required>
            <TextInput
              type="password"
              placeholder="Ketik ulang password baru"
              value={data.password_confirmation}
              onChange={(v) => {
                setData('password_confirmation', v);
                if (errors.password_confirmation) clearErrors('password_confirmation');
              }}
              error={!!errors.password_confirmation}
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <ButtonCancel onClick={handleClose} disabled={processing} />
            <ButtonSubmit type="submit" loading={processing} loadingLabel="Menyimpan...">
              Simpan Password
            </ButtonSubmit>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
`,
  },
];

const DELETES = [
  "app/Http/Controllers/MasterData/KaryawanPageController.php",
  "resources/js/inertia/pages/Karyawan/Create.tsx",
  "resources/js/inertia/pages/Karyawan/Edit.tsx",
  "resources/js/inertia/pages/Karyawan/Show.tsx",
];

const EDITS = [
  {
    file: "routes/web.php",
    marker: "[F3-INERTIA]",
    steps: [
      {
        find: `use App\\Http\\Controllers\\MasterData\\KaryawanPageController;`,
        with: `use App\\Http\\Controllers\\MasterData\\KaryawanWebController;`,
      },
      {
        find: `Route::redirect('/karyawan', '/master-data?tab=karyawan'); // cuma persis /karyawan; create/detail/edit ada di grup auth di bawah`,
        with: `Route::redirect('/karyawan', '/master-data?tab=karyawan'); // alias lama [F3-INERTIA]: create/detail/edit sekarang modal di tab Karyawan, bukan route`,
      },
      {
        find: `    // Master Data: Cabang, Perusahaan, Departemen, Kategori, Supplier (admin-only). Mutasi lewat Inertia (redirect back + flash).`,
        with: `    // Master Data: Cabang, Perusahaan, Departemen, Kategori, Supplier, Karyawan (admin-only). Mutasi lewat Inertia (redirect back + flash).`,
      },
      {
        find: `        Route::delete('/supplier/{id}', [SupplierWebController::class, 'destroy'])->whereNumber('id');
    });`,
        with: `        Route::delete('/supplier/{id}', [SupplierWebController::class, 'destroy'])->whereNumber('id');

        // [F3-INERTIA] Karyawan (Data User): modal Tambah/Edit/Hapus/Ubah Password + import. Statis (/import) di atas {id}.
        Route::post('/karyawan/import', [KaryawanWebController::class, 'import']);
        Route::post('/karyawan', [KaryawanWebController::class, 'store']);
        Route::put('/karyawan/{id}/password', [KaryawanWebController::class, 'setPassword'])->whereNumber('id');
        Route::put('/karyawan/{id}', [KaryawanWebController::class, 'update'])->whereNumber('id');
        Route::delete('/karyawan/{id}', [KaryawanWebController::class, 'destroy'])->whereNumber('id');
    });`,
      },
      {
        start: `    // Karyawan: create / detail / edit (admin-only; non-admin web/Inertia -> redirect /dashboard, API/JSON tetap 403).`,
        end: `    // Penanganan Inventory (semua role; non-admin hanya lihat laporan miliknya -- scoping di controller API)`,
        with: ``,
      },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/MasterDataPageController.php",
    marker: "[F3-INERTIA]",
    steps: [
      {
        find: `            'supplier' => $tab === 'supplier' ? fn () => SupplierWebController::daftar() : null,`,
        with: `            'supplier' => $tab === 'supplier' ? fn () => SupplierWebController::daftar() : null,
            // [F3-INERTIA] Tab Karyawan: satu halaman data (pagination/search/filter role dari query string),
            // pilihan dropdown form, dan SEMUA hasil filter buat Export (optional = baru dihitung saat diminta
            // lewat partial reload \`only: ['karyawanExport']\`).
            'karyawan' => $tab === 'karyawan' ? fn () => KaryawanWebController::daftar($request) : null,
            'karyawanOpsi' => $tab === 'karyawan' ? fn () => KaryawanWebController::opsi() : null,
            'karyawanExport' => $tab === 'karyawan' ? Inertia::optional(fn () => KaryawanWebController::untukExport($request)) : null,`,
      },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/UserController.php",
    marker: "[F3-INERTIA]",
    steps: [
      {
        find: `use App\\Models\\Transaksi\\InventoryPemakai;
use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Hash;`,
        with: `use App\\Actions\\MasterData\\KaryawanAction;
use App\\Models\\User;
use App\\Queries\\KaryawanQuery;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\ValidationException;`,
      },
      {
        start: `        // BARU: eager-load relasi role juga, biar frontend (TabKaryawan.tsx)`,
        end: `    public function edit(User $user)`,
        with: `        // [F3-INERTIA] Eager-load relasi role juga (frontend baca nama/warna role tanpa request tambahan).
        // Filter role/status/search dipakai bareng halaman web lewat KaryawanQuery.
        // Role 'cabang' diperlakukan identik dengan 'user' -- tidak ada scoping khusus lokasi_kantor_id
        // (lihat catatan di User::isAdmin(): akses cuma 2 tingkat, admin vs role lain).
        $query = KaryawanQuery::filter(
            User::with('departemen', 'lokasiKantor', 'roleRef'),
            $request->filled('role') ? (string) $request->role : null,
            $request->filled('status') ? (string) $request->status : null,
            $request->filled('search') ? (string) $request->search : null,
        );

        return response()->json($query->latest()->get());
    }

`,
      },
      {
        start: `    public function store(Request $request)`,
        with: `    // [F3-INERTIA] store/update/destroy: aturan & logikanya dipindah ke KaryawanAction (dipakai bareng halaman web).
    // Bentuk response JSON dipertahankan sama seperti dulu.
    public function store(Request $request)
    {
        $validated = $request->validate(KaryawanAction::rulesBuat());

        try {
            $user = KaryawanAction::buat($validated);
        } catch (ValidationException $e) {
            return $this->responseValidasi($e);
        }

        return response()->json([
            'message' => 'User berhasil dibuat.',
            'user' => $user->load('departemen', 'lokasiKantor', 'roleRef'),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate(KaryawanAction::rulesUbah($user));

        try {
            KaryawanAction::perbarui($user, $validated);
        } catch (ValidationException $e) {
            return $this->responseValidasi($e);
        }

        return response()->json($user->load('departemen', 'lokasiKantor', 'roleRef'));
    }

    public function destroy(User $user)
    {
        try {
            KaryawanAction::hapus($user);
        } catch (ValidationException $e) {
            return $this->responseValidasi($e);
        }

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * 422 JSON seperti dulu: 'message' = pesan asli untuk pelanggaran pinjaman aktif (key \`status\`),
     * selain itu 'The given data was invalid.'; 'errors' = error per field.
     */
    private function responseValidasi(ValidationException $e)
    {
        $errors = $e->errors();

        return response()->json([
            'message' => $errors['status'][0] ?? 'The given data was invalid.',
            'errors' => $errors,
        ], 422);
    }
}
`,
      },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/AdminUserController.php",
    marker: "[F3-INERTIA]",
    steps: [
      {
        find: `use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Hash;`,
        with: `use App\\Actions\\MasterData\\KaryawanAction;
use App\\Models\\User;
use Illuminate\\Http\\Request;`,
      },
      {
        find: `        $user->update([
            'password' => Hash::make($validated['password']),
        ]);`,
        with: `        // [F3-INERTIA] logika dipakai bareng halaman web (KaryawanWebController::setPassword)
        KaryawanAction::ubahPassword($user, $validated['password']);`,
      },
    ],
  },
  {
    file: "app/Http/Controllers/MasterData/RoleController.php",
    marker: "[F3-INERTIA]",
    steps: [
      {
        find: `    public function index() {
        return response()->json(
            Role::where('nama', '!=', 'cabang')->orderBy('id')->get(['id', 'nama'])
        );
    }`,
        with: `    // [F3-INERTIA] Daftar role yang boleh dipilih (tanpa 'cabang'). Dipakai bareng GET /api/roles dan
    // props \`karyawanOpsi\` di tab Karyawan (KaryawanWebController::opsi).
    public static function daftar()
    {
        return Role::where('nama', '!=', 'cabang')->orderBy('id')->get(['id', 'nama']);
    }

    public function index() {
        return response()->json(self::daftar());
    }`,
      },
    ],
  },
  {
    file: "resources/js/components/masterData/TabKaryawan.tsx",
    marker: "[F3-INERTIA]",
    steps: [
      {
        start: `import { useEffect, useMemo, useRef, useState, type JSX } from 'react';`,
        end: `type TabKey = 'semua' | 'user' | 'admin';`,
        with: `import { useEffect, useRef, useState, type JSX } from 'react';
import { router, usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { Download, Upload, Plus, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ScrollableTabBar from '../shared/ScrollableTabBar';
import Pagination from '../shared/Pagination';
import Tooltip from '../shared/Tooltip';
import SearchInput from '../shared/SearchInput';
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal';
import KaryawanExportModal from '../laporan/KaryawanExportModal';
import KaryawanFormModal from './karyawan/KaryawanFormModal';
import KaryawanDetailModal from './karyawan/KaryawanDetailModal';
import type { KaryawanList, KaryawanOpsi, KaryawanRow } from '../../types/karyawan';

`,
      },
      {
        start: `// Sama shape persis dengan tipe Karyawan di api/karyawan.ts`,
        end: `const roleStyles: Record<string, string> = {`,
        with: `// [F3-INERTIA] Satu baris user dari props server (lengkap: id relasi, tanggal_masuk, status). Dipakai juga
// KaryawanExportModal, jadi tetap kompatibel dengan tipe Karyawan di api/masterData/karyawan.ts.
type User = KaryawanRow;

`,
      },
      {
        start: `// Create/Detail/Edit sekarang halaman Inertia sendiri, jadi tab ini ke-unmount waktu user`,
        with: `// [F3-INERTIA] Tab "Data User" di Master Data (tadinya halaman /karyawan, lalu tab dengan axios + halaman
// Create/Edit/Show terpisah). Sekarang:
//  - data dari props server (MasterDataPageController -> props.karyawan, hanya dikirim saat tab ini aktif);
//  - pagination, pencarian, dan filter role dijalankan server lewat router.get (query string = sumber kebenaran);
//  - Tambah / Edit / Detail = modal overlay dengan state lokal (KaryawanFormModal / KaryawanDetailModal);
//  - mutasi (hapus, import) lewat router.* ke /master-data/karyawan, hasilnya toast dari flash server (FlashToaster).
interface KaryawanPageProps {
    karyawan?: KaryawanList;
    karyawanOpsi?: KaryawanOpsi;
    karyawanExport?: User[];
}

export default function TabKaryawan() {
    const { user: authUser } = useAuth();
    const isAdmin = authUser?.role === 'admin';

    const pageProps = usePage().props as unknown as KaryawanPageProps;
    const list = pageProps.karyawan;
    const users: User[] = list?.data ?? [];
    const activeTab: TabKey = list?.filters.role ?? 'semua';
    const serverSearch = list?.filters.search ?? '';
    const currentPage = list?.current_page ?? 1;
    const totalPages = list?.last_page ?? 1;
    const totalUsers = list?.total ?? 0;

    const [searchInput, setSearchInput] = useState<string>(serverSearch);
    const [listLoading, setListLoading] = useState<boolean>(false);

    // Modal Tambah/Edit (user null = Tambah) dan modal Detail -- state lokal, bukan route.
    const [formModal, setFormModal] = useState<{ user: User | null } | null>(null);
    const [detailUser, setDetailUser] = useState<User | null>(null);

    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [deleteError, setDeleteError] = useState<string>('');

    // State import Excel karyawan
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState<boolean>(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [showImportModal, setShowImportModal] = useState<boolean>(false);

    // Modal export (Excel/PDF). Datanya = SEMUA hasil filter aktif, diambil lewat partial reload
    // (props.karyawanExport) tiap tombol Export diklik, bukan cuma halaman yang lagi tampil.
    const [showExportModal, setShowExportModal] = useState<boolean>(false);
    const [exportLoading, setExportLoading] = useState<boolean>(false);

    // Pindah halaman / ganti filter = visit ringan ke /master-data (partial reload cuma props.karyawan).
    // Nilai default (search kosong, role semua, halaman 1) tidak ikut di URL.
    function visitList(next: { search?: string; role?: TabKey; page?: number }) {
        const search = (next.search ?? searchInput).trim();
        const role = next.role ?? activeTab;
        const page = next.page ?? 1;

        const data: Record<string, string | number> = { tab: 'karyawan' };
        if (search) data.search = search;
        if (role !== 'semua') data.role = role;
        if (page > 1) data.page = page;

        setListLoading(true);
        router.get('/master-data', data, {
            only: ['karyawan'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () => setListLoading(false),
        });
    }

    // Pencarian: tunggu user berhenti mengetik sebentar sebelum minta data ke server.
    useEffect(() => {
        if (searchInput.trim() === serverSearch) return;
        const timer = setTimeout(() => visitList({ search: searchInput, page: 1 }), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    function openCreate() {
        setFormModal({ user: null });
    }

    function openEdit(user: User) {
        setFormModal({ user });
    }

    // Dari tombol "Hapus User" di dalam modal Edit: tutup form dulu, baru buka konfirmasi hapus.
    function requestDelete(user: User) {
        setFormModal(null);
        setDeleteError('');
        setUserToDelete(user);
    }

    function confirmDelete() {
        if (!userToDelete) return;

        setDeleting(true);
        setDeleteError('');
        // Sukses -> toast dari flash server. Gagal (mis. masih punya pinjaman inventory) -> error bag "delete",
        // tampil di dalam modal konfirmasi.
        router.delete(\`/master-data/karyawan/\${userToDelete.id}\`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setUserToDelete(null),
            onError: (errors) => setDeleteError(errors.delete || 'Gagal menghapus user. Coba lagi.'),
            onFinish: () => setDeleting(false),
        });
    }

    function openExport() {
        setExportLoading(true);
        router.reload({
            only: ['karyawanExport'],
            onSuccess: () => setShowExportModal(true),
            onError: () => toast.error('Gagal menyiapkan data export. Coba lagi.'),
            onFinish: () => setExportLoading(false),
        });
    }

    // Handler saat user pilih file dari <input type="file">.
    // Sukses -> toast dari flash server + modal ditutup. Ada baris bermasalah -> error bag "file" (satu pesan per
    // baris, dipisah newline) tampil sebagai list di modal. Baris yang valid tetap tersimpan (sama seperti dulu),
    // dan list otomatis ter-refresh karena server redirect balik ke halaman ini.
    function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportErrors([]);

        router.post('/master-data/karyawan/import', { file }, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setShowImportModal(false),
            onError: (errors) =>
                setImportErrors(
                    String(errors.file || 'Gagal import file. Coba lagi.')
                        .split('\\n')
                        .filter(Boolean)
                ),
            onFinish: () => {
                setImporting(false);
                // reset value biar bisa pilih file yang sama lagi kalau perlu re-upload
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    }

    const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? 'Pekerja';

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <p className="text-sm text-slate-500">
                    Kelola data user dan karyawan sistem, akun login, departemen, dan hak akses.
                </p>
                {isAdmin && (
                    <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                        <button
                            type="button"
                            onClick={openExport}
                            disabled={exportLoading}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
                        >
                            {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
                        >
                            <Upload size={16} />
                            Import Excel
                        </button>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs"
                        >
                            <Plus size={16} />
                            Tambah User
                        </button>
                    </div>
                )}
            </div>

            <div>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    {/* Tab navigation role */}
                    <ScrollableTabBar
                        className="mb-4"
                        activeTab={activeTab}
                        onChange={(key) => visitList({ role: key, page: 1 })}
                        tabs={tabs}
                    />

                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <SearchInput
                            value={searchInput}
                            onChange={setSearchInput}
                            placeholder="Cari nama, email, atau NIK user..."
                            className="flex-1"
                        />
                    </div>

                    <p className="text-xs text-slate-500 mb-4">
                        Total {activeTabLabel}: <span className="font-semibold text-slate-900">{totalUsers}</span> user
                    </p>

                    <div className={\`border border-slate-200 rounded-lg overflow-hidden transition-opacity \${listLoading ? 'opacity-60' : ''}\`}>
                        {!list && <p className="text-center text-sm text-red-500 py-8">Gagal memuat data. Coba lagi.</p>}

                        {list && users.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-8">Tidak ada user yang cocok dengan pencarian / filter ini.</p>
                        )}

                        {list && users.length > 0 && (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/50">
                                                <th className="px-6 py-3.5 font-medium">Nama Karyawan</th>
                                                <th className="px-6 py-3.5 font-medium">Email</th>
                                                <th className="px-6 py-3.5 font-medium">Departemen</th>
                                                <th className="px-6 py-3.5 font-medium">Role</th>
                                                <th className="px-6 py-3.5 font-medium">Status</th>
                                                <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map((user) => (
                                                <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                                                    <td className="px-6 py-3.5 text-slate-800">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                                                                {initials(user.name)}
                                                            </div>
                                                            <div className="min-w-0 max-w-[200px]">
                                                                <Tooltip content={user.name}>
                                                                    <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <div className="max-w-[220px]">
                                                            <Tooltip content={user.email || '-'}>
                                                                <p className="truncate text-slate-700">{user.email || '-'}</p>
                                                            </Tooltip>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5 text-slate-600">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                                                            {user.departemen?.nama || 'Belum diatur'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <span className={\`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold \${roleStyles[user.role ?? ''] || defaultRoleStyle}\`}>
                                                            {roleLabels[user.role ?? ''] || user.role || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <StatusBadge status={user.status} />
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDetailUser(user)}
                                                                title="Detail User"
                                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEdit(user)}
                                                                        title="Edit User"
                                                                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                                    >
                                                                        <Pencil size={15} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => requestDelete(user)}
                                                                        title="Hapus User"
                                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile List View */}
                                <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                                    {users.map((user) => (
                                        <div key={user.id} className="p-4 flex flex-col gap-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                                                        {initials(user.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                                                        <p className="text-xs text-slate-400 truncate">{user.nik || user.email || '-'}</p>
                                                    </div>
                                                </div>
                                                <span className={\`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold \${roleStyles[user.role ?? ''] || defaultRoleStyle}\`}>
                                                    {roleLabels[user.role ?? ''] || user.role || '-'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <StatusBadge status={user.status} small />
                                                    <span className="text-xs text-slate-500 truncate">
                                                        {user.departemen?.nama || 'Departemen belum diatur'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailUser(user)}
                                                        title="Detail"
                                                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {isAdmin && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(user)}
                                                                title="Edit"
                                                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => requestDelete(user)}
                                                                title="Hapus"
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="px-6 py-3 border-t border-slate-100">
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={(page) => visitList({ page })}
                                            totalItems={totalUsers}
                                            itemLabel="user"
                                            className="pt-0 mt-0 border-t-0"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL TAMBAH / EDIT */}
            {formModal && pageProps.karyawanOpsi && (
                <KaryawanFormModal
                    key={formModal.user?.id ?? 'baru'}
                    user={formModal.user}
                    opsi={pageProps.karyawanOpsi}
                    onClose={() => setFormModal(null)}
                    onDelete={requestDelete}
                />
            )}

            {/* MODAL DETAIL */}
            {detailUser && <KaryawanDetailModal user={detailUser} onClose={() => setDetailUser(null)} />}

            {/* MODAL KONFIRMASI HAPUS */}
            <ConfirmDeleteModal
                isOpen={!!userToDelete}
                itemName={userToDelete?.name || ''}
                itemCode={userToDelete?.nik || undefined}
                itemType="Karyawan / User"
                warningMessage="Akun login dan seluruh hak akses user ini akan dicabut secara permanen."
                loading={deleting}
                errorMessage={deleteError}
                onClose={() => {
                    setUserToDelete(null);
                    setDeleteError('');
                }}
                onConfirm={confirmDelete}
            />

            {/* MODAL IMPORT EXCEL */}
            {showImportModal && (
                <ImportModal
                    importing={importing}
                    errors={importErrors}
                    fileInputRef={fileInputRef}
                    onFileSelected={handleFileSelected}
                    onClose={() => {
                        setShowImportModal(false);
                        setImportErrors([]);
                    }}
                />
            )}

            {/* Modal export Excel/PDF — data = SEMUA hasil filter aktif (props.karyawanExport), bukan cuma halaman yang tampil. */}
            <KaryawanExportModal
                open={showExportModal}
                onClose={() => setShowExportModal(false)}
                data={pageProps.karyawanExport ?? []}
            />
        </>
    );
}

// Modal untuk pilih & upload file Excel karyawan
interface ImportModalProps {
    importing: boolean;
    errors: string[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClose: () => void;
}

function ImportModal({ importing, errors, fileInputRef, onFileSelected, onClose }: ImportModalProps) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Import Data Karyawan</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Upload file Excel (.xlsx) berisi kolom NIK, Nama, Email, Phone, Departemen, dan
                    Tanggal Masuk. Karyawan baru akan otomatis dibuatkan akun dan passwordnya
                    dikirim ke email masing-masing.
                </p>

                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-8 cursor-pointer hover:bg-gray-50">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600">
                        {importing ? 'Mengupload & memproses...' : 'Klik untuk pilih file Excel'}
                    </span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        disabled={importing}
                        onChange={onFileSelected}
                    />
                </label>

                {errors.length > 0 && (
                    <div className="mt-4 text-sm bg-red-50 text-red-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <p className="font-medium mb-1">Gagal import:</p>
                        <ul className="list-disc list-inside space-y-1">
                            {errors.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-5">
                    <button
                        onClick={onClose}
                        disabled={importing}
                        className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
`,
      },
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
        // rapikan folder kosong yang tadinya dibuat F3 (berhenti di folder pertama yang masih berisi)
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

// ------------------------------------------------------------ SYARAT: F1 + F2 SUDAH TERPASANG
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/CabangWebController.php')) ||
    !fs.existsSync(abs('resources/js/components/layout/FlashToaster.tsx'))) {
  fail('F3 butuh F1 yang sudah terpasang (CabangWebController.php / FlashToaster.tsx tidak ditemukan). Jalankan `node f1.mjs` dulu.');
}
if (!fs.existsSync(abs('app/Http/Controllers/MasterData/SupplierWebController.php'))) {
  fail('F3 butuh F2 yang sudah terpasang (SupplierWebController.php tidak ditemukan). Jalankan `node f2.mjs` dulu.');
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
    if (cur.includes('[F3-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F3, tidak ditimpa: ' + nf.path);
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
log((DRY ? '[DRY RUN] ' : '') + 'F3 - Karyawan -> Inertia (props + modal)');
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
  log('\nBackup asli: .migrasi-backup/f3/   (kembalikan: node f3.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=master-data');
log('  npx tsc --noEmit');
log('  npm run build');
