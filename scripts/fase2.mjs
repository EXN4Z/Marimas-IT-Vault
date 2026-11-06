#!/usr/bin/env node
/**
 * fase2.mjs — FASE 2: komponen kecil (.pn-*, .dd-btn, .sk) jadi utilitas Tailwind.
 *
 * Jalankan dari ROOT project (setelah fase1):
 *   node scripts/fase2.mjs --dry              lihat rencana, tidak menulis apa pun
 *   node scripts/fase2.mjs                    jalankan
 *   node scripts/fase2.mjs --revert           kembalikan SEMUA yang diubah fase2
 *   node scripts/fase2.mjs --revert --force   revert walau file hasil fase2 sudah kamu edit
 *   node scripts/fase2.mjs --verify           (opsional) bandingkan tampilan LAMA vs BARU di Chromium — butuh Python + Playwright
 *
 * Yang dikerjakan:
 *   1. index.css — hapus aturan .pn-* (±120 baris), .dd-btn*, .sk (+ keyframes), kelas mati (.pn-tab/.pn-seg/…);
 *                  tambah `@theme inline` (token palet dv/dd/pn jadi bg-dd-card, text-dv-ink, shadow-dd, …) dan `--animate-sk`.
 *                  Palet per area (`.pn { --dv-ink … }` terang + gelap) TETAP di CSS: itu data warna, bukan gaya komponen.
 *   2. TSX       — token kelas diganti utilitas persis setara. Modifier `is-late / is-on / is-ok / is-drag` tetap sebagai kelas
 *                  penanda (tanpa CSS) yang dibaca varian Tailwind: `[&.is-late]:…`, `group-[.is-late]/lama:…`.
 *   3. components/ui/pn.ts — baru. Tiga gaya yang dipakai ≥ 14× (pnCard, pnEmpty, pnTable) jadi konstanta, bukan disalin 14–20×.
 *
 * TIDAK disentuh (sengaja): `.dd-pill` (ditimpa `.dd-v4 .dd-pill` di dashboard.css → Fase 3) dan `.dv-*` (dipakai bersama widget dashboard → Fase 3).
 *
 * Backup: .migrasi-backup/fase2/ + manifest.json (sha256), pola sama dengan fase1.mjs / dashboard.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry');
const REVERT = FLAGS.has('--revert');
const FORCE = FLAGS.has('--force');
const VERIFY = FLAGS.has('--verify');

const PHASE = 'fase2';
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', PHASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const JS = path.join(ROOT, 'resources', 'js');
const CSS_FILE = path.join(JS, 'index.css');
const PN_TS = path.join(JS, 'components', 'ui', 'pn.ts');

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

// ─────────────────────────────────────────────────────────────────────────────
// PEMETAAN KELAS → UTILITAS (setara persis dengan aturan CSS lama)
// Catatan: `text-[13px]` (bukan text-sm) supaya hanya font-size yang diset — text-sm/xs ikut mengubah line-height.
// ─────────────────────────────────────────────────────────────────────────────
const SIMPLE = {
  sk: 'animate-sk bg-[var(--dv-track,#ECE8F6)] motion-reduce:animate-none dark:bg-[var(--dv-track,#2A2A30)]',
  // header
  'pn-head': 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
  'pn-title': 'text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-dv-ink',
  'pn-sub': 'mt-1.5 max-w-[560px] text-[13px] leading-normal text-dv-muted',
  'pn-head-act': 'flex shrink-0 flex-wrap items-center gap-2.5',
  'pn-warn': 'inline-flex items-center gap-1.5 self-start rounded-full bg-dv-alert/10 px-3 py-1.5 text-[12px] font-bold text-dv-alert [&.is-ok]:bg-dd-green/12 [&.is-ok]:text-dd-green-ink',
  'pn-cta': 'inline-flex h-[42px] items-center gap-2 rounded-full bg-pn-btn-bg px-[18px] text-[13px] font-bold whitespace-nowrap text-pn-btn-fg shadow-dd hover:opacity-[.88] dark:shadow-none',
  // tabel
  'pn-scroll': 'overflow-x-auto',
  'pn-aset': 'flex items-center gap-2.5',
  'pn-ico': 'grid size-[34px] shrink-0 place-items-center rounded-full bg-(--c)/16 text-(--c)',
  'pn-kode': 'leading-[1.25] font-bold text-dv-ink',
  'pn-jenis': 'text-[11px] font-normal text-dv-muted',
  'pn-strong': 'font-bold text-dv-ink',
  'pn-trunc': 'max-w-60 truncate',
  'pn-trunc-s': 'min-w-0 truncate',
  'pn-nowrap': 'whitespace-nowrap',
  'pn-mono': 'font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[12px] whitespace-nowrap',
  'pn-lama': 'group/lama flex items-center gap-2',
  'pn-lama-t': 'h-[5px] w-14 overflow-hidden rounded-full bg-dv-track',
  'pn-lama-f': 'h-full bg-dv-primary group-[.is-late]/lama:bg-dv-alert',
  'pn-lama-n': 'text-[12px] font-bold whitespace-nowrap text-dv-soft group-[.is-late]/lama:text-dv-alert',
  'pn-act': 'flex items-center justify-end gap-1.5 whitespace-nowrap',
  // papan
  'pn-board': 'grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4',
  'pn-col': 'flex min-w-0 flex-col gap-2',
  'pn-col-h': 'flex items-baseline gap-2 border-b-2 border-b-(--c) pb-2.5',
  'pn-col-n': 'text-[28px] leading-none font-bold text-dv-ink',
  'pn-col-t': 'text-[13px] font-bold text-dv-ink',
  'pn-col-s': 'ml-auto text-[11px] text-dv-muted',
  'pn-bcard': 'rounded-[14px] border border-dv-line bg-dd-card text-[12px] text-dv-soft shadow-dd dark:shadow-none [&.is-late]:border-dv-alert [&.is-drag]:cursor-grab',
  'pn-bcard-in': 'flex flex-col gap-[3px] px-3 py-2.5',
  'pn-bcard-top': 'flex items-center justify-between gap-2',
  'pn-bcard-foot': 'flex items-center justify-between gap-2 pt-1',
  'pn-bcard-x': 'flex flex-col gap-1.5 border-t border-dv-line px-3 py-2.5',
  'pn-brow': 'flex items-center justify-between gap-3 border-b border-dv-line pb-1 [&>span:first-child]:text-dv-muted [&>span:last-child]:text-right',
  'pn-chev': 'grid size-6 shrink-0 place-items-center rounded-lg border border-dv-line text-dv-soft hover:bg-dv-surface',
  'pn-link': 'text-left text-[12px] font-bold text-dv-ink hover:underline',
  'pn-drop': 'rounded-[14px] border border-dashed border-dv-line p-3 text-center text-[12px] text-dv-muted [&.is-on]:border-dv-muted [&.is-on]:bg-dv-surface [&.is-on]:text-dv-ink',
  // `.pn-table th.pn-r { text-align: right }` — semua pemakai ada di <th>; ditangani rakitan pnTable (th.text-right)
  'pn-r': 'text-right',
};

/** Keluarga kelas yang saling bentrok (bg/warna/ukuran): token "anchor" dirakit sekali, token anggota dihapus. */
const FAMILY_ANCHOR = {
  'dd-btn': (has) =>
    [
      'inline-flex items-center gap-1.5 rounded-full border border-transparent font-bold whitespace-nowrap shadow-dd',
      has('dd-btn-sm') ? 'h-[34px] px-3.5 text-[12.5px]' : 'h-[42px] px-5 text-[13px]',
      has('dd-btn-primary') ? 'bg-dv-primary text-dv-on-primary hover:brightness-[1.08]' : 'bg-dd-card text-dv-ink hover:brightness-[.97]',
      'disabled:opacity-50 dark:border-dv-line dark:shadow-none',
    ].join(' '),
  'pn-btn': (has) =>
    [
      'h-[30px] rounded-full border px-3.5 text-[12px] font-bold',
      has('pn-btn-primary') ? 'border-pn-btn-bg bg-pn-btn-bg text-pn-btn-fg hover:border-pn-btn-bg hover:opacity-[.88]' : 'border-dv-line bg-dd-card text-dv-ink hover:border-dv-muted',
    ].join(' '),
};
const FAMILY_MEMBER = { 'dd-btn-primary': 'dd-btn', 'dd-btn-sm': 'dd-btn', 'pn-btn-primary': 'pn-btn' };

