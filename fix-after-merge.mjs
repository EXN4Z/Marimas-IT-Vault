#!/usr/bin/env node
/**
 * Jalankan dari root project (sejajar `artisan`):  node fix-after-merge.mjs
 * Aman dijalankan ulang. Ngapain:
 *  1. `${import.meta.env.BASE_URL}logo.png` -> `/logo.png`
 *     (laravel-vite-plugin ngeset base = /build/ pas production build, jadi BASE_URL
 *      berubah jadi /build/ dan logo bakal 404 di production)
 *  2. index.css: `html, body, #root {` -> `html, body, #root, #app {`
 *     (root element Inertia id-nya #app, biar safety-net overflow-x tetap berlaku)
 */
import fs from 'node:fs';
import path from 'node:path';

const JS = path.resolve('resources/js');
if (!fs.existsSync(JS)) { console.error('resources/js tidak ketemu. Jalankan dari root project.'); process.exit(1); }

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
};

let changed = 0;
for (const f of walk(JS)) {
  const src = fs.readFileSync(f, 'utf8');
  const next = src.replaceAll('${import.meta.env.BASE_URL}logo.png', '/logo.png');
  if (next !== src) { fs.writeFileSync(f, next); console.log('patched', path.relative('.', f)); changed++; }
}

const css = path.join(JS, 'index.css');
if (fs.existsSync(css)) {
  const src = fs.readFileSync(css, 'utf8');
  const next = src.replace('html, body, #root {', 'html, body, #root, #app {');
  if (next !== src) { fs.writeFileSync(css, next); console.log('patched resources/js/index.css'); changed++; }
}
console.log(changed ? `Selesai, ${changed} file diubah.` : 'Tidak ada yang perlu diubah.');
