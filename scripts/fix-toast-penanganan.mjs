// node fix-toast-penanganan.mjs  (--dry / --revert; bisa dari root atau scripts/)
// Error validasi di modal Penanganan (mis. "Biaya komponen wajib diisi kalau hasilnya diperbaiki")
// tampil sebagai toast (react-hot-toast), bukan kotak merah di dalam form.
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
      if (fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'resources', 'js'))) return d;
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
  }
  return process.cwd();
}
const root = findRoot(args.find((a) => !a.startsWith('--')));
const BK = path.join(root, '.migrasi-backup', 'fix-toast-penanganan');

const files = [
  {
    rel: 'resources/js/features/penanganan/modals/PenangananSelesaiModal.tsx',
    fallback: 'Gagal menandai penanganan selesai.',
    block: `        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
`,
  },
  {
    rel: 'resources/js/features/penanganan/modals/FormPerbaikanModal.tsx',
    fallback: 'Gagal menyimpan perbaikan.',
    block: `          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}
`,
  },
];

for (const f of files) {
  const file = path.join(root, f.rel);
  const bk = path.join(BK, f.rel);
  if (REVERT) {
    if (fs.existsSync(bk)) { fs.copyFileSync(bk, file); console.log('dikembalikan ' + f.rel); }
    continue;
  }
  let t = fs.readFileSync(file, 'utf8');
  const orig = t;
  if (t.includes('toastFormErrors')) { console.log('  sudah ter-patch: ' + f.rel); continue; }

  const onErr = `      onError: (errors) =>
        setError(errors.biaya_komponen || errors.harga_jasa || String(Object.values(errors)[0] || '${f.fallback}')),
`;
  const steps = [
    [onErr, `      onError: (errors) => toastFormErrors(errors, '${f.fallback}'),\n`],
    [f.block, ''],
    ["  const [error, setError] = useState('');\n", ''],
    ["    setError('');\n", ''],
    ["import { router } from '@inertiajs/react';\n", "import { router } from '@inertiajs/react';\nimport { toastFormErrors } from '../../../lib/toastErrors';\n"],
  ];
  let ok = true;
  for (const [from, to] of steps) {
    if (!t.includes(from)) { console.log(`! pola tidak ketemu di ${f.rel}, dilewati:\n${from.slice(0, 70)}`); ok = false; break; }
    t = t.replace(from, to);
  }
  if (!ok) continue;
  console.log((DRY ? '  [dry] ' : '  ok ') + f.rel);
  if (!DRY) {
    fs.mkdirSync(path.dirname(bk), { recursive: true });
    if (!fs.existsSync(bk)) fs.writeFileSync(bk, orig);
    fs.writeFileSync(file, t);
  }
}
