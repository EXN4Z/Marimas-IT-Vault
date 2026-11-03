#!/usr/bin/env node
/**
 * lighthouse-all.mjs
 *
 * Scan semua halaman Marimas IT Vault pakai Lighthouse CLI, satu laporan HTML + JSON per halaman,
 * lalu cetak ringkasan skor dan simpan ke lh-reports/<waktu>/ringkasan.md.
 *
 * Syarat:
 *   - App jalan dari BUILD PRODUCTION (npm run build), bukan `vite dev`.
 *   - Sesi harus sudah login. Paling gampang: terapkan dulu scripts/dummy-autologin.mjs
 *     (dan dummy-dashboard.mjs kalau dashboard mau terisi), revert setelah selesai.
 *   - Chrome/Edge terpasang. Lighthouse diunduh otomatis lewat npx.
 *
 * Pemakaian (dari root project):
 *   node scripts/lighthouse-all.mjs
 *   node scripts/lighthouse-all.mjs --base=http://10.10.1.4:8015
 *   node scripts/lighthouse-all.mjs --mobile                 # default desktop
 *   node scripts/lighthouse-all.mjs --only=dashboard,laporan # filter berdasarkan nama/slug
 *   node scripts/lighthouse-all.mjs --out=./hasil-lh
 *
 * Halaman yang ter-redirect ke /login ditandai "LOGIN" (artinya yang discan halaman login, bukan halaman aslinya).
 */
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const BASE = opt('base', 'http://10.10.1.4:8015').replace(/\/$/, '');
const MOBILE = args.includes('--mobile');
const ONLY = opt('only', '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const OUT = path.resolve(opt('out', path.join('lh-reports', stamp)));

// Sumber: routes/web/*.php + resources/js/layouts/navigation.ts
const PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Penanganan Inventory', path: '/penanganan-inventory' },
  { name: 'Laporan - Export Data', path: '/laporan?tab=export_data' },
  { name: 'Laporan - Foto Inventory', path: '/laporan?tab=foto_inventory' },
  { name: 'Laporan - Riwayat Inventory', path: '/laporan?tab=riwayat_inventory' },
  { name: 'Master Data - Inventory', path: '/master-data?tab=inventory' },
  { name: 'Master Data - Kategori', path: '/master-data?tab=kategori' },
  { name: 'Master Data - Data User', path: '/master-data?tab=karyawan' },
  { name: 'Master Data - Cabang', path: '/master-data?tab=cabang' },
  { name: 'Master Data - Perusahaan', path: '/master-data?tab=perusahaan' },
  { name: 'Master Data - Departemen', path: '/master-data?tab=departemen' },
  { name: 'Master Data - Supplier', path: '/master-data?tab=supplier' },
  { name: 'Audit Log', path: '/audit-log' },
  { name: 'Settings', path: '/settings' },
];

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const pages = PAGES.filter((p) => !ONLY.length || ONLY.some((k) => slug(p.name).includes(k) || p.path.includes(k)));

const pct = (v) => (v == null ? '-' : String(Math.round(v * 100)));
const sec = (ms) => (ms == null ? '-' : (ms / 1000).toFixed(1) + 's');

function scan(page) {
  const base = path.join(OUT, slug(page.name));
  const cmd = [
    'npx --yes lighthouse',
    `"${BASE}${page.path}"`,
    MOBILE ? '' : '--preset=desktop',
    '--only-categories=performance,accessibility,best-practices',
    '--output=json --output=html',
    `--output-path="${base}"`,
    '--quiet',
    '--chrome-flags="--headless"',
  ]
    .filter(Boolean)
    .join(' ');
  const r = spawnSync(cmd, { shell: true, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  return { base, ok: r.status === 0, err: (r.stderr || '').trim().split('\n').slice(-2).join(' ') };
}

async function main() {
  if (!pages.length) return console.log('Tidak ada halaman yang cocok dengan --only.');
  await fs.mkdir(OUT, { recursive: true });
  console.log(`Scan ${pages.length} halaman (${MOBILE ? 'mobile' : 'desktop'}) -> ${OUT}\n`);

  const rows = [];
  for (const [i, page] of pages.entries()) {
    process.stdout.write(`[${i + 1}/${pages.length}] ${page.name} ... `);
    const { base, ok, err } = scan(page);
    let lhr = null;
    try {
      lhr = JSON.parse(await fs.readFile(`${base}.report.json`, 'utf8'));
    } catch {
      /* gagal scan */
    }
    if (!ok || !lhr) {
      console.log('GAGAL ' + err);
      rows.push({ name: page.name, path: page.path, failed: true });
      continue;
    }
    const a = lhr.audits;
    const cat = lhr.categories;
    const login = /\/login(\?|$|\/)/.test(lhr.finalDisplayedUrl || lhr.finalUrl || '');
    const row = {
      name: page.name,
      path: page.path,
      login,
      perf: pct(cat.performance?.score),
      a11y: pct(cat.accessibility?.score),
      bp: pct(cat['best-practices']?.score),
      fcp: sec(a['first-contentful-paint']?.numericValue),
      lcp: sec(a['largest-contentful-paint']?.numericValue),
      tbt: Math.round(a['total-blocking-time']?.numericValue ?? 0) + 'ms',
      cls: (a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3),
    };
    rows.push(row);
    console.log(`perf ${row.perf} / a11y ${row.a11y} / bp ${row.bp}${login ? '  <- LOGIN (bukan halaman asli)' : ''}`);
  }

  const head = ['Halaman', 'Perf', 'A11y', 'BP', 'FCP', 'LCP', 'TBT', 'CLS', 'Catatan'];
  const lines = rows.map((r) =>
    r.failed
      ? [r.name, '-', '-', '-', '-', '-', '-', '-', 'GAGAL scan']
      : [r.name, r.perf, r.a11y, r.bp, r.fcp, r.lcp, r.tbt, r.cls, r.login ? 'LOGIN: sesi tidak aktif' : ''],
  );
  const md = [
    `# Ringkasan Lighthouse (${MOBILE ? 'mobile' : 'desktop'}) - ${stamp}`,
    `Base: ${BASE}`,
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...lines.map((l) => `| ${l.join(' | ')} |`),
    '',
    'Laporan lengkap per halaman: file .report.html di folder ini.',
  ].join('\n');
  await fs.writeFile(path.join(OUT, 'ringkasan.md'), md);

  console.log('\n' + md);
  if (rows.some((r) => r.login)) {
    console.log('\nAda halaman yang ter-redirect ke /login. Pastikan autologin aktif (scripts/dummy-autologin.mjs) lalu ulangi.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
