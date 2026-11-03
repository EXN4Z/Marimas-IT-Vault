#!/usr/bin/env node
/**
 * fix-modal-no-outside-close.mjs
 *
 * Semua modal form TIDAK lagi tertutup kalau klik di luar kotaknya (backdrop). Menutup hanya lewat
 * tombol X / Batal / Tutup (dan tombol Esc, tidak diubah). Mencegah isian form hilang karena salah klik.
 *
 * Yang dikerjakan:
 *   1. Hapus handler klik-backdrop di semua modal form / aksi / export / konfirmasi:
 *        - Modal.tsx (dipakai tab Cabang & Perusahaan)
 *        - ConfirmDeleteModal, KaryawanPasswordModal
 *        - Master Data: DepartemenTab, KategoriTab, SupplierTab
 *        - Inventory: InventoryFormModal, SerahTerima, Pengembalian, LaporKerusakan, PasangParent, LepasDariInduk
 *        - Penanganan: FormPerbaikan, TerimaLaporan, PenangananSelesai, PenangananExport
 *        - Laporan export: Departemen, Inventory, InventoryPemakai, Karyawan, Kategori, Simple
 *   2. Tambah tombol X di modal yang belum punya:
 *        - JualConfirmModal (Tandai inventory sebagai dijual)
 *        - ImportModal di KaryawanTab (Import Data Karyawan)
 *      (modal lain sudah punya tombol X, tidak disentuh)
 *
 * Tidak disentuh (bukan form): FotoZoomViewer (viewer foto). Modal detail read-only (InventoryDetailModal,
 * DetailPenangananModal, detail di FotoInventoryTab) juga dibiarkan; pakai --semua kalau mau ikut dikunci.
 *
 * Pemakaian (dari root project, atau dari dalam scripts/):
 *   node scripts/fix-modal-no-outside-close.mjs            # terapkan
 *   node scripts/fix-modal-no-outside-close.mjs --dry-run  # cuma tampilkan apa yang akan berubah
 *   node scripts/fix-modal-no-outside-close.mjs --semua    # sekalian kunci modal detail read-only
 *   node scripts/fix-modal-no-outside-close.mjs --revert   # kembalikan dari backup (.migrasi-backup/modal-tanpa-klik-luar/)
 *   node scripts/fix-modal-no-outside-close.mjs /path/ke/project
 *
 * Idempotent (yang sudah ter-patch dilewati). Kalau potongan kode asli tidak cocok (sudah diubah manual),
 * file itu TIDAK disentuh dan alasannya dicetak. File asli di-backup dulu. CRLF dipertahankan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REVERT = args.includes('--revert');
const SEMUA = args.includes('--semua');

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
const JS = path.join(ROOT, 'resources', 'js');
const BACKUP = path.join(ROOT, '.migrasi-backup', 'modal-tanpa-klik-luar');

const norm = (s) => s.replace(/\r\n/g, '\n');
const OK = 'ok';
const DONE = 'done';
const FAIL = 'fail';

/* ------------------------------------------------------------------ pola umum ------------------------------------------------------------------ */

// Backdrop pola: onMouseDown={(e) => { if (e.target === e.currentTarget && !x) onClose(); }}
function lepasMouseDownBackdrop(text) {
  const RE = /\n[ \t]*onMouseDown=\{\(e\) => \{\n[ \t]*if \(e\.target === e\.currentTarget[^\n]*\n[ \t]*\}\}/g;
  const found = text.match(RE);
  if (!found) {
    return text.includes('e.target === e.currentTarget')
      ? { status: FAIL, note: 'ada pengecekan e.target === e.currentTarget tapi bentuknya beda dari yang dikenali' }
      : { status: DONE };
  }
  if (found.length !== 1) return { status: FAIL, note: `handler backdrop ditemukan ${found.length}x (diharapkan 1x)` };
  return { status: OK, text: text.replace(RE, '') };
}

// Backdrop pola hook: useBackdropClose + {...backdrop} / {...backdropModal}
function lepasHookBackdrop(text) {
  if (!text.includes('useBackdropClose')) return { status: DONE };
  let t = text;
  t = t.replace(/^import \{ useBackdropClose \} from '[^']+';\n/m, '');
  t = t.replace(/^[ \t]*const \w+ = useBackdropClose\([^\n]*\);\n\n/m, '').replace(/^[ \t]*const \w+ = useBackdropClose\([^\n]*\);\n/m, '');
  t = t.replace(/\n[ \t]*\{\.\.\.(?:backdrop|backdropModal)\}/, '');
  if (t.includes('useBackdropClose') || /\{\.\.\.backdrop\w*\}/.test(t)) {
    return { status: FAIL, note: 'pemakaian useBackdropClose tidak sepenuhnya dikenali' };
  }
  return { status: OK, text: t };
}

/* --------------------------------------------------------------- pola khusus per file --------------------------------------------------------------- */

function patchModalUmum(text) {
  if (!text.includes('handleBackdropClick')) return { status: DONE };
  let t = text;
  const steps = [
    [/import \{ useEffect, useRef, type MouseEvent, type ReactNode \} from 'react';/, "import { useEffect, type ReactNode } from 'react';"],
    [/  \/\/ BARU: fix bug[\s\S]*?const mouseDownOnBackdrop = useRef\(false\);\n\n/, ''],
    [/  function handleBackdropMouseDown[\s\S]*?\n  \}\n\n  function handleBackdropClick[\s\S]*?\n  \}\n\n/, ''],
    [/\n[ \t]*onMouseDown=\{handleBackdropMouseDown\}\n[ \t]*onClick=\{handleBackdropClick\}/, ''],
    [/\(tombol X, klik backdrop, atau Esc\)/, '(tombol X atau Esc; klik di luar modal tidak menutup)'],
  ];
  for (const [re, rep] of steps) {
    if (!re.test(t)) return { status: FAIL, note: `bagian ${re.source.slice(0, 40)}... tidak ditemukan` };
    t = t.replace(re, rep);
  }
  return { status: OK, text: t };
}

