#!/usr/bin/env node
// script-logo.mjs -- turunkan logo Marimas di sidebar sedikit.
//   node script-logo.mjs            # turun 0.5rem (8px)  -> top-2
//   node script-logo.mjs --step 3   # lebih turun: top-3 (12px). Pilihan: 1 (4px) .. 6 (24px)
// Jalankan dari root project (folder yang ada package.json). Aman diulang; ganti --step untuk geser lagi.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const si = args.indexOf('--step');
const step = si >= 0 ? Number(args[si + 1]) : 2;
if (!Number.isInteger(step) || step < 1 || step > 6) {
  console.error('x --step harus angka 1 sampai 6');
  process.exit(1);
}
const file = path.join(process.cwd(), 'resources', 'js', 'layouts', 'sidebar', 'Sidebar.tsx');
if (!fs.existsSync(file)) {
  console.error('x Sidebar.tsx tidak ketemu. Jalankan dari root project (folder yang ada package.json).');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

// <img ... src={`/logo.png`} ... className="h-18 w-auto p-1" /> (+ kemungkinan relative top-N dari run sebelumnya)
const re = /(<img src=\{`\/logo\.png`\}[^>]*?className=")h-18 w-auto p-1(?: relative top-\d)?(")/;
if (!re.test(src)) {
  console.error('x Anchor logo tidak ketemu di Sidebar.tsx (file sudah berubah?). Kirim isi bagian <img> logo ke chat.');
  process.exit(2);
}
const out = src.replace(re, `$1h-18 w-auto p-1 relative top-${step}$2`);
if (out === src) {
  console.log(`= Sudah top-${step}, tidak ada yang diubah.`);
  process.exit(0);
}
const backup = path.join(process.cwd(), '.logo-backup', 'Sidebar.tsx');
if (!fs.existsSync(backup)) {
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(file, backup);
}
fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
console.log(`~ Logo diturunkan: relative top-${step} (${step * 4}px). Backup: .logo-backup/Sidebar.tsx`);
