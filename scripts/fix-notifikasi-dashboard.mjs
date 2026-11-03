#!/usr/bin/env node
/**
 * fix-notifikasi-dashboard.mjs
 *
 * Merapikan kartu "Notifikasi" di dashboard admin (kolom kanan) yang tampilannya tidak stabil:
 *   1. Dua gaya baris campur (baris berkode 11px vs baris pesan lama 13,5px)  -> satu struktur & satu ukuran font:
 *      [dot + judul + keterangan] [pelapor + status].
 *   2. Dot "belum dibaca" menggeser teks                                      -> dot punya ruang tetap & sejajar judul.
 *   3. Tinggi baris melar / berubah-ubah (terutama di halaman terakhir)       -> grid dengan jumlah baris tetap (--np = pageSize).
 *   4. Baris berkode tidak punya waktu                                        -> waktu tampil di semua baris.
 *   5. Pelapor panjang keluar dari kartu                                      -> dipotong "..."; status selalu satu baris
 *      ("BERHASIL DIPERBAIKI" -> "DIPERBAIKI" supaya tidak numpuk 3 baris di sisi kanan).
 *
 * File yang diubah:
 *   resources/js/features/dashboard/widgets/ledger/NotifikasiLedger.tsx
 *   resources/js/features/dashboard/dashboard-v4.css   (blok "notifikasi")
 * Hanya berlaku untuk dashboard admin (v4); DashboardUser tidak berubah.
 *
 * Pemakaian (dari root project, atau dari dalam scripts/):
 *   node scripts/fix-notifikasi-dashboard.mjs            # terapkan
 *   node scripts/fix-notifikasi-dashboard.mjs --dry-run  # cuma cek apa yang akan berubah
 *   node scripts/fix-notifikasi-dashboard.mjs --revert   # kembalikan dari backup (.migrasi-backup/notifikasi/)
 *   node scripts/fix-notifikasi-dashboard.mjs /path/ke/project
 *
 * Idempotent, dan otomatis meng-upgrade file yang sudah pernah kena versi script sebelumnya.
 * Kalau potongan kode asli tidak ditemukan (sudah diubah manual), file itu TIDAK disentuh
 * dan alasannya dicetak. File asli di-backup dulu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REVERT = args.includes('--revert');

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

const ROOT = findRoot(args.find((a) => !a.startsWith('--')));
const DASH = path.join(ROOT, 'resources', 'js', 'features', 'dashboard');
const BACKUP = path.join(ROOT, '.migrasi-backup', 'notifikasi');

// [berkas, penanda "sudah ter-patch", edit utama [[lama, baru], ...], upgrade [[lama, baru], ...]]
// upgrade = perbaikan susulan; dijalankan kalau teks lamanya masih ada (file asli maupun hasil versi script sebelumnya).
const FILES = [
  {
    rel: 'widgets/ledger/NotifikasiLedger.tsx',
    done: 'dd-nt-w',
    edits: [
      ["import { useRef, useState } from 'react';", "import { useRef, useState, type CSSProperties } from 'react';"],
      ["        style={fill ? undefined : { height: pageSize * 66 }}", "        style={fill ? ({ '--np': pageSize } as CSSProperties) : { height: pageSize * 66 }}"],
      [
        "            {list.map((n) => {\n              const r = v4 ? ringkas(n) : null;\n              return r ? (\n                <button key={n.id} type=\"button\" className=\"dd-nt is-row\" onClick={() => open(n)}>\n                  <span className=\"dd-nt-l\">\n                    <b>\n                      {!n.read_at && <i className=\"dd-un\" aria-label=\"Belum dibaca\" />}\n                      {r.kode}\n                    </b>\n                    <small>{r.tipe}</small>\n                  </span>\n                  <span className=\"dd-nt-r\">\n                    <b>{r.user}</b>\n                    <em className={r.status.cls}>{r.status.teks}</em>\n                  </span>\n                </button>\n              ) : (\n                <button key={n.id} type=\"button\" className=\"dd-nt\" onClick={() => open(n)}>\n                  <span className=\"dd-nt-m\">\n                    {!n.read_at && <i className=\"dd-un\" aria-label=\"Belum dibaca\" />}\n                    {!n.read_at ? <b>{n.data?.message}</b> : n.data?.message}\n                  </span>\n                  <span className=\"dd-nt-d\">{formatWaktuSingkat(n.created_at)}</span>\n                </button>\n              );\n            })}\n",
        "            {list.map((n) => {\n              if (!v4) {\n                return (\n                  <button key={n.id} type=\"button\" className=\"dd-nt\" onClick={() => open(n)}>\n                    <span className=\"dd-nt-m\">\n                      {!n.read_at && <i className=\"dd-un\" aria-label=\"Belum dibaca\" />}\n                      {!n.read_at ? <b>{n.data?.message}</b> : n.data?.message}\n                    </span>\n                    <span className=\"dd-nt-d\">{formatWaktuSingkat(n.created_at)}</span>\n                  </button>\n                );\n              }\n\n              // [DASHBOARD-V4] Semua baris memakai satu struktur yang sama: [dot] [judul + keterangan] [pelapor + status].\n              // Slot dot selalu ada (transparan kalau sudah dibaca) supaya teks tidak bergeser antar baris.\n              const r = ringkas(n);\n              const waktu = formatWaktuSingkat(n.created_at);\n              const title = r ? r.kode : (n.data?.message ?? 'Notifikasi baru');\n              const sub = r ? r.tipe : null;\n              const unreadRow = !n.read_at;\n              return (\n                <button key={n.id} type=\"button\" className={`dd-nt is-row${unreadRow ? ' is-unread' : ''}${r ? '' : ' is-msg'}`} onClick={() => open(n)}>\n                  <span className=\"dd-nt-l\">\n                    <i className=\"dd-un\" aria-label={unreadRow ? 'Belum dibaca' : undefined} aria-hidden={unreadRow ? undefined : true} />\n                    <b title={title}>{title}</b>\n                    <small>\n                      {sub && <span className=\"dd-nt-s\" title={sub}>{sub}</span>}\n                      <span className=\"dd-nt-w\">{sub ? `\\u00a0\\u00b7 ${waktu}` : waktu}</span>\n                    </small>\n                  </span>\n                  {r && (\n                    <span className=\"dd-nt-r\">\n                      <b title={r.user}>{r.user}</b>\n                      <em className={r.status.cls}>{r.status.teks}</em>\n                    </span>\n                  )}\n                </button>\n              );\n            })}\n",
      ],
    ],
    upgrades: [["teks: 'BERHASIL DIPERBAIKI'", "teks: 'DIPERBAIKI'"]],
  },
  {
    rel: 'dashboard-v4.css',
    done: '.dd-nt-w',
    edits: [
      [
        "/* notifikasi */\n.dd-v4 .dd-nt.is-row { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; }\n.dd-v4 .dd-nlist.is-fill .dd-nt { min-height: 44px; max-height: none; }\n.dd-v4 .dd-nt-l b { display: flex; align-items: center; font-size: 11px; font-weight: 600; color: var(--dv-ink); }\n.dd-v4 .dd-nt-l small { display: block; font-size: 10px; color: var(--dv-muted); }\n.dd-v4 .dd-nt-r { text-align: right; }\n.dd-v4 .dd-nt-r b { display: block; font-size: 11px; font-weight: 600; color: var(--dv-ink); }\n.dd-v4 .dd-nt-r em { display: block; font-style: normal; font-size: 9.5px; font-weight: 700; margin-top: 1px; }\n.dd-v4 .dd-nt-r em.sg { color: var(--dd-green); }\n.dd-v4 .dd-nt-r em.sy { color: var(--dd-yellow); }\n.dd-v4 .dd-nt-r em.sr { color: var(--dv-alert); }\n.dd-v4 .dd-nt:hover .dd-nt-l b { text-decoration: underline; }\n\n",
        "/* notifikasi\n   Semua baris (kode inventory maupun pesan lama) satu struktur: [dot + judul + keterangan] [pelapor + status].\n   - Tinggi baris seragam: grid dengan jumlah baris tetap (--np = pageSize dari komponen), jadi halaman terakhir\n     yang barisnya lebih sedikit tidak melar, dan baris tidak berubah tinggi saat ganti halaman.\n   - Dot selalu punya ruang 14px (transparan kalau sudah dibaca) dan sejajar baris judul -> teks selalu lurus.\n   - Satu ukuran font untuk semua baris (11px judul / 10px keterangan); pesan panjang dipotong 2 baris. */\n.dd-v4 .dd-nlist.is-fill { margin-bottom: 8px; }\n.dd-v4 .dd-nlist.is-fill > div { display: grid; grid-template-rows: repeat(var(--np, 5), minmax(60px, 1fr)); }\n.dd-v4 .dd-nlist.is-fill .dd-nt { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 8px; flex: none; height: auto; min-height: 0; max-height: none; padding: 6px 0; border-top: 0; text-align: left; }\n.dd-v4 .dd-nlist.is-fill .dd-nt + .dd-nt { border-top: 1px solid var(--dv-line); }\n.dd-v4 .dd-un { position: absolute; left: 0; top: 4.5px; display: block; width: 6px; height: 6px; margin: 0; border-radius: 50%; background: transparent; }\n.dd-v4 .dd-nt.is-unread .dd-un { background: var(--dv-alert); }\n.dd-v4 .dd-nt-l { position: relative; min-width: 0; padding-left: 14px; }\n.dd-v4 .dd-nt-l b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 500; line-height: 1.35; color: var(--dv-soft); }\n.dd-v4 .dd-nt.is-unread .dd-nt-l b { font-weight: 600; color: var(--dv-ink); }\n.dd-v4 .dd-nt.is-msg .dd-nt-l b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; overflow-wrap: anywhere; }\n.dd-v4 .dd-nt-l small { display: flex; margin-top: 1px; white-space: nowrap; font-size: 10px; line-height: 1.35; color: var(--dv-muted); }\n.dd-v4 .dd-nt-s { min-width: 0; overflow: hidden; text-overflow: ellipsis; }\n.dd-v4 .dd-nt-w { flex: none; }\n.dd-v4 .dd-nt-r { min-width: 0; max-width: 92px; text-align: right; }\n.dd-v4 .dd-nt-r b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 600; line-height: 1.35; color: var(--dv-ink); }\n.dd-v4 .dd-nt-r em { display: block; margin-top: 1px; font-style: normal; font-size: 9.5px; font-weight: 700; line-height: 1.35; white-space: nowrap; }\n.dd-v4 .dd-nt-r em.sg { color: var(--dd-green); }\n.dd-v4 .dd-nt-r em.sy { color: var(--dd-yellow); }\n.dd-v4 .dd-nt-r em.sr { color: var(--dv-alert); }\n.dd-v4 .dd-nt:hover .dd-nt-l b { text-decoration: underline; }\n.dd-v4 .dd-nt:focus-visible { outline: 1.5px solid var(--dv-primary); outline-offset: -1.5px; border-radius: 6px; }\n\n",
      ],
    ],
    upgrades: [["font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }", "font-weight: 700; line-height: 1.35; white-space: nowrap; }"]],
  },
];

