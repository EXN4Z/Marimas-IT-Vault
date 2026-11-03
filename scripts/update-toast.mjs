// node scripts/update-toast.mjs  (--dry / --revert; bisa dijalankan dari root atau dari scripts/)
//   node update-toast.mjs --dry       -> cuma tampilkan rencana, tidak ada file yang berubah
//   node update-toast.mjs --revert    -> kembalikan semua file dari backup (.migrasi-backup/update-toast/)
//   node update-toast.mjs path/ke/project
//
// Error aksi/simpan/hapus/import yang tadinya kotak merah inline di dalam modal/halaman sekarang jadi
// toast (react-hot-toast), mengikuti pola CabangTab/Perusahaan (simpan), SupplierTab/DepartemenTab (hapus).
//
//  1) Master Data  : SupplierTab, KategoriTab, DepartemenTab  -> error simpan jadi toast (banner merah dibuang)
//  2) Hapus        : KategoriTab, CabangTab, PerusahaanTab, KaryawanTab -> `deleteError` jadi toast + modal ditutup
//  3) Aksi inventory: SerahTerima, Pengembalian, LaporKerusakan, PasangParent, LepasDariInduk, JualConfirm
//  4) Detail inventory: historyActionError (terima laporan, hapus riwayat pemakaian/penanganan)
//  5) Import file  : InventoryTab, PenangananPage -> error "file" jadi toast
//     + validasi client "Nama ... tidak boleh kosong!" di Supplier/Kategori/Departemen ikut toast (inline tetap ada),
//       sama seperti CabangTab (toastFormErrors).
//     + form Penanganan (FormPerbaikanModal, PenangananSelesaiModal): toast + error inline per-field
//       Cek field kosong dilakukan di client (konsisten dengan form lain; salah ketik tidak memenuhi Audit Log).
//       Aturan server tetap jalan sebagai sumber kebenaran (penolakan server tetap tampil sebagai error/toast).
//     + modal Penanganan dilebarkan max-w-sm -> max-w-md supaya pesan error di grid 2 kolom tidak terpotong.
//  6) Error validasi inline (per-field) diseragamkan lewat komponen <InlineError> di components/form/FormControls.tsx
//     (style = persis yang dulu dipakai <Field error>: ikon + teks merah kecil + fade-in, role="alert").
//     Dipakai <Field>, error foto (SerahTerima/Pengembalian/LaporKerusakan), "Pilih minimal 1 kolom" di semua
//     modal export, fotoError InventoryFormModal, dan FieldError di Settings.
//
//  7) BACKEND -- Audit Log cuma mencatat request yang BERHASIL: app/Http/Middleware/LogActivity.php tidak lagi
//     membuat entri untuk request gagal (status >= 400 atau redirect balik membawa error validasi/aturan bisnis),
//     dan penanda " (GAGAL)" dibuang. Entri "(GAGAL)" lama yang sudah ada di database TIDAK dihapus oleh script ini.
//
// SENGAJA TIDAK DISENTUH:
//  - Inventory: alur "hapus paksa" (deleteError / deleteForceAvailable) tetap di ConfirmDeleteModal
//  - Import Karyawan (bisa mengembalikan daftar banyak baris -> inline masuk akal)
//  - Error per-field (errors.foto, fotoError, "Nama ... tidak boleh kosong!" di bawah kolom, Settings) dan Login
//
// Aman dijalankan berulang kali: file yang sudah ter-patch dilewati. Kalau ada pola yang tidak cocok,
// file itu TIDAK diubah (semua-atau-tidak-sama-sekali per file) dan alasannya dicetak.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// root project = folder terdekat (naik dari cwd / lokasi script) yang punya package.json + resources/js,
// jadi aman dijalankan dari root maupun dari dalam scripts/
function findRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  for (const start of [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) {
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

const args = process.argv.slice(2);
const DRY = args.includes('--dry') || args.includes('--dry-run');
const REVERT = args.includes('--revert');
const root = findRoot(args.find((a) => !a.startsWith('--')));
const BK = path.join(root, '.migrasi-backup', 'update-toast');
const J = 'resources/js/features/';

// ---------------------------------------------------------------- helper pola
// hapus satu baris utuh yang cocok regex
const dropLine = (re) => ({ re: new RegExp(`^[ \\t]*${re.source}[ \\t]*\\r?\\n`, 'gm'), to: '' });
// hapus blok JSX `{nama && ( ... )}` (+ baris kosong di depannya), penutup harus satu indent dengan pembuka
const dropBlock = (cond) => ({
  re: new RegExp(`\\n([ \\t]*)\\{${cond} && \\(\\r?\\n[\\s\\S]*?\\r?\\n\\1\\)\\}\\r?\\n`),
  to: '',
});
// onError: (errors) => setDeleteError(pesan)  ->  toast + tutup modal (perilaku sama dengan SupplierTab/DepartemenTab)
const deleteToToast = (closer, step = '  ') => ({
  re: /^([ \t]*)onError: \(errors\) => setDeleteError\((.+)\),$/m,
  to: `$1onError: (errors) => {\n$1${step}toast.error($2);\n$1${step}${closer};\n$1},`,
});

const deleteCommon = [
  dropLine(/const \[deleteError, setDeleteError\] = useState(?:<string>)?\(''\);/),
  dropLine(/setDeleteError\(''\);/),
  dropLine(/errorMessage=\{deleteError\}/),
];
const deleteLeft = [/deleteError/i];

// ---------------------------------------------------------------- daftar file
const FILES = [
  // ===== 1) Master Data: simpan =====
  ...[
    ['supplier/SupplierTab.tsx', "errors.nama || errors.alamat || errors.telepon || 'Gagal menyimpan supplier.'"],
    ['kategori/KategoriTab.tsx', "errors.nama || 'Gagal menyimpan kategori.'"],
    ['departemen/DepartemenTab.tsx', "errors.nama || 'Gagal menyimpan departemen.'"],
  ].map(([file, msg]) => ({
    rel: `${J}master-data/${file}`,
    marker: `setFormError(${msg})`,
    ops: [
      { from: `setFormError(${msg})`, to: `toast.error(${msg})` },
      // banner merah server-error di bawah form (error client "tidak boleh kosong" tetap inline di bawah kolom)
      dropBlock('formError && formNama\\.trim\\(\\)'),
      // AlertCircle cuma dipakai banner itu
      { re: /,\s*AlertCircle\b/, to: '' },
    ],
    left: [/AlertCircle/],
  })),

  // ===== 2) Hapus: error di dalam ConfirmDeleteModal -> toast + tutup modal =====
  ...[
    ['master-data/kategori/KategoriTab.tsx', 'setDeleteTarget(null)'],
    ['master-data/cabang/CabangTab.tsx', 'setDeleteTarget(null)'],
    ['master-data/perusahaan/PerusahaanTab.tsx', 'setDeleteTarget(null)'],
    ['karyawan/KaryawanTab.tsx', 'setUserToDelete(null)', '    '], // file ini pakai indent 4 spasi
  ].map(([file, closer, step]) => ({
    rel: J + file,
    marker: 'setDeleteError(',
    ops: [
      deleteToToast(closer, step),
      ...deleteCommon,
      { re: /-> error bag "delete", tampil di modal\./, to: '-> toast error + tutup modal.', optional: true },
      { re: /error bag "delete",\r?\n[ \t]*\/\/ tampil di dalam modal konfirmasi\./, to: 'toast error + tutup modal.', optional: true },
    ],
    left: deleteLeft,
  })),

  // ===== 3) Aksi inventory =====
  ...[
    ['LaporKerusakanModal.tsx', 'serverError', 'setServerError', true],
    ['PengembalianModal.tsx', 'serverError', 'setServerError', true],
    ['SerahTerimaModal.tsx', 'serverError', 'setServerError', true],
    ['LepasDariIndukModal.tsx', 'error', 'setError', false],
    ['PasangParentModal.tsx', 'error', 'setError', false],
  ].map(([file, v, setter]) => ({
    rel: `${J}inventory/aksi/${file}`,
    marker: `${setter}(msg)`,
    ops: [
      // sebelumnya sudah toast.error(msg) + simpan ke state buat kotak inline -> tinggal buang yang inline
      dropLine(new RegExp(`const \\[${v}, ${setter}\\] = useState\\(''\\);`)),
      dropLine(new RegExp(`${setter}\\((?:msg|'')\\);`)),
      dropBlock(v),
      { re: /([Gg])agal validasi -> pesan tampil di dalam modal ini\./, to: '$1agal validasi -> toast error.', optional: true },
      { re: /^([ \t]*\/\/ )pesan tampil di dalam modal ini\./m, to: '$1toast error.', optional: true },
    ],
    left: [new RegExp(`\\b${setter}\\b`), new RegExp(`\\{${v} &&`)],
  })),

  // ===== 3b) Jual =====
  {
    rel: `${J}inventory/aksi/JualConfirmModal.tsx`,
    marker: 'jualError',
    ops: [
      dropLine(/jualError: string;/),
      { from: '{ jualTarget, jualError, setJualTarget,', to: '{ jualTarget, setJualTarget,' },
      { re: /([ \t]*)\{jualError && \(\r?\n[\s\S]*?\r?\n\1\)\}\r?\n\r?\n/, to: '' },
    ],
    left: [/jualError/],
  },

  // ===== 3c + 4 + 5) InventoryTab: jual, riwayat detail, import =====
  {
    rel: `${J}inventory/InventoryTab.tsx`,
    marker: 'setJualError(',
    ops: [
      // jual
      { from: "onError: (errors) => setJualError(errors.jual || 'Gagal menandai inventory sebagai terjual.'),", to: "onError: (errors) => toast.error(errors.jual || 'Gagal menandai inventory sebagai terjual.')," },
      dropLine(/const \[jualError, setJualError\] = useState\(''\);/),
      dropLine(/setJualError\(''\);/),
      dropLine(/jualError=\{jualError\}/),
      // riwayat di modal detail
      { from: "onError: (errors) => setHistoryActionError(errors.terima || 'Gagal menerima laporan penanganan.'),", to: "onError: (errors) => toast.error(errors.terima || 'Gagal menerima laporan penanganan.')," },
      { from: "onError: (errors) => setHistoryActionError(String(Object.values(errors)[0] || 'Gagal menghapus riwayat penanganan.')),", to: "onError: (errors) => toast.error(String(Object.values(errors)[0] || 'Gagal menghapus riwayat penanganan.'))," },
      { from: "onError: (errors) => setHistoryActionError(errors.hapus || 'Gagal menghapus riwayat pemakaian.'),", to: "onError: (errors) => toast.error(errors.hapus || 'Gagal menghapus riwayat pemakaian.')," },
      dropLine(/const \[historyActionError, setHistoryActionError\] = useState\(''\);/),
      dropLine(/setHistoryActionError\(''\);/),
      dropLine(/historyActionError=\{historyActionError\}/),
      { re: /error bag "terima" tampil di modal detail\./, to: 'error bag "terima" -> toast.', optional: true },
      { re: /error bag "hapus" tampil di modal detail\./, to: 'error bag "hapus" -> toast.', optional: true },
      // import
      { from: "onError: (errors) => setImportError(String(errors.file || 'Gagal mengimport file')),", to: "onError: (errors) => toast.error(String(errors.file || 'Gagal mengimport file'))," },
      dropLine(/const \[importError, setImportError\] = useState\(''\);/),
      dropLine(/setImportError\(''\);/),
      { re: /^[ \t]*\{importError && <p [^\n]*<\/p>\}\r?\n\r?\n/m, to: '' },
      { from: 'gagal -> pesan error inline.', to: 'gagal -> toast error (key "file").', optional: true },
    ],
    left: [/jualError/i, /historyActionError/, /importError/i],
  },
  {
    rel: `${J}inventory/detail/InventoryDetailModal.tsx`,
    marker: 'historyActionError',
    ops: [
      dropLine(/historyActionError: string;/),
      { from: 'setPemakaiPage, historyActionError, penangananPage,', to: 'setPemakaiPage, penangananPage,' },
      dropBlock('historyActionError'),
    ],
    left: [/historyActionError/],
  },

  // ===== 5) Import file: Penanganan =====
  {
    rel: `${J}penanganan/PenangananPage.tsx`,
    marker: 'setImportError(',
    ops: [
      { from: "onError: (errors) => setImportError(String(errors.file || 'Gagal mengimport file')),", to: "onError: (errors) => toast.error(String(errors.file || 'Gagal mengimport file'))," },
      dropLine(/const \[importError, setImportError\] = useState\(''\);/),
      dropLine(/setImportError\(''\);/),
      { re: /^[ \t]*\{importError && <p className="pn-err">\{importError\}<\/p>\}\r?\n\r?\n/m, to: '' },
      { from: 'Gagal -> pesan error inline (key "file").', to: 'Gagal -> toast error (key "file").', optional: true },
    ],
    left: [/importError/i],
  },
];


// ---------------------------------------------------------------- 6) <InlineError>
// tambahkan InlineError ke import FormControls yang sudah ada (atau buat import baru kalau belum ada)
const addInlineErrorImport = (newImportPath) => ({
  label: 'import InlineError',
  fn: (t) => {
    if (/import\s*\{[^}]*\bInlineError\b[^}]*\}\s*from\s*'[^']*FormControls'/.test(t)) return t;
    const m = t.match(/import\s*\{([^}]*)\}\s*from\s*'([^']*components\/form\/FormControls)';/);
    if (m) return t.replace(m[0], `import {${m[1].replace(/\s+$/, '')}, InlineError } from '${m[2]}';`.replace('{ ', '{ ').replace(/\{,/, '{'));
    if (!newImportPath) return null;
    const lines = t.split('\n');
    let last = -1;
    lines.forEach((l, i) => { if (/^import\s.*from\s.*;$/.test(l)) last = i; });
    if (last < 0) return null;
    lines.splice(last + 1, 0, `import { InlineError } from '${newImportPath}';`);
    return lines.join('\n');
  },
});

