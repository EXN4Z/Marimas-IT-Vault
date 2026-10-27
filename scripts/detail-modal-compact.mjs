// detail-modal-compact.mjs
// Modal detail inventory: lebih sempit (4xl -> 3xl), 1 kolom (ga gepeng lagi), padding & ukuran lebih kecil.
// Jalanin dari root project (marimas-it-vault):
//   node scripts/detail-modal-compact.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join('resources', 'js', 'features', 'inventory', 'detail');

const edits = [
  {
    file: 'InventoryDetailModal.tsx',
    changes: [
      // lebar modal
      ['w-full max-w-4xl max-h-[92vh]', 'w-full max-w-3xl max-h-[90vh]'],
      // header lebih tipis
      ['px-6 pt-4 pb-3 shrink-0', 'px-5 pt-3.5 pb-3 shrink-0'],
      ['text-[22px] leading-[1.1] font-bold mt-0.5 mb-2 truncate', 'text-xl leading-[1.1] font-bold mt-0.5 mb-1.5 truncate'],
      // body
      ['px-6 py-4 overflow-y-auto space-y-4', 'px-5 py-3.5 overflow-y-auto space-y-3.5'],
      // skeleton foto
      ['w-28 h-28 rounded-md flex-shrink-0', 'w-24 h-24 rounded-md flex-shrink-0'],
      // pembungkus 2 kolom -> 1 kolom (section ditumpuk)
      [
        '<div className="grid gap-5 md:grid-cols-2 md:gap-x-8 items-start">\n              <div className="space-y-5 min-w-0">',
        '<div className="space-y-4 min-w-0">\n              <div className="space-y-4 min-w-0">',
      ],
      [
        '              </div>\n\n              <div className="space-y-5 min-w-0">\n              {/* Riwayat pemakai / peminjaman */}',
        '              </div>\n\n              <div className="space-y-4 min-w-0">\n              {/* Riwayat pemakai / peminjaman */}',
      ],
      // Pengadaan & lokasi: 2 kolom di dalam section
      [
        '<div className="[&>.dv-row:first-child]:border-t-0">\n                  <div className="dv-row">\n                    <span>Perusahaan</span>',
        '<div className="grid md:grid-cols-2 md:gap-x-8 [&>.dv-row:first-child]:border-t-0 md:[&>.dv-row:nth-child(2)]:border-t-0">\n                  <div className="dv-row">\n                    <span>Perusahaan</span>',
      ],
      // footer
      ['flex items-center justify-end px-6 py-2.5 shrink-0', 'flex items-center justify-end px-5 py-2 shrink-0'],
    ],
  },
  {
    file: 'InventoryDetailHero.tsx',
    changes: [
      ['sm:grid-cols-[112px_1fr]', 'sm:grid-cols-[96px_1fr]'],
      ['w-28 h-28 rounded-md overflow-hidden', 'w-24 h-24 rounded-md overflow-hidden'],
      ['<ImageOff size={24} />', '<ImageOff size={20} />'],
      ['<div className="grid gap-5 sm:grid-cols', '<div className="grid gap-4 sm:grid-cols'],
    ],
  },
];

let failed = false;
const pending = [];

for (const { file, changes } of edits) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) {
    console.error(`[X] ga ketemu: ${p} (jalanin dari root project ya)`);
    failed = true;
    continue;
  }
  let src = fs.readFileSync(p, 'utf8');
  const crlf = src.includes('\r\n');
  if (crlf) src = src.replace(/\r\n/g, '\n'); // normalisasi biar match di Windows
  let n = 0;
  for (const [from, to] of changes) {
    if (src.includes(to) && !src.includes(from)) continue; // udah pernah dijalanin
    const count = src.split(from).length - 1;
    if (count !== 1) {
      console.error(`[X] ${file}: pola ditemukan ${count}x (harus 1x) -> ${from.slice(0, 70).replace(/\n/g, '\\n')}...`);
      failed = true;
      continue;
    }
    src = src.replace(from, () => to);
    n++;
  }
  pending.push({ p, file, n, out: crlf ? src.replace(/\n/g, '\r\n') : src });
}

if (failed) {
  console.error('\nAda yang gagal, file TIDAK ditulis. Cek pesan di atas.');
  process.exit(1);
}
for (const { p, file, n, out } of pending) {
  fs.writeFileSync(p, out, 'utf8');
  console.log(`[OK] ${file}: ${n} perubahan`);
}
console.log('\nSelesai. Cek di browser (Vite HMR otomatis reload).');
