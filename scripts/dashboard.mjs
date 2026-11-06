#!/usr/bin/env node
/**
 * dashboard.mjs — DASHBOARD: dari 38 file jadi 3 file (+ css), tiap bagian diberi komentar.
 *
 * Jalankan dari ROOT project (folder yang ada resources/js):
 *   node scripts/dashboard.mjs --dry              lihat rencana, tidak menulis apa pun
 *   node scripts/dashboard.mjs                    jalankan
 *   node scripts/dashboard.mjs --revert           kembalikan SEMUA yang diubah dashboard
 *   node scripts/dashboard.mjs --revert --force   revert walau file hasil dashboard sudah kamu edit
 *
 * Hasil:
 *   features/dashboard/DashboardAdmin.tsx   halaman admin utuh (bagian-bagian ditandai komentar ═══)
 *   features/dashboard/DashboardUser.tsx    halaman user utuh
 *   features/dashboard/DashboardShared.tsx  yang dipakai admin DAN user (Panel, Pager, notifikasi, skeleton, ...)
 *   features/dashboard/dashboard.css        = dashboard-v4.css (ganti nama; di-import admin & user)
 *   features/dashboard/widgets/             DIHAPUS (kode dipindah apa adanya, bukan ditulis ulang)
 *
 * Backup ada di .migrasi-backup/dashboard/ (struktur folder sama). Cakupan dashboard cuma features/dashboard,
 * jadi bisa di-revert sendiri tanpa mengganggu skrip lain (inventory dst.) selama tidak ada yang menyentuh
 * file yang sama.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry');
const REVERT = FLAGS.has('--revert');
const FORCE = FLAGS.has('--force');

const PHASE = 'dashboard';
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', PHASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const JS = path.join(ROOT, 'resources', 'js');
const DASH = path.join(JS, 'features', 'dashboard');
const WIDGETS = path.join(DASH, 'widgets');

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

// ─────────────────────────────────────────────────────────────────────────────
// RENCANA: file mana masuk ke file mana, urutan, dan label komentarnya.
// ─────────────────────────────────────────────────────────────────────────────
const PLAN = {
  shared: {
    out: 'DashboardShared.tsx',
    top: [
      'DashboardShared — bagian yang dipakai DashboardAdmin DAN DashboardUser.',
      'Isi (urut dari atas): tema warna · format waktu & gaya aktivitas · meta aktivitas · blok dasar (Panel, EmptyNote,',
      'HeroBanner, LedgerHeader, DotMeter, DotBars) · Pager · baris aktivitas · notifikasi · skeleton loading.',
      'Cari bagian lewat komentar bergaris ═══.',
    ],
    sources: [
      { file: 'widgets/_shared/theme.ts', only: ['THEME'], label: 'TEMA WARNA' },
      { file: 'widgets/aktivitas/aktivitas.ts', only: ['AKTIVITAS_ASET_STYLE', 'formatWaktuSingkat'], label: 'GAYA AKTIVITAS & FORMAT WAKTU SINGKAT' },
      { file: 'widgets/ledger/aktivitasMeta.ts', label: 'META AKTIVITAS (tone, label, jam/tanggal)' },
      { file: 'widgets/ledger/primitives.tsx', label: 'BLOK DASAR (Panel, EmptyNote, HeroBanner, LedgerHeader, DotMeter, DotBars)' },
      { file: 'widgets/ledger/Pager.tsx', label: 'PAGER (halaman ‹ 1 2 3 ›)' },
      { file: 'widgets/ledger/AktivitasLedger.tsx', label: 'BARIS AKTIVITAS (AktivitasRows) — dipakai kalender admin, kalender user, riwayat user' },
      { file: 'widgets/ledger/NotifikasiLedger.tsx', label: 'NOTIFIKASI (panel daftar notifikasi)' },
      { file: 'widgets/_shared/DashboardSkeleton.tsx', label: 'SKELETON LOADING (tampil selama data deferred belum datang)' },
    ],
  },
  admin: {
    out: 'DashboardAdmin.tsx',
    entry: 'DashboardAdmin.tsx',
    map: [
      'PETA HALAMAN ADMIN (dua kolom) — tiap bagian punya komentar bergaris ═══ di bawah:',
      '  KOLOM KIRI   1. HERO (total + chart pembelian) · 2. KPI (kartu angka) · 3. AKTIVITAS + KALENDER',
      '  KOLOM KANAN  1. TERBANYAK DIPEGANG · 2. NOTIFIKASI (komponennya di DashboardShared.tsx)',
    ],
    jsxMarks: [
      { startsWith: '<HeroInventory', text: 'KOLOM KIRI · 1. HERO' },
      { startsWith: '<KpiDots', text: 'KOLOM KIRI · 2. KPI' },
      { startsWith: '<AktivitasKalender', text: 'KOLOM KIRI · 3. AKTIVITAS + KALENDER' },
      { startsWith: '<TerbanyakDipegang', text: 'KOLOM KANAN · 1. TERBANYAK DIPEGANG' },
      { startsWith: '<NotifikasiLedger', text: 'KOLOM KANAN · 2. NOTIFIKASI (DashboardShared.tsx)' },
    ],
    sources: [
      { file: 'widgets/ledger/HeroInventory.tsx', label: 'KOLOM KIRI · 1. HERO — total inventory + chart tren pembelian + per merek' },
      { file: 'widgets/ledger/KpiDots.tsx', label: 'KOLOM KIRI · 2. KPI — kartu angka (status inventory & perhatian)' },
      { file: 'widgets/ledger/AktivitasKalender.tsx', label: 'KOLOM KIRI · 3. AKTIVITAS + KALENDER — daftar aktivitas terbaru + kalender mutasi' },
      { file: 'widgets/ledger/TerbanyakDipegang.tsx', label: 'KOLOM KANAN · 1. TERBANYAK DIPEGANG — pemegang inventory teratas' },
    ],
  },
  user: {
    out: 'DashboardUser.tsx',
    entry: 'DashboardUser.tsx',
    map: [
      'PETA HALAMAN USER (dari atas ke bawah) — tiap bagian punya komentar bergaris ═══ di bawah:',
      '  1. HEADER + BANNER · 2. DI TANGANMU · 3. RIWAYAT TERBARU · 4. RINGKASAN · 5. KALENDER + NOTIFIKASI',
      '  (Panel, LedgerHeader, HeroBanner, AktivitasRows, NotifikasiLedger ada di DashboardShared.tsx)',
    ],
    jsxMarks: [
      { startsWith: '<LedgerHeader', text: '1. HEADER + BANNER (LedgerHeader & HeroBanner di DashboardShared.tsx)' },
      { startsWith: '<div className="dd-row2', text: 'BARIS TENGAH (kiri: di tanganmu + riwayat · kanan: ringkasan)' },
      { startsWith: '<DiTanganmu', text: '2. DI TANGANMU' },
      { startsWith: '<Panel title="Riwayat terbaru"', text: '3. RIWAYAT TERBARU' },
      { startsWith: '<Panel title="Ringkasan"', text: '4. RINGKASAN' },
      { startsWith: '<KalenderLedger', text: '5. KALENDER + NOTIFIKASI (notifikasi lewat prop aside)' },
    ],
    sources: [
      { file: 'widgets/ledger/DiTanganmu.tsx', label: '2. DI TANGANMU — inventory yang sedang dipegang user' },
      { file: 'widgets/ledger/KalenderLedger.tsx', label: '5. KALENDER + NOTIFIKASI — kalender mutasi milik user (+ slot aside untuk notifikasi)' },
    ],
  },
};

const CSS_OLD = path.join(DASH, 'dashboard-v4.css');
const CSS_NEW = path.join(DASH, 'dashboard.css');
const CSS_SPEC = './dashboard.css';

// ─────────────────────────────────────────────────────────────────────────────
// REVERT
// ─────────────────────────────────────────────────────────────────────────────
function revert() {
  if (!fs.existsSync(MANIFEST)) die('Tidak ada manifest dashboard — belum pernah dijalankan, atau sudah di-revert.');
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  const dirty = [];
  for (const e of m.files) {
    if (e.action === 'deleted') continue;
    const abs = path.join(ROOT, e.path);
    if (fs.existsSync(abs) && sha(fs.readFileSync(abs, 'utf8')) !== e.sha) dirty.push(e.path);
  }
  if (dirty.length && !FORCE) {
    die(`File hasil dashboard ini sudah kamu ubah setelahnya:\n  ${dirty.join('\n  ')}\nRevert akan menimpa perubahan itu. Pakai --revert --force kalau memang mau.`);
  }

  log(DRY ? '\n[DRY] Revert dashboard akan:' : '\nRevert dashboard:');
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
    log('\n✔ Revert selesai. (Salinan backup tetap ada di .migrasi-backup/dashboard/)\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER KECIL (cukup untuk pola kode di project ini: import di kolom 0, export di kolom 0)
// ─────────────────────────────────────────────────────────────────────────────
function splitFile(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const imports = [];
  const body = [];
  for (let i = 0; i < lines.length; ) {
    const l = lines[i];
    if (/^import\s/.test(l)) {
      let stmt = l;
      let j = i;
      const done = (s) => /^import\s+['"][^'"]+['"]\s*;?\s*(\/\/.*)?$/.test(s.trim()) || /\bfrom\s+['"][^'"]+['"]\s*;?\s*(\/\/.*)?$/.test(s.trim());
      while (!done(stmt) && j + 1 < lines.length) {
        j++;
        stmt += ' ' + lines[j].trim();
      }
      imports.push(parseImport(stmt));
      i = j + 1;
    } else {
      body.push(l);
      i++;
    }
  }
  while (body.length && body[0].trim() === '') body.shift();
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  return { eol, imports, body };
}

function parseImport(stmt) {
  const s = stmt.replace(/\s+/g, ' ').trim();
  const side = s.match(/^import ['"]([^'"]+)['"]/);
  if (side) return { spec: side[1], side: true, def: null, ns: null, named: [], typeOnly: false };
  const m = s.match(/^import (type )?(.*?) from ['"]([^'"]+)['"]/);
  if (!m) die(`Tidak bisa membaca import: ${stmt}`);
  const typeOnly = !!m[1];
  const clause = m[2];
  const named = [];
  const brace = clause.match(/\{([^}]*)\}/);
  if (brace) {
    for (let part of brace[1].split(',')) {
      part = part.trim();
      if (!part) continue;
      let t = typeOnly;
      if (/^type\s+/.test(part)) {
        t = true;
        part = part.replace(/^type\s+/, '');
      }
      const [name, alias] = part.split(/\s+as\s+/);
      named.push({ name: name.trim(), alias: alias ? alias.trim() : null, type: t });
    }
  }
  const rest = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
  let def = null;
  let ns = null;
  if (rest.startsWith('* as ')) ns = rest.slice(5).trim();
  else if (rest) def = rest;
  return { spec: m[3], side: false, def, ns, named, typeOnly };
}

const DECL_RE = /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+|const\s+|let\s+|class\s+|interface\s+|type\s+|enum\s+)([A-Za-z_$][\w$]*)/;

function stripExports(lines, fileLabel) {
  return lines.map((l) => {
    if (/^export\s+default\b/.test(l) || /^export\s*\{/.test(l) || /^export\s*\*/.test(l)) {
      die(`${fileLabel}: ada "${l.trim()}" — script ini cuma menangani "export function/const/type/interface".`);
    }
    return l.replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|class|interface|type|enum)\b)/, '');
  });
}