const INLINE_COMPONENT = `// Pesan error validasi INLINE (di bawah kolom / area form). Satu-satunya style error inline di app ini supaya
// tampilannya konsisten: dipakai <Field error>, error foto, "pilih minimal 1 kolom", dst.
// Error dari server / aksi (simpan, hapus, import) pakai toast, bukan ini.
export function InlineError({ children, className = '' }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <span
      className={\`flex items-center gap-1.5 mt-1.5 text-xs font-medium text-red-600 animate-[fadeIn_150ms_ease-out] \${className}\`.trim()}
      role="alert"
    >
      <AlertCircle size={13} className="shrink-0 text-red-500" />
      {children}
    </span>
  );
}

`;

FILES.push({
  rel: 'resources/js/components/form/FormControls.tsx',
  marker: (t) => !t.includes('export function InlineError'),
  ops: [
    {
      label: 'komentar pembuka <Field>',
      fn: (t) => (t.includes('// Label + error text pembungkus') ? t.replace('// Label + error text pembungkus', INLINE_COMPONENT + '// Label + error text pembungkus') : null),
    },
    {
      label: 'blok error di <Field>',
      re: /\{error \? \(\r?\n\s*<span\r?\n\s*className="flex items-center gap-1\.5 mt-1\.5 text-xs font-medium text-red-600 animate-\[fadeIn_150ms_ease-out\]"\r?\n\s*role="alert"\r?\n\s*>\r?\n\s*<AlertCircle size=\{13\} className="shrink-0 text-red-500" \/>\r?\n\s*\{error\}\r?\n\s*<\/span>\r?\n\s*\) : hint/,
      to: '{error ? (\n        <InlineError>{error}</InlineError>\n      ) : hint',
    },
  ],
});

// error foto di modal aksi inventory
for (const file of ['SerahTerimaModal', 'PengembalianModal', 'LaporKerusakanModal']) {
  FILES.push({
    rel: `${J}inventory/aksi/${file}.tsx`,
    marker: /<p className="mt-1(?:\.5)? text-xs text-red-600 font-medium">\{errors\.foto\}<\/p>/,
    ops: [
      { re: /<p className="mt-1(?:\.5)? text-xs text-red-600 font-medium">\{errors\.foto\}<\/p>/, to: '<InlineError>{errors.foto}</InlineError>' },
      addInlineErrorImport(),
    ],
  });
}

// "Pilih minimal 1 kolom data untuk diekspor." di modal export
for (const rel of [
  `${J}penanganan/export/PenangananExportModal.tsx`,
  `${J}laporan/export/InventoryExportModal.tsx`,
  `${J}laporan/export/InventoryPemakaiExportModal.tsx`,
  `${J}laporan/export/KaryawanExportModal.tsx`,
]) {
  const re = /<p className="mt-1\.5 text-xs text-red-600 font-medium">(\s*Pilih minimal 1 kolom data untuk diekspor\.\s*)<\/p>/;
  FILES.push({ rel, marker: re, ops: [{ re, to: '<InlineError>$1</InlineError>' }, addInlineErrorImport()] });
}

FILES.push({
  rel: `${J}inventory/form/InventoryFormModal.tsx`,
  marker: '{fotoError && <span className="block mt-1 text-xs text-red-600',
  ops: [
    {
      re: /\{fotoError && <span className="block mt-1 text-xs text-red-600 animate-\[fadeIn_120ms_ease-out\]">\{fotoError\}<\/span>\}/,
      to: '{fotoError && <InlineError>{fotoError}</InlineError>}',
    },
    addInlineErrorImport(),
  ],
});

FILES.push({
  rel: 'resources/js/pages/Settings/Index.tsx',
  marker: 'return <p className="text-xs text-red-500 mt-1">{message}</p>;',
  ops: [
    { from: 'return <p className="text-xs text-red-500 mt-1">{message}</p>;', to: 'return <InlineError>{message}</InlineError>;' },
    addInlineErrorImport('../../components/form/FormControls'),
  ],
});


// validasi client di form Master Data: tetap inline di bawah kolom, tapi sekarang juga toast (pola CabangTab)
for (const file of ['supplier/SupplierTab.tsx', 'kategori/KategoriTab.tsx', 'departemen/DepartemenTab.tsx']) {
  const re = /^([ \t]*)setFormError\('(Nama \w+ tidak boleh kosong!)'\);\r?\n([ \t]*return;)/m;
  FILES.push({
    rel: `${J}master-data/${file}`,
    marker: re,
    ops: [
      { re, to: "$1setFormError('$2');\n$1toastFormErrors({ nama: '$2' });\n$3" },
      {
        label: 'import toastFormErrors',
        fn: (t) =>
          t.includes('toastFormErrors }') || t.includes("lib/toastErrors")
            ? t
            : t.replace("import toast from 'react-hot-toast';\n", "import toast from 'react-hot-toast';\nimport { toastFormErrors } from '../../../lib/toastErrors';\n"),
      },
    ],
  });
}



// pesan sama persis dengan aturan server (InventoryPenangananAction: Rule::requiredIf hasil === 'diperbaiki')
const VALIDASI_CLIENT =
  "    // sama dengan aturan server: biaya komponen & jasa wajib kalau hasilnya diperbaiki\n" +
  "    if (!isRusakBerat) {\n" +
  "      const clientErrors: Record<string, string> = {};\n" +
  "      if (!biayaKomponen.trim()) clientErrors.biaya_komponen = 'Biaya komponen wajib diisi kalau hasilnya diperbaiki.';\n" +
  "      if (!hargaJasa.trim()) clientErrors.harga_jasa = 'Biaya jasa wajib diisi kalau hasilnya diperbaiki.';\n" +
  "      if (Object.keys(clientErrors).length > 0) {\n" +
  "        setErrors(clientErrors);\n" +
  "        toastFormErrors(clientErrors);\n" +
  "        return;\n" +
  "      }\n" +
  "    }\n";

// ---------------------------------------------------------------- Penanganan: toast + inline per-field
for (const [file, fallback] of [
  ['FormPerbaikanModal.tsx', 'Gagal menyimpan perbaikan.'],
  ['PenangananSelesaiModal.tsx', 'Gagal menandai penanganan selesai.'],
]) {
  const fieldOp = (setter, key) => ({
    re: new RegExp(`onChange=\\{\\(e\\) => ${setter}\\(e\\.target\\.value\\)\\}([\\s\\S]*?)className="([^"]*)"(\\r?\\n\\s*)/>`),
    to: `onChange={(e) => { ${setter}(e.target.value); clearError('${key}'); }}$1className={\`$2\${errCls('${key}')}\`}$3/>$3<InlineError>{errors.${key}}</InlineError>`,
  });
  FILES.push({
    rel: `${J}penanganan/modals/${file}`,
    marker: `onError: (errors) => toastFormErrors(errors, '${fallback}'),`,
    ops: [
      {
        label: 'import InlineError',
        fn: (t) =>
          t.replace(
            "import { toastFormErrors } from '../../../lib/toastErrors';\n",
            "import { toastFormErrors } from '../../../lib/toastErrors';\nimport { InlineError } from '../../../components/form/FormControls';\n",
          ),
      },
      {
        label: 'state errors',
        re: /(  const \[submitting, setSubmitting\] = useState\(false\);\r?\n)/,
        to:
          "$1  const [errors, setErrors] = useState<Record<string, string>>({});\n" +
          "  const clearError = (key: string) => {\n" +
          "    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));\n" +
          "  };\n" +
          "  const errCls = (key: string) => (errors[key] ? ' !border-red-400 focus:!ring-red-400' : '');\n",
      },
      { re: /(if \(value === 'rusak_berat'\) \{\r?\n)/, to: '$1      setErrors({});\n' },
      {
        label: 'validasi client + reset error',
        re: /(  const handleSubmit = \(\) => \{\r?\n)(    setSubmitting\(true\);)/,
        to: "$1" + VALIDASI_CLIENT + "    setErrors({});\n$2",
      },
      {
        label: 'onError',
        from: `onError: (errors) => toastFormErrors(errors, '${fallback}'),`,
        to: `onError: (serverErrors) => {\n        setErrors(serverErrors);\n        toastFormErrors(serverErrors, '${fallback}');\n      },`,
      },
      fieldOp('setTanggalSelesai', 'tanggal_selesai'),
      fieldOp('setBiayaKomponen', 'biaya_komponen'),
      fieldOp('setHargaJasa', 'harga_jasa'),
      fieldOp('setCatatan', 'catatan'),
    ],
  });
}


// modal Penanganan: lebarkan sedikit (pesan error di grid 2 kolom kepanjangan di max-w-sm)
for (const file of ['FormPerbaikanModal.tsx', 'PenangananSelesaiModal.tsx']) {
  const from = 'w-full max-w-sm max-h-[90vh]';
  FILES.push({
    rel: `${J}penanganan/modals/${file}`,
    marker: from,
    ops: [{ from, to: 'w-full max-w-md max-h-[90vh]' }],
  });
}


// MIGRASI: kalau sebelumnya sempat menjalankan versi yang membuang validasi client di modal Penanganan,
// pasang lagi (idempotent: dilewati kalau validasi sudah ada).
for (const file of ['FormPerbaikanModal.tsx', 'PenangananSelesaiModal.tsx']) {
  const sisip = '  const handleSubmit = () => {\n    setErrors({});\n    setSubmitting(true);';
  FILES.push({
    rel: `${J}penanganan/modals/${file}`,
    marker: (t) => t.includes(sisip) && !t.includes('clientErrors'),
    ops: [{ from: sisip, to: '  const handleSubmit = () => {\n' + VALIDASI_CLIENT + '    setErrors({});\n    setSubmitting(true);' }],
  });
}


// ---------------------------------------------------------------- 7) Audit Log: hanya request berhasil
// (method tandaiGagal() sengaja dipertahankan: dipakai sebagai penentu, dan fix-audit.mjs memakainya sebagai marker)
FILES.push({
  rel: 'app/Http/Middleware/LogActivity.php',
  marker: "' (GAGAL)' : ''",
  ops: [
    {
      label: 'lewati request gagal',
      from: "        AuditLog::create([\n            'user_id' => $request->user()?->id,",
      to:
        "        // Audit Log cuma mencatat aksi yang BERHASIL. Request gagal (status >= 400, atau redirect balik membawa\n" +
        "        // error validasi / aturan bisnis) tidak dicatat.\n" +
        "        if ($this->tandaiGagal($request, $response)) {\n" +
        "            return;\n" +
        "        }\n\n" +
        "        AuditLog::create([\n            'user_id' => $request->user()?->id,",
    },
    {
      label: 'buang penanda (GAGAL)',
      from: "mb_strimwidth($this->buatDeskripsi($request), 0, 240, '…') . ($this->tandaiGagal($request, $response) ? ' (GAGAL)' : ''),",
      to: "mb_strimwidth($this->buatDeskripsi($request), 0, 240, '…'),",
    },
    {
      label: 'komentar tandaiGagal',
      from: '// Gagal = response error (>= 400, termasuk exception) atau redirect balik membawa error validasi/aturan bisnis.',
      to: '// Gagal = response error (>= 400, termasuk exception) atau redirect balik membawa error validasi/aturan bisnis.\n    // Request gagal TIDAK dicatat di Audit Log (lihat log()).',
    },
  ],
  left: [/\(GAGAL\)/],
});

// ---------------------------------------------------------------- jalankan
let ok = 0, skip = 0, bad = 0;

for (const f of FILES) {
  const file = path.join(root, f.rel);
  const bk = path.join(BK, f.rel);

  if (REVERT) {
    if (fs.existsSync(bk)) { fs.copyFileSync(bk, file); console.log('  dikembalikan  ' + f.rel); }
    continue;
  }
  if (!fs.existsSync(file)) { console.log('! file tidak ada, dilewati: ' + f.rel); bad++; continue; }

  const orig = fs.readFileSync(file, 'utf8');
  const hasMarker = typeof f.marker === 'string' ? orig.includes(f.marker) : typeof f.marker === 'function' ? f.marker(orig) : f.marker.test(orig);
  if (!hasMarker) { console.log('  sudah ter-patch: ' + f.rel); skip++; continue; }

  let t = orig;
  let fail = null;
  for (const op of f.ops) {
    let next;
    if (op.fn) {
      next = op.fn(t);
      if (next == null) { if (op.optional) continue; fail = op.label ?? 'fn'; break; }
    } else if (op.re) {
      if (!op.re.test(t)) { op.re.lastIndex = 0; if (op.optional) continue; fail = String(op.re).slice(0, 90); break; }
      op.re.lastIndex = 0;
      next = t.replace(op.re, op.to);
    } else {
      if (!t.includes(op.from)) { if (op.optional) continue; fail = op.from.slice(0, 90); break; }
      next = t.replace(op.from, op.to);
    }
    t = next;
  }
  if (!fail) {
    const sisa = (f.left ?? []).find((re) => re.test(t));
    if (sisa) fail = `masih ada sisa referensi ${sisa} setelah patch`;
  }
  if (fail) { console.log(`! pola tidak cocok di ${f.rel}, file TIDAK diubah:\n    ${fail}`); bad++; continue; }

  console.log((DRY ? '  [dry] ' : '  ok ') + f.rel);
  ok++;
  if (!DRY && t !== orig) {
    fs.mkdirSync(path.dirname(bk), { recursive: true });
    if (!fs.existsSync(bk)) fs.writeFileSync(bk, orig);
    fs.writeFileSync(file, t);
  }
}

if (!REVERT) {
  console.log(`\nSelesai: ${ok} ${DRY ? 'akan diubah' : 'diubah'}, ${skip} sudah ter-patch, ${bad} bermasalah.`);
  if (!DRY && ok) console.log('Backup di .migrasi-backup/update-toast/ (node scripts/update-toast.mjs --revert untuk balikin).');
}