function patchPasswordModal(text) {
  const RE = /(className="fixed inset-0 z-\[100\][^\n]*\n)[ \t]*onClick=\{handleClose\}\n/;
  if (!RE.test(text)) {
    return /className="fixed inset-0 z-\[100\]/.test(text) && /onClick=\{handleClose\}\n\s*>/.test(text)
      ? { status: FAIL, note: 'overlay ditemukan tapi bentuknya beda dari yang dikenali' }
      : { status: DONE };
  }
  return { status: OK, text: text.replace(RE, '$1') };
}

function patchFotoDetail(text) {
  const RE = /(className="fixed inset-0 bg-black\/50 z-\[70\] flex items-center justify-center p-4") onClick=\{onClose\}>/;
  if (!RE.test(text)) return { status: DONE };
  return { status: OK, text: text.replace(RE, '$1>') };
}

function patchJualConfirm(text) {
  if (text.includes('aria-label="Tutup"')) return { status: DONE };
  const oldHead =
    '      <div className="bg-white rounded-xl w-full max-w-sm p-5">\n' +
    '        <h2 className="text-base font-semibold text-slate-900 mb-1">Tandai inventory sebagai dijual?</h2>\n';
  const newHead = [
    '      <div className="bg-white rounded-xl w-full max-w-sm p-5">',
    '        <div className="flex items-start justify-between gap-3 mb-1">',
    '          <h2 className="text-base font-semibold text-slate-900">Tandai inventory sebagai dijual?</h2>',
    '          <button',
    '            type="button"',
    '            onClick={() => setJualTarget(null)}',
    '            disabled={jualLoading}',
    '            aria-label="Tutup"',
    '            className="-mr-1.5 -mt-1 shrink-0 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"',
    '          >',
    '            <X size={18} />',
    '          </button>',
    '        </div>',
    '',
  ].join('\n');
  const oldImport = "import type { Inventory } from '../types/inventory';\n";
  if (!text.includes(oldHead) || !text.includes(oldImport)) return { status: FAIL, note: 'header / import modal tidak cocok' };
  return {
    status: OK,
    text: text.replace(oldHead, () => newHead).replace(oldImport, () => "import { X } from 'lucide-react';\n" + oldImport),
  };
}

function patchKaryawanImport(text) {
  if (text.includes('aria-label="Tutup"')) return { status: DONE };
  const oldHead = '                <h2 className="text-base font-semibold text-gray-900 mb-1">Import Data Karyawan</h2>\n';
  const newHead = [
    '                <div className="flex items-start justify-between gap-3 mb-1">',
    '                    <h2 className="text-base font-semibold text-gray-900">Import Data Karyawan</h2>',
    '                    <button',
    '                        type="button"',
    '                        onClick={onClose}',
    '                        disabled={importing}',
    '                        aria-label="Tutup"',
    '                        className="-mr-1.5 -mt-1 shrink-0 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition disabled:opacity-40"',
    '                    >',
    '                        <X size={18} />',
    '                    </button>',
    '                </div>',
    '',
  ].join('\n');
  const oldImport = "import { Download, Upload, Plus, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';";
  const newImport = "import { Download, Upload, Plus, Eye, Pencil, Trash2, Loader2, X } from 'lucide-react';";
  if (!text.includes(oldHead) || !text.includes(oldImport)) return { status: FAIL, note: 'header ImportModal / import lucide tidak cocok' };
  return { status: OK, text: text.replace(oldHead, () => newHead).replace(oldImport, () => newImport) };
}

/* ------------------------------------------------------------------ daftar target ------------------------------------------------------------------ */

const gabung = (...fns) => (text) => {
  let t = text;
  let changed = false;
  for (const fn of fns) {
    const r = fn(t);
    if (r.status === FAIL) return r;
    if (r.status === OK) {
      t = r.text;
      changed = true;
    }
  }
  return changed ? { status: OK, text: t } : { status: DONE };
};

const TARGETS = [
  // modal umum + konfirmasi + password
  ['components/modal/Modal.tsx', patchModalUmum],
  ['components/modal/ConfirmDeleteModal.tsx', lepasHookBackdrop],
  ['features/karyawan/modals/KaryawanPasswordModal.tsx', patchPasswordModal],
  // master data
  ['features/master-data/departemen/DepartemenTab.tsx', lepasHookBackdrop],
  ['features/master-data/kategori/KategoriTab.tsx', lepasHookBackdrop],
  ['features/master-data/supplier/SupplierTab.tsx', lepasHookBackdrop],
  // inventory
  ['features/inventory/form/InventoryFormModal.tsx', lepasMouseDownBackdrop],
  ['features/inventory/aksi/SerahTerimaModal.tsx', lepasMouseDownBackdrop],
  ['features/inventory/aksi/PengembalianModal.tsx', lepasMouseDownBackdrop],
  ['features/inventory/aksi/LaporKerusakanModal.tsx', lepasMouseDownBackdrop],
  ['features/inventory/aksi/PasangParentModal.tsx', lepasMouseDownBackdrop],
  ['features/inventory/aksi/LepasDariIndukModal.tsx', lepasMouseDownBackdrop],
  ['features/inventory/aksi/JualConfirmModal.tsx', patchJualConfirm],
  // penanganan
  ['features/penanganan/modals/FormPerbaikanModal.tsx', lepasMouseDownBackdrop],
  ['features/penanganan/modals/TerimaLaporanModal.tsx', lepasMouseDownBackdrop],
  ['features/penanganan/modals/PenangananSelesaiModal.tsx', lepasMouseDownBackdrop],
  ['features/penanganan/export/PenangananExportModal.tsx', lepasMouseDownBackdrop],
  // laporan export
  ['features/laporan/export/DepartemenExportModal.tsx', lepasMouseDownBackdrop],
  ['features/laporan/export/InventoryExportModal.tsx', lepasMouseDownBackdrop],
  ['features/laporan/export/InventoryPemakaiExportModal.tsx', lepasMouseDownBackdrop],
  ['features/laporan/export/KaryawanExportModal.tsx', lepasMouseDownBackdrop],
  ['features/laporan/export/KategoriExportModal.tsx', lepasMouseDownBackdrop],
  ['features/laporan/export/SimpleExportModal.tsx', lepasMouseDownBackdrop],
  // karyawan
  ['features/karyawan/KaryawanTab.tsx', patchKaryawanImport],
];

// Modal detail read-only: hanya dikunci kalau pakai --semua
const TARGETS_DETAIL = [
  ['features/inventory/detail/InventoryDetailModal.tsx', lepasMouseDownBackdrop],
  ['features/penanganan/modals/DetailPenangananModal.tsx', lepasMouseDownBackdrop],
  ['features/laporan/foto/FotoInventoryTab.tsx', patchFotoDetail],
];

const daftar = SEMUA ? [...TARGETS, ...TARGETS_DETAIL] : TARGETS;

/* ------------------------------------------------------------------ eksekusi ------------------------------------------------------------------ */

const log = [];
const backupPath = (rel) => path.join(BACKUP, rel.replace(/[\\/]/g, '__'));

function terapkan([rel, fn]) {
  const file = path.join(JS, rel);
  if (!fs.existsSync(file)) {
    log.push(`! ${rel}: file tidak ditemukan, dilewati`);
    return;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const r = fn(norm(raw));
  if (r.status === DONE) {
    log.push(`= ${rel}: sudah ter-patch`);
    return;
  }
  if (r.status === FAIL) {
    log.push(`! ${rel}: ${r.note}, file TIDAK diubah`);
    return;
  }
  log.push(`${DRY ? '~' : '+'} ${rel}`);
  if (DRY) return;
  fs.mkdirSync(BACKUP, { recursive: true });
  const bak = backupPath(rel);
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, raw, 'utf8');
  fs.writeFileSync(file, crlf ? r.text.replace(/\n/g, '\r\n') : r.text, 'utf8');
}

function kembalikan([rel]) {
  const bak = backupPath(rel);
  if (!fs.existsSync(bak)) return; // tidak pernah di-patch
  log.push(`${DRY ? '~' : '<'} ${rel} dikembalikan`);
  if (!DRY) fs.writeFileSync(path.join(JS, rel), fs.readFileSync(bak, 'utf8'), 'utf8');
}

if (!fs.existsSync(JS)) {
  console.error(`resources/js tidak ditemukan di ${ROOT}. Jalankan dari root project atau kasih path-nya.`);
  process.exit(1);
}

// saat --revert, semua target (termasuk detail) dicek: yang punya backup dikembalikan
for (const t of REVERT ? [...TARGETS, ...TARGETS_DETAIL] : daftar) (REVERT ? kembalikan : terapkan)(t);

console.log(DRY ? '[dry-run]' : REVERT ? 'Revert:' : 'Hasil:');
if (log.length === 0) console.log('  (tidak ada yang dikembalikan, belum pernah di-patch)');
for (const l of log) console.log('  ' + l);
if (!DRY && !REVERT && log.some((l) => l.startsWith('+'))) {
  console.log('\nSelesai. Jalankan `npm run dev` / `npm run build` untuk melihat hasilnya.');
  if (!SEMUA) console.log('Modal detail read-only tidak dikunci. Tambahkan --semua kalau mau ikut dikunci.');
}