const norm = (s) => s.replace(/\r\n/g, '\n');
const log = [];

function backupPath(rel) {
  return path.join(BACKUP, rel.replace(/[\\/]/g, '__'));
}

function applyFile(f) {
  const file = path.join(DASH, f.rel);
  if (!fs.existsSync(file)) {
    log.push(`! ${f.rel}: file tidak ditemukan, dilewati`);
    return;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  let text = norm(raw);
  let changed = false;

  if (!text.includes(f.done)) {
    for (const [oldS] of f.edits) {
      if (!text.includes(oldS)) {
        log.push(`! ${f.rel}: potongan kode asli tidak cocok (sudah diubah manual?), file TIDAK diubah`);
        return;
      }
    }
    for (const [oldS, newS] of f.edits) text = text.replace(oldS, () => newS);
    changed = true;
  }
  for (const [oldS, newS] of f.upgrades ?? []) {
    if (text.includes(oldS)) {
      text = text.replace(oldS, () => newS);
      changed = true;
    }
  }
  if (!changed) {
    log.push(`= ${f.rel}: sudah versi terbaru`);
    return;
  }
  if (crlf) text = text.replace(/\n/g, '\r\n');

  log.push(`${DRY ? '~' : '+'} ${f.rel}`);
  if (DRY) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  const bak = backupPath(f.rel);
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, raw, 'utf8');
  fs.writeFileSync(file, text, 'utf8');
}

function revertFile(f) {
  const bak = backupPath(f.rel);
  if (!fs.existsSync(bak)) {
    log.push(`! ${f.rel}: tidak ada backup`);
    return;
  }
  log.push(`${DRY ? '~' : '<'} ${f.rel} dikembalikan`);
  if (!DRY) fs.writeFileSync(path.join(DASH, f.rel), fs.readFileSync(bak, 'utf8'), 'utf8');
}

if (!fs.existsSync(DASH)) {
  console.error(`resources/js/features/dashboard tidak ditemukan di ${ROOT}. Jalankan dari root project atau kasih path-nya.`);
  process.exit(1);
}

for (const f of FILES) (REVERT ? revertFile : applyFile)(f);

console.log(DRY ? '[dry-run]' : REVERT ? 'Revert:' : 'Hasil:');
for (const l of log) console.log('  ' + l);
if (!DRY && !REVERT && log.some((l) => l.startsWith('+'))) console.log('\nSelesai. Jalankan `npm run dev` / `npm run build` untuk melihat hasilnya.');
