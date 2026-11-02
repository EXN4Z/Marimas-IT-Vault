// node fix-audit.mjs  (--dry / --revert; bisa dijalankan dari root atau dari scripts/)
// Audit log lebih kebaca: pasang/lepas induk, import Excel, ubah password user, dan CRUD master data
// (cabang, perusahaan, departemen, kategori, supplier, karyawan) disebut jelas, bukan "membuat data baru di /master-data/...".
// Jalankan fix-logic.mjs juga supaya edit inventory ikut kebaca.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
function findRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  for (const start of [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) {
    let d = path.resolve(start);
    for (;;) {
      if (fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'app'))) return d;
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
  }
  return process.cwd();
}
const root = findRoot(args.find((a) => !a.startsWith('--')));
const rel = 'app/Http/Middleware/LogActivity.php';
const file = path.join(root, rel);
const bk = path.join(root, '.migrasi-backup', 'fix-audit', rel);

if (REVERT) {
  if (fs.existsSync(bk)) { fs.copyFileSync(bk, file); console.log('dikembalikan ' + rel); } else console.log('tidak ada backup');
  process.exit(0);
}

let t = fs.readFileSync(file, 'utf8');
const orig = t;
const stepsA = [
  // 1) panggil deskripsi master data sebelum fallback generik
  [
`        $khusus = $this->deskripsiInventaris($request, $nama);
        if ($khusus !== null) {
            return $khusus;
        }
`,
`        $khusus = $this->deskripsiInventaris($request, $nama);
        if ($khusus !== null) {
            return $khusus;
        }

        $master = $this->deskripsiMasterData($request, $nama);
        if ($master !== null) {
            return $master;
        }
`],
  // 2) arm pasang/lepas induk
  [
`            default => null,
        };
    }
`,
`            $uri === 'inventory/{inventory}/pasang-ke-induk' => "{$nama} memasang inventory" . ($kodeAset ? " {$kodeAset}" : '') . ' ke induk ' . $this->kodeDariId($request->input('parent_id')),
            $uri === 'inventory/{inventory}/lepas-dari-induk' => "{$nama} melepas inventory" . ($kodeAset ? " {$kodeAset}" : '') . ' dari induk' . ($request->input('keterangan') ? " (keterangan: {$request->input('keterangan')})" : ''),
            default => null,
        };
    }

    // Master Data (cabang, perusahaan, departemen, kategori, supplier, karyawan): sebut jenis data + nama,
    // bukan cuma path mentah. Delete: record sudah hilang saat log ditulis, jadi cukup jenis data (+ id).
    protected function deskripsiMasterData(Request $request, string $nama): ?string
    {
        $route = $request->route();
        if (!$route || !preg_match('#^master-data/(cabang|perusahaan|departemen|kategori|supplier|karyawan)(?:/(import|\\{id\\}(?:/password)?))?$#', $route->uri(), $m)) {
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
            $target = \\App\\Models\\User::find($request->route('id'))?->name;

            return "{$nama} mengubah password user" . ($target ? " {$target}" : '');
        }

        return match ($request->method()) {
            'POST' => "{$nama} menambahkan {$label}",
            'PUT', 'PATCH' => "{$nama} mengubah {$label}" . ($objek ? '' : " (id {$request->route('id')})"),
            'DELETE' => "{$nama} menghapus {$jenis} (id {$request->route('id')})",
            default => null,
        };
    }

    protected function kodeDariId($id): string
    {
        return ($id ? \\App\\Models\\MasterData\\Inventory::find($id)?->kode_inventory : null) ?? 'terkait';
    }
`],
];

// Tahap B: kode induk direkam SEBELUM controller jalan (setelah "lepas", parent_id sudah null).
const stepsB = [
  [
`        $response = $next($request);
`,
`        $this->catatKodeInduk($request);

        $response = $next($request);
`],
  [
`' dari induk' . ($request->input('keterangan')`,
`' dari induk' . ($request->attributes->get('audit_kode_induk') ? ' ' . $request->attributes->get('audit_kode_induk') : '') . ($request->input('keterangan')`],
  [
`    protected function kodeDariId($id): string`,
`    // Simpan kode induk item sebelum aksi lepas/pasang jalan.
    protected function catatKodeInduk(Request $request): void
    {
        $item = $request->route('inventory');
        if (is_scalar($item)) {
            $item = \\App\\Models\\MasterData\\Inventory::find($item);
        }
        if ($item instanceof \\App\\Models\\MasterData\\Inventory && $item->parent_id) {
            $request->attributes->set('audit_kode_induk', \\App\\Models\\MasterData\\Inventory::find($item->parent_id)?->kode_inventory);
        }
    }

    protected function kodeDariId($id): string`],
];

// Tahap C: request yang gagal (status >= 400 atau ada error validasi di session) tetap dicatat, diberi tanda "(GAGAL)".
const stepsC = [
  [
`        $this->log($request);
`,
`        $this->log($request, $response);
`],
  [
`    protected function log(Request $request): void`,
`    protected function log(Request $request, $response = null): void`],
  [
`'deskripsi' => $this->buatDeskripsi($request),`,
`'deskripsi' => mb_strimwidth($this->buatDeskripsi($request), 0, 240, '…') . ($this->tandaiGagal($request, $response) ? ' (GAGAL)' : ''),`],
  [
`    protected function kodeDariId($id): string`,
`    // Gagal = response error (>= 400, termasuk exception) atau redirect balik membawa error validasi/aturan bisnis.
    protected function tandaiGagal(Request $request, $response): bool
    {
        if ($response && method_exists($response, 'getStatusCode') && $response->getStatusCode() >= 400) {
            return true;
        }

        if ($request->hasSession() && ($errors = $request->session()->get('errors')) instanceof \\Illuminate\\Support\\ViewErrorBag) {
            foreach ($errors->getBags() as $bag) {
                if ($bag->any()) {
                    return true;
                }
            }
        }

        return false;
    }

    protected function kodeDariId($id): string`],
];

let changed = false;
for (const { marker, steps } of [{ marker: 'deskripsiMasterData', steps: stepsA }, { marker: 'audit_kode_induk', steps: stepsB }, { marker: 'tandaiGagal', steps: stepsC }]) {
  if (t.includes(marker)) { console.log('  sudah ter-patch: ' + marker); continue; }
  for (const [from, to] of steps) {
    const i = t.indexOf(from);
    if (i === -1) { console.log('! pola tidak ketemu, batal (tidak ada yang diubah):\n' + from.slice(0, 80)); process.exit(1); }
    t = t.slice(0, i) + to + t.slice(i + from.length);
  }
  changed = true;
}
if (!changed) process.exit(0);
console.log((DRY ? '[dry] ' : 'ok ') + rel);
if (!DRY) {
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  if (!fs.existsSync(bk)) fs.writeFileSync(bk, orig);
  fs.writeFileSync(file, t);
}
