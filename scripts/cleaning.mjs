// Jalankan dari root project (node cleaning.mjs) atau dari dalam scripts/ (node cleaning.mjs) -- root dicari otomatis.
//   node cleaning.mjs --dry       -> cuma tampilkan rencana, tidak ada file yang berubah
//   node cleaning.mjs --revert    -> kembalikan semua file dari backup (.migrasi-backup/cleaning/)
//   node cleaning.mjs --scripts   -> sekalian hapus scripts/*.mjs (patch sekali-pakai yang sudah kepasang)
//   node cleaning.mjs path/ke/project
//
// F10 -- bersihin kode yang BENAR-BENAR tidak terpakai. Prinsip:
//  * File frontend yang dihapus = hasil hitung ulang graph import saat script jalan (bukan daftar tetap).
//    Akar graph: app.tsx + semua pages/** (dimuat lewat import.meta.glob).
//  * Setiap hapus/edit punya syarat: kalau simbolnya ternyata masih dipakai di tempat lain, dilewati + diberi tahu.
//  * Aman dijalankan berulang kali. Semua file asli di-backup dulu.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// root project = folder terdekat (naik dari lokasi script / cwd) yang punya package.json + resources/js,
// jadi aman dijalankan dari root maupun dari dalam scripts/
function findRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const start of [process.cwd(), here]) {
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

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const root = findRoot(args.find((a) => !a.startsWith('--')));
const DRY = flag('--dry');
const REVERT = flag('--revert');
const WITH_SCRIPTS = flag('--scripts');

const BACKUP = path.join(root, '.migrasi-backup', 'cleaning');
const MANIFEST = path.join(BACKUP, 'manifest.json');
const abs = (rel) => path.join(root, rel);
const posix = (p) => p.split(path.sep).join('/');

// ------------------------------------------------------------------ revert
if (REVERT) {
  if (!fs.existsSync(MANIFEST)) {
    console.log('Tidak ada backup cleaning untuk dikembalikan.');
    process.exit(0);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const rel of m.files) {
    const src = path.join(BACKUP, 'files', rel);
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
    fs.copyFileSync(src, abs(rel));
    console.log('  dikembalikan  ' + rel);
  }
  fs.rmSync(BACKUP, { recursive: true, force: true });
  console.log(`\nSelesai: ${m.files.length} file dikembalikan.`);
  process.exit(0);
}

if (!fs.existsSync(abs('package.json')) || !fs.existsSync(abs('resources/js'))) {
  console.error('Jalankan dari root project Marimas IT Vault (atau kasih path-nya).');
  process.exit(1);
}

// ------------------------------------------------------------------ virtual FS
const walk = (dir, out = []) => {
  if (!fs.existsSync(abs(dir))) return out;
  for (const e of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    const rel = posix(path.join(dir, e.name));
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

const edited = new Map(); // rel -> isi baru
const deleted = new Map(); // rel -> alasan
const skipped = [];
const read = (rel) => (edited.has(rel) ? edited.get(rel) : fs.readFileSync(abs(rel), 'utf8'));
const exists = (rel) => !deleted.has(rel) && fs.existsSync(abs(rel));
const SRC_RE = /\.(tsx?|jsx?)$/;

const jsFiles = () => walk('resources/js').filter((f) => SRC_RE.test(f) && !deleted.has(f));
const phpFiles = () => [...walk('app'), ...walk('routes'), ...walk('bootstrap'), ...walk('config'), ...walk('database'), ...walk('tests'), ...walk('resources/views')].filter((f) => /\.php$/.test(f) && !deleted.has(f));

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|#).*$/gm, '').replace(/([^:'"])\/\/.*$/gm, '$1');
const wordCount = (text, name) => (text.match(new RegExp('(?<![\\w$])' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g')) || []).length;
// berapa kali `name` muncul di KODE (bukan komentar) di semua file `files`
const codeUses = (files, name, exceptFile) =>
  files.filter((f) => f !== exceptFile).reduce((n, f) => n + wordCount(stripComments(read(f)), name), 0);


// file lain yang meng-import modul `rel` (relatif), buat ngecek pemakaian simbol yang di-export
function importersOf(rel) {
  const set = new Set(jsFiles());
  const re = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const out = [];
  for (const f of set) {
    if (f === rel) continue;
    const t = stripComments(read(f));
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(t))) {
      const spec = m[1] || m[2] || m[3];
      if (!spec.startsWith('.')) continue;
      const b = posix(path.join(path.dirname(f), spec));
      if ([b, b + '.ts', b + '.tsx', b + '.js', b + '.jsx', b + '/index.ts', b + '/index.tsx'].includes(rel)) { out.push(f); break; }
    }
  }
  return out;
}

// ------------------------------------------------------------------ helper edit
function removeBlock(text, re, { oneLine = false } = {}) {
  const m = re.exec(text);
  if (!m) return null;
  let start = text.lastIndexOf('\n', m.index) + 1;
  let end;
  if (oneLine) {
    end = text.indexOf('\n', m.index);
    end = end === -1 ? text.length : end + 1;
  } else {
    const open = text.indexOf('{', m.index + m[0].length);
    if (open === -1) return null;
    let depth = 0;
    let i = open;
    let q = null;
    for (; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];
      if (q) {
        if (c === '\\') i++;
        else if (c === q) q = null;
        continue;
      }
      if (c === '/' && n === '/') { i = text.indexOf('\n', i); if (i === -1) break; continue; }
      if (c === '/' && n === '*') { i = text.indexOf('*/', i) + 1; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) break;
    }
    if (depth !== 0) return null;
    end = text.indexOf('\n', i);
    end = end === -1 ? text.length : end + 1;
  }
  // ikut buang komentar/docblock yang menempel tepat di atasnya
  const lines = text.slice(0, start).split('\n');
  lines.pop();
  while (lines.length) {
    const t = lines[lines.length - 1].trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
      start -= lines.pop().length + 1;
    } else break;
  }
  let before = text.slice(0, start);
  let after = text.slice(end);
  // jangan sisakan dua baris kosong berurutan
  if (/\n\s*\n$/.test(before) && /^\s*\n/.test(after)) after = after.replace(/^\s*\n/, '');
  // jangan sisakan baris kosong tepat setelah "{" pembuka atau tepat sebelum "}" penutup
  if (/\{\n$/.test(before)) after = after.replace(/^[ \t]*\n/, '');
  before = before.replace(/\{\n\s*\n$/, '{\n');
  if (/^\s*\}/.test(after)) before = before.replace(/\n[ \t]*\n$/, '\n');
  return before + after;
}

function pruneUse(text, names) {
  for (const n of names) {
    const useRe = new RegExp('^use\\s+[^;]*\\\\' + n + ';\\r?\\n', 'm');
    if (!useRe.test(text)) continue;
    const without = text.replace(useRe, '');
    if (wordCount(without, n) === 0) text = without;
  }
  return text;
}

function setEdit(rel, next, why) {
  if (next == null || next === read(rel)) return false;
  edited.set(rel, next);
  plan.push({ kind: 'edit', rel, why });
  return true;
}
const plan = [];
const del = (rel, why) => {
  if (!exists(rel) || deleted.has(rel)) return;
  deleted.set(rel, why);
  plan.push({ kind: 'hapus', rel, why });
};
const skip = (rel, why) => skipped.push(`${rel}: ${why}`);

// ================================================================== 1. FRONTEND: edit
// 1a. react-query cuma dipakai sebagai provider kosong (tidak ada useQuery/useMutation di mana pun).
(() => {
  const rel = 'resources/js/app.tsx';
  if (!exists(rel)) return;
  const others = jsFiles().filter((f) => f !== rel && f !== 'resources/js/lib/queryClient.ts');
  const hooks = others.some((f) => /useQuery|useMutation|useQueryClient|useInfiniteQuery|@tanstack\/react-query/.test(stripComments(read(f))));
  if (hooks) return skip(rel, 'react-query ternyata masih dipakai di file lain, provider dibiarkan');
  let lines = read(rel).split('\n');
  const a = lines.findIndex((l) => l.includes('<QueryClientProvider'));
  const b = lines.findIndex((l) => l.includes('</QueryClientProvider>'));
  if (a === -1 || b === -1) return;
  const inner = lines.slice(a + 1, b).map((l) => (l.startsWith('  ') ? l.slice(2) : l));
  lines = [...lines.slice(0, a), ...inner, ...lines.slice(b + 1)].filter(
    (l) => !/import\s*\{\s*QueryClientProvider\s*\}\s*from\s*'@tanstack\/react-query'/.test(l) && !/import\s*\{\s*queryClient\s*\}\s*from\s*'\.\/lib\/queryClient'/.test(l),
  );
  setEdit(rel, lines.join('\n'), 'buang QueryClientProvider (react-query tidak dipakai)');
})();

// ================================================================== 2. FRONTEND: file yatim (graph import)
(() => {
  const files = jsFiles();
  const set = new Set(files);
  const resolve = (from, spec) => {
    if (!spec.startsWith('.')) return null;
    const b = posix(path.join(path.dirname(from), spec));
    for (const c of [b, b + '.ts', b + '.tsx', b + '.js', b + '.jsx', b + '/index.ts', b + '/index.tsx', b + '/index.js']) if (set.has(c)) return c;
    return null;
  };
  const re = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const edges = new Map();
  for (const f of files) {
    const out = [];
    const t = stripComments(read(f));
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(t))) {
      const r = resolve(f, m[1] || m[2] || m[3]);
      if (r) out.push(r);
    }
    edges.set(f, out);
  }
  const seen = new Set();
  const stack = ['resources/js/app.tsx', ...files.filter((f) => f.startsWith('resources/js/pages/'))];
  while (stack.length) {
    const x = stack.pop();
    if (seen.has(x) || !set.has(x)) continue;
    seen.add(x);
    stack.push(...(edges.get(x) || []));
  }
  for (const f of files) {
    if (seen.has(f)) continue;
    if (f === 'resources/js/app.js') {
      // entry lama; vite.config.js cuma pakai app.tsx
      if (read(f).replace(/\s/g, '').replace(/^\/\//, '') === '' && !/app\.js/.test(fs.readFileSync(abs('vite.config.js'), 'utf8')) && !/app\.js/.test(fs.readFileSync(abs('resources/views/app.blade.php'), 'utf8')))
        del(f, 'entry lama kosong (vite pakai app.tsx)');
      continue;
    }
    if (f.endsWith('.d.ts')) continue;
    del(f, 'tidak di-import dari app.tsx / pages/** (file yatim)');
  }
})();

// 2b. file cadangan .bak di dalam resources/ (sudah ada di git history / versi aktifnya jalan)
for (const f of walk('resources').filter((f) => f.endsWith('.bak'))) del(f, 'file cadangan .bak');

// 1b. simbol lokal / export yang tidak dipernah dipanggil
const jsRemovals = [
  { rel: 'resources/js/features/karyawan/KaryawanTab.tsx', name: 'openCreate', re: /^[ \t]*function openCreate\s*\(/m, why: 'fungsi openCreate tidak dipanggil (tombol Tambah User set state langsung)' },
  { rel: 'resources/js/features/laporan/foto/FotoInventoryTab.tsx', name: 'PER_PAGE', re: /^const PER_PAGE\s*=.*$/m, oneLine: true, why: 'konstanta PER_PAGE tidak dipakai (paginasi dari server)' },
  { rel: 'resources/js/features/inventory/types/inventory.ts', name: 'InventoryPosisi', re: /^type InventoryPosisi\s*=.*$/m, oneLine: true, why: 'type InventoryPosisi tidak dipakai' },
  { rel: 'resources/js/features/inventory/types/inventory.ts', name: 'InventoryFormValues', re: /^export interface InventoryFormValues\b/m, why: 'interface InventoryFormValues tidak dipakai (form modal pakai useForm Inertia)' },
  { rel: 'resources/js/features/inventory/list/helpers.ts', name: 'STATUS_AKSEN', re: /^export const STATUS_AKSEN\b.*$/m, oneLine: true, why: 'STATUS_AKSEN = {} kosong, tidak dibaca siapa pun' },
  { rel: 'resources/js/features/laporan/types.ts', name: 'FotoSub', re: /^export type FotoSub\b.*$/m, oneLine: true, why: 'type FotoSub tidak dipakai' },
  { rel: 'resources/js/features/penanganan/helpers.ts', name: 'TabStatus', re: /^export type TabStatus\b.*$/m, oneLine: true, why: 'type TabStatus tidak dipakai' },
];
for (const r of jsRemovals) {
  if (!exists(r.rel)) continue;
  const text = read(r.rel);
  if (!r.re.test(text)) continue; // sudah bersih
  // dipakai = kemunculan di file sendiri (di luar definisi) + di file yang meng-import modul ini
  const own = wordCount(stripComments(text), r.name) - 1;
  const uses = own + importersOf(r.rel).reduce((n, f) => n + wordCount(stripComments(read(f)), r.name), 0);
  if (uses > 0) {
    skip(r.rel, `${r.name} masih dipakai (${uses} kemunculan di kode), dilewati`);
    continue;
  }
  setEdit(r.rel, removeBlock(text, r.re, { oneLine: r.oneLine }), r.why);
}

// 1c. import `Images` (lucide) yang tidak terpakai
(() => {
  const rel = 'resources/js/features/laporan/foto/FotoInventoryTab.tsx';
  if (!exists(rel)) return;
  const t = read(rel);
  if (!/import\s*\{[^}]*\bImages\b[^}]*\}\s*from\s*'lucide-react'/.test(t)) return;
  if (wordCount(stripComments(t), 'Images') > 1) return skip(rel, 'Images masih dipakai');
  setEdit(rel, t.replace(/(import\s*\{[^}]*?)\bImages,\s*/, '$1'), "import 'Images' (lucide-react) tidak dipakai");
})();

// ================================================================== 3. BACKEND PHP
// 3a. UserController: cuma index() yang dirutekan (GET /master-data/karyawan/cari).
(() => {
  const rel = 'app/Http/Controllers/MasterData/UserController.php';
  if (!exists(rel)) return;
  const routes = phpFiles().filter((f) => f.startsWith('routes/')).map(read).join('\n');
  if (/UserController::class,\s*'(edit|store|update|destroy)'/.test(routes)) return skip(rel, 'ada route yang masih menunjuk store/update/destroy/edit');
  if (/UserController::class\s*\]?\s*\)/.test(routes.replace(/UserController::class,\s*'index'/g, ''))) return skip(rel, 'UserController dipakai sebagai invokable/resource, dilewati');
  let t = read(rel);
  const before = t;
  for (const name of ['edit', 'store', 'update', 'destroy']) t = removeBlock(t, new RegExp(`^[ \\t]*public function ${name}\\s*\\(`, 'm')) ?? t;
  t = removeBlock(t, /^[ \t]*private function responseValidasi\s*\(/m) ?? t;
  t = pruneUse(t, ['KaryawanAction', 'ValidationException']);
  if (t !== before) setEdit(rel, t, 'buang edit/store/update/destroy + responseValidasi (tidak ada route-nya; CRUD ada di KaryawanController)');
})();

// 3b. Mailable yang tidak pernah dikirim + view-nya
(() => {
  const pairs = [
    ['app/Mail/BranchCredentials.php', 'BranchCredentials', 'resources/views/emails/branch-credentials.blade.php', 'emails.branch-credentials'],
    ['app/Mail/NewPasswordMail.php', 'NewPasswordMail', 'resources/views/emails/new-password.blade.php', 'emails.new-password'],
  ];
  const all = phpFiles();
  for (const [cls, name, view, viewName] of pairs) {
    if (!exists(cls)) continue;
    const refs = all.filter((f) => f !== cls && wordCount(read(f), name) > 0);
    if (refs.length) {
      skip(cls, `${name} dirujuk di ${refs.join(', ')}`);
      continue;
    }
    del(cls, `Mailable ${name} tidak pernah dipakai`);
    const viewRefs = all.filter((f) => f !== cls && f !== view && read(f).includes(viewName));
    if (!viewRefs.length) del(view, `view ${viewName} hanya dipakai Mailable yang dihapus`);
  }
})();

// 3c. method statis/relasi yang tidak ada yang manggil
const phpMethods = [
  { rel: 'app/Models/User.php', name: 'generatePasswordFromName', re: /^[ \t]*public static function generatePasswordFromName\s*\(/m, prune: ['Str'], why: 'User::generatePasswordFromName tidak dipanggil (password dibuat di KaryawanAction)' },
  { rel: 'app/Queries/Laporan/RiwayatInventoryQuery.php', name: 'dariRequest', re: /^[ \t]*public static function dariRequest\s*\(/m, prune: ['Request'], why: 'RiwayatInventoryQuery::dariRequest = sisa API lama, tidak ada pemanggil' },
  { rel: 'app/Models/MasterData/Inventory.php', name: 'menempel', re: /^[ \t]*public function scopeMenempel\s*\(/m, prune: [], callRe: /(->|::)menempel\s*\(/, why: 'scope Inventory::menempel() tidak dipakai' },
  { rel: 'app/Models/Transaksi/InventoryPemakai.php', name: 'requestedBy', re: /^[ \t]*public function requestedBy\s*\(/m, prune: [], why: 'relasi InventoryPemakai::requestedBy tidak dipakai (kolom diserahkan_oleh tetap diisi)' },
];
for (const r of phpMethods) {
  if (!exists(r.rel)) continue;
  const text = read(r.rel);
  if (!r.re.test(text)) continue;
  const others = phpFiles().filter((f) => f !== r.rel);
  const call = r.callRe || new RegExp(`(->|::|['"])${r.name}\\b`);
  const hit = others.find((f) => call.test(stripComments(read(f))));
  const selfHit = call.test(stripComments(text.replace(r.re, '')));
  if (hit || selfHit) {
    skip(r.rel, `${r.name} ternyata dipakai${hit ? ' di ' + hit : ' di file ini'}`);
    continue;
  }
  const next = removeBlock(text, r.re);
  setEdit(r.rel, next && pruneUse(next, r.prune), r.why);
}

// ================================================================== 4. scripts/ (opsional)
const SELF = posix(path.relative(root, fileURLToPath(import.meta.url)));
if (WITH_SCRIPTS) for (const f of walk('scripts').filter((f) => f.endsWith('.mjs') && f !== SELF)) del(f, 'patch sekali-pakai (sudah ter-apply)');

// ================================================================== laporan rencana
const edits = plan.filter((p) => p.kind === 'edit');
const dels = plan.filter((p) => p.kind === 'hapus');
console.log(DRY ? '=== DRY RUN (tidak ada yang diubah) ===\n' : '=== CLEANING ===\n');
console.log(`HAPUS FILE (${dels.length})`);
for (const p of dels) console.log(`  - ${p.rel}\n      ${p.why}`);
console.log(`\nEDIT (${edits.length})`);
for (const p of edits) console.log(`  ~ ${p.rel}\n      ${p.why}`);
if (skipped.length) {
  console.log(`\nDILEWATI (${skipped.length})`);
  for (const s of skipped) console.log('  ! ' + s);
}

if (!plan.length) {
  console.log('\nTidak ada yang perlu dibersihkan.');
} else if (!DRY) {
  const touched = [...new Set([...edited.keys(), ...deleted.keys()])];
  fs.mkdirSync(path.join(BACKUP, 'files'), { recursive: true });
  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).files : [];
  for (const rel of touched) {
    const dst = path.join(BACKUP, 'files', rel);
    if (fs.existsSync(dst)) continue; // backup pertama (asli) jangan ditimpa
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(abs(rel), dst);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify({ files: [...new Set([...prev, ...touched])] }, null, 2));
  for (const [rel, text] of edited) if (!deleted.has(rel)) fs.writeFileSync(abs(rel), text);
  for (const rel of deleted.keys()) fs.rmSync(abs(rel), { force: true });
  // buang folder kosong yang ditinggalkan
  for (const rel of deleted.keys()) {
    let d = path.dirname(abs(rel));
    while (d.startsWith(root) && d !== root && fs.existsSync(d) && fs.readdirSync(d).length === 0) {
      fs.rmdirSync(d);
      d = path.dirname(d);
    }
  }
  console.log(`\nSelesai: ${dels.length} file dihapus, ${edits.length} file diedit. Backup: .migrasi-backup/cleaning/ (node cleaning.mjs --revert untuk balikin).`);
}

// ================================================================== yang SENGAJA tidak disentuh (cuma laporan)
console.log(`
------------------------------------------------------------------
LANGKAH MANUAL (script tidak menyentuh package.json / lock supaya 'npm ci' di Railway tidak pecah):
  npm uninstall @tanstack/react-query
  npm uninstall concurrently @tailwindcss/postcss      # tidak ada import/script/config yang memakainya
  npm run build                                         # pastikan bundle tetap jadi

TIDAK DISENTUH (butuh keputusan kamu, ada efek ke DB/deploy):
  - Sisa stack API/Sanctum: bootstrap/app.php ($middleware->statefulApi() & ->api(append: LogActivity) -- tidak ada
    route api), trait HasApiTokens di User, config/sanctum.php, 'api/*' di config/cors.php, migration
    personal_access_tokens, dan laravel/sanctum di composer.json.
  - LogActivity: pola URI lama ('aset/{aset}', 'aset-pemakai', 'api/login', ...) tidak ada route-nya lagi.
  - app/Notifications/TestPushNotification.php: helper tinker, tidak dipanggil di kode (sengaja dibiarkan).
`);
