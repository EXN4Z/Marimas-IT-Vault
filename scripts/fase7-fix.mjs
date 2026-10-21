// Pakai: node scripts/fase7-fix.mjs [--commit]
// Membuat UpdateDepartemenRequest & UpdateSupplierRequest, lalu memakainya di controller. Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const commit = process.argv.includes('--commit');
const REQ = 'app/Http/Requests/MasterData';
const CTL = 'app/Http/Controllers/MasterData';

const items = [
  { c: 'Departemen', rules: `            'nama' => 'required|string|unique:departemen,nama,' . $this->route('id'),` },
  { c: 'Supplier', rules: `            'nama' => 'required|string|unique:supplier,nama,' . $this->route('id'),
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',` },
];

const reqTpl = (c, rules) => `<?php

namespace App\\Http\\Requests\\MasterData;

use Illuminate\\Foundation\\Http\\FormRequest;

// Dipindah dari ${c}Controller::update() -- aturan validasi identik ({id} diambil dari route, sama dengan $model->id).
class Update${c}Request extends FormRequest
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

for (const { c, rules } of items) {
  const reqPath = `${REQ}/Update${c}Request.php`;
  const ctlPath = `${CTL}/${c}Controller.php`;
  if (!fs.existsSync(ctlPath)) { console.error(`X tidak ada: ${ctlPath}`); process.exit(1); }

  fs.mkdirSync(path.dirname(reqPath), { recursive: true });
  fs.writeFileSync(reqPath, reqTpl(c, rules));
  console.log(`+ ${reqPath}`);

  let s = fs.readFileSync(ctlPath, 'utf8');
  if (s.includes(`Update${c}Request $request`)) { console.log(`= ${ctlPath} (sudah dipatch)`); continue; }

  const i = s.indexOf('public function update(');
  const j = s.indexOf('$validated = $request->validate([', i);
  const k = s.indexOf(']);', j);
  if (i < 0 || j < 0 || k < 0) { console.error(`X pola update() tidak cocok di ${ctlPath}`); process.exit(1); }

  s = s.slice(0, j) + '$validated = $request->validated();' + s.slice(k + 3);
  s = s.replace('public function update(Request $request', `public function update(Update${c}Request $request`);
  s = s.replace('use App\\Http\\Controllers\\Controller;\n',
    `use App\\Http\\Controllers\\Controller;\nuse App\\Http\\Requests\\MasterData\\Update${c}Request;\n`);
  fs.writeFileSync(ctlPath, s);
  console.log(`~ ${ctlPath}`);
}

const run = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return null; } };
const files = items.flatMap(({ c }) => [`${REQ}/Update${c}Request.php`, `${CTL}/${c}Controller.php`]);
for (const f of files) {
  const out = run(`php -l ${f}`);
  console.log(out === null ? `X php -l GAGAL: ${f}` : `  php -l OK: ${f}`);
  if (out === null) process.exit(1);
}
if (run('php artisan route:list --json') === null) { console.error('X route:list gagal'); process.exit(1); }
console.log('  route:list OK');

if (commit) {
  execSync(`git add ${files.join(' ')}`, { stdio: 'inherit' });
  execSync('git commit -m "refactor(fase-7): Form Request Departemen/Supplier update"', { stdio: 'inherit' });
}
console.log('Selesai. Tes manual: edit departemen/supplier (nama duplikat harus 422).');
