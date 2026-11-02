#!/usr/bin/env node
/**
 * fix-modal-overlay.mjs
 *
 * Memperbaiki bug semua modal form di Marimas ONE:
 *   1. Latar belakang jadi biru + blur  -> backdrop netral `bg-black/50`, tanpa backdrop-blur.
 *   2. Modal tidak tepat di tengah layar -> akar masalahnya `.mv .pg { animation: ... both }`
 *      (fill-mode `both` menahan `transform`, sehingga `.pg` jadi containing block untuk
 *      `position: fixed`; modal jadi ikut posisi halaman, bukan viewport).
 *      Juga `Modal.tsx` yang `items-start` di mobile.
 *
 * Pemakaian (dari root project):
 *   node fix-modal-overlay.mjs            # terapkan perbaikan
 *   node fix-modal-overlay.mjs --dry-run  # cuma tampilkan apa yang akan berubah
 *   node fix-modal-overlay.mjs /path/ke/project
 *
 * Aman dijalankan berulang kali (idempotent).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const JS_DIR = path.join(ROOT, 'resources', 'js');

const changes = [];

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      out.push(...(await walk(p)));
    } else if (e.isFile() && p.endsWith('.tsx')) {
      out.push(p); // .tsx.bak otomatis terlewat
    }
  }
  return out;
}

async function patch(file, transform, label) {
  const before = await fs.readFile(file, 'utf8');
  const { text, count } = transform(before);
  if (text === before) return;
  changes.push(`${path.relative(ROOT, file)}  (${label}${count ? `, ${count} baris` : ''})`);
  if (!DRY) await fs.writeFile(file, text, 'utf8');
}

/* ---------- 1) Backdrop semua modal: netral, tanpa blur ---------- */
function fixBackdrops(src) {
  let count = 0;
  const text = src
    .split('\n')
    .map((line) => {
      if (!line.includes('fixed inset-0')) return line;
      if (/bg-black\/(8|9)\d/.test(line)) return line; // viewer foto zoom sengaja gelap pekat
      let next = line
        .replace(/\bbg-(?:slate-950|slate-900|black)\/(?:40|50|60)\b/g, 'bg-black/50')
        .replace(/\s+backdrop-blur-(?:\[2px\]|sm)(?=[\s"'`}]|$)/g, '');
      if (next !== line) count++;
      return next;
    })
    .join('\n');
  return { text, count };
}

/* ---------- 2) Modal.tsx: selalu center, bukan items-start di mobile ---------- */
function fixModalAlign(src) {
  const text = src.replace('items-start sm:items-center', 'items-center');
  return { text, count: text === src ? 0 : 1 };
}

/* ---------- 3) index.css: lepas fill-mode yang bikin .pg jadi containing block ---------- */
function fixCss(src) {
  const re = /\.mv \.pg\s*\{\s*animation:\s*mvPg \.22s ease-out both\s*\}/;
  if (!re.test(src)) return { text: src, count: 0 };
  const replacement =
    '/* Tanpa fill-mode (both/forwards): transform yang "tertahan" bikin .pg jadi containing block\n' +
    '   untuk position:fixed, sehingga semua modal di dalamnya tidak center di viewport. */\n' +
    '.mv .pg{animation:mvPg .22s ease-out}';
  return { text: src.replace(re, replacement), count: 1 };
}

async function main() {
  try {
    await fs.access(JS_DIR);
  } catch {
    console.error(`resources/js tidak ditemukan di ${ROOT}. Jalankan dari root project atau kasih path-nya.`);
    process.exit(1);
  }

  await patch(path.join(JS_DIR, 'index.css'), fixCss, 'fix containing block .pg');

  const modalFile = path.join(JS_DIR, 'components', 'modal', 'Modal.tsx');
  try {
    await patch(modalFile, fixModalAlign, 'center di semua ukuran layar');
  } catch {
    /* Modal.tsx tidak ada, lewati */
  }

  for (const f of await walk(JS_DIR)) {
    await patch(f, fixBackdrops, 'backdrop netral tanpa blur');
  }

  console.log(DRY ? '[dry-run] file yang AKAN diubah:' : 'File yang diubah:');
  if (changes.length === 0) console.log('  (tidak ada, sudah bersih)');
  for (const c of changes) console.log('  - ' + c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
