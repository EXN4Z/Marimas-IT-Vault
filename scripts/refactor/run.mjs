#!/usr/bin/env node
// Refactor struktur folder (Laravel + Inertia + React TS). Behavior-preserving.
// Jalankan dari mana saja: node scripts/refactor/run.mjs <perintah> [--apply]
// Default = DRY-RUN (tidak mengubah apa pun). Tambah --apply untuk eksekusi + commit per fase.

import fs from 'node:fs';
import path from 'node:path';
import * as cfg from './config.mjs';
import {
  ROOT, c, log, warn, die, sh, git, hasCmd, exists, read, write, listFiles, pruneEmptyDirs, movePath,
  maskPhp, relocate, insertUses, checkPhpStatic, lintPhp, routeSnapshot, scanPhp,
} from './lib.mjs';

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('--')) ?? 'help';
const flag = (n) => args.includes(`--${n}`);
const APPLY = flag('apply');
const hasGit = () => git(['rev-parse', '--is-inside-work-tree'], { allowFail: true }).code === 0;
const statePath = `${cfg.OUT_DIR}/state.json`;
const loadState = () => (exists(statePath) ? JSON.parse(read(statePath)) : { baseline: null, fqcnMap: {}, moves: [], notes: [], skipped: [] });
const saveState = (s) => write(statePath, JSON.stringify(s, null, 2));

// =============================================================================
// util verifikasi
// =============================================================================
function countTsErrors(out) {
  return (out.match(/error TS\d+/g) || []).length;
}

function runJsChecks() {
  if (flag('skip-js')) return { skipped: true };
  const tsc = sh('npx', ['--no-install', 'tsc', '--noEmit'], { allowFail: true });
  const build = sh('npm', ['run', 'build', '--silent'], { allowFail: true });
  return { tsc: { code: tsc.code, errors: countTsErrors(tsc.out), tail: tsc.out.split('\n').slice(-15).join('\n') }, build: { code: build.code, tail: build.out.split('\n').slice(-15).join('\n') } };
}

function verifyJs(label) {
  const base = loadState().baseline?.js;
  const now = runJsChecks();
  if (now.skipped) return warn('verifikasi JS dilewati (--skip-js)');
  log(c.dim(`  tsc: exit ${now.tsc.code}, ${now.tsc.errors} error | build: exit ${now.build.code}`));
  const baseErr = base?.tsc?.errors ?? 0;
  const baseBuild = base?.build?.code ?? 0;
  if (now.tsc.errors > baseErr || (now.build.code !== 0 && baseBuild === 0)) {
    die(`[${label}] verifikasi JS GAGAL (lebih buruk dari baseline: tsc ${baseErr} -> ${now.tsc.errors}, build ${baseBuild} -> ${now.build.code}).\n${now.tsc.tail}\n${now.build.tail}\nRollback: git reset --hard HEAD`);
  }
  if (now.tsc.code !== 0 || now.build.code !== 0) warn('tsc/build masih gagal, tapi tidak lebih buruk dari baseline.');
}

function mapAction(action, fqcnMap) {
  const [cls, method] = String(action).split('@');
  return `${fqcnMap[cls] ?? cls}${method ? '@' + method : ''}`;
}
function normalizeRoutes(rows, fqcnMap) {
  return rows.map((r) => {
    const m = r.match(/^(.*?) \| name=(.*?) \| (.*?) \| mw=(.*)$/);
    return m ? `${m[1]} | name=${m[2]} | ${mapAction(m[3], fqcnMap)} | mw=${m[4]}` : r;
  }).sort();
}

function verifyPhp(label, changedFiles) {
  const errs = checkPhpStatic();
  if (errs.length) die(`[${label}] cek statis PHP GAGAL:\n  ${errs.join('\n  ')}\nRollback: git reset --hard HEAD`);
  log(c.dim('  cek statis (namespace/use/path): OK'));

  const lint = lintPhp(changedFiles.filter((f) => f.endsWith('.php') && exists(f)));
  if (lint.skipped) warn('php tidak ada di PATH: php -l dilewati.');
  else if (lint.errors.length) die(`[${label}] php -l GAGAL:\n  ${lint.errors.join('\n  ')}\nRollback: git reset --hard HEAD`);
  else log(c.dim(`  php -l: OK (${changedFiles.length} file)`));

  const st = loadState();
  if (st.baseline?.routes) {
    const now = routeSnapshot();
    if (!now) warn('php tidak ada: route:list dilewati.');
    else if (now.error) die(`[${label}] route:list gagal:\n${now.error}\nRollback: git reset --hard HEAD`);
    else {
      const a = normalizeRoutes(st.baseline.routes, st.fqcnMap);
      const b = normalizeRoutes(now.rows, {});
      const miss = a.filter((x) => !b.includes(x));
      const extra = b.filter((x) => !a.includes(x));
      if (miss.length || extra.length) {
        die(`[${label}] route:list BERBEDA dari baseline.\n- hilang/berubah:\n  ${miss.join('\n  ')}\n- baru/berubah:\n  ${extra.join('\n  ')}\nRollback: git reset --hard HEAD`);
      }
      log(c.dim(`  route:list identik dengan baseline (${a.length} route)`));
    }
  } else warn('baseline route belum ada (jalankan fase 0 di PHP environment yang jalan).');
}

