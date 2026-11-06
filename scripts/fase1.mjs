#!/usr/bin/env node
/**
 * fase1.mjs — FASE 1: dark mode jadi token tema Tailwind v4 (tanpa override `html.dark … !important`).
 *
 * Jalankan dari ROOT project (folder yang ada resources/js):
 *   node scripts/fase1.mjs --dry              lihat rencana + tabel pemetaan, tidak menulis apa pun
 *   node scripts/fase1.mjs                    jalankan
 *   node scripts/fase1.mjs --revert           kembalikan SEMUA yang diubah fase1
 *   node scripts/fase1.mjs --revert --force   revert walau file hasil fase1 sudah kamu edit
 *
 * Yang dikerjakan:
 *   1. index.css  — blok "ULTRA-CLEAN GRAPHITE DARK THEME" (±820 baris override `html.dark .bg-white {…!important}` dst.)
 *                   diganti blok token: `@theme { --color-surface… }` (nilai terang) + `html.dark { --color-surface… }` (nilai gelap)
 *                   + beberapa aturan dasar (body, input, shadow). Tidak ada `!important`.
 *   2. TSX/TS     — kelas lama diganti token (bg-white → bg-surface, text-slate-500 → text-ink-500, border-slate-200 → border-line-200, …).
 *                   Pemetaan dibuat OTOMATIS dari blok CSS lama (nilai gelap = nilai efektif setelah cascade), jadi tampilan gelap sama.
 *                   Kelas `dark:` yang selama ini TERTUTUP override lama (tak pernah tampil) dihapus; yang pakai `!` tetap.
 *   3. Aturan kontekstual yang masih punya pemakai dipindah ke utilitas (mis. lingkaran `rounded-full bg-slate-100` dapat border gelap).
 *
 * Mode terang tidak diubah: nilai terang token = nilai palet Tailwind yang dulu dipakai (`var(--color-slate-50)` dst.).
 *
 * Backup: .migrasi-backup/fase1/ (struktur folder sama) + manifest.json (sha256), pola yang sama dengan scripts/dashboard.mjs.
 * Butuh: postcss dan @babel/parser (keduanya sudah ada di node_modules lewat vite / react-select).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry');
const REVERT = FLAGS.has('--revert');
const FORCE = FLAGS.has('--force');

const PHASE = 'fase1';
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', PHASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const JS = path.join(ROOT, 'resources', 'js');
const CSS_FILE = path.join(JS, 'index.css');

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

// ─────────────────────────────────────────────────────────────────────────────
// REVERT (pola sama dengan dashboard.mjs)
// ─────────────────────────────────────────────────────────────────────────────
function revert() {
  if (!fs.existsSync(MANIFEST)) die('Tidak ada manifest fase1 — belum pernah dijalankan, atau sudah di-revert.');
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  const dirty = [];
  for (const e of m.files) {
    const abs = path.join(ROOT, e.path);
    if (fs.existsSync(abs) && sha(fs.readFileSync(abs, 'utf8')) !== e.sha) dirty.push(e.path);
  }
  if (dirty.length && !FORCE) {
    die(`File hasil fase1 ini sudah kamu ubah setelahnya:\n  ${dirty.join('\n  ')}\nRevert akan menimpa perubahan itu. Pakai --revert --force kalau memang mau.`);
  }

  log(DRY ? '\n[DRY] Revert fase1 akan:' : '\nRevert fase1:');
  for (const e of m.files) {
    log(`  pulihkan  ${e.path}`);
    if (!DRY) {
      const abs = path.join(ROOT, e.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.copyFileSync(path.join(BACKUP_DIR, e.path), abs);
    }
  }
  if (!DRY) {
    fs.rmSync(MANIFEST);
    log('\n✔ Revert selesai. (Salinan backup tetap ada di .migrasi-backup/fase1/)\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BAGIAN A — baca blok CSS lama, hitung nilai gelap EFEKTIF per kelas (cascade: yang terakhir menang)
// ─────────────────────────────────────────────────────────────────────────────
const START_MARK = '/* ===== ULTRA-CLEAN GRAPHITE DARK THEME ===== */';
const END_MARK = '/* >>> cursor-pointer (script-cursor.mjs) >>> */';

