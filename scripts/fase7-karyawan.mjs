// Pakai: node scripts/fase7-karyawan.mjs [--commit]
// Pindahkan 2 validate([...]) literal di KaryawanController ke Form Request. Idempotent.
// (store/update TIDAK disentuh: aturannya datang dari KaryawanAction::rulesBuat/rulesUbah yang dipakai bareng API.)
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const REQ = 'app/Http/Requests/MasterData';
const CTL = 'app/Http/Controllers/MasterData/KaryawanController.php';

const reqTpl = (cls, from, rules) => `<?php

namespace App\\Http\\Requests\\MasterData;

use Illuminate\\Foundation\\Http\\FormRequest;

// Dipindah dari KaryawanController::${from}() -- aturan validasi identik.
class ${cls} extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
${rules}
        ];
    }
}
`;

const jobs = [
  { cls: 'SetPasswordKaryawanRequest', method: 'setPassword',
    rules: `            'password' => ['required', 'string', 'confirmed'],`,
    oldSig: 'public function setPassword(Request $request, $id)', newSig: 'public function setPassword(SetPasswordKaryawanRequest $request, $id)',
    oldBody: `$validated = $request->validate([
            'password' => ['required', 'string', 'confirmed'],
        ]);`, newBody: '$validated = $request->validated();' },
  { cls: 'ImportKaryawanRequest', method: 'import',
    rules: `            'file' => 'required|file|mimes:xlsx,xls|max:10240',`,
    oldSig: 'public function import(Request $request)', newSig: 'public function import(ImportKaryawanRequest $request)',
    oldBody: `        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

`, newBody: '' },
];

let s = fs.readFileSync(CTL, 'utf8');
fs.mkdirSync(REQ, { recursive: true });
for (const j of jobs) {
  fs.writeFileSync(`${REQ}/${j.cls}.php`, reqTpl(j.cls, j.method, j.rules));
  console.log(`+ ${REQ}/${j.cls}.php`);
  if (s.includes(j.newSig)) { console.log(`= ${j.method}() sudah dipatch`); continue; }
  if (!s.includes(j.oldSig) || !s.includes(j.oldBody)) { console.error(`X pola ${j.method}() tidak cocok di ${CTL} (sudah diubah manual?)`); process.exit(1); }
  s = s.replace(j.oldSig, j.newSig).replace(j.oldBody, j.newBody);
  s = s.replace('use App\\Http\\Controllers\\Controller;\n', `use App\\Http\\Controllers\\Controller;\nuse App\\Http\\Requests\\MasterData\\${j.cls};\n`);
}
fs.writeFileSync(CTL, s);
console.log(`~ ${CTL}`);

const files = [CTL, ...jobs.map((j) => `${REQ}/${j.cls}.php`)];
for (const f of files) {
  try { execSync(`php -l ${f}`, { stdio: 'pipe' }); console.log(`  php -l OK: ${f}`); }
  catch { console.error(`X php -l GAGAL: ${f}`); process.exit(1); }
}
try { execSync('php artisan route:list --json', { stdio: 'pipe' }); console.log('  route:list OK'); }
catch { console.error('X route:list gagal'); process.exit(1); }

if (process.argv.includes('--commit')) {
  execSync(`git add ${files.join(' ')}`, { stdio: 'inherit' });
  execSync('git commit -m "refactor(fase-7): Form Request Karyawan setPassword/import"', { stdio: 'inherit' });
}
console.log('Selesai. Tes manual: ubah password karyawan (konfirmasi tidak cocok -> error di field password) dan import Excel.');
