<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;

class LogActivity
{
    // Route yang gak perlu dicatat, biar gak infinite logging & gak berisik
    protected array $excluded = [
        'api/audit-log',
        'api/audit-log/*',
        'api/login',
        'api/logout',
    ];

    // Cuma method yang benar-benar mengubah data yang dicatat. GET (buka
    // halaman/liat data/pindah tab) sengaja gak dicatat -- dulu tiap
    // navigasi/fetch list ikut nyatet, jadi log kebanjiran "melihat data"
    // dan menutupi aktivitas ubah data yang justru penting.
    protected array $loggedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function handle(Request $request, Closure $next)
    {
        $this->catatKodeInduk($request);

        $response = $next($request);

        $this->log($request, $response);

        return $response;
    }

    protected function log(Request $request, $response = null): void
    {
        if (!in_array($request->method(), $this->loggedMethods, true)) {
            return;
        }

        foreach ($this->excluded as $pattern) {
            if ($request->is($pattern)) {
                return;
            }
        }

        AuditLog::create([
            'user_id' => $request->user()?->id,
            'method' => $request->method(),
            'endpoint' => $request->path(),
            'deskripsi' => mb_strimwidth($this->buatDeskripsi($request), 0, 240, '…') . ($this->tandaiGagal($request, $response) ? ' (GAGAL)' : ''),
            'ip_address' => $request->ip(),
        ]);
    }

    protected function buatDeskripsi(Request $request): string
    {
        $nama = $request->user()?->name ?? 'Guest';
        $method = $request->method();
        $path = $request->path();

        $khusus = $this->deskripsiInventaris($request, $nama);
        if ($khusus !== null) {
            return $khusus;
        }

        $master = $this->deskripsiMasterData($request, $nama);
        if ($master !== null) {
            return $master;
        }

        return match ($method) {
            'POST' => "{$nama} membuat data baru di /{$path}",
            'PUT', 'PATCH' => "{$nama} mengubah data di /{$path}",
            'DELETE' => "{$nama} menghapus data di /{$path}",
            default => "{$nama} mengakses /{$path}",
        };
    }

    /**
     * Deskripsi khusus buat aksi-aksi inventaris (serah-terima, pengembalian,
     * lapor kerusakan, penanganan, jual aset) supaya audit log kebaca jelas
     * siapa-ngapain-ke-apa, bukan cuma "mengubah data di /aset-pemakai/12".
     * Dicocokkan pakai pola URI route (bukan raw path yang isinya id angka),
     * jadi gak keliru walau id-nya beda-beda. Kembalikan null kalau bukan
     * salah satu route inventaris yang dikenali, biar fallback ke deskripsi
     * generik seperti biasa.
     */
    protected function deskripsiInventaris(Request $request, string $nama): ?string
    {
        $route = $request->route();
        if (!$route) {
            return null;
        }

        // [F4-INERTIA] Route web inventory ada di bawah prefix master-data/ (mis. "master-data/inventory/{inventory}/jual");
        // prefix dibuang supaya deskripsi audit sama dengan route API-nya.
        $uri = preg_replace('#^master-data/#', '', $route->uri()); // contoh: "inventory/{inventory}/pemakai"
        // [F6-INERTIA] Route web penanganan ada di bawah prefix penanganan-inventory/ (mis. "penanganan-inventory/{inventoryPenanganan}/terima");
        // dipetakan ke pola URI API-nya supaya deskripsi audit sama.
        $uri = preg_replace('#^penanganan-inventory(?=/|$)#', 'inventory-penanganan', $uri);
        $method = $request->method();
        $kodeAset = $this->kodeAsetDariRoute($route);

        return match (true) {
            ($uri === 'inventory' || $uri === 'aset') && $method === 'POST' => "{$nama} menambahkan inventory baru" . ($request->input('nama') ? " ({$request->input('nama')})" : ''),
            ($uri === 'inventory/{inventory}' || $uri === 'aset/{aset}') && in_array($method, ['POST', 'PUT', 'PATCH'], true) => "{$nama} mengubah data inventory" . ($kodeAset ? " {$kodeAset}" : ''),
            ($uri === 'inventory/{inventory}' || $uri === 'aset/{aset}') && $method === 'DELETE' => "{$nama} menghapus inventory" . ($kodeAset ? " {$kodeAset}" : ''),
            $uri === 'inventory/{inventory}/pemakai' || $uri === 'aset/{aset}/pemakai' => "{$nama} meminjamkan inventory" . ($kodeAset ? " {$kodeAset}" : '') . " ke " . $this->namaPenerima($request),
            $uri === 'inventory-pemakai/{inventoryPemakai}/kembalikan' || $uri === 'aset-pemakai/{asetPemakai}/kembalikan' => "{$nama} mencatat pengembalian inventory dari peminjam",
            ($uri === 'inventory-pemakai/{inventoryPemakai}' || $uri === 'aset-pemakai/{asetPemakai}') && $method === 'DELETE' => "{$nama} menghapus riwayat pemakaian inventory",
            ($uri === 'inventory-penanganan' || $uri === 'aset-penanganan') && $method === 'POST' => "{$nama} melaporkan kerusakan inventory" . ($request->input('keluhan') ? ": {$request->input('keluhan')}" : ''),
            $uri === 'inventory-penanganan/{inventoryPenanganan}/terima' || $uri === 'aset-penanganan/{asetPenanganan}/terima' => "{$nama} mulai menangani laporan kerusakan inventory",
            ($uri === 'inventory-penanganan/{inventoryPenanganan}' || $uri === 'aset-penanganan/{asetPenanganan}') && in_array($method, ['POST', 'PUT', 'PATCH'], true) => "{$nama} memperbarui status penanganan inventory" . ($request->input('hasil') ? " (hasil: {$request->input('hasil')})" : ''),
            ($uri === 'inventory-penanganan/{inventoryPenanganan}' || $uri === 'aset-penanganan/{asetPenanganan}') && $method === 'DELETE' => "{$nama} menghapus laporan penanganan inventory",
            $uri === 'inventory/{inventory}/jual' || $uri === 'aset/{aset}/jual' => "{$nama} menjual/writeoff inventory" . ($kodeAset ? " {$kodeAset}" : ''),
            $uri === 'inventory/{inventory}/pasang-ke-induk' => "{$nama} memasang inventory" . ($kodeAset ? " {$kodeAset}" : '') . ' ke induk ' . $this->kodeDariId($request->input('parent_id')),
            $uri === 'inventory/{inventory}/lepas-dari-induk' => "{$nama} melepas inventory" . ($kodeAset ? " {$kodeAset}" : '') . ' dari induk' . ($request->attributes->get('audit_kode_induk') ? ' ' . $request->attributes->get('audit_kode_induk') : '') . ($request->input('keterangan') ? " (keterangan: {$request->input('keterangan')})" : ''),
            default => null,
        };
    }