function declaredNames(lines) {
  const out = [];
  for (const l of lines) {
    const m = l.match(DECL_RE);
    if (m) out.push(m[1]);
  }
  return out;
}

function pickOnly(lines, only, fileLabel) {
  const decls = [];
  lines.forEach((l, i) => {
    const m = l.match(DECL_RE);
    if (m) decls.push({ i, name: m[1] });
  });
  const chunks = decls.map((d) => {
    let s = d.i;
    while (s > 0 && /^\s*(\/\/|\/\*|\*)/.test(lines[s - 1])) s--;
    return { name: d.name, s };
  });
  const picked = [];
  for (const name of only) {
    const k = chunks.findIndex((c) => c.name === name);
    if (k < 0) die(`${fileLabel}: deklarasi "${name}" tidak ditemukan.`);
    const end = k + 1 < chunks.length ? chunks[k + 1].s : lines.length;
    const seg = lines.slice(chunks[k].s, end);
    while (seg.length && seg[seg.length - 1].trim() === '') seg.pop();
    picked.push(seg.join('\n'));
  }
  return picked.join('\n\n').split('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// PENGUMPUL IMPORT
// ─────────────────────────────────────────────────────────────────────────────
class ImportMap {
  constructor() {
    this.m = new Map();
  }
  add(spec, { def = null, defType = false, ns = null, named = [], side = false } = {}) {
    let e = this.m.get(spec);
    if (!e) {
      e = { def: null, defType: false, ns: null, named: new Map(), side: false };
      this.m.set(spec, e);
    }
    if (side) e.side = true;
    if (def) {
      e.def = def;
      e.defType = defType;
    }
    if (ns) e.ns = ns;
    for (const n of named) {
      const key = n.alias || n.name;
      const prev = e.named.get(key);
      if (!prev) e.named.set(key, { name: n.name, alias: n.alias, type: n.type });
      else prev.type = prev.type && n.type;
    }
  }
  render() {
    const specs = [...this.m.keys()];
    const isRel = (s) => s.startsWith('.');
    const isCss = (s) => /\.css$/.test(s);
    const order = [...specs.filter((s) => !isRel(s)), ...specs.filter((s) => isRel(s) && !isCss(s)), ...specs.filter(isCss)];
    const lines = [];
    for (const spec of order) {
      const e = this.m.get(spec);
      const named = [...e.named.values()];
      const hasValue = !!e.def || !!e.ns || named.some((n) => !n.type);
      if (!e.def && !e.ns && named.length === 0) {
        lines.push(`import '${spec}';`);
        continue;
      }
      const fmt = (n, inline) => `${inline && n.type ? 'type ' : ''}${n.name}${n.alias ? ` as ${n.alias}` : ''}`;
      if (!hasValue) {
        lines.push(`import type { ${named.map((n) => fmt(n, false)).join(', ')} } from '${spec}';`);
      } else {
        const parts = [];
        if (e.def) parts.push(e.def);
        if (e.ns) parts.push(`* as ${e.ns}`);
        if (named.length) parts.push(`{ ${named.map((n) => fmt(n, true)).join(', ')} }`);
        lines.push(`import ${parts.join(', ')} from '${spec}';`);
      }
    }
    return lines;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY
// ─────────────────────────────────────────────────────────────────────────────
function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (/\.(tsx?|jsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

function read(abs) {
  if (!fs.existsSync(abs)) die(`File sumber tidak ada: ${rel(abs)}\n(Jalankan dari root project? Atau dashboard sudah pernah jalan?)`);
  return fs.readFileSync(abs, 'utf8');
}

const isInsideWidgets = (abs) => abs === WIDGETS || abs.startsWith(WIDGETS + path.sep);

function apply() {
  if (fs.existsSync(MANIFEST)) die('dashboard sudah pernah dijalankan (manifest ada). Pakai --revert dulu kalau mau mengulang.');
  if (!fs.existsSync(WIDGETS)) die('resources/js/features/dashboard/widgets tidak ditemukan. Jalankan dari ROOT project.');
  for (const o of [path.join(DASH, 'DashboardShared.tsx'), CSS_NEW]) {
    if (fs.existsSync(o)) die(`${rel(o)} sudah ada — dashboard tidak menimpa file yang bukan miliknya.`);
  }

  // 1) Baca & siapkan semua sumber
  const G = {};
  for (const [gname, plan] of Object.entries(PLAN)) {
    const g = { name: gname, plan, outPath: path.join(DASH, plan.out), parts: [], entry: null };
    if (plan.entry) {
      const abs = path.join(DASH, plan.entry);
      g.entry = { abs, ...splitFile(read(abs)) };
    }
    for (const s of plan.sources) {
      const abs = path.join(DASH, s.file);
      const sp = splitFile(read(abs));
      let body = stripExports(sp.body, s.file);
      if (s.only) body = pickOnly(body, s.only, s.file);
      g.parts.push({ abs, src: s, imports: sp.imports, body, names: declaredNames(body) });
    }
    G[gname] = g;
  }
  const EOL = G.admin.entry.eol;

  // 2) Peta nama -> grup (untuk menerjemahkan import internal widgets, termasuk lewat barrel index.ts)
  const DECL = new Map();
  for (const g of Object.values(G)) {
    const seenHere = new Map();
    for (const p of g.parts) {
      for (const n of p.names) {
        if (seenHere.has(n)) die(`Nama bentrok dalam ${g.plan.out}: "${n}" ada di ${seenHere.get(n)} dan ${p.src.file}. Ganti salah satu dulu.`);
        seenHere.set(n, p.src.file);
        const owners = DECL.get(n) || new Set();
        // admin vs user boleh punya nama lokal yang sama (beda file); Shared vs lainnya tidak (rancu untuk import)
        for (const o of owners) {
          if (o !== g.name && (o === 'shared' || g.name === 'shared')) die(`Nama "${n}" ada di ${o} dan ${g.name} — rancu untuk import. Ganti salah satu dulu.`);
        }
        owners.add(g.name);
        DECL.set(n, owners);
      }
    }
    if (g.entry) {
      for (const n of declaredNames(g.entry.body)) {
        if (seenHere.has(n)) die(`Nama bentrok di ${g.plan.out}: "${n}" dideklarasi di entry dan di ${seenHere.get(n)}.`);
      }
    }
  }

  // 3) Selesaikan import tiap file → ImportMap grup + daftar nama yang harus diekspor dari Shared
  const neededFromShared = new Set();
  const importMaps = {};
  for (const g of Object.values(G)) {
    const im = new ImportMap();
    importMaps[g.name] = im;
    const files = [...g.parts.map((p) => ({ abs: p.abs, imports: p.imports })), ...(g.entry ? [{ abs: g.entry.abs, imports: g.entry.imports }] : [])];
    for (const f of files) {
      for (const imp of f.imports) {
        if (!imp.spec.startsWith('.')) {
          im.add(imp.spec, { def: imp.def, defType: imp.typeOnly, ns: imp.ns, named: imp.named, side: imp.side });
          continue;
        }
        const abs = path.resolve(path.dirname(f.abs), imp.spec);
        if (isInsideWidgets(abs)) {
          if (imp.def || imp.ns) die(`${rel(f.abs)}: import default/namespace dari widgets (${imp.spec}) tidak didukung.`);
          for (const n of imp.named) {
            if (n.alias) die(`${rel(f.abs)}: import "${n.name} as ${n.alias}" dari widgets tidak didukung.`);
            const owners = DECL.get(n.name);
            if (!owners) die(`${rel(f.abs)}: "${n.name}" (dari ${imp.spec}) tidak ikut digabung — bagian itu dianggap mati. Cek rencana PLAN di dashboard.mjs.`);
            if (owners.has(g.name)) continue; // sudah satu file → import dibuang
            if (owners.has('shared')) {
              neededFromShared.add(n.name);
              importMaps[g.name].add('./DashboardShared', { named: [n] });
            } else {
              die(`${rel(f.abs)}: "${n.name}" ada di grup ${[...owners].join('/')}, bukan shared — tidak boleh dipakai silang admin/user.`);
            }
          }
          continue;
        }
        // import ke luar widgets → pertahankan, path dihitung ulang dari lokasi baru (semua output di features/dashboard)
        if (/\.css$/.test(imp.spec) && abs === CSS_OLD) {
          im.add(CSS_SPEC, { side: true });
          continue;
        }
        let ns = path.relative(DASH, abs).split(path.sep).join('/');
        if (!ns.startsWith('.')) ns = './' + ns;
        im.add(ns, { def: imp.def, defType: imp.typeOnly, ns: imp.ns, named: imp.named, side: imp.side });
      }
    }
    if (g.entry) im.add(CSS_SPEC, { side: true }); // admin & user sama-sama import css dashboard
  }

  // nama lokal admin/user tidak boleh sama dengan nama yang diimpor dari Shared
  for (const gname of ['admin', 'user']) {
    const g = G[gname];
    const local = new Set([...g.parts.flatMap((p) => p.names), ...declaredNames(g.entry.body)]);
    for (const n of neededFromShared) if (local.has(n)) die(`Bentrok nama "${n}" di ${g.plan.out}.`);
  }

  // 4) Rakit isi file
  const bar = '═'.repeat(72);
  const banner = (label, from) => [`// ${bar}`, `// ${label}`, ...(from ? [`//   (dulu: ${from})`] : []), `// ${bar}`];
  const outputs = [];

  for (const g of Object.values(G)) {
    const lines = [];
    if (g.name === 'shared') {
      lines.push(...g.plan.top.map((t) => `// ${t}`), '');
    }
    lines.push(...importMaps[g.name].render(), '');

    if (g.entry) {
      lines.push(...g.plan.map.map((t) => `// ${t}`), '');
      let eb = [...g.entry.body];
      for (const mk of g.plan.jsxMarks || []) {
        const idx = eb.map((l, i) => (l.trim().startsWith(mk.startsWith) ? i : -1)).filter((i) => i >= 0);
        if (idx.length !== 1) die(`${g.plan.out}: penanda JSX "${mk.startsWith}" cocok ${idx.length}× (harus tepat 1). Entry file berubah? Sesuaikan PLAN.`);
        const i = idx[0];
        const indent = eb[i].match(/^\s*/)[0];
        eb.splice(i, 0, `${indent}{/* ═══ ${mk.text} ═══ */}`);
      }
      lines.push(...eb, '');
    }

    for (const p of g.parts) {
      let body = [...p.body];
      if (g.name === 'shared') {
        // ekspor hanya nama yang benar-benar dipakai admin/user
        body = body.map((l) => {
          const m = l.match(DECL_RE);
          return m && neededFromShared.has(m[1]) ? 'export ' + l : l;
        });
      }
      lines.push('', ...banner(p.src.label, p.src.file), '', ...body, '');
    }

    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const text = lines.join(EOL).replace(/^(\r?\n)+/, '') + EOL;
    outputs.push({ g, text });
  }

  // 5) Cek: tidak ada file lain di luar widgets yang masih mengimpor widgets / dashboard-v4.css
  const toDelete = new Set([...listFiles(WIDGETS), CSS_OLD].filter((p) => fs.existsSync(p)));
  const rewritten = new Set(outputs.map((o) => o.g.outPath));
  const offenders = [];
  for (const f of listFiles(JS)) {
    if (toDelete.has(f) || rewritten.has(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/(?:from\s+|import\s+|import\(\s*|@import\s+(?:url\()?)['"]([^'"]+)['"]/g)) {
      if (!m[1].startsWith('.')) continue;
      const abs = path.resolve(path.dirname(f), m[1]);
      if (isInsideWidgets(abs) || abs === CSS_OLD) offenders.push(`${rel(f)}  →  ${m[1]}`);
    }
  }
  if (offenders.length) die(`Masih ada file lain yang mengimpor widgets/ atau dashboard-v4.css:\n  ${offenders.join('\n  ')}\nUbah dulu import-nya, lalu jalankan ulang dashboard.`);

  // 6) Laporan
  const count = (s) => s.split('\n').length - 1;
  let deletedLines = 0;
  for (const f of toDelete) deletedLines += count(fs.readFileSync(f, 'utf8'));
  log(DRY ? '\n[DRY] dashboard akan:' : '\ndashboard menjalankan:');
  for (const o of outputs) {
    const exists = fs.existsSync(o.g.outPath);
    log(`  ${exists ? 'tulis ulang' : 'buat       '} ${rel(o.g.outPath)}  (${count(o.text)} baris)`);
    for (const p of o.g.parts) log(`        ═══ ${p.src.label.split(' — ')[0]}   ← ${p.src.file}`);
  }
  log(`  ganti nama  ${rel(CSS_OLD)} → ${rel(CSS_NEW)}`);
  log(`  hapus       ${rel(WIDGETS)}/  (${[...toDelete].length - 1} file, ${deletedLines} baris — termasuk widget lama yang tidak dipakai)`);
  log(`\n  Diekspor dari DashboardShared: ${[...neededFromShared].sort().join(', ')}`);
  for (const o of outputs) {
    const names = o.g.parts.flatMap((p) => p.names).concat(o.g.entry ? declaredNames(o.g.entry.body) : []);
    const unused = names.filter((n) => !(o.g.name === 'shared' && neededFromShared.has(n)) && (o.text.match(new RegExp(`\\b${n.replace(/\$/g, '\\$')}\\b`, 'g')) || []).length === 1);
    if (unused.length) log(`  ⚠ kemungkinan tidak terpakai di ${o.g.plan.out}: ${unused.join(', ')} (dibiarkan, hapus manual kalau mau)`);
  }
  if (DRY) {
    log('\n[DRY] Tidak ada yang ditulis.\n');
    return;
  }

  // 7) Backup → manifest → tulis
  const manifest = { phase: PHASE, at: new Date().toISOString(), files: [] };
  const backup = (abs) => {
    const dest = path.join(BACKUP_DIR, rel(abs));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
  };
  for (const o of outputs) {
    if (fs.existsSync(o.g.outPath)) {
      backup(o.g.outPath);
      manifest.files.push({ path: rel(o.g.outPath), action: 'modified', sha: sha(o.text) });
    } else {
      manifest.files.push({ path: rel(o.g.outPath), action: 'created', sha: sha(o.text) });
    }
  }
  const cssText = fs.readFileSync(CSS_OLD, 'utf8');
  backup(CSS_OLD);
  manifest.files.push({ path: rel(CSS_OLD), action: 'deleted' });
  manifest.files.push({ path: rel(CSS_NEW), action: 'created', sha: sha(cssText) });
  for (const f of toDelete) {
    if (f === CSS_OLD) continue;
    backup(f);
    manifest.files.push({ path: rel(f), action: 'deleted' });
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  for (const o of outputs) fs.writeFileSync(o.g.outPath, o.text);
  fs.writeFileSync(CSS_NEW, cssText);
  fs.rmSync(CSS_OLD);
  fs.rmSync(WIDGETS, { recursive: true, force: true });

  log(`\n✔ dashboard selesai. Backup: ${rel(BACKUP_DIR)}/`);
  log('  Cek: npm run build   (atau npx tsc --noEmit)');
  log('  Batal: node scripts/dashboard.mjs --revert\n');
}

// ─────────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(JS)) die('resources/js tidak ditemukan. Jalankan dari ROOT project (node scripts/dashboard.mjs).');
REVERT ? revert() : apply();