const PN_TABLE_PARTS = [
  'w-full border-separate border-spacing-0 text-[13px]',
  // <th>
  '[&_th]:bg-dv-surface [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-bold [&_th]:whitespace-nowrap [&_th]:text-dv-muted',
  '[&_th.text-center]:text-center [&_th.text-right]:text-right',
  '[&_th:first-child]:rounded-l-[10px] [&_th:last-child]:rounded-r-[10px]',
  // <td>
  '[&_td]:border-b [&_td]:border-dv-line [&_td]:p-3 [&_td]:align-middle [&_td]:text-dv-soft',
  '[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-dv-surface/70',
  // baris terlambat: <tr className="is-late"> (kelas penanda, tanpa CSS)
  '[&_tr.is-late_td:first-child]:shadow-[inset_3px_0_0_var(--dv-alert)]',
];

/** Dipakai ≥ 14×: jadi konstanta di components/ui/pn.ts */
const PN_CONST = {
  'pn-card': { name: 'pnCard', value: 'min-w-0 rounded-[20px] bg-dd-card px-[18px] pt-3.5 pb-2.5 shadow-dd dark:border dark:border-dv-line dark:shadow-none' },
  'pn-empty': { name: 'pnEmpty', value: 'mb-2 rounded-[14px] border border-dashed border-dv-line px-4 py-12 text-center text-[13px] text-dv-muted' },
  'pn-table': { name: 'pnTable', value: PN_TABLE_PARTS.join(' ') },
};

/** Token palet area yang dibuka jadi utilitas (nilai tetap dibaca di elemen pemakai, jadi ikut .pn / .dv / .dv-modal & mode gelap). */
const THEME_COLORS = ['dv-ink', 'dv-soft', 'dv-muted', 'dv-line', 'dv-track', 'dv-surface', 'dv-primary', 'dv-on-primary', 'dv-alert', 'dd-card', 'dd-green', 'dd-green-ink', 'pn-btn-bg', 'pn-btn-fg'];

/** Kelas yang sudah tidak punya pemakai di TSX (diverifikasi saat Fase 2) — aturannya dibuang. */
const DEAD = ['pn-bar', 'pn-count', 'pn-dot', 'pn-err', 'pn-seg', 'pn-tab', 'pn-tabs'];


/** Komentar yang menyebut kelas lama → disesuaikan (tiap `from` harus ada tepat 1×). */
const COMMENT_FIXES = [
  { file: 'components/skeleton/Skeleton.tsx', from: 'cukup di kelas .sk (index.css).', to: 'cukup di utilitas animate-sk / bg-dv-track di bawah (+ --animate-sk di @theme index.css).' },
  { file: 'components/skeleton/SkeletonTableRow.tsx', from: '(.pn-table di dalam .pn-card). Padding sel & garis pemisah', to: '(pnTable di dalam pnCard, lihat components/ui/pn.ts). Padding sel & garis pemisah' },
  { file: 'components/skeleton/SkeletonTableRow.tsx', from: 'datang dari .pn-table itu sendiri', to: 'datang dari pnTable itu sendiri' },
  { file: 'components/skeleton/SkeletonTableRow.tsx', from: 'dalam kartu .pn-card, buat halaman', to: 'dalam kartu pnCard, buat halaman' },
  { file: 'features/inventory/list/InventoryTable.tsx', from: '(.pn-card / .pn-table)', to: '(pnCard / pnTable)' },
  { file: 'features/inventory/list/InventoryHeaderBar.tsx', from: '(.pn-head, .dd-btn, .pn-cta di index.css)', to: '(utilitas Tailwind; palet .pn di index.css)' },
  { file: 'features/laporan/foto/FotoInventoryTab.tsx', from: '(garis & header .pn-table)', to: '(garis & header pnTable)' },
  { file: 'features/penanganan/list/PenangananHeader.tsx', from: 'Gaya lewat kelas .pn-* & .dd-btn di index.css.', to: 'Gaya lewat utilitas Tailwind (token palet .pn di index.css).' },
  { file: 'features/penanganan/list/PenangananSkeleton.tsx', from: '(pola .pn-aset)', to: '(pola ikon + kode + jenis di PenangananTabel)' },
  { file: 'features/penanganan/list/PenangananSkeleton.tsx', from: 'meniru layout baru (kelas .pn-* sama dengan PenangananPage)', to: 'meniru layout baru (utilitas yang sama dengan PenangananPage)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Diekspor untuk harness verifikasi: terapkan pemetaan ke string class mentah (mis. HTML fixture)
// ─────────────────────────────────────────────────────────────────────────────
export function mapClassString(str) {
  const toks = str.split(/\s+/).filter(Boolean);
  const has = (c) => toks.includes(c);
  const out = [];
  for (const t of toks) {
    if (PN_CONST[t]) out.push(PN_CONST[t].value);
    else if (SIMPLE[t]) out.push(SIMPLE[t]);
    else if (FAMILY_ANCHOR[t]) out.push(FAMILY_ANCHOR[t](has));
    else if (FAMILY_MEMBER[t]) continue;
    else out.push(t);
  }
  return out.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// REVERT
// ─────────────────────────────────────────────────────────────────────────────
function revert() {
  if (!fs.existsSync(MANIFEST)) die('Tidak ada manifest fase2 — belum pernah dijalankan, atau sudah di-revert.');
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const dirty = [];
  for (const e of m.files) {
    const abs = path.join(ROOT, e.path);
    if (fs.existsSync(abs) && sha(fs.readFileSync(abs, 'utf8')) !== e.sha) dirty.push(e.path);
  }
  if (dirty.length && !FORCE) {
    die(`File hasil fase2 ini sudah kamu ubah setelahnya:\n  ${dirty.join('\n  ')}\nRevert akan menimpa perubahan itu. Pakai --revert --force kalau memang mau.`);
  }
  log(DRY ? '\n[DRY] Revert fase2 akan:' : '\nRevert fase2:');
  for (const e of m.files) {
    const abs = path.join(ROOT, e.path);
    if (e.action === 'created') {
      log(`  hapus     ${e.path}`);
      if (!DRY && fs.existsSync(abs)) fs.rmSync(abs);
    } else {
      log(`  pulihkan  ${e.path}`);
      if (!DRY) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.copyFileSync(path.join(BACKUP_DIR, e.path), abs);
      }
    }
  }
  if (!DRY) {
    fs.rmSync(MANIFEST);
    log('\n✔ Revert selesai. (Salinan backup tetap ada di .migrasi-backup/fase2/)\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AST: grup class (atribut className / cn(...) / literal tunggal) — sama dengan fase1, plus nama tag
// ─────────────────────────────────────────────────────────────────────────────
const CN_CALLEES = new Set(['cn', 'clsx', 'twMerge', 'classNames', 'cva']);
let CONDS = 0;
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

function collectGroups(ast) {
  const groups = [];
  const constEdits = [];
  const seen = new Set();
  const visit = (node, tag) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, tag));
    let lits = null;
    let gtag = tag;
    if (node.type === 'JSXOpeningElement') gtag = node.name?.name;
    if (node.type === 'JSXAttribute' && node.name?.name === 'className' && node.value) {
      // className="pn-card" persis → konstanta
      if (node.value.type === 'StringLiteral' && PN_CONST[node.value.value.trim()]) {
        constEdits.push({ start: node.value.start, end: node.value.end, name: PN_CONST[node.value.value.trim()].name });
        seen.add(node.value.start + 1);
        return;
      }
      lits = [];
      collectLiterals(node.value, lits);
    } else if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && CN_CALLEES.has(node.callee.name)) {
      lits = [];
      collectLiterals(node.arguments, lits);
    }
    if (lits && lits.length) {
      const fresh = lits.filter((l) => !seen.has(l.start));
      fresh.forEach((l) => seen.add(l.start));
      if (fresh.length) groups.push({ lits: fresh, tag: node.type === 'JSXAttribute' ? tag : null });
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'extra' || k.endsWith('Comments')) continue;
      const v = node[k];
      if (v && typeof v === 'object') visit(v, node.type === 'JSXOpeningElement' ? node.name?.name : gtag);
    }
    if (node.type === 'StringLiteral' && !seen.has(node.start + 1)) {
      seen.add(node.start + 1);
      groups.push({ lits: [{ start: node.start + 1, end: node.end - 1, path: [] }], tag: null });
    } else if (node.type === 'TemplateElement' && !seen.has(node.start)) {
      seen.add(node.start);
      groups.push({ lits: [{ start: node.start, end: node.end, path: [] }], tag: null });
    }
  };
  visit(ast.program, null);
  return { groups, constEdits };
}