function commit(msg, extraPaths = []) {
  if (!hasGit() || flag('no-commit')) return warn('commit dilewati.');
  git(['add', '-A', '--', ...cfg.PHP_DIRS.filter((d) => exists(d)), 'resources', ...extraPaths]);
  const staged = git(['diff', '--cached', '--quiet'], { allowFail: true });
  if (staged.code === 0) return warn('tidak ada perubahan untuk di-commit.');
  git(['commit', '-F', '-'], { input: msg });
  log(c.green('  commit: ') + msg.split('\n')[0]);
}

function requireCleanTree() {
  if (!hasGit() || flag('allow-dirty')) return;
  const s = git(['status', '--porcelain', '--untracked-files=no']).out.trim();
  if (s) die(`Working tree belum bersih (commit/stash dulu, atau pakai --allow-dirty):\n${s}`);
}

function ensureBranch() {
  if (!hasGit()) return warn('Bukan git repo: lewati branch/commit/git mv (pakai rename biasa).');
  const cur = git(['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
  if (cur === cfg.BRANCH) return;
  const has = git(['rev-parse', '--verify', cfg.BRANCH], { allowFail: true }).code === 0;
  git(has ? ['checkout', cfg.BRANCH] : ['checkout', '-b', cfg.BRANCH]);
  log(c.green(`  branch: ${cfg.BRANCH}`));
}

function excludeOutDir() {
  if (!hasGit()) return;
  const p = path.join(ROOT, '.git', 'info', 'exclude');
  try {
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (!cur.includes(cfg.OUT_DIR)) fs.appendFileSync(p, `\n${cfg.OUT_DIR}/\n`);
  } catch { /* abaikan */ }
}

function takeBaseline() {
  log(c.bold('Baseline'));
  const st = loadState();
  const js = runJsChecks();
  const routes = routeSnapshot();
  let tests = null;
  if (!flag('skip-tests') && hasCmd('php', ['-v'])) {
    const t = sh('php', ['artisan', 'test', '--compact'], { allowFail: true });
    tests = { code: t.code, tail: t.out.split('\n').slice(-6).join('\n') };
  }
  st.baseline = { js, routes: routes?.rows ?? null, routesError: routes?.error ?? null, tests, at: new Date().toISOString() };
  saveState(st);
  if (!js.skipped) log(`  tsc: exit ${js.tsc.code} (${js.tsc.errors} error) | build: exit ${js.build.code}`);
  log(`  route:list: ${routes?.rows ? routes.rows.length + ' route' : routes?.error ? c.red('GAGAL (lihat state.json)') : 'dilewati (tanpa php)'}`);
  if (tests) log(`  test: exit ${tests.code}`);
}

function ensureBaseline() {
  if (!loadState().baseline) {
    warn('Baseline belum ada, ambil sekarang (sebelum ada perubahan).');
    takeBaseline();
  }
}

// cek Inertia::render('X/Y') <-> resources/js/pages/X/Y.tsx (case-sensitive, seperti resolver app.tsx)
function checkInertiaPages() {
  const names = new Set();
  for (const f of scanPhp()) {
    for (const m of maskPhpKeepStrings(read(f)).matchAll(/Inertia::render\(\s*'([^']+)'/g)) names.add(m[1]);
  }
  const bad = [];
  for (const n of names) {
    const parts = `${n}.tsx`.split('/');
    let dir = 'resources/js/pages';
    for (const part of parts) {
      const ents = exists(dir) ? fs.readdirSync(path.join(ROOT, dir)) : [];
      if (!ents.includes(part)) { bad.push(`${n} -> ${dir}/${part} tidak ada (case-sensitive)`); break; }
      dir += `/${part}`;
    }
  }
  return { names: [...names], bad };
}
function maskPhpKeepStrings(src) { // hanya buang komentar baris/blok
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// =============================================================================
// FASE 0
// =============================================================================
function phase0() {
  log(c.bold('\nFASE 0: persiapan'));
  if (!exists('artisan') || !exists('resources/js')) die('Jalankan dari project Laravel (butuh artisan & resources/js).');
  if (!APPLY) return log('  (dry-run) akan: buat branch, exclude .refactor-out, ambil baseline tsc/build/route:list/test. Pakai --apply.');
  requireCleanTree();
  ensureBranch();
  excludeOutDir();
  takeBaseline();
}

// =============================================================================
// FASE 4: pages/dashboard -> pages/Dashboard
// =============================================================================
function actualName(dir, name) {
  if (!exists(dir)) return null;
  return fs.readdirSync(path.join(ROOT, dir)).find((e) => e.toLowerCase() === name.toLowerCase()) ?? null;
}

function phase4() {
  log(c.bold('\nFASE 4 (sisa): casing folder pages'));
  const todo = [];
  for (const { from, to } of cfg.FE_DIR_RENAMES) {
    const parent = path.posix.dirname(from);
    const have = actualName(parent, path.posix.basename(from));
    if (have === path.posix.basename(to)) { log(c.dim(`  sudah benar: ${to}`)); continue; }
    if (!have) { warn(`tidak ada: ${from}`); continue; }
    todo.push({ from: `${parent}/${have}`, to });
  }
  for (const t of todo) log(`  ${t.from}  ->  ${t.to}`);
  const chk = checkInertiaPages();
  if (chk.bad.length) log(c.yellow(`  Inertia::render yang belum cocok dengan pages/: \n    ${chk.bad.join('\n    ')}`));
  if (!APPLY) return;
  requireCleanTree(); ensureBranch(); excludeOutDir(); ensureBaseline();
  for (const t of todo) {
    const tmp = `${t.from}__tmp_case`;
    movePath(t.from, tmp);
    movePath(tmp, t.to);
  }
  const after = checkInertiaPages();
  if (after.bad.length) die(`Masih ada render yang tidak cocok dengan pages/:\n  ${after.bad.join('\n  ')}`);
  verifyJs('fase 4');
  commit('refactor(fase-4): samakan casing pages/Dashboard dengan Inertia::render(\'Dashboard/Index\')');
}

// =============================================================================
// FASE 5: Controllers + Queries
// =============================================================================
function splitRoleController() {
  const roleCtl = `${cfg.LEGACY_MOVES.find(([f]) => f.endsWith('MasterData/RoleController.php'))[0]}`;
  if (!exists(roleCtl)) return false;
  const src = read(roleCtl);
  if (!src.includes('public static function daftar()')) return false; // sudah dibelah
  const mark = "return Role::where('nama', '!=', 'cabang')->orderBy('id')->get(['id', 'nama']);";
  if (!src.includes(mark)) die('RoleController berubah dari yang diharapkan, belah manual.');
  if (!src.includes('return response()->json(self::daftar());')) die('RoleController::index() berubah dari yang diharapkan.');

  write('app/Queries/MasterData/RoleQuery.php', `<?php

namespace App\\Queries\\MasterData;

use App\\Models\\MasterData\\Role;

class RoleQuery
{
    // [F3-INERTIA] Daftar role yang boleh dipilih (tanpa 'cabang'). Dipakai bareng props \`karyawanOpsi\`
    // di tab Karyawan (KaryawanController::opsi) dan RoleController::index() (legacy JSON).
    public static function daftar()
    {
        ${mark}
    }
}
`);
  let out = src
    .replace(/    \/\/ \[F3-INERTIA\] Daftar role[\s\S]*?public static function daftar\(\)\s*\{[\s\S]*?\}\s*\n\s*\n/, '')
    .replace('return response()->json(self::daftar());', 'return response()->json(RoleQuery::daftar());')
    .replace('use App\\Models\\MasterData\\Role;', 'use App\\Queries\\MasterData\\RoleQuery;');
  if (out.includes('daftar()\n    {') || !out.includes('RoleQuery::daftar()')) die('Pembelahan RoleController gagal, batal.');
  write(roleCtl, out);

  const kar = 'app/Http/Controllers/MasterData/KaryawanWebController.php';
  let k = read(kar);
  if (k.includes('RoleController::daftar()')) {
    k = k.replace('RoleController::daftar()', 'RoleQuery::daftar()');
    write(kar, insertUses(k, ['App\\Queries\\MasterData\\RoleQuery'], kar));
  }
  return true;
}

function phase5() {
  log(c.bold('\nFASE 5: Controllers, Queries'));
  if (cfg.LEGACY_MOVES.some(([, to]) => exists(to))) return warn('Tujuan fase 5 sudah ada (Legacy/...): fase 5 sudah selesai, dilewati.');
  const pairs = [...cfg.LEGACY_MOVES, ...cfg.LIVE_CONTROLLER_MOVES, ...cfg.QUERY_MOVES].filter(([f]) => exists(f));
  if (!pairs.length) return warn('Tidak ada file yang perlu dipindah (fase 5 sudah selesai?).');
  if (APPLY) { requireCleanTree(); ensureBranch(); excludeOutDir(); ensureBaseline(); }
  if (APPLY && splitRoleController()) log('  RoleController dibelah -> Queries/MasterData/RoleQuery + sisa index() ke Legacy');
  const res = relocate(pairs, { apply: APPLY });
  printMoves(res.moves);
  log(`  file lain yang diedit (use/namespace/rename): ${res.edited}`);
  if (!APPLY) return log(c.dim('  (dry-run) + RoleController dibelah saat --apply'));
  finishPhase('fase 5', res, 'refactor(fase-5): pindah/rename Controllers + Queries ke subfolder per modul\n\n- XWebController -> XController, DashboardPageController -> DashboardController,\n  PenangananInventoryPageController -> PenangananPageController, WebAuthController -> AuthController\n- Controller API lama (routes/api.php kosong) -> Http/Controllers/Legacy/ (tidak dihapus)\n- Queries -> Queries/{MasterData,Transaksi,Laporan,Dashboard,AuditLog}; RoleQuery baru dari RoleController::daftar()');
}

// =============================================================================
// FASE 6: Console + Support
// =============================================================================
function phase6() {
  log(c.bold('\nFASE 6: Console, Support'));
  const pairs = [...cfg.CONSOLE_MOVES, ...cfg.SUPPORT_MOVES].filter(([f]) => exists(f));
  if (!pairs.length) return warn('Tidak ada file yang perlu dipindah (fase 6 sudah selesai?).');
  if (APPLY) { requireCleanTree(); ensureBranch(); excludeOutDir(); ensureBaseline(); }
  const res = relocate(pairs, { apply: APPLY });
  printMoves(res.moves);
  log(`  file lain yang diedit: ${res.edited}`);
  if (!APPLY) return;
  finishPhase('fase 6', res, 'refactor(fase-6): Commands -> Audit/ & Maintenance/, Concerns -> app/Support/Concerns\n\nCommand Maintenance TIDAK dihapus (kandidat hapus: tanya pemilik).');
}

function printMoves(moves) {
  for (const m of moves) log(`  ${c.dim(m.from)}\n    -> ${m.to}${m.oldShort !== m.newShort ? c.yellow(`  (class ${m.oldShort} -> ${m.newShort})`) : ''}`);
}

function finishPhase(label, res, message) {
  const st = loadState();
  // peta batch ini (TIDAK dirantai satu sama lain, hindari tabrakan XController vs XWebController)
  const batch = {};
  for (const m of res.moves) batch[m.oldFqcn] = m.newFqcn;
  // perpanjang entri fase sebelumnya: k -> v, lalu v -> w di batch ini jadi k -> w
  for (const k of Object.keys(st.fqcnMap)) if (batch[st.fqcnMap[k]]) st.fqcnMap[k] = batch[st.fqcnMap[k]];
  for (const m of res.moves) st.moves.push({ from: m.from, to: m.to });
  Object.assign(st.fqcnMap, batch);
  saveState(st); // verifyPhp membaca peta ini dari disk
  const changed = [...res.newTexts.keys()].map((f) => res.moves.find((m) => m.from === f)?.to ?? f);
  const all = new Set([...changed, ...res.moves.map((m) => m.to)]);
  verifyPhp(label, [...all]);
  commit(message);
}

// =============================================================================
// FASE 7: Form Request
// =============================================================================
function matchClose(code, openIdx) {
  const open = code[openIdx];
  const close = { '(': ')', '[': ']', '{': '}' }[open];
  let depth = 0;
  for (let i = openIdx; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close && --depth === 0) return i;
  }
  return -1;
}
function splitTop(code, from, to) { // posisi koma level-0 di code[from,to)
  const cuts = [];
  let d = 0;
  for (let i = from; i < to; i++) {
    const ch = code[i];
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) d--;
    else if (ch === ',' && d === 0) cuts.push(i);
  }
  const parts = [];
  let s = from;
  for (const cut of cuts) { parts.push([s, cut]); s = cut + 1; }
  parts.push([s, to]);
  return parts.filter(([a, b]) => code.slice(a, b).trim() !== '');
}

function phase7() {
  log(c.bold('\nFASE 7: Form Request'));
  if (APPLY) { requireCleanTree(); ensureBranch(); excludeOutDir(); ensureBaseline(); }
  const created = [];
  const skipped = [];
  const edits = new Map();
  for (const file of cfg.REQUEST_CONTROLLERS) {
    if (!exists(file)) { warn(`${file} belum ada (fase 5 dulu).`); continue; }
    const src = read(file);
    const code = maskPhp(src);
    const ctl = path.basename(file, '.php');
    const entity = ctl.replace(/Controller$/, '');
    const modul = path.basename(path.dirname(file));
    const fileEdits = [];
    const needUse = [];
    const used = new Set();
    const methodRe = /(?:public|protected|private)[ \t]+(?:static[ \t]+)?function[ \t]+(\w+)[ \t]*\(([^)]*)\)[^{;]*\{/g;
    let mm;
    while ((mm = methodRe.exec(code))) {
      const [, method, params] = mm;
      const bodyOpen = mm.index + mm[0].length - 1;
      const bodyClose = matchClose(code, bodyOpen);
      const body = code.slice(bodyOpen, bodyClose);
      const calls = [...body.matchAll(/\$request->validate\(/g)];
      if (!calls.length) continue;
      const where = `${ctl}::${method}`;
      if (calls.length > 1) { skipped.push(`${where}: lebih dari 1 validate()`); continue; }
      if (!/\bRequest[ \t]+\$request\b/.test(params)) { skipped.push(`${where}: parameter bukan "Request $request"`); continue; }
      const callAt = bodyOpen + calls[0].index;
      const parenOpen = callAt + calls[0][0].length - 1;
      const parenClose = matchClose(code, parenOpen);
      const lineStart = code.lastIndexOf('\n', callAt) + 1;
      const prefix = code.slice(lineStart, callAt);
      const tail = code.slice(parenClose + 1).match(/^[ \t]*;[ \t]*(?:\r?\n)?/);
      if (!/^[ \t]*(\$\w+[ \t]*=[ \t]*)?$/.test(prefix) || !tail) { skipped.push(`${where}: bentuk statement tidak standar`); continue; }
      const assigned = /\$\w+[ \t]*=/.test(prefix) ? prefix.trim().replace(/\s*=\s*$/, '') : null;
      if (assigned && assigned !== '$validated') { skipped.push(`${where}: hasil ditampung di ${assigned}`); continue; }
      const before = code.slice(bodyOpen + 1, lineStart).trim();
      if (before && !/^(\$\w+[ \t]*=[^;]*?\b(?:findOrFail|firstOrFail|find)\([^;]*\)[ \t]*;[ \t\r\n]*)+$/.test(before)) { skipped.push(`${where}: ada statement lain sebelum validate()`); continue; }
      const argParts = splitTop(code, parenOpen + 1, parenClose);
      if (argParts.length < 1 || argParts.length > 2) { skipped.push(`${where}: argumen validate() tidak standar`); continue; }
      const [rA, rB] = argParts[0];
      const rulesMasked = code.slice(rA, rB);
      if (!rulesMasked.trim().startsWith('[')) { skipped.push(`${where}: rules bukan array literal`); continue; }
      const allMasked = code.slice(parenOpen, parenClose);
      if (/\$|::|\bnew\b/.test(allMasked)) { skipped.push(`${where}: rules memakai variabel/kelas lain (perlu manual)`); continue; }
      const rules = src.slice(rA, rB).trim();
      const messages = argParts[1] ? src.slice(argParts[1][0], argParts[1][1]).trim() : null;

      let name = `${method[0].toUpperCase()}${method.slice(1)}${entity}Request`;
      if (used.has(name)) { skipped.push(`${where}: nama ${name} bentrok`); continue; }
      used.add(name);
      const fq = `App\\Http\\Requests\\${modul}\\${name}`;
      const reqFile = `app/Http/Requests/${modul}/${name}.php`;
      if (exists(reqFile)) { skipped.push(`${where}: ${reqFile} sudah ada`); continue; }

      created.push({
        file: reqFile,
        text: `<?php

namespace App\\Http\\Requests\\${modul};

use Illuminate\\Foundation\\Http\\FormRequest;

// Dipindah dari ${ctl}::${method}() -- aturan validasi identik.
class ${name} extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ${rules};
    }
${messages ? `
    public function messages(): array
    {
        return ${messages};
    }
` : ''}}
`,
      });

      // edit controller: signature + statement
      const sigRe = /\bRequest([ \t]+\$request)\b/;
      const sigStart = mm.index;
      const sigSlice = src.slice(sigStart, bodyOpen);
      const sm = sigSlice.match(sigRe);
      fileEdits.push({ start: sigStart + sm.index, end: sigStart + sm.index + sm[0].length, text: `${name}${sm[1]}` });
      const stmtEnd = parenClose + 1 + tail[0].length;
      if (assigned) {
        fileEdits.push({ start: callAt, end: stmtEnd, text: '$request->validated();' + (tail[0].endsWith('\n') ? (tail[0].endsWith('\r\n') ? '\r\n' : '\n') : '') });
      } else {
        let s = lineStart;
        let e = stmtEnd;
        const prevLine = code.slice(code.lastIndexOf('\n', lineStart - 2) + 1, lineStart).trim();
        const nextBlank = /^[ \t]*\r?\n/.exec(code.slice(e));
        if ((prevLine.endsWith('{') || prevLine === '') && nextBlank) e += nextBlank[0].length;
        fileEdits.push({ start: s, end: e, text: '' });
      }
      needUse.push(fq);
    }
    if (fileEdits.length) {
      let out = src;
      for (const e of fileEdits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
      out = insertUses(out, needUse, file);
      edits.set(file, out);
    }
  }
  for (const r of created) log(`  + ${r.file}`);
  for (const f of edits.keys()) log(`  ~ ${f}`);
  if (skipped.length) { log(c.yellow('  dilewati (perlu manual / tidak aman otomatis):')); skipped.forEach((s) => log(`    - ${s}`)); }
  if (!APPLY) return;
  for (const r of created) write(r.file, r.text);
  for (const [f, t] of edits) write(f, t);
  const st = loadState();
  st.skipped = [...(st.skipped ?? []), ...skipped.map((s) => `[fase 7] ${s}`)];
  st.notes.push('Fase 7: validasi FormRequest jalan SEBELUM body method. Beda tipis: id tidak ada + payload invalid -> 422 (dulu 404 dari findOrFail). Selain itu identik.');
  saveState(st);
  verifyPhp('fase 7', [...created.map((r) => r.file), ...edits.keys()]);
  commit('refactor(fase-7): pindahkan $request->validate([...]) literal ke app/Http/Requests/<Modul>\n\nAturan & pesan validasi identik. Yang punya variabel/Rule:: dibiarkan di controller.');
}

// =============================================================================
// FASE 8: routes
// =============================================================================
function phase8() {
  log(c.bold('\nFASE 8: routes/web.php -> routes/web/*.php'));
  if (!exists(cfg.ROUTES_FILE)) die('routes/web.php tidak ada.');
  if (exists(`${cfg.ROUTES_DIR}/dashboard.php`)) return warn('routes/web/ sudah ada (fase 8 sudah selesai?).');
  if (APPLY) { requireCleanTree(); ensureBranch(); excludeOutDir(); ensureBaseline(); }
  const lines = read(cfg.ROUTES_FILE).split('\n');
  const find = (re, from = 0) => {
    const i = lines.findIndex((l, k) => k >= from && re.test(l));
    if (i < 0) die(`Anchor route tidak ketemu: ${re}`);
    return i;
  };
  const closer = (from, ind = '    });') => {
    const i = lines.findIndex((l, k) => k > from && l.replace(/\r$/, '') === ind);
    if (i < 0) die(`Penutup group tidak ketemu setelah baris ${from + 1}`);
    return i;
  };
  const gStart = find(/^Route::middleware\('auth'\)->group\(function/);
  const gEnd = lines.findIndex((l, k) => k > gStart && l.replace(/\r$/, '') === '});');
  const A = {
    pub: find(/Login & verifikasi OTP/),
    resend: find(/\/resend-otp/),
    redirRoot: find(/Route::redirect\('\/', '\/dashboard'\)/),
    aliasEnd: find(/Route::redirect\('\/cabang'/),
    logout: find(/\/logout/, gStart),
    dashH: find(/\/\/ Dashboard \(semua role/, gStart),
    dashR: find(/Route::get\('\/dashboard'/, gStart),
    lapH: find(/\/\/ Laporan \(admin-only/, gStart),
    lapR: find(/Route::get\('\/laporan'/, gStart),
    mdH: find(/\/\/ Master Data \(semua role boleh/, gStart),
    pemH: find(/\[F5-INERTIA\] Transaksi pemakai/, gStart),
    kemH: find(/\[F5-INERTIA\] Kembalikan inventory/, gStart),
    penH: find(/\/\/ Penanganan Inventory \(semua role/, gStart),
    notH: find(/\[F9-INERTIA\] Notifikasi/, gStart),
    notE: find(/push-subscriptions', \[PushSubscriptionController::class, 'destroy'\]/, gStart),
    setH: find(/\/\/ Settings \(semua role/, gStart),
    setE: find(/\/settings\/password/, gStart),
    audH: find(/\/\/ Audit Log \(admin-only\)/, gStart),
    audE: find(/Route::get\('\/audit-log'/, gStart),
  };
  A.admEnd = closer(A.pemH);
  A.kemE = closer(A.kemH);
  A.penG = find(/prefix\('penanganan-inventory'\)->group/, A.penH);
  A.penE = closer(A.penG);

  const range = (a, b) => lines.slice(a, b + 1);
  const trimEnd = (arr) => { const o = [...arr]; while (o.length && o[o.length - 1].trim() === '') o.pop(); return o; };
  const unind = (arr) => arr.map((l) => (l.startsWith('    ') ? l.slice(4) : l));

  const slices = {
    auth: [[A.pub, A.resend]],
    dashboard: [[A.dashH, A.dashR]],
    laporan: [[A.lapH, A.lapR]],
    'master-data': [[A.mdH, A.pemH - 1], [A.admEnd, A.admEnd]],
    transaksi: [[A.pemH, A.admEnd - 1], [A.kemH, A.kemE], [A.penH, A.penE]],
    notifikasi: [[A.notH, A.notE]],
    settings: [[A.setH, A.setE]],
    'audit-log': [[A.audH, A.audE]],
  };
  // cek cakupan: semua baris non-kosong di dalam group harus kebagian tepat satu slice
  const owner = new Map();
  const claim = (i, who) => { if (owner.has(i)) die(`Baris ${i + 1} diklaim dua slice (${owner.get(i)} & ${who})`); owner.set(i, who); };
  claim(A.logout, 'auth(logout)');
  for (const [who, rs] of Object.entries(slices)) for (const [a, b] of rs) for (let i = a; i <= b; i++) claim(i, who);
  for (let i = gStart + 1; i < gEnd; i++) if (lines[i].trim() !== '' && !owner.has(i)) die(`Baris ${i + 1} tidak masuk slice manapun: ${lines[i].trim()}`);

  const uses = lines.slice(0, gStart).filter((l) => /^use\s/.test(l)).map((l) => l.replace(/\r$/, ''));
  const useFor = (bodyText) => {
    const code = maskPhp(bodyText);
    const picked = uses.filter((u) => {
      const m = u.match(/^use\s+([\w\\]+)(?:\s+as\s+(\w+))?;/);
      if (!m) return false;
      const s = m[2] ?? m[1].split('\\').pop();
      return new RegExp(`(?<![\\w\\\\$])${s}(?!\\w)`).test(code);
    });
    return ['use Illuminate\\Support\\Facades\\Route;', ...picked.filter((u) => !u.includes('Facades\\Route;'))].join('\n');
  };

  const files = {};
  const compose = (name, parts, headerNote, extra = '') => {
    let body = parts.map((p) => trimEnd(unind(p)).join('\n')).filter(Boolean).join('\n\n');
    files[name] = `<?php\n\n${useFor(body + extra)}\n\n${headerNote}\n\n${body}${extra}\n`;
  };
  const inGroup = '// Di-require dari routes/web.php DI DALAM Route::middleware(\'auth\')->group(...).';

  // auth.php: halaman publik + logout (butuh login -> middleware('auth') eksplisit)
  const pub = trimEnd(unind(range(A.pub, A.resend))).join('\n');
  const logoutLine = lines[A.logout].replace(/\r$/, '').trim().replace(/;$/, "->middleware('auth');");
  files.auth = `<?php\n\n${useFor(pub + logoutLine)}\n\n// Di-require dari routes/web.php DI LUAR grup 'auth' (login & OTP publik).\n\n${pub}\n\n// Logout butuh sesi login (dulu di dalam grup 'auth').\n${logoutLine}\n`;

  compose('dashboard', [range(A.dashH, A.dashR)], inGroup);
  compose('laporan', [range(A.lapH, A.lapR)], inGroup);
  compose('master-data', [[...trimEnd(range(A.mdH, A.pemH - 1)), lines[A.admEnd]]], inGroup);
  const pemakai = ["    Route::middleware(['role:admin', LogActivity::class])->prefix('master-data')->group(function () {", ...trimEnd(range(A.pemH, A.admEnd - 1)), '    });'];
  compose('transaksi', [pemakai, range(A.kemH, A.kemE), range(A.penH, A.penE)], `${inGroup}\n// Transaksi pemakai & penanganan inventory (grup pemakai dulu 1 grup dengan master-data admin; middleware identik).`);
  compose('notifikasi', [range(A.notH, A.notE)], inGroup);
  compose('settings', [range(A.setH, A.setE)], inGroup);
  compose('audit-log', [range(A.audH, A.audE)], inGroup);

  const order = ['dashboard', 'laporan', 'master-data', 'transaksi', 'notifikasi', 'settings', 'audit-log'];
  const webPhp = `<?php

use Illuminate\\Support\\Facades\\Route;

// Login, verifikasi OTP, logout: routes/web/auth.php (publik, di luar grup 'auth').
require __DIR__.'/web/auth.php';

${trimEnd(range(A.redirRoot, A.aliasEnd)).join('\n')}

// Halaman Inertia (butuh login). Satu file per modul di routes/web/.
Route::middleware('auth')->group(function () {
${order.map((n) => `    require __DIR__.'/web/${n}.php';`).join('\n')}
});
`;
  log(`  ${cfg.ROUTES_FILE}  ->  web.php (grup 'auth' + require + redirect alias) + ${Object.keys(files).length} file di ${cfg.ROUTES_DIR}/`);
  for (const n of Object.keys(files)) log(`    + ${cfg.ROUTES_DIR}/${n}.php`);
  if (!APPLY) return;
  for (const [n, t] of Object.entries(files)) write(`${cfg.ROUTES_DIR}/${n}.php`, t);
  write(cfg.ROUTES_FILE, webPhp);
  verifyPhp('fase 8', [cfg.ROUTES_FILE, ...Object.keys(files).map((n) => `${cfg.ROUTES_DIR}/${n}.php`)]);
  commit('refactor(fase-8): pecah routes/web.php -> routes/web/{auth,dashboard,master-data,transaksi,laporan,notifikasi,settings,audit-log}.php\n\nNama route, URL, middleware identik (diverifikasi vs route:list baseline).');
}

// =============================================================================
// plan / report / check
// =============================================================================
function plan() {
  log(c.bold('\nMAPPING lama -> baru (tidak ada yang diubah)\n'));
  const sec = (t, pairs) => { log(c.bold(`${t}`)); for (const [f, to] of pairs) log(`  ${exists(f) ? ' ' : c.dim('x')} ${f}\n      -> ${to}`); log(''); };
  log(c.bold('Fase 4'));
  for (const r of cfg.FE_DIR_RENAMES) log(`  ${r.from}  ->  ${r.to}`);
  log('');
  sec('Fase 5a: Controller API lama -> Legacy/ (tidak dihapus)', cfg.LEGACY_MOVES);
  sec('Fase 5b: Controller Inertia (hapus suffix Web / Page)', cfg.LIVE_CONTROLLER_MOVES);
  sec('Fase 5c: Queries', cfg.QUERY_MOVES);
  log('  + app/Queries/MasterData/RoleQuery.php  (dari RoleController::daftar(); sisa index() ikut ke Legacy)\n');
  sec('Fase 6a: Console', cfg.CONSOLE_MOVES);
  sec('Fase 6b: Support', cfg.SUPPORT_MOVES);
  log(c.bold('Fase 7') + '  Form Request dibuat otomatis HANYA untuk validate([...]) literal tanpa variabel; sisanya dilaporkan.');
  log(c.bold('Fase 8') + '  routes/web.php -> web.php + routes/web/{auth,dashboard,master-data,transaksi,laporan,notifikasi,settings,audit-log}.php\n');
  log(c.bold('Tetap di tempat (di luar target, tidak disentuh)'));
  log('  MasterData/UserController (dipakai route /master-data/karyawan/cari), pages/Auth/VerifyOtp.tsx, lib/queryClient.ts, index.css, app.js\n');
  log(c.bold('Dry-run engine PHP (fase 5 + 6)'));
  const pairs = [...cfg.LEGACY_MOVES, ...cfg.LIVE_CONTROLLER_MOVES, ...cfg.QUERY_MOVES, ...cfg.CONSOLE_MOVES, ...cfg.SUPPORT_MOVES].filter(([f]) => exists(f));
  if (!pairs.length) return log('  semua sudah dipindah.');
  const r = relocate(pairs, { apply: false });
  log(`  ${r.moved} file dipindah, ${r.edited} file lain akan diedit (use/namespace/rename). Tidak ada konflik nama.`);
  const chk = checkInertiaPages();
  log(c.bold('\nCek Inertia::render <-> resources/js/pages'));
  log(chk.bad.length ? c.yellow('  ' + chk.bad.join('\n  ')) : c.green('  semua cocok'));
}

function report() {
  const st = loadState();
  log(c.bold('\nLAPORAN'));
  log(`  file dipindah/rename (tercatat script): ${st.moves.length}`);
  for (const m of st.moves) log(`    ${m.from} -> ${m.to}`);
  log(c.bold('\n  Di luar struktur target (dibiarkan / ditaruh):'));
  log('    Http/Controllers/Legacy/**  controller API lama, routes/api.php kosong -> kandidat hapus (F10 di komentar kode)');
  log('    Http/Controllers/MasterData/UserController  masih dipakai route /master-data/karyawan/cari');
  log('    app/Console/Commands/Maintenance/*  kandidat hapus kalau sudah sekali jalan (TANYA pemilik)');
  log('    Legacy/ImportController  (target: Actions/Shared/ImportExcel, ekstraksi logika belum dikerjakan)');
  log(c.bold('\n  Belum dikerjakan / butuh keputusan:'));
  for (const s of st.skipped) log(`    - ${s}`);
  for (const n of st.notes) log(`    * ${n}`);
  log('    - Queries Cabang/Perusahaan/Departemen/Kategori/Supplier: kelasnya belum ada (daftar() masih static di controller) -> tidak dibuat.');
  log('    - Sampah di repo: .migrasi-backup/, build_errors.txt, baseline-routes.txt, current-routes.txt, resources/js/app.js, views/emails/new-password,blade.php (nama file ada koma)');
}

function check() {
  log(c.bold('\nCek statis PHP + Inertia pages'));
  const errs = checkPhpStatic();
  log(errs.length ? c.red(`  ${errs.length} masalah:\n  ${errs.join('\n  ')}`) : c.green('  PHP: namespace/use/path OK'));
  const chk = checkInertiaPages();
  log(chk.bad.length ? c.red('  ' + chk.bad.join('\n  ')) : c.green(`  Inertia: ${chk.names.length} nama render cocok dengan pages/`));
  process.exitCode = errs.length || chk.bad.length ? 1 : 0;
}

function help() {
  log(`
Pakai: node scripts/refactor/run.mjs <perintah> [--apply] [opsi]

  plan      tampilkan tabel mapping lama -> baru + dry-run engine (aman, tidak mengubah)
  0         persiapan: branch ${cfg.BRANCH}, baseline tsc/build/route:list/test
  4         fix casing pages/dashboard -> pages/Dashboard
  5         Controllers + Queries      (rename/pindah + update namespace/use/route)
  6         Console + Support
  7         Form Request (otomatis untuk validate literal)
  8         routes/web.php -> routes/web/*.php
  all       jalankan 0,4,5,6,7,8 berurutan
  check     cek statis namespace/use + Inertia::render vs pages/
  report    laporan akhir

Default DRY-RUN. --apply = eksekusi + verifikasi + commit per fase.
Opsi: --allow-dirty  --no-commit  --skip-js  --skip-tests
Sesudah selesai: composer dump-autoload && php artisan optimize:clear
`);
}

const phases = { 0: phase0, 4: phase4, 5: phase5, 6: phase6, 7: phase7, 8: phase8 };
if (cmd === 'all') {
  if (!APPLY) { plan(); log(c.dim('\n(dry-run) tambah --apply untuk eksekusi semua fase.')); }
  else for (const k of [0, 4, 5, 6, 7, 8]) phases[k]();
  if (APPLY) report();
} else if (phases[cmd]) phases[cmd]();
else if (cmd === 'plan') plan();
else if (cmd === 'report') report();
else if (cmd === 'check') check();
else help();