function loadDeps() {
  const req = createRequire(path.join(ROOT, 'package.json'));
  try {
    return { postcss: req('postcss'), babel: req('@babel/parser') };
  } catch (e) {
    die(`Butuh postcss dan @babel/parser di node_modules (${e.message.split('\n')[0]}). Jalankan: npm ci`);
  }
}

/** key = nama kelas apa adanya (mis. "bg-white", "hover:bg-slate-100", "bg-slate-50/60") → { prop: nilai } */
function legacyEffective(postcss, blockText) {
  const eff = new Map();
  const root = postcss.parse(blockText);
  for (const r of root.nodes) {
    if (r.type !== 'rule') continue;
    for (const sel of r.selectors) {
      const m = sel.trim().match(/^html\.dark \.((?:\\.|[A-Za-z0-9_-])+)(:hover)?$/);
      if (!m) continue;
      const key = m[1].replace(/\\(.)/g, '$1');
      const e = eff.get(key) || {};
      r.walkDecls((d) => {
        const cur = e[d.prop];
        const imp = !!d.important;
        if (!cur || imp >= cur.imp) e[d.prop] = { v: d.value, imp };
      });
      eff.set(key, e);
    }
  }
  return new Map([...eff].map(([k, e]) => [k, Object.fromEntries(Object.entries(e).map(([p, x]) => [p, x.v]))]));
}

// ─────────────────────────────────────────────────────────────────────────────
// BAGIAN B — pemetaan kelas lama → token
// ─────────────────────────────────────────────────────────────────────────────
// Kelas lama: [hover:]{bg|text|border|ring}-{white | famili-shade | [#hex]}[/alpha]
const LEGACY_RE = /^(hover:)?(bg|text|border|ring)-(white|[a-z]+-\d{2,3}|\[#[0-9A-Fa-f]{3,8}\])(?:\/(\d+))?$/;
const PROP_OF = { bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color' };

/** nama token (tanpa prefix utilitas) — dibedakan per properti supaya nilai gelap bg/text/border tidak bentrok */
function tokenName(kind, hover, color, alpha) {
  const a = alpha ? `-a${alpha}` : '';
  if (color.startsWith('[#')) return `${{ bg: 'surface', text: 'ink', border: 'line', ring: 'glow' }[kind]}-x${color.slice(2, -1).toLowerCase()}${a}`; // x = hex arbitrer
  if (color === 'white') return `surface${a}`; // bg-white
  const [fam, shade] = color.split('-');
  if (fam === 'slate') {
    if (kind === 'bg') {
      if (shade === '900') return hover ? `solid-hover-900${a}` : `solid${a}`;
      if (shade === '800') return `solid-hover${a}`;
      return hover ? `hover-${shade}${a}` : `surface-${shade}${a}`;
    }
    if (kind === 'text') return `ink-${shade}${a}`;
    if (kind === 'border') return `line-${shade}${a}`;
  }
  const pre = { bg: 'tint', text: 'tone', border: 'edge', ring: 'glow' }[kind];
  return `${pre}-${fam}-${hover ? 'hover-' : ''}${shade}${a}`;
}

/** nilai terang token = persis warna palet Tailwind yang dulu dipakai kelas itu */
function lightValue(color, alpha) {
  if (color.startsWith('[#')) return color.slice(1, -1);
  const v = color === 'white' ? 'var(--color-white)' : `var(--color-${color})`;
  return alpha ? `color-mix(in oklab, ${v} ${alpha}%, transparent)` : v;
}

// Token interaksi untuk border (hover/focus) yang dulu tak pernah tampil di mode gelap karena border dasarnya dipaksa !important.
// Nilainya diambil dari palet kontrol react-select di SearchableSelect.tsx (#383842 / #4b4b55 / #5c5c68).
const INTERACTIVE_BORDER = {
  'border-slate-300': { name: 'line-300', light: 'var(--color-slate-300)', dark: '#383842' },
  'border-slate-400': { name: 'line-400', light: 'var(--color-slate-400)', dark: '#4b4b55' },
  'border-slate-900': { name: 'line-900', light: 'var(--color-slate-900)', dark: '#5c5c68' },
};

// ─────────────────────────────────────────────────────────────────────────────
// BAGIAN C — parsing token class
// ─────────────────────────────────────────────────────────────────────────────
function splitVariants(tok) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of tok) {
    if (ch === '[' || ch === '(') depth++;
    if (ch === ']' || ch === ')') depth--;
    if (ch === ':' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  return { variants: parts, base: cur };
}

const COLORISH = /^(white|black|transparent|current|inherit|[a-z]+-\d{2,3}|\[(#|rgb|hsl|oklch|color|var)[^\]]*\])(\/[\w.\[\]%]+)?$/;
/** properti warna yang dipengaruhi class: 'bg' | 'text' | 'border' | 'ring' | null */
function propKey(base) {
  const b = base.startsWith('!') ? base.slice(1) : base;
  const m = b.match(/^(bg|text|border|ring)-(.+)$/);
  if (!m || !COLORISH.test(m[2])) return null;
  return m[1];
}

// ─────────────────────────────────────────────────────────────────────────────
// BAGIAN D — transformasi satu file TSX/TS
// ─────────────────────────────────────────────────────────────────────────────
const CN_CALLEES = new Set(['cn', 'clsx', 'twMerge', 'classNames', 'cva']);

let CONDS = 0;
/** path = daftar [idKondisi, cabang]; dua literal hanya bisa muncul bersamaan bila tak berada di cabang berbeda dari kondisi yang sama */
function collectLiterals(node, out, p = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => collectLiterals(n, out, p));
  if (node.type === 'StringLiteral') out.push({ start: node.start + 1, end: node.end - 1, path: p });
  else if (node.type === 'TemplateElement') out.push({ start: node.start, end: node.end, path: p });
  if (node.type === 'ConditionalExpression') {
    const id = ++CONDS;
    collectLiterals(node.test, out, p);
    collectLiterals(node.consequent, out, [...p, [id, 0]]);
    collectLiterals(node.alternate, out, [...p, [id, 1]]);
    return;
  }
  if (node.type === 'LogicalExpression' && (node.operator === '||' || node.operator === '??')) {
    const id = ++CONDS;
    collectLiterals(node.left, out, [...p, [id, 0]]);
    collectLiterals(node.right, out, [...p, [id, 1]]);
    return;
  }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra' || k.endsWith('Comments')) continue;
    const v = node[k];
    if (v && typeof v === 'object') collectLiterals(v, out, p);
  }
}
const coOccur = (a, b) => a.path.every(([id, br]) => b.path.every(([id2, br2]) => id !== id2 || br === br2));

/** Kumpulkan "grup" = kumpulan literal yang membentuk satu daftar class (atribut className / panggilan cn(...) / literal tunggal) */
function collectGroups(ast) {
  const groups = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    let lits = null;
    if (node.type === 'JSXAttribute' && node.name?.name === 'className' && node.value) {
      lits = [];
      collectLiterals(node.value, lits);
    } else if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && CN_CALLEES.has(node.callee.name)) {
      lits = [];
      collectLiterals(node.arguments, lits);
    }
    if (lits && lits.length) {
      const fresh = lits.filter((l) => !seen.has(l.start));
      fresh.forEach((l) => seen.add(l.start));
      if (fresh.length) groups.push(fresh);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'extra' || k.endsWith('Comments')) continue;
      const v = node[k];
      if (v && typeof v === 'object') visit(v);
    }
    if (node.type === 'StringLiteral' && !seen.has(node.start + 1)) {
      seen.add(node.start + 1);
      groups.push([{ start: node.start + 1, end: node.end - 1, path: [] }]);
    } else if (node.type === 'TemplateElement' && !seen.has(node.start)) {
      seen.add(node.start);
      groups.push([{ start: node.start, end: node.end, path: [] }]);
    }
  };
  visit(ast.program);
  return groups;
}

/**
 * Transformasi satu grup. Mengembalikan daftar edit { start, end, text } (offset di file asli).
 * `ctx` mengumpulkan token yang dipakai + statistik.
 */
function transformGroup(src, group, ctx) {
  const toks = [];
  group.forEach((lit, li) => {
    const text = src.slice(lit.start, lit.end);
    for (const m of text.matchAll(/\S+/g)) {
      const { variants, base } = splitVariants(m[0]);
      toks.push({ li, lit, s: lit.start + m.index, e: lit.start + m.index + m[0].length, raw: m[0], variants, base, out: m[0], remove: false });
    }
  });
  if (!toks.length) return [];

  // konteks tiap token = token lain yang bisa muncul BERSAMAAN di elemen yang sama (bukan cabang ternary lain)
  for (const t of toks) t.ctx = toks.filter((u) => coOccur(u.lit, t.lit));
  const baseProps = (t) => new Set(t.ctx.filter((u) => u.variants.length === 0 && LEGACY_RE.test(u.base) && ctx.eff.has(u.base)).map((u) => propKey(u.base)));

  // 2) ganti kelas
  for (const t of toks) {
    if (t.variants.includes('dark')) continue;
    if (t.base.startsWith('!')) continue;
    const chain = t.variants.join(':');
    const m = t.base.match(LEGACY_RE);

    // a) kelas yang persis punya aturan lama: tanpa varian, atau hover (aturan hover lama)
    if (m && (t.variants.length === 0 || (t.variants.length === 1 && t.variants[0] === 'hover')) && ctx.eff.has((t.variants[0] ? 'hover:' : '') + t.base)) {
      const key = (t.variants[0] ? 'hover:' : '') + t.base;
      const lm = key.match(LEGACY_RE);
      const name = tokenName(lm[2], !!lm[1], lm[3], lm[4]);
      ctx.use(name, lm[2], lm[3], lm[4], ctx.eff.get(key)[PROP_OF[lm[2]]]);
      t.out = (t.variants.length ? 'hover:' : '') + `${lm[2]}-${name}`;
      t.mig = `${lm[2]}|${chain}`;
      continue;
    }
    // b) varian lain (focus:, disabled:, md:, hover: tanpa aturan hover lama, …) dari kelas yang punya aturan dasar
    if (m && t.variants.length > 0 && !m[1] && ctx.eff.has(t.base)) {
      const name = tokenName(m[2], false, m[3], m[4]);
      ctx.use(name, m[2], m[3], m[4], ctx.eff.get(t.base)[PROP_OF[m[2]]]);
      t.out = `${t.variants.join(':')}:${m[2]}-${name}`;
      t.mig = `${m[2]}|${chain}`;
      ctx.variantCount++;
      continue;
    }
    // c) border interaktif (hover:/focus:) yang dulu tertutup border dasar yang dipaksa
    if (t.variants.length > 0 && INTERACTIVE_BORDER[t.base] && baseProps(t).has('border')) {
      const ib = INTERACTIVE_BORDER[t.base];
      ctx.useRaw(ib.name, 'border', ib.light, ib.dark);
      t.out = `${t.variants.join(':')}:border-${ib.name}`;
      t.mig = `border|${chain}`;
      ctx.variantCount++;
    }
  }

  // 3) hapus `dark:` yang tertutup (properti sama + rantai varian sama sudah dipegang token)
  for (const t of toks) {
    if (t.variants[0] !== 'dark' || t.base.startsWith('!')) continue;
    const k = propKey(t.base);
    if (!k) continue;
    const chain = t.variants.slice(1).join(':');
    if (t.ctx.some((u) => u.mig === `${k}|${chain}`)) {
      t.remove = true;
      ctx.removedDark.push(t.raw);
    }
  }

  // 4) aturan kontekstual lama yang masih punya pemakai
  // tiap tambahan ditempel di literal tempat token pemicunya berada (bukan literal terakhir grup)
  const addTo = new Map(); // lit → [kelas]
  const add = (lit, ...cls) => addTo.set(lit, [...(addTo.get(lit) || []), ...cls]);
  for (const t of toks) {
    if (t.raw === 'bg-slate-100' && t.ctx.some((u) => u.raw === 'rounded-full') && !addTo.has(t.lit)) {
      add(t.lit, 'dark:border', 'dark:border-[#38383e]'); // html.dark .rounded-full.bg-slate-100 { border: 1px solid #38383e }
      ctx.contextual++;
    }
    if (/^(hover:)?bg-white\/\d+$/.test(t.base) && t.variants.every((v) => v === 'hover') && !addTo.has(t.lit)) {
      add(t.lit, 'dark:bg-[rgba(28,28,32,0.85)]', 'dark:hover:bg-[rgba(28,28,32,0.85)]'); // html.dark [class*="bg-white/"]
      ctx.contextual++;
    }
  }

  // 5) susun edit
  const edits = [];
  for (const t of toks) {
    if (t.remove) {
      // hapus token + spasi di depannya (atau di belakangnya kalau token pertama)
      const text = src;
      let s = t.s;
      let e = t.e;
      if (s > t.lit.start && /\s/.test(text[s - 1])) s--;
      else if (e < t.lit.end && /\s/.test(text[e])) e++;
      edits.push({ start: s, end: e, text: '' });
    } else if (t.out !== t.raw) {
      edits.push({ start: t.s, end: t.e, text: t.out });
    }
  }
  for (const [lit, cls] of addTo) {
    edits.push({ start: lit.end, end: lit.end, text: (src.slice(lit.start, lit.end).match(/\s$/) ? '' : ' ') + cls.join(' ') });
  }
  return edits;
}

function applyEdits(src, edits) {
  // edit bisa saling menempel (hapus + ganti di sebelahnya): urutkan, buang yang tumpang tindih
  edits.sort((a, b) => a.start - b.start || a.end - b.end);
  let out = '';
  let pos = 0;
  for (const ed of edits) {
    if (ed.start < pos) continue;
    out += src.slice(pos, ed.start) + ed.text;
    pos = ed.end;
  }
  return out + src.slice(pos);
}

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.(tsx?)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// BAGIAN E — blok CSS baru
// ─────────────────────────────────────────────────────────────────────────────
function buildCssBlock(tokens, EOL) {
  // tokens: Map<`${kind}-${name}`, {name, light, dark}> — satu token dipakai satu properti
  const byName = new Map();
  for (const t of tokens.values()) byName.set(t.name, t);
  const order = (n) => {
    const g = ['surface', 'hover-', 'solid', 'ink-', 'line-', 'tint-', 'tone-', 'edge-', 'glow-'];
    const i = g.findIndex((p) => n.startsWith(p));
    return (i < 0 ? 99 : i) * 1000;
  };
  const list = [...byName.values()].sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name, 'en', { numeric: true }));

  const L = [];
  L.push('/* ===== DARK MODE: TOKEN TEMA (menggantikan override `html.dark .bg-white {…!important}` dst.) =====');
  L.push('   Cara kerja: tiap warna yang berubah di mode gelap adalah token `--color-*` (nilai terang di @theme, nilai gelap di html.dark).');
  L.push('   Di komponen pakai kelas token biasa, tanpa `dark:` — mis. `bg-surface`, `text-ink-700`, `border-line-200`, `bg-tint-amber-50`.');
  L.push('   Nama:  surface-* latar · hover-* latar saat hover · solid* tombol gelap · ink-* teks · line-* garis · tint-* latar status ·');
  L.push('          tone-* teks status · edge-* garis status · glow-* ring status · -x… hex khusus · sufiks -aNN = dengan alpha NN%.');
  L.push('   Nilai terang = palet Tailwind semula (var(--color-slate-50) dst.), jadi mode terang tidak berubah. ===== */');
  L.push('@theme {');
  for (const t of list) L.push(`  --color-${t.name}: ${t.light};`);
  L.push('}');
  L.push('');
  L.push('html.dark {');
  L.push('  color-scheme: dark;');
  L.push('  background-color: #121214;');
  for (const t of list) L.push(`  --color-${t.name}: ${t.dark};`);
  L.push('}');
  L.push('');
  L.push('html.dark body {');
  L.push('  background-color: #121214;');
  L.push('  color: #f4f4f5;');
  L.push('}');
  L.push('');
  L.push('/* Kontrol form: tak berlapis (unlayered) sehingga menang atas utilitas Tailwind tanpa !important. */');
  L.push('html.dark :is(input, select, textarea) {');
  L.push('  color-scheme: dark;');
  L.push('}');
  L.push('html.dark :is(input:not([type="checkbox"]):not([type="radio"]), select, textarea) {');
  L.push('  background-color: #18181b;');
  L.push('  color: #f4f4f5;');
  L.push('  border-color: #2c2c31;');
  L.push('}');
  L.push('html.dark :is(input, textarea)::placeholder {');
  L.push('  color: #71717a;');
  L.push('}');
  L.push('');
  L.push('/* Elevasi gelap untuk kartu/modal/dropdown: bayangan pekat + garis tipis (Tailwind meng-inline shadow, jadi tak bisa lewat token). */');
  L.push('html.dark :is(.shadow-sm, .shadow-md, .shadow-lg, .shadow-xl) {');
  L.push('  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px #2c2c31;');
  L.push('}');
  L.push('');
  L.push('/* Transisi input di header (aturan mode terang yang dulu terselip di blok dark) */');
  L.push('header input[type="text"],');
  L.push('header input {');
  L.push('  transition: all 0.2s ease-in-out;');
  L.push('}');
  L.push('');
  return L.join(EOL);
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY
// ─────────────────────────────────────────────────────────────────────────────
function apply() {
  if (fs.existsSync(MANIFEST)) die('fase1 sudah pernah dijalankan (manifest ada). Pakai --revert dulu kalau mau mengulang.');
  if (!fs.existsSync(JS)) die('resources/js tidak ditemukan. Jalankan dari ROOT project (node scripts/fase1.mjs).');
  const { postcss, babel } = loadDeps();

  // 1) blok CSS lama
  const css = fs.readFileSync(CSS_FILE, 'utf8');
  const EOL = css.includes('\r\n') ? '\r\n' : '\n';
  const s = css.indexOf(START_MARK);
  const e = css.indexOf(END_MARK);
  if (s < 0 || e < 0 || e < s || css.indexOf(START_MARK, s + 1) >= 0) die('Penanda blok dark mode di index.css tidak ditemukan / tidak unik. Apakah fase1 sudah pernah jalan (tanpa manifest)?');
  const oldBlock = css.slice(s, e);
  const oldLines = oldBlock.split('\n').length - 1;
  const eff = legacyEffective(postcss, oldBlock);
  // `html.dark .ring-1.ring-slate-900\/5 { --tw-ring-color: #2c2c31 }` — selector komposit, dipetakan manual ke token ring biasa
  if (oldBlock.includes('.ring-1.ring-slate-900\\/5')) eff.set('ring-slate-900/5', { '--tw-ring-color': '#2c2c31' });

  // 2) transformasi TSX/TS
  const tokens = new Map();
  const ctx = {
    eff,
    removedDark: [],
    variantCount: 0,
    contextual: 0,
    use(name, kind, color, alpha, dark) {
      if (!dark) die(`Aturan lama untuk ${kind}-${color}${alpha ? '/' + alpha : ''} tidak punya nilai ${PROP_OF[kind]}.`);
      tokens.set(`${kind}-${name}`, { name, kind, light: lightValue(color, alpha), dark });
    },
    useRaw(name, kind, light, dark) {
      tokens.set(`${kind}-${name}`, { name, kind, light, dark });
    },
  };
  const changes = [];
  let totalEdits = 0;
  for (const f of listFiles(JS)) {
    const src = fs.readFileSync(f, 'utf8');
    let ast;
    try {
      ast = babel.parse(src, { sourceType: 'module', plugins: f.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'] });
    } catch (err) {
      die(`Gagal mem-parse ${rel(f)}: ${err.message}`);
    }
    const edits = [];
    for (const g of collectGroups(ast)) edits.push(...transformGroup(src, g, ctx));
    if (!edits.length) continue;
    const out = applyEdits(src, edits);
    if (out !== src) {
      changes.push({ file: f, text: out, n: edits.length });
      totalEdits += edits.length;
    }
  }

  // 3) CSS baru
  const block = buildCssBlock(tokens, EOL);
  let newCss = css.slice(0, s) + block + EOL + css.slice(e);
  // PENETRAL (shell): placeholder `revert` sebelumnya kalah oleh `html.dark input::placeholder{!important}`; sekarang aturan itu tiada,
  // jadi batasi ke mode terang supaya placeholder gelap tetap #71717a seperti sebelumnya.
  const PH_OLD = '.mv .search input::placeholder{color:revert;opacity:revert}';
  const PH_NEW = 'html:not(.dark) .mv .search input::placeholder{color:revert;opacity:revert}';
  if (newCss.split(PH_OLD).length !== 2) die('Aturan placeholder di blok PENETRAL tidak ditemukan tepat 1×. Ubah script atau periksa index.css.');
  newCss = newCss.replace(PH_OLD, PH_NEW);
  const newBlockLines = block.split(EOL).length;

  // 4) laporan
  log(DRY ? '\n[DRY] fase1 akan:' : '\nfase1 menjalankan:');
  log(`  tulis ulang ${rel(CSS_FILE)}   blok dark mode ${oldLines} baris → ${newBlockLines} baris (${tokens.size} token, tanpa !important)`);
  log(`  ubah        ${changes.length} file TSX/TS  (${totalEdits} penggantian)`);
  log(`  kelas `+'`dark:`'+` tertutup yang dihapus: ${ctx.removedDark.length}   varian (hover/focus/disabled…) dialihkan ke token: ${ctx.variantCount}   aturan kontekstual → utilitas: ${ctx.contextual}`);
  const usedLegacy = new Set([...tokens.values()].map((t) => `${t.kind}-${t.name}`));
  const dead = [...eff.keys()].filter((k) => {
    const m = k.match(LEGACY_RE);
    return !m || !usedLegacy.has(`${m[2]}-${tokenName(m[2], !!m[1], m[3], m[4])}`);
  });
  log(`  override lama tanpa pemakai (dibuang begitu saja): ${dead.length} kelas`);
  log('\n  Pemetaan kelas lama → token (nilai terang | nilai gelap):');
  for (const t of [...tokens.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'en', { numeric: true }))) {
    log(`    ${(t.kind + '-' + t.name).padEnd(30)} ${t.light.padEnd(58)} | ${t.dark}`);
  }
  if (DRY) {
    log('\n[DRY] Tidak ada yang ditulis.\n');
    return;
  }

  // 5) backup → manifest → tulis
  const manifest = { phase: PHASE, at: new Date().toISOString(), files: [] };
  const backup = (abs) => {
    const dest = path.join(BACKUP_DIR, rel(abs));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
  };
  backup(CSS_FILE);
  manifest.files.push({ path: rel(CSS_FILE), action: 'modified', sha: sha(newCss) });
  for (const c of changes) {
    backup(c.file);
    manifest.files.push({ path: rel(c.file), action: 'modified', sha: sha(c.text) });
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  fs.writeFileSync(CSS_FILE, newCss);
  for (const c of changes) fs.writeFileSync(c.file, c.text);

  log(`\n✔ fase1 selesai. Backup: ${rel(BACKUP_DIR)}/`);
  log('  Cek: npx tsc --noEmit && npm run build, lalu lihat tampilan terang & gelap.');
  log('  Batal: node scripts/fase1.mjs --revert\n');
}

REVERT ? revert() : apply();