    // Master Data (cabang, perusahaan, departemen, kategori, supplier, karyawan): sebut jenis data + nama,
    // bukan cuma path mentah. Delete: record sudah hilang saat log ditulis, jadi cukup jenis data (+ id).
    protected function deskripsiMasterData(Request $request, string $nama): ?string
    {
        $route = $request->route();
        if (!$route || !preg_match('#^master-data/(cabang|perusahaan|departemen|kategori|supplier|karyawan)(?:/(import|\{id\}(?:/password)?))?$#', $route->uri(), $m)) {
            return null;
        }

        $jenis = ['karyawan' => 'user'][$m[1]] ?? $m[1];
        $sub = $m[2] ?? '';
        $objek = $request->input($m[1] === 'karyawan' ? 'name' : 'nama');
        $label = $objek ? "{$jenis} {$objek}" : $jenis;

        if ($sub === 'import') {
            return "{$nama} mengimport data {$jenis} dari Excel";
        }
        if ($sub === '{id}/password') {
            $target = \App\Models\User::find($request->route('id'))?->name;

            return "{$nama} mengubah password user" . ($target ? " {$target}" : '');
        }

        return match ($request->method()) {
            'POST' => "{$nama} menambahkan {$label}",
            'PUT', 'PATCH' => "{$nama} mengubah {$label}" . ($objek ? '' : " (id {$request->route('id')})"),
            'DELETE' => "{$nama} menghapus {$jenis} (id {$request->route('id')})",
            default => null,
        };
    }

    // Simpan kode induk item sebelum aksi lepas/pasang jalan.
    protected function catatKodeInduk(Request $request): void
    {
        $item = $request->route('inventory');
        if (is_scalar($item)) {
            $item = \App\Models\MasterData\Inventory::find($item);
        }
        if ($item instanceof \App\Models\MasterData\Inventory && $item->parent_id) {
            $request->attributes->set('audit_kode_induk', \App\Models\MasterData\Inventory::find($item->parent_id)?->kode_inventory);
        }
    }

    // Gagal = response error (>= 400, termasuk exception) atau redirect balik membawa error validasi/aturan bisnis.
    protected function tandaiGagal(Request $request, $response): bool
    {
        if ($response && method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
            return true;
        }

        if ($request->hasSession() && ($errors = $request->session()->get('errors')) instanceof \Illuminate\Support\ViewErrorBag) {
            foreach ($errors->getBags() as $bag) {
                if ($bag->any()) {
                    return true;
                }
            }
        }

        return false;
    }

    protected function kodeDariId($id): string
    {
        return ($id ? \App\Models\MasterData\Inventory::find($id)?->kode_inventory : null) ?? 'terkait';
    }

    // Ambil kode_inventory dari model yang udah di-resolve lewat route model
    // binding (aman dipanggil setelah $next($request), binding-nya udah pasti
    // selesai karena controller sudah jalan duluan).
    protected function kodeAsetDariRoute($route): ?string
    {
        $item = $route->parameter('inventory') ?? $route->parameter('aset');
        if ($item instanceof \App\Models\MasterData\Inventory) {
            return $item->kode_inventory;
        }

        return null;
    }

    // Nama karyawan/akun cabang penerima aset pas serah-terima. Request body
    // sekarang cuma kirim user_id (pekerja_id sudah dihapus total dari
    // AsetPemakaiController & frontend), jadi cukup 1 query kecil ambil
    // namanya -- aman karena cuma jalan di request POST serah-terima,
    // bukan tiap request.
    protected function namaPenerima(Request $request): string
    {
        if ($userId = $request->input('user_id')) {
            $nama = \App\Models\User::find($userId)?->name;
            if ($nama) {
                return $nama;
            }
        }

        return 'karyawan/akun terkait';
    }
}