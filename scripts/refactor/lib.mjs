import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHP_DIRS, OUT_DIR } from './config.mjs';

// scripts/refactor/lib.mjs -> root project = 2 level di atas folder ini
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const abs = (p) => path.join(ROOT, p);

// ---------- fs ----------
export const exists = (p) => fs.existsSync(abs(p));
export const read = (p) => fs.readFileSync(abs(p), 'utf8');
export function write(p, s) {
  fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
  fs.writeFileSync(abs(p), s);
}
export function listFiles(dir, ext = '.php') {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(abs(d))) return;
    for (const e of fs.readdirSync(abs(d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) {
        if (['vendor', 'node_modules', '.git', 'cache', 'storage'].includes(e.name)) continue;
        walk(p);
      } else if (e.name.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out;
}
export function pruneEmptyDirs(dirs) {
  for (const d of dirs) {
    try { if (fs.existsSync(abs(d)) && fs.readdirSync(abs(d)).length === 0) fs.rmdirSync(abs(d)); } catch { /* abaikan */ }
  }
}

// ---------- log ----------
export const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
export const log = (...a) => console.log(...a);
export const warn = (...a) => console.log(c.yellow('! ' + a.join(' ')));
export function die(msg) {
  console.error(c.red('\nX ' + msg));
  process.exit(1);
}

// ---------- shell ----------
export function sh(cmd, args = [], { input, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', input, shell: process.platform === 'win32', maxBuffer: 1 << 28 });
  if (r.error && r.error.code === 'ENOENT') return { code: 127, out: `${cmd}: tidak ditemukan`, missing: true };
  const res = { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  if (res.code !== 0 && !allowFail) die(`Perintah gagal: ${cmd} ${args.join(' ')}\n${res.out}`);
  return res;
}
export const git = (args, opts) => sh('git', args, opts);
export const hasCmd = (cmd, args = ['--version']) => !sh(cmd, args, { allowFail: true }).missing && sh(cmd, args, { allowFail: true }).code === 0;

// ---------- PHP: masking komentar & string (panjang sama, newline tetap) ----------
export function maskPhp(src) {
  const n = src.length;
  let out = '';
  let i = 0;
  const blank = (s) => s.replace(/[^\r\n]/g, ' ');
  while (i < n) {
    const ch = src[i];
    const nx = src[i + 1];
    if ((ch === '/' && nx === '/') || (ch === '#' && nx !== '[')) {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      out += blank(src.slice(i, j));
      i = j;
    } else if (ch === '/' && nx === '*') {
      const j = src.indexOf('*/', i + 2);
      const e = j < 0 ? n : j + 2;
      out += blank(src.slice(i, e));
      i = e;
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === '\\') j++;
        j++;
      }
      out += blank(src.slice(i, j + 1));
      i = j + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- PHP: parse ----------
export function parsePhp(file) {
  const src = read(file);
  const code = maskPhp(src);
  const ns = (code.match(/^[ \t]*namespace[ \t]+([\w\\]+)[ \t]*;/m) || [])[1] ?? '';
  const decl = code.match(/^[ \t]*(?:(?:abstract|final|readonly)[ \t]+)*(class|trait|interface|enum)[ \t]+(\w+)/m);
  const short = decl ? decl[2] : null;
  const declIdx = decl ? decl.index : code.length;
  if (/^[ \t]*use[ \t]+(?:function|const)\b/m.test(code)) die(`use function/const belum didukung: ${file}`);
  if (/^[ \t]*use[ \t]+[\w\\]*\\\{/m.test(code)) die(`grouped use belum didukung: ${file}`);
  const imports = [];
  const re = /^[ \t]*use[ \t]+([\w\\]+)(?:[ \t]+as[ \t]+(\w+))?[ \t]*;/gm;
  let m;
  while ((m = re.exec(code))) {
    if (m.index >= declIdx) break;
    const fqcn = m[1].replace(/^\\/, '');
    imports.push({ fqcn, alias: m[2] ?? null, short: m[2] ?? fqcn.split('\\').pop(), start: m.index, end: m.index + m[0].length });
  }
  return { file, src, code, ns, short, fqcn: short ? (ns ? `${ns}\\${short}` : short) : null, imports };
}

export function nsFromPath(file) {
  const parts = file.replace(/\.php$/, '').split('/');
  parts.pop();
  if (parts[0] === 'app') return ['App', ...parts.slice(1)].join('\\');
  if (parts[0] === 'tests') return ['Tests', ...parts.slice(1)].join('\\');
  return null;
}

export const scanPhp = () => PHP_DIRS.flatMap((d) => listFiles(d));

const identRe = (name) => new RegExp(`(?<![\\w\\\\$])(?<!->)${esc(name)}(?!\\w)`);

// ---------- PHP: relokasi kelas (pindah/rename) + update semua referensi ----------
// pairs: [[fromPath, toPath], ...] -- diproses SEKALIGUS (simultan), jadi tukar-nama antar kelas aman.
export function relocate(pairs, { apply, label = '' } = {}) {
  const files = scanPhp();
  const info = new Map(files.map((f) => [f, parsePhp(f)]));
  const classes = new Map(); // fqcn -> parsed
  const shortCount = new Map();
  for (const p of info.values()) {
    if (!p.fqcn) continue;
    classes.set(p.fqcn, p);
    shortCount.set(p.short, (shortCount.get(p.short) ?? 0) + 1);
  }

  const moves = pairs.map(([from, to]) => {
    const p = info.get(from);
    if (!p) die(`File sumber tidak ada / bukan PHP yang dikenal: ${from}`);
    if (!p.short) die(`Tidak ketemu deklarasi class di ${from}`);
    if (exists(to) && !pairs.some(([f]) => f === to)) die(`Tujuan sudah ada: ${to}`);
    const newNs = nsFromPath(to);
    if (!newNs) die(`Tidak bisa turunkan namespace dari ${to}`);
    const newShort = path.basename(to, '.php');
    return { from, to, oldFqcn: p.fqcn, oldNs: p.ns, oldShort: p.short, newNs, newShort, newFqcn: `${newNs}\\${newShort}` };
  });
  const byOld = new Map(moves.map((m) => [m.oldFqcn, m]));
  const byFile = new Map(moves.map((m) => [m.from, m]));

  // rename short: old short harus unik (tidak ada kelas lain bernama sama) supaya aman diganti global (termasuk komentar)
  const renames = moves.filter((m) => m.oldShort !== m.newShort);
  for (const m of renames) {
    if (shortCount.get(m.oldShort) !== 1) die(`Nama ${m.oldShort} tidak unik, rename otomatis tidak aman.`);
  }
  const renameMap = new Map(renames.map((m) => [m.oldShort, m.newShort]));

  // regex FQCN (satu kali jalan, supaya tukar-nama tidak diproses dua kali)
  const sorted = [...moves].sort((a, b) => b.oldFqcn.length - a.oldFqcn.length);
  const mapSingle = new Map(sorted.map((m) => [m.oldFqcn, m.newFqcn]));
  const mapDouble = new Map(sorted.map((m) => [m.oldFqcn.replaceAll('\\', '\\\\'), m.newFqcn.replaceAll('\\', '\\\\')]));
  const fqRe = (keys) => new RegExp(`(?<!\\w)(${[...keys].map(esc).join('|')})(?![\\w\\\\])`, 'g');
  const reSingle = sorted.length ? fqRe(mapSingle.keys()) : null;
  const reDouble = sorted.length ? fqRe(mapDouble.keys()) : null;
  const reRename = renameMap.size ? new RegExp(`(?<![\\w\\\\$])(?<!->)(${[...renameMap.keys()].map(esc).join('|')})(?!\\w)`, 'g') : null;

  const newTexts = new Map();
  for (const [f, p] of info) {
    const mv = byFile.get(f);
    const fNewNs = mv ? mv.newNs : p.ns;
    let text = p.src;

    // A. FQCN (use, inline, string)
    if (reSingle) text = text.replace(reSingle, (_, k) => mapSingle.get(k)).replace(reDouble, (_, k) => mapDouble.get(k));
    // B. rename short name (kode + komentar)
    if (reRename) text = text.replace(reRename, (_, k) => renameMap.get(k));
    // C. namespace line
    if (mv && mv.oldNs !== mv.newNs) text = text.replace(/^([ \t]*namespace[ \t]+)[\w\\]+([ \t]*;)/m, `$1${mv.newNs}$2`);

    // D. use baru buat kelas yang dulu 1 namespace (implisit) tapi sekarang beda namespace
    const needUse = new Set();
    for (const [fq, k] of classes) {
      if (k.file === f || k.ns !== p.ns) continue;
      if (p.imports.some((i) => i.short === k.short)) continue;
      if (!identRe(k.short).test(p.code)) continue;
      const kMove = byOld.get(fq);
      const kNewNs = kMove ? kMove.newNs : k.ns;
      const kNewFq = kMove ? kMove.newFqcn : fq;
      if (kNewNs !== fNewNs) needUse.add(kNewFq);
    }
    if (needUse.size) text = insertUses(text, [...needUse], f);

    if (text !== p.src) newTexts.set(f, text);
  }

  // ---------- eksekusi ----------
  const summary = { moved: moves.length, edited: [...newTexts.keys()].filter((f) => !byFile.has(f)).length, moves, label };
  if (!apply) return { ...summary, newTexts };

  // git mv urut: jalankan yang tujuannya sudah kosong
  const pending = [...moves];
  let guard = pending.length * pending.length + 5;
  while (pending.length && guard--) {
    const i = pending.findIndex((m) => !exists(m.to));
    if (i < 0) die('Siklus rename path terdeteksi, hentikan.');
    const [m] = pending.splice(i, 1);
    fs.mkdirSync(abs(path.dirname(m.to)), { recursive: true });
    movePath(m.from, m.to);
  }
  for (const [f, text] of newTexts) {
    const mv = byFile.get(f);
    write(mv ? mv.to : f, text);
  }
  pruneEmptyDirs([...new Set(moves.map((m) => path.dirname(m.from)))]);
  return { ...summary, newTexts };
}

export function movePath(from, to) {
  if (git(['rev-parse', '--is-inside-work-tree'], { allowFail: true }).code === 0 && git(['ls-files', '--error-unmatch', from], { allowFail: true }).code === 0) {
    git(['mv', from, to]);
  } else {
    fs.mkdirSync(abs(path.dirname(to)), { recursive: true });
    fs.renameSync(abs(from), abs(to));
  }
}

export function insertUses(text, fqcns, file) {
  const code = maskPhp(text);
  const re = /^[ \t]*use[ \t]+([\w\\]+)(?:[ \t]+as[ \t]+(\w+))?[ \t]*;[^\n]*/gm;
  const declM = code.match(/^[ \t]*(?:(?:abstract|final|readonly)[ \t]+)*(?:class|trait|interface|enum)[ \t]+\w+/m);
  const declIdx = declM ? declM.index : code.length;
  let last = null;
  const have = new Map();
  let m;
  while ((m = re.exec(code))) {
    if (m.index >= declIdx) break;
    last = m;
    have.set(m[2] ?? m[1].split('\\').pop(), m[1].replace(/^\\/, ''));
  }
  const add = [];
  for (const fq of fqcns) {
    const s = fq.split('\\').pop();
    if (have.get(s) === fq) continue;
    if (have.has(s)) die(`Konflik import ${s} di ${file}: ${have.get(s)} vs ${fq}`);
    add.push(`use ${fq};`);
  }
  if (!add.length) return text;
  const crlf = (text.match(/\r\n/g) || []).length;
  const eol = crlf > (text.match(/\n/g) || []).length / 2 ? '\r\n' : '\n';
  if (last) {
    const at = last.index + last[0].replace(/\r$/, '').length;
    return text.slice(0, at) + eol + add.join(eol) + text.slice(at);
  }
  const nsM = code.match(/^[ \t]*namespace[ \t]+[\w\\]+[ \t]*;/m);
  if (nsM) {
    const at = nsM.index + nsM[0].length;
    return text.slice(0, at) + eol + eol + add.join(eol) + text.slice(at);
  }
  const open = text.indexOf('<?php') + 5;
  return text.slice(0, open) + eol + eol + add.join(eol) + text.slice(open);
}

// ---------- verifikasi statis PHP (tanpa PHP/composer) ----------
export function checkPhpStatic() {
  const files = scanPhp();
  const info = new Map(files.map((f) => [f, parsePhp(f)]));
  const classes = new Map();
  const byShort = new Map();
  for (const p of info.values()) {
    if (!p.fqcn) continue;
    classes.set(p.fqcn, p);
    (byShort.get(p.short) ?? byShort.set(p.short, []).get(p.short)).push(p);
  }
  const errors = [];
  for (const [f, p] of info) {
    if (p.fqcn) {
      const want = nsFromPath(f);
      if (want && want !== p.ns) errors.push(`${f}: namespace "${p.ns}" != path "${want}"`);
      if (path.basename(f, '.php') !== p.short) errors.push(`${f}: nama file != nama class (${p.short})`);
    }
    for (const i of p.imports) {
      if (i.fqcn.startsWith('App\\') && !classes.has(i.fqcn)) errors.push(`${f}: use ${i.fqcn} tidak ada filenya`);
    }
    for (const m of p.code.matchAll(/\\(App\\[\w\\]+)/g)) {
      const fq = m[1].replace(/\\$/, '');
      if (!classes.has(fq) && !/\\$/.test(m[1])) errors.push(`${f}: referensi \\${fq} tidak ada filenya`);
    }
    // nama kelas proyek dipakai tanpa import / bukan 1 namespace
    for (const [short, list] of byShort) {
      if (list.length !== 1) continue;
      const k = list[0];
      if (k.file === f || k.ns === p.ns) continue;
      if (p.imports.some((i) => i.short === short)) continue;
      if (!identRe(short).test(p.code)) continue;
      // hanya laporkan kalau dipakai sebagai kelas: X::, new X, extends X, type-hint "X $"
      const usage = new RegExp(`(?<![\\w\\\\$])(?<!->)(?:new\\s+|extends\\s+|implements\\s+|instanceof\\s+)?${esc(short)}(?:::|\\s+\\$|\\s*\\()`);
      if (usage.test(p.code)) errors.push(`${f}: pakai ${short} tapi tidak di-import (seharusnya ${k.fqcn})`);
    }
  }
  return errors;
}

export function lintPhp(files) {
  if (!hasCmd('php', ['-v'])) return { skipped: true, errors: [] };
  const errors = [];
  for (const f of files) {
    const r = sh('php', ['-l', f], { allowFail: true });
    if (r.code !== 0) errors.push(`${f}: ${r.out.trim().split('\n')[0]}`);
  }
  return { skipped: false, errors };
}

// ---------- baseline route:list ----------
export function routeSnapshot() {
  if (!hasCmd('php', ['-v'])) return null;
  const r = sh('php', ['artisan', 'route:list', '--json', '--no-interaction'], { allowFail: true });
  if (r.code !== 0) return { error: r.out };
  const start = r.out.search(/^\[/m);
  let rows;
  try { rows = JSON.parse(r.out.slice(start < 0 ? 0 : start)); } catch { return { error: 'route:list bukan JSON valid' }; }
  const norm = rows.map((x) => `${x.method} ${x.uri} | name=${x.name ?? ''} | ${x.action} | mw=${(x.middleware ?? []).join(',')}`).sort();
  return { rows: norm };
}

export function outPath(name) {
  return `${OUT_DIR}/${name}`;
}