const SEMANTIC = /^(pn-[a-z-]+|dd-btn(-[a-z]+)?|sk)$/;

function transformGroup(src, group, file, stats) {
  const toks = [];
  group.lits.forEach((lit) => {
    const text = src.slice(lit.start, lit.end);
    for (const m of text.matchAll(/\S+/g)) toks.push({ lit, s: lit.start + m.index, e: lit.start + m.index + m[0].length, raw: m[0] });
  });
  for (const t of toks) t.ctx = toks.filter((u) => coOccur(u.lit, t.lit));
  const edits = [];
  for (const t of toks) {
    const c = t.raw;
    if (!SEMANTIC.test(c) && c !== 'pn-r') continue;
    const has = (x) => t.ctx.some((u) => u.raw === x);
    let out = null;
    if (PN_CONST[c]) die(`${rel(file)}: "${c}" dipakai tidak sebagai className="${c}" persis (mis. digabung kelas lain). Tangani manual dulu.`);
    else if (c === 'pn-r') {
      if (group.tag !== 'th') die(`${rel(file)}: "pn-r" dipakai di <${group.tag}> (hanya <th> yang didukung rakitan pnTable).`);
      out = SIMPLE[c];
    } else if (SIMPLE[c]) out = SIMPLE[c];
    else if (FAMILY_ANCHOR[c]) out = FAMILY_ANCHOR[c](has);
    else if (FAMILY_MEMBER[c]) {
      if (!has(FAMILY_MEMBER[c])) die(`${rel(file)}: "${c}" tanpa "${FAMILY_MEMBER[c]}" di elemen yang sama.`);
      out = '';
    } else if (DEAD.includes(c)) die(`${rel(file)}: kelas "${c}" ternyata dipakai — jangan dibuang.`);
    else die(`${rel(file)}: kelas "${c}" belum ada di pemetaan fase2.`);
    stats.tokens++;
    stats.byClass[c] = (stats.byClass[c] || 0) + 1;
    if (out === '') {
      let s = t.s;
      let e = t.e;
      if (s > t.lit.start && /\s/.test(src[s - 1])) s--;
      else if (e < t.lit.end && /\s/.test(src[e])) e++;
      edits.push({ start: s, end: e, text: '' });
    } else edits.push({ start: t.s, end: t.e, text: out });
  }
  return edits;
}

