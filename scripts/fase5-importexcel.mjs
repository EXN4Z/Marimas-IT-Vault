// Pakai: node scripts/fase5-importexcel.mjs [--commit]
// Buat app/Actions/Shared/ImportExcel.php dan pakai di 5 controller yang punya blok import() identik
// (Cabang, Perusahaan, Departemen, Supplier, Inventory). Perilaku sama: transaksi, rollback bila ada error,
// pesan error = pesan pertama / 'Gagal import: ...', error bag key "file". Idempotent.
// TIDAK disentuh: Karyawan (sengaja tanpa rollback global), Penanganan (sudah di Action sendiri), Legacy/ImportController.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ACTION = 'app/Actions/Shared/ImportExcel.php';
const CTL = 'app/Http/Controllers/MasterData';
const TARGETS = ['Cabang', 'Perusahaan', 'Departemen', 'Supplier', 'Inventory'].map((n) => `${CTL}/${n}Controller.php`);
const die = (m) => { console.error('X ' + m); process.exit(1); };
const touched = [];

const action = `<?php

namespace App\\Actions\\Shared;

use Exception;
use Illuminate\\Http\\UploadedFile;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;
use Maatwebsite\\Excel\\Facades\\Excel;

// Dipindah dari blok import() yang identik di Cabang/Perusahaan/Departemen/Supplier/Inventory Controller.
// Semua-atau-tidak-sama-sekali (rollback). Gagal -> ValidationException dengan error bag key "file".
class ImportExcel
{
    /**
     * @param class-string $importClass  kelas import (diinstansiasi di dalam try, seperti sebelumnya)
     * @param string       $pesanErrorDefault  dipakai kalau getErrors()[0] kosong
     * @param \\Closure     $pesanSukses  fn ($import): string -- membangun pesan sukses dari objek import
     */
    public static function dalamTransaksi(string $importClass, UploadedFile $file, string $pesanErrorDefault, \\Closure $pesanSukses): string
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
`;
fs.mkdirSync('app/Actions/Shared', { recursive: true });
fs.writeFileSync(ACTION, action); touched.push(ACTION);
console.log(`+ ${ACTION}`);

const METHOD_RE = /(    public function import\((\w+) \$request\): RedirectResponse\n    \{\n)([\s\S]*?)(\n    \}\n)/;
const BODY_RE = /\$pesanError = null;\n\s+\$pesanSukses = null;\n\n\s+DB::beginTransaction\(\);\n\s+try \{\n\s+\$import = new (\w+)\(\);\n\s+Excel::import\(\$import, \$request->file\('file'\)\);\n\n\s+if \(count\(\$import->getErrors\(\)\) > 0\) \{\n\s+DB::rollBack\(\);\n\s+\$pesanError = \(string\) \(\$import->getErrors\(\)\[0\] \?\? '([^']*)'\);\n\s+\} else \{\n\s+DB::commit\(\);\n\s+\$pesanSukses = ([\s\S]*?);\n\s+\}\n\s+\} catch \(Exception \$e\) \{\n\s+DB::rollBack\(\);\n\s+\$pesanError = 'Gagal import: ' \. \$e->getMessage\(\);\n\s+\}\n\n\s+if \(\$pesanError !== null\) \{\n\s+throw ValidationException::withMessages\(\['file' => \$pesanError\]\);\n\s+\}\n\n\s+return back\(\)->with\('success', \$pesanSukses\);/;

for (const p of TARGETS) {
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('ImportExcel::dalamTransaksi')) { console.log(`= ${p} (sudah dipatch)`); continue; }
  const m = s.match(METHOD_RE);
  if (!m) die(`import() tidak ditemukan di ${p}`);
  const b = m[3].match(BODY_RE);
  if (!b) die(`isi import() di ${p} tidak sama dengan pola yang dikenal (sudah diubah manual?) -- tidak diubah`);
  const [, importCls, defErr, sukses] = b;
  const suksesFn = sukses.split('\n').map((l, i) => (i === 0 ? l.trim() : '            ' + l.trim())).join('\n');
  const newBody =
`        $pesan = ImportExcel::dalamTransaksi(
            ${importCls}::class,
            $request->file('file'),
            '${defErr}',
            fn ($import) => ${suksesFn}
        );

        return back()->with('success', $pesan);`;
  s = s.replace(METHOD_RE, (_, head, _t, _body, tail) => head + newBody + tail);
  s = s.replace('use App\\Http\\Controllers\\Controller;\n', 'use App\\Actions\\Shared\\ImportExcel;\nuse App\\Http\\Controllers\\Controller;\n');
  // buang import yang tak terpakai lagi
  for (const [useLine, re] of [
    ['use Exception;\n', /(?<![\w\\])Exception\b/g],
    ['use Illuminate\\Support\\Facades\\DB;\n', /\bDB::/g],
    ['use Illuminate\\Validation\\ValidationException;\n', /\bValidationException\b/g],
    ['use Maatwebsite\\Excel\\Facades\\Excel;\n', /\bExcel::/g],
  ]) {
    if (!s.includes(useLine)) continue;
    const body = s.replace(useLine, '');
    if (!re.test(body)) s = body;
  }
  fs.writeFileSync(p, s); touched.push(p);
  console.log(`~ ${p}`);
}

for (const f of touched) {
  try { execSync(`php -l ${f}`, { stdio: 'pipe' }); } catch { die(`php -l GAGAL: ${f}`); }
}
console.log(`  php -l OK (${touched.length} file)`);
try { execSync('php artisan route:list --json', { stdio: 'pipe' }); console.log('  route:list OK'); }
catch { die('route:list gagal'); }

if (process.argv.includes('--commit')) {
  execSync(`git add ${touched.map((f) => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
  execSync('git commit -m "refactor(fase-5): Actions/Shared/ImportExcel dipakai 5 controller master-data"', { stdio: 'inherit' });
}
console.log('Selesai. Tes manual: import Excel di Cabang, Perusahaan, Departemen, Supplier, Inventory (sukses, file salah isi -> pesan error di field file).');