function applyEdits(src, edits) {
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
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const TARGET_SEL = /^(?:html\.dark )?\.(?:pn-[a-z-]+|dd-btn(?:-[a-z]+)?|sk)(?![A-Za-z0-9_-])/;
const isTargetSelector = (s) => TARGET_SEL.test(s.trim()) || s.trim() === '.pn .dd-btn:disabled';
const DROP_COMMENTS = [
  /^\s*header\s*$/,
  /^\s*tab pill \+ pilihan tampilan\s*$/,
  /^\s*kartu tabel\s*$/,
  /^\s*papan\s*$/,
  /^\s*tombol\s*$/,
  /^=+ END PENANGANAN V2 =+$/,
  /INVENTORY V2 \(\.pn-\*\)/,
  /END INVENTORY V2/,
  /SKELETON LOADING/,
];

function themeBlock(EOL) {
  const L = [];
  L.push('/* ===== PALET DASHBOARD / PENANGANAN → UTILITAS TAILWIND =====');
  L.push('   Variabel --dv-* / --dd-* / --pn-* tetap didefinisikan per area (.dv, .pn, .dv-modal; terang + gelap) di bawah.');
  L.push('   Di komponen dipakai lewat utilitas: bg-dd-card, text-dv-ink, border-dv-line, bg-dv-alert/10, shadow-dd, …');
  L.push('   `inline` = nilai dibaca di elemen pemakai, jadi otomatis mengikuti area (.pn/.dv) dan mode gelapnya. ===== */');
  L.push('@theme inline {');
  for (const c of THEME_COLORS) L.push(`  --color-${c}: var(--${c});`);
  L.push('  --shadow-dd: var(--dd-shadow);');
  L.push('}');
  L.push('');
  L.push('/* Skeleton: animate-sk (+ motion-reduce:animate-none) */');
  L.push('@theme {');
  L.push('  --animate-sk: sk-pulse 1.6s ease-in-out infinite;');
  L.push('  @keyframes sk-pulse {');
  L.push('    0%,');
  L.push('    100% {');
  L.push('      opacity: 1;');
  L.push('    }');
  L.push('    50% {');
  L.push('      opacity: 0.5;');
  L.push('    }');
  L.push('  }');
  L.push('}');
  L.push('');
  return L.join(EOL);
}

function rewriteCss(postcss, css) {
  const EOL = css.includes('\r\n') ? '\r\n' : '\n';
  const root = postcss.parse(css);
  let removedRules = 0;
  let sawPalette = false;
  let headerComment = null;
  for (const n of [...root.nodes]) {
    if (n.type === 'comment') {
      if (/PENANGANAN V2 \(\.pn-\*\)/.test(n.text)) headerComment = n;
      else if (DROP_COMMENTS.some((re) => re.test(n.text.trim()))) n.remove();
      continue;
    }
    if (n.type === 'rule') {
      if (n.selectors.every(isTargetSelector)) {
        n.remove();
        removedRules++;
      } else if (n.selector.trim() === '.pn') sawPalette = true;
    } else if (n.type === 'atrule') {
      if (n.name === 'keyframes' && n.params === 'sk-pulse') {
        n.remove();
        removedRules++;
      } else if (n.name === 'media') {
        const kids = n.nodes.filter((k) => k.type === 'rule');
        if (kids.length && kids.every((k) => k.selectors.every(isTargetSelector))) {
          n.remove();
          removedRules++;
        }
      }
    }
  }
  if (!headerComment || !sawPalette) die('Blok "PENANGANAN V2" / palet `.pn` tidak ditemukan di index.css. Apakah index.css sudah berbeda dari yang diharapkan?');
  headerComment.text = `===== PALET PENANGANAN / INVENTORY / MASTER DATA (.pn) =====
   Halaman ini memakai palet yang sama dengan dashboard: kartu putih + aksen ungu / kuning / hijau (terang), graphite netral (gelap).
   Token --dv-* / --dd-* disalin ke .pn karena halaman ini tidak dibungkus .dv. Komponennya sendiri memakai utilitas Tailwind
   (lihat components/ui/pn.ts dan token di blok @theme di atas), bukan kelas .pn-*.`;
  let out = root.toString();
  // sisipkan blok @theme tepat sebelum komentar palet .pn
  const marker = '/* ===== PALET PENANGANAN / INVENTORY / MASTER DATA (.pn)';
  const i = out.indexOf(marker);
  if (i < 0) die('Gagal menyisipkan blok @theme (penanda palet tidak ketemu).');
  out = out.slice(0, i) + themeBlock(EOL) + EOL + out.slice(i);
  out = out.replace(/(\r?\n){3,}/g, EOL + EOL);
  return { css: out, removedRules };
}

function pnTsSource() {
  const q = (s) => `'${s}'`;
  const L = [];
  L.push('// Gaya halaman Penanganan / Inventory / Master Data / Laporan Foto (dulu kelas .pn-* di index.css).');
  L.push('// Hanya yang dipakai berulang (≥ 14×) dijadikan konstanta di sini; sisanya utilitas Tailwind langsung di komponen.');
  L.push('// Warna (text-dv-ink, bg-dd-card, …) berasal dari palet area `.pn` / `.dv` — lihat blok @theme di index.css.');
  L.push('');
  L.push('/** Kartu putih (terang) / kartu bergaris (gelap) pembungkus tabel & daftar. */');
  L.push(`export const pnCard =\n  ${q(PN_CONST['pn-card'].value)};`);
  L.push('');
  L.push('/** Keadaan kosong ("Belum ada data …"). */');
  L.push(`export const pnEmpty =\n  ${q(PN_CONST['pn-empty'].value)};`);
  L.push('');
  L.push('/**');
  L.push(' * Tabel data: <table className={pnTable}>. Gaya <th>/<td> diberikan dari <table> lewat varian `[&_th]:` supaya sel tidak perlu kelas satu per satu.');
  L.push(' * Modifier: <th className="text-right"> / "text-center" untuk rata; <tr className="is-late"> menandai baris terlambat (garis kiri merah).');
  L.push(' */');
  L.push('export const pnTable = [');
  for (const part of PN_TABLE_PARTS) L.push(`  ${q(part)},`);
  L.push("].join(' ');");
  L.push('');
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY
// ─────────────────────────────────────────────────────────────────────────────
function apply() {
  if (fs.existsSync(MANIFEST)) die('fase2 sudah pernah dijalankan (manifest ada). Pakai --revert dulu kalau mau mengulang.');
  if (!fs.existsSync(JS)) die('resources/js tidak ditemukan. Jalankan dari ROOT project.');
  if (fs.existsSync(PN_TS)) die('components/ui/pn.ts sudah ada (tanpa manifest). Hapus/periksa dulu.');
  const req = createRequire(path.join(ROOT, 'package.json'));
  let postcss, babel;
  try {
    postcss = req('postcss');
    babel = req('@babel/parser');
  } catch (e) {
    die(`Butuh postcss dan @babel/parser di node_modules. Jalankan: npm ci`);
  }

  const css = fs.readFileSync(CSS_FILE, 'utf8');
  const { css: newCss, removedRules } = rewriteCss(postcss, css);

  const stats = { tokens: 0, byClass: {}, consts: 0 };
  const changes = [];
  for (const f of listFiles(JS)) {
    if (f === PN_TS) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (!/\b(pn-|dd-btn|sk\b)/.test(src)) continue;
    let ast;
    try {
      ast = babel.parse(src, { sourceType: 'module', plugins: f.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'] });
    } catch (err) {
      die(`Gagal mem-parse ${rel(f)}: ${err.message}`);
    }
    const { groups, constEdits } = collectGroups(ast);
    const edits = [];
    for (const g of groups) edits.push(...transformGroup(src, g, f, stats));
    const used = new Set();
    for (const c of constEdits) {
      edits.push({ start: c.start, end: c.end, text: `{${c.name}}` });
      used.add(c.name);
      stats.consts++;
    }
    if (used.size) {
      const imports = ast.program.body.filter((n) => n.type === 'ImportDeclaration');
      const last = imports[imports.length - 1];
      let r = path.relative(path.dirname(f), path.join(JS, 'components', 'ui', 'pn')).split(path.sep).join('/');
      if (!r.startsWith('.')) r = './' + r;
      const semi = src[last.end - 1] === ';' ? ';' : '';
      edits.push({ start: last.end, end: last.end, text: `\nimport { ${[...used].sort().join(', ')} } from '${r}'${semi}` });
    }
    if (!edits.length) continue;
    const out = applyEdits(src, edits);
    if (out !== src) changes.push({ file: f, text: out, n: edits.length });
  }

  // perbaiki komentar yang menyebut kelas lama
  const texts = new Map(changes.map((c) => [c.file, c]));
  for (const fx of COMMENT_FIXES) {
    const abs = path.join(JS, fx.file);
    if (!fs.existsSync(abs)) die(`COMMENT_FIXES: ${fx.file} tidak ada.`);
    let c = texts.get(abs);
    if (!c) {
      c = { file: abs, text: fs.readFileSync(abs, 'utf8'), n: 0 };
      texts.set(abs, c);
      changes.push(c);
    }
    if (c.text.split(fx.from).length !== 2) die(`COMMENT_FIXES: "${fx.from}" tidak ditemukan tepat 1× di ${fx.file}.`);
    c.text = c.text.replace(fx.from, () => fx.to);
  }

  // sisa kelas semantik di luar komentar?
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const leftovers = [];
  for (const c of changes) {
    for (const m of stripComments(c.text).matchAll(/(?<![\w-])(pn-[a-z-]+|dd-btn(?:-[a-z]+)?|sk)(?![\w-])/g)) leftovers.push(`${rel(c.file)}: ${m[1]}`);
  }
  if (leftovers.length) die('Masih ada sisa kelas lama setelah transformasi:\n  ' + [...new Set(leftovers)].join('\n  '));

  const cssBefore = css.split('\n').length;
  const cssAfter = newCss.split('\n').length;
  log(DRY ? '\n[DRY] fase2 akan:' : '\nfase2 menjalankan:');
  log(`  tulis ulang ${rel(CSS_FILE)}   ${cssBefore} → ${cssAfter} baris  (${removedRules} aturan dibuang, +@theme inline ${THEME_COLORS.length} warna + shadow-dd + animate-sk)`);
  log(`  baru        ${rel(PN_TS)}   pnCard, pnEmpty, pnTable`);
  log(`  ubah        ${changes.length} file TSX/TS   (${stats.tokens} kelas → utilitas, ${stats.consts} → konstanta pn.ts)`);
  log('\n  Pemakaian per kelas:');
  for (const [k, v] of Object.entries(stats.byClass).sort((a, b) => b[1] - a[1])) log(`    ${k.padEnd(14)} ${String(v).padStart(3)}×`);
  log(`  (+ konstanta: ${stats.consts}×  pn-card/pn-empty/pn-table)`);
  log(`  Kelas mati dibuang tanpa pengganti: ${DEAD.join(', ')}`);
  if (DRY) {
    log('\n[DRY] Tidak ada yang ditulis.\n');
    return;
  }

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
  const pn = pnTsSource();
  manifest.files.push({ path: rel(PN_TS), action: 'created', sha: sha(pn) });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  fs.writeFileSync(CSS_FILE, newCss);
  fs.mkdirSync(path.dirname(PN_TS), { recursive: true });
  fs.writeFileSync(PN_TS, pn);
  for (const c of changes) fs.writeFileSync(c.file, c.text);

  log(`\n✔ fase2 selesai. Backup: ${rel(BACKUP_DIR)}/`);
  log('  Cek: npx tsc --noEmit && npm run build, lalu lihat Penanganan, Inventory, Master Data, Laporan Foto (terang & gelap).');
  log('  Verifikasi tampilan otomatis (opsional): node scripts/fase2.mjs --verify');
  log('  Batal: node scripts/fase2.mjs --revert\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY (opsional): bandingkan computed style LAMA vs BARU di Chromium.
//   node scripts/fase2.mjs --verify
// Menggantikan 4 langkah manual lama (extract2.mjs + fixtures.mjs + compare2.py + build dua project).
// Butuh: Python 3 + `pip install playwright` + `playwright install chromium` (minta izin dulu).
// Tidak menyentuh project-mu: semua dikerjakan di salinan sementara.
// ─────────────────────────────────────────────────────────────────────────────

/** Dulu extract2.mjs: ambil semua "grup class" (className / cn(...) / literal) dari satu tree project. */
function extractGroups(root, babel) {
  const CN = new Set(['cn','clsx','twMerge','classNames','cva']);
  function lits(node, o){ if(!node||typeof node!=='object')return; if(Array.isArray(node)) return node.forEach(n=>lits(n,o));
    if(node.type==='StringLiteral') o.push([node.start+1,node.end-1]); else if(node.type==='TemplateElement') o.push([node.start,node.end]);
    for(const k of Object.keys(node)){ if(k==='loc'||k==='extra'||k.endsWith('Comments'))continue; const v=node[k]; if(v&&typeof v==='object') lits(v,o);} }
  function groups(ast){ const g=[], seen=new Set();
    const visit=(n)=>{ if(!n||typeof n!=='object')return; if(Array.isArray(n)) return n.forEach(visit); if(n.type==='ImportDeclaration') return;
      let l=null; let constText=null;
      if(n.type==='JSXAttribute'&&n.name?.name==='className'&&n.value){ const ex=n.value.type==='JSXExpressionContainer'?n.value.expression:null; if(ex&&ex.type==='Identifier'&&PNC[ex.name]){ g.push([['CONST',PNC[ex.name]]]); seen.add(n.value.start); return; } l=[];lits(n.value,l);} else if(n.type==='CallExpression'&&n.callee?.type==='Identifier'&&CN.has(n.callee.name)){l=[];lits(n.arguments,l);}
      if(l&&l.length){const f=l.filter(x=>!seen.has(x[0])); f.forEach(x=>seen.add(x[0])); if(f.length) g.push(f);}
      for(const k of Object.keys(n)){ if(k==='loc'||k==='extra'||k.endsWith('Comments'))continue; const v=n[k]; if(v&&typeof v==='object') visit(v);}
      if(n.type==='StringLiteral'&&!seen.has(n.start+1)){seen.add(n.start+1); g.push([[n.start+1,n.end-1]]);}
      else if(n.type==='TemplateElement'&&!seen.has(n.start)){seen.add(n.start); g.push([[n.start,n.end]]);} };
    visit(ast.program); return g; }
  function walk(d,a=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p,a); else if(/\.tsx?$/.test(e.name)&&!e.name.endsWith('.d.ts')) a.push(p);} return a.sort(); }
  const PNC=(()=>{ const f=path.join(root,'resources/js/components/ui/pn.ts'); if(!fs.existsSync(f)) return {}; const code=fs.readFileSync(f,'utf8').replace(/export const/g,'const'); return new Function(code+'; return {pnCard,pnEmpty,pnTable};')(); })();
  const res=[];
  for(const f of walk(path.join(root,'resources/js'))){ if(f.endsWith('components/ui/pn.ts')) continue; const src=fs.readFileSync(f,'utf8'); const ast=babel.parse(src,{sourceType:'module',plugins:f.endsWith('.tsx')?['typescript','jsx']:['typescript']});
    for(const g of groups(ast)){ const line=g[0][0]==='CONST'?0:src.slice(0,g[0][0]).split('\n').length;
      const text=g.map(([s,e])=>s==='CONST'?e:src.slice(s,e)).join(' ').replace(/\s+/g,' ').trim(); res.push({file:path.relative(root,f),line,kind:'group',text});
      if(g.length>1&&g[0][0]!=='CONST') for(const [s,e] of g) res.push({file:path.relative(root,f),line,kind:'lit',text:src.slice(s,e).replace(/\s+/g,' ').trim()}); } }
  return res;
}

/** Dulu fixtures.mjs: DOM tiruan kelas lama + versi baru lewat mapClassString. */
function buildFixtures() {
  const th = (c='', t='Kolom') => `<th${c?` class="${c}"`:''}>${t}</th>`;
  const tdrow = (late, last) => `<tr${late?' class="is-late"':''}>
    <td><div class="pn-aset"><span class="pn-ico" style="--c:#2FA45E"><svg width="16" height="16"></svg></span><div><p class="pn-kode">INV-001</p><p class="pn-jenis">Rusak ringan</p></div></div></td>
    <td class="pn-strong">Laptop Dell</td><td class="pn-trunc">Layar bergaris dan sering mati sendiri saat dipakai lama sekali sekali sekali sekali</td>
    <td class="pn-nowrap">12 Mei 2025</td><td class="pn-strong pn-nowrap">Rp 1.500.000</td><td class="pn-mono">STR-0099</td><td class="text-center">3</td>
    <td><div class="pn-lama${late?' is-late':''}"><div class="pn-lama-t"><div class="pn-lama-f" style="width:60%"></div></div><span class="pn-lama-n">12 hari</span></div></td>
    <td><div class="pn-act"><button type="button" class="pn-btn">Detail</button><button type="button" class="pn-btn pn-btn-primary">Terima</button></div></td></tr>`;
  const fixtures = {
    tabel: `<div class="pn-card"><div class="hidden sm:block pn-scroll"><table class="pn-table"><thead><tr>${th()}${th('text-center')}${th('pn-r','Aksi')}</tr></thead><tbody>${tdrow(false)}${tdrow(true)}${tdrow(false)}</tbody></table></div></div>`,
    kosong: `<div class="pn-card"><p class="pn-empty">Belum ada data.</p></div><div class="pn-empty">Tidak ada laporan.</div>`,
    header: `<div class="pn-head"><div><h2 class="pn-title">Penanganan Inventory</h2><p class="pn-sub">Lacak setiap laporan kerusakan dari menunggu sampai selesai dengan rapi.</p></div><div class="pn-head-act"><button type="button" class="dd-btn">Export</button><button type="button" class="dd-btn" disabled>Import</button><button type="button" class="dd-btn dd-btn-primary">Baru</button><button type="button" class="dd-btn dd-btn-sm">Kecil</button><button type="button" class="dd-btn dd-btn-sm dd-btn-primary">Kecil P</button></div></div>`,
    warn: `<p class="pn-warn">3 laporan terlambat</p><p class="pn-warn is-ok">Semua tepat waktu</p>`,
    papan: `<div class="pn-board"><div class="pn-col"><div class="pn-col-h" style="--c:#5B4A9B"><span class="pn-col-n">4</span><h3 class="pn-col-t">Menunggu</h3><span class="pn-col-s">sub</span></div>
      <div class="pn-bcard"><div class="pn-bcard-in"><div class="pn-bcard-top"><p class="pn-kode pn-trunc-s">INV-1 <span class="pn-jenis"> · ringan</span></p><button type="button" class="pn-chev">v</button></div><p class="pn-strong pn-trunc-s">Nama unit yang cukup panjang sekali untuk dipotong</p><p class="pn-trunc-s">Keluhan</p><div class="pn-bcard-foot"><div class="pn-lama"><div class="pn-lama-t"><div class="pn-lama-f" style="width:40%"></div></div><span class="pn-lama-n">5 hari</span></div><button type="button" class="pn-link">Terima</button></div></div>
        <div class="pn-bcard-x"><div class="pn-brow"><span>Tanggal</span><span class="pn-strong">12 Mei</span></div><div class="pn-act"><button type="button" class="pn-btn">Cetak</button><button type="button" class="pn-btn pn-btn-primary">Detail</button></div></div></div>
      <div class="pn-bcard is-late is-drag"><div class="pn-bcard-in"><div class="pn-bcard-top"><p class="pn-kode pn-trunc-s">INV-2</p></div><div class="pn-lama is-late"><div class="pn-lama-t"><div class="pn-lama-f" style="width:100%"></div></div><span class="pn-lama-n">30 hari</span></div></div></div>
      <div class="pn-drop">Kosong</div><div class="pn-drop is-on">Seret ke sini</div></div></div>`,
    skeleton: `<div class="sk" style="height:12px;width:120px"></div><div class="sk rounded-full" style="height:24px;width:24px"></div>`,
  };
  const old = Object.entries(fixtures).map(([k, v]) => `<section data-f="${k}">${v}</section>`).join('\n');
  const neu = old.replace(/class="([^"]*)"/g, (_, c) => `class="${mapClassString(c)}"`);
  return { old, neu };
}

/** Dulu compare2.py (tidak diubah). */
const COMPARE_PY = String.raw`# pemakaian: python3 compare2.py old.css new.css old.json new.json fix_old.html fix_new.html out.json
import json, sys, re, collections
from playwright.sync_api import sync_playwright
OLD_CSS = open(sys.argv[1]).read(); NEW_CSS = open(sys.argv[2]).read()
old = json.load(open(sys.argv[3])); new = json.load(open(sys.argv[4]))
FIX_OLD = open(sys.argv[5]).read(); FIX_NEW = open(sys.argv[6]).read(); OUT = sys.argv[7]
NOANIM = '<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>'
WRAPPERS = ['pn', 'dv dd-v4', 'dv']
VIEWPORTS = [1400, 800, 420]

READ = """
([sel, props_skip, within]) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', {willReadFrequently:true});
  const rgba = (s) => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0,0,1,1); return Array.from(cx.getImageData(0,0,1,1).data).join(','); };
  const COLOR = /(^|-)color$|^fill$|^stroke$/;
  const els = within ? Array.from(within === 'ALL' ? document.querySelectorAll(sel) : document.querySelectorAll(sel)) : [];
  return els.map(el => { const cs = getComputedStyle(el); const o = {};
    for (const p of cs) { if (p.startsWith('--')) continue; let v = cs.getPropertyValue(p); if (COLOR.test(p)) v = rgba(v); o[p] = v; }
    o['@tag'] = el.tagName + '.' + (typeof el.className === 'string' ? el.className.slice(0,40) : ''); return o; });
}
"""
def norm_shadow(v):
    parts, depth, cur = [], 0, ''
    for ch in v:
        if ch == '(' : depth += 1
        if ch == ')' : depth -= 1
        if ch == ',' and depth == 0: parts.append(cur.strip()); cur = ''
        else: cur += ch
    parts.append(cur.strip())
    keep = [p for p in parts if p and p != 'none' and not re.match(r'^(rgba\(0, 0, 0, 0\)|transparent|color\(srgb 0 0 0 / 0\)) 0px 0px 0px 0px( inset)?$', p)]
    return ', '.join(keep)

LOGICAL = {'block-start': 'top', 'block-end': 'bottom', 'inline-start': 'left', 'inline-end': 'right'}
def fullradius(v, el):
    if v.endswith('px') and float(v[:-2]) >= 999: return 'FULL'
    if v == '50%' and el.get('width') == el.get('height'): return 'FULL'
    return v
def cmp_el(a, b):
    d = []
    for p in a:
        if p == '@tag': continue
        va, vb = a[p], b.get(p)
        m = re.match(r'border-(top|right|bottom|left)-(color|style)$', p)
        if m and a[f'border-{m.group(1)}-width'] == '0px' and b[f'border-{m.group(1)}-width'] == '0px': continue
        m = re.match(r'border-(block|inline)-(start|end)-(color|style|width)$', p)
        if m: continue   # properti logis = padanan fisik yang sudah dibandingkan
        if 'radius' in p: va, vb = fullradius(va, a), fullradius(vb, b)
        if p == 'box-shadow': va, vb = norm_shadow(va), norm_shadow(vb)
        if va != vb:
            if re.match(r'^\d+,\d+,\d+,\d+$', va or '') and re.match(r'^\d+,\d+,\d+,\d+$', vb or ''):
                if all(abs(int(x) - int(y)) <= 2 for x, y in zip(va.split(','), vb.split(','))): continue
            d.append((p, va, vb))
    return d

def page_html(css, dark, wrapper, body):
    return f'<!doctype html><html class="{"dark" if dark else ""}"><head><meta charset="utf-8"><style>{css}</style>{NOANIM}</head><body><div class="{wrapper}" id="w">{body}</div></body></html>'

def run_fixtures(br):
    diffs = []; n = 0
    for dark in (False, True):
        for wrap in WRAPPERS:
            for vw in VIEWPORTS:
                res = {}
                for ver, css, body in (('old', OLD_CSS, FIX_OLD), ('new', NEW_CSS, FIX_NEW)):
                    pg = br.new_page(viewport={'width': vw, 'height': 900}); pg.set_content(page_html(css, dark, wrap, body))
                    base = pg.evaluate(READ, ['#w *', [], 'ALL'])
                    # hover pada tiap button/tr/.pn-link/.pn-chev (indeks DOM, sama di versi lama & baru)
                    idx = pg.evaluate("Array.from(document.querySelectorAll('#w *')).map((e,i)=>/^(BUTTON|TR|A)$/.test(e.tagName)?i:-1).filter(i=>i>=0)")
                    cdp = pg.context.new_cdp_session(pg); cdp.send('DOM.enable'); cdp.send('CSS.enable'); root = cdp.send('DOM.getDocument', {'depth': 1})['root']['nodeId']
                    nodes = cdp.send('DOM.querySelectorAll', {'nodeId': root, 'selector': '#w *'})['nodeIds']
                    hov = {}
                    for i in idx:
                        cdp.send('CSS.forcePseudoState', {'nodeId': nodes[i], 'forcedPseudoClasses': ['hover']})
                        hov[i] = pg.evaluate("(i)=>{const els=document.querySelectorAll('#w *'); const out=[]; const root=els[i]; for(const el of [root,...root.querySelectorAll('*')]){} return 0}", i)
                        # baca target + turunannya
                        hov[i] = pg.evaluate("""([i,props_skip])=>{const els=document.querySelectorAll('#w *'); const root=els[i]; const cv=document.createElement('canvas'); cv.width=cv.height=1; const cx=cv.getContext('2d',{willReadFrequently:true});
                          const rgba=s=>{cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=s;cx.fillRect(0,0,1,1);return Array.from(cx.getImageData(0,0,1,1).data).join(',')}; const COLOR=/(^|-)color$|^fill$|^stroke$/;
                          return [root,...root.querySelectorAll('*')].map(el=>{const cs=getComputedStyle(el); const o={}; for(const p of cs){ if(p.startsWith('--'))continue; let v=cs.getPropertyValue(p); if(COLOR.test(p)) v=rgba(v); o[p]=v;} o['@tag']=el.tagName; return o;})}""", [i, []])
                        cdp.send('CSS.forcePseudoState', {'nodeId': nodes[i], 'forcedPseudoClasses': []})
                    res[ver] = (base, hov); pg.close()
                (bo, ho), (bn, hn) = res['old'], res['new']
                if len(bo) != len(bn): diffs.append(('STRUKTUR', dark, wrap, vw, len(bo), len(bn))); continue
                for k, (a, b) in enumerate(zip(bo, bn)):
                    n += 1
                    for d in cmp_el(a, b): diffs.append(('fixture-base', dark, wrap, vw, a['@tag'], k) + d)
                for i in ho:
                    for k, (a, b) in enumerate(zip(ho[i], hn[i])):
                        n += 1
                        for d in cmp_el(a, b): diffs.append(('fixture-hover', dark, wrap, vw, a['@tag'], i, k) + d)
    return n, diffs

def run_pairs(br):
    pairs = collections.OrderedDict()
    for a, b in zip(old, new):
        if a['text'] != b['text']: pairs.setdefault((a['text'], b['text']), f"{a['file']}:{a['line']}")
    items = list(pairs.items()); n = 0; diffs = []
    TAGS = ['div', 'button', 'input']
    for dark in (False, True):
        for wrap in ('pn', 'dv dd-v4'):
            res = {}
            for ver, css, which in (('old', OLD_CSS, 0), ('new', NEW_CSS, 1)):
                body = ''.join(f'<div class="CLS"></div>' for _ in [])
                pg = br.new_page(viewport={'width': 1400, 'height': 900})
                pg.set_content(page_html(css, dark, wrap, ''))
                pg.evaluate("""([items,tags])=>{const c=document.getElementById('w'); items.forEach((cls,i)=>tags.forEach((t,j)=>{const e=document.createElement(t); e.className=cls; e.setAttribute('data-k',i+'-'+j); if(t==='input') e.type='text'; c.appendChild(e);}))}""", [[k[which] for k, _ in items], TAGS])
                res[ver] = {'base': pg.evaluate(READ, ['#w > *', [], 'ALL']), 'dis': None}
                pg.evaluate("document.querySelectorAll('#w > button, #w > input').forEach(e=>e.setAttribute('disabled',''))")
                res[ver]['dis'] = pg.evaluate(READ, ['#w > *', [], 'ALL'])
                pg.close()
            for st in ('base', 'dis'):
                for k, (a, b) in enumerate(zip(res['old'][st], res['new'][st])):
                    n += 1; i, j = divmod(k, len(TAGS))
                    if st == 'dis' and TAGS[j] == 'div': continue
                    for d in cmp_el(a, b): diffs.append(('kelas-' + st, dark, wrap, TAGS[j], items[i][1], items[i][0][0][:110], items[i][0][1][:110]) + d)
    return n, diffs

with sync_playwright() as pw:
    br = pw.chromium.launch()
    nf, df = run_fixtures(br); npair, dp = run_pairs(br); br.close()
json.dump({'fixture': df, 'pairs': dp}, open(OUT, 'w'), ensure_ascii=False, indent=0)
print('fixture: elemen dibandingkan', nf, '| selisih', len(df)); print('pasangan kelas: elemen dibandingkan', npair, '| selisih', len(dp))
`;

function findPython() {
  for (const c of ['python3', 'python', 'py']) {
    const r = spawnSync(c, ['-c', 'import sys;print(sys.version_info[0])'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim() === '3') return c;
  }
  return null;
}

function buildCss(dir, label) {
  log(`  build ${label} …`);
  const r = spawnSync('npm', ['run', 'build'], { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) die(`npm run build gagal di versi ${label}:\n` + (r.stdout + r.stderr).split('\n').slice(-25).join('\n'));
  const assets = path.join(dir, 'public', 'build', 'assets');
  const css = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => f.endsWith('.css')) : [];
  if (!css.length) die(`CSS hasil build ${label} tidak ditemukan di public/build/assets.`);
  css.sort((a, b) => fs.statSync(path.join(assets, b)).size - fs.statSync(path.join(assets, a)).size);
  return path.join(assets, css[0]);
}

function verify() {
  if (!fs.existsSync(MANIFEST)) die('fase2 belum dijalankan (manifest tidak ada). Jalankan dulu: node scripts/fase2.mjs');
  const req = createRequire(path.join(ROOT, 'package.json'));
  let babel;
  try {
    babel = req('@babel/parser');
  } catch {
    die('Butuh @babel/parser di node_modules. Jalankan: npm ci');
  }
  const py = findPython();
  if (!py) die('Python 3 tidak ditemukan (sudah dicoba: python3, python, py).');
  const chk = spawnSync(py, ['-c', 'from playwright.sync_api import sync_playwright as s\np = s().start()\nb = p.chromium.launch()\nb.close()\np.stop()'], { encoding: 'utf8' });
  if (chk.status !== 0) die('Playwright / Chromium belum siap. Jalankan:\n    pip install playwright\n    playwright install chromium\n  (butuh izin kamu karena mengunduh browser)\n\n' + (chk.stderr || '').split('\n').slice(-4).join('\n'));

  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'fase2-verify-'));
  const lama = path.join(W, 'lama');
  const baru = path.join(W, 'baru');
  const SKIP = new Set(['node_modules', 'vendor', '.git', '.migrasi-backup', 'storage', 'docs', 'scripts']);
  const copy = (dest) =>
    fs.cpSync(ROOT, dest, {
      recursive: true,
      filter: (p) => {
        const r = path.relative(ROOT, p).split(path.sep);
        if (r[0] && SKIP.has(r[0])) return false;
        return !(r[0] === 'public' && r[1] === 'build');
      },
    });
  log('\nverify fase2 — kerja di salinan sementara: ' + W);
  copy(baru);
  copy(lama);
  // LAMA = project sekarang dengan file hasil fase2 dikembalikan dari backup (sebelum fase2)
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const f of manifest.files) {
    const dst = path.join(lama, f.path);
    if (f.action === 'created') fs.rmSync(dst, { force: true });
    else fs.copyFileSync(path.join(BACKUP_DIR, f.path), dst);
  }
  for (const d of [lama, baru]) fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'), 'junction');

  const oldCss = buildCss(lama, 'LAMA');
  const newCss = buildCss(baru, 'BARU');
  log(`  ukuran CSS build: ${fs.statSync(oldCss).size} → ${fs.statSync(newCss).size} byte`);

  log('  ekstrak kelas TSX …');
  const oldJson = path.join(W, 'old.json');
  const newJson = path.join(W, 'new.json');
  fs.writeFileSync(oldJson, JSON.stringify(extractGroups(lama, babel)));
  fs.writeFileSync(newJson, JSON.stringify(extractGroups(baru, babel)));
  const { old, neu } = buildFixtures();
  fs.writeFileSync(path.join(W, 'fix_old.html'), old);
  fs.writeFileSync(path.join(W, 'fix_new.html'), neu);
  fs.writeFileSync(path.join(W, 'compare2.py'), COMPARE_PY);

  log('  bandingkan di Chromium (bisa beberapa menit) …');
  const outJson = path.join(W, 'out.json');
  const r = spawnSync(py, ['compare2.py', oldCss, newCss, oldJson, newJson, 'fix_old.html', 'fix_new.html', outJson], {
    cwd: W,
    stdio: 'inherit',
    env: { ...process.env, PYTHONUTF8: '1' },
  });
  if (r.status !== 0) die(`compare2.py gagal (kode ${r.status}). Salinan kerja dibiarkan di ${W} untuk diperiksa.`);

  const out = JSON.parse(fs.readFileSync(outJson, 'utf8'));
  const by = (arr, dark) => arr.filter((x) => x[1] === dark).length;
  const keep = path.join(BACKUP_DIR, 'verify-diffs.json');
  fs.copyFileSync(outJson, keep);
  const light = by(out.fixture, false) + by(out.pairs, false);
  log('\nHasil selisih computed style');
  log(`  fixture DOM     terang ${by(out.fixture, false)}   gelap ${by(out.fixture, true)}`);
  log(`  pasangan kelas  terang ${by(out.pairs, false)}   gelap ${by(out.pairs, true)}`);
  log(`  rincian lengkap: ${rel(keep)}`);
  if (light > 0) {
    // ringkas per elemen/kelas lama: properti apa yang berbeda (tuple mentah ada di verify-diffs.json)
    const grp = new Map();
    for (const x of out.fixture.filter((y) => y[0] === 'fixture-base' && y[1] === false)) {
      const k = 'fixture  ' + x[4];
      (grp.get(k) ?? grp.set(k, new Set()).get(k)).add(`${x[6]}: ${x[7]} → ${x[8]}`);
    }
    for (const x of out.fixture.filter((y) => y[0] === 'fixture-hover' && y[1] === false)) {
      const k = 'fixture  (hover, elemen ke-' + x[5] + ')';
      (grp.get(k) ?? grp.set(k, new Set()).get(k)).add(x[7]);
    }
    for (const x of out.pairs.filter((y) => y[1] === false)) {
      const k = 'kelas    ' + x[5].slice(0, 60);
      (grp.get(k) ?? grp.set(k, new Set()).get(k)).add(x[7]);
    }
    log('\n  Mode terang harus 0. Selisih dikelompokkan per elemen / kelas lama (periksa satu per satu):');
    for (const [k, v] of grp) log(`   - ${k}  →  ${[...v].slice(0, 4).join(' | ')}${v.size > 4 ? ' …' : ''}`);
    log('\n  Catatan: kelas yang diuji terlepas dari konteks aslinya (mis. pn-r di luar <th>, pn-col-h tanpa --c, kelas yang tidak dipakai TSX)');
    log('  bisa menghasilkan selisih palsu. Cocokkan dengan pemakaian nyata di TSX sebelum menganggapnya bug.');
    process.exitCode = 1;
  } else log('\n  ✔ Mode terang: 0 selisih.');
  fs.rmSync(W, { recursive: true, force: true });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  VERIFY ? verify() : REVERT ? revert() : apply();
}
