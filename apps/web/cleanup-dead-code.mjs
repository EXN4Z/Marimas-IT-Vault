// Jalankan dari root folder frontend (yang ada package.json):
//   node cleanup-dead-code.mjs
// Cek hasilnya dengan `git diff`, lalu `npm run build`.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');
if (!fs.existsSync(SRC)) {
  console.error('Folder src/ nggak ketemu. Jalankan dari root folder frontend.');
  process.exit(1);
}

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const write = (rel, txt) => fs.writeFileSync(path.join(SRC, rel), txt);
const warn = (msg) => console.warn('  ! ' + msg);

// Hapus 1 deklarasi top-level (fungsi/const/interface/type) beserta komentar di atasnya.
function deleteDecl(rel, name) {
  const eol = read(rel).includes('\r\n') ? '\r\n' : '\n';
  const lines = read(rel).split(/\r?\n/);
  const startRe = new RegExp(`^(export\\s+)?(default\\s+)?(async\\s+)?(function|const|let|interface|type)\\s+${name}\\b`);
  const start = lines.findIndex((l) => startRe.test(l));
  if (start === -1) return warn(`${rel}: "${name}" nggak ketemu (mungkin sudah dihapus)`);

  let depth = 0;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if ('{[('.includes(ch)) depth++;
      else if ('}])'.includes(ch)) depth--;
    }
    const t = lines[i].trim();
    if (depth <= 0 && (t.endsWith(';') || t.endsWith('}'))) {
      end = i;
      break;
    }
  }

  let from = start;
  while (from > 0 && lines[from - 1].trim().startsWith('//')) from--;
  let to = end;
  if (lines[to + 1] !== undefined && lines[to + 1].trim() === '') to++; // buang 1 baris kosong sesudahnya

  lines.splice(from, to - from + 1);
  write(rel, lines.join(eol));
  console.log(`  - hapus ${name}  (${rel})`);
}

// Cabut kata `export` dari deklarasi (deklarasinya tetap ada, masih dipakai di file itu).
function unexport(rel, name) {
  const txt = read(rel);
  const re = new RegExp(`^export\\s+(?:default\\s+)?(?=(?:async\\s+)?(?:function|const|let|interface|type)\\s+${name}\\b)`, 'm');
  if (!re.test(txt)) return warn(`${rel}: export "${name}" nggak ketemu (mungkin sudah dicabut)`);
  write(rel, txt.replace(re, ''));
  console.log(`  ~ cabut export ${name}  (${rel})`);
}

function replaceExact(rel, from, to) {
  const txt = read(rel);
  if (!txt.includes(from)) return warn(`${rel}: teks yang mau diganti nggak ketemu`);
  write(rel, txt.replace(from, to));
  console.log(`  ~ edit ${rel}`);
}

console.log('1) Hapus fungsi/konstanta yang benar-benar mati');
deleteDecl('api/auth.ts', 'changePassword');
deleteDecl('api/auth.ts', 'register');
deleteDecl('api/auth.ts', 'RegisterResponse');
deleteDecl('components/shared/skeleton/Skeleton.tsx', 'SkeletonText');
deleteDecl('components/shared/skeleton/Skeleton.tsx', 'SkeletonTextProps');
deleteDecl('components/shared/skeleton/Skeleton.tsx', 'SkeletonCircle');
deleteDecl('components/shared/skeleton/Skeleton.tsx', 'SkeletonCircleProps');
deleteDecl('pages/dashboard/widgets/theme.ts', 'NOTIF_VISIBLE_COUNT');
deleteDecl('pages/dashboard/widgets/primitives.tsx', 'PrimaryActionButton');
deleteDecl('utils/printCsvReport.ts', 'printCsvAsReport');
deleteDecl('utils/printCsvReport.ts', 'parseCsv');

console.log('2) Rapikan barrel index.ts');
write(
  'components/shared/skeleton/index.ts',
  `// Barrel export biar pemanggil cukup:
//   import { Skeleton, SkeletonTable, SkeletonCardGrid } from '../shared/skeleton';
// tanpa perlu nunjuk file satu-satu di dalam folder ini.

export { default as Skeleton } from './Skeleton';
export { SkeletonTable, SkeletonListCard } from './SkeletonTableRow';
export { SkeletonCardGrid } from './SkeletonCard';
export { default as SkeletonChart, SkeletonDonutChart } from './SkeletonChart';
`
);
console.log('  ~ edit components/shared/skeleton/index.ts');

{
  const rel = 'pages/dashboard/widgets/index.ts';
  const txt = read(rel)
    .split(/\r?\n/)
    .filter((l) => !l.includes("from './theme'") && !l.includes("from './primitives'"))
    .join(read(rel).includes('\r\n') ? '\r\n' : '\n');
  write(rel, txt);
  console.log('  ~ edit ' + rel);
}

console.log('3) Cabut export default yang nggak dipakai di luar file');
unexport('components/shared/skeleton/SkeletonCard.tsx', 'SkeletonCard');
unexport('components/shared/skeleton/SkeletonTableRow.tsx', 'SkeletonTableRow');

console.log('4) Cabut export yang cuma dipakai di dalam file sendiri');
unexport('components/shared/FormControls.tsx', 'textareaClass');
unexport('utils/excelReport.ts', 'buildStyledWorkbook');
for (const n of [
  'fetchUser',
  'fetchNotifications',
  'fetchDepartemenDistribusi',
  'fetchRingkasanInventory',
  'fetchAktivitasInventoryTerbaru',
  'fetchAktivitasInventoryKalender',
  'fetchInventoryPribadi',
  'fetchRingkasanAktivitasPribadi',
  'fetchInventoryPerMerek',
  'fetchTrenPembelianInventory',
  'fetchStatusInventoryDistribusi',
  'fetchInventoryPerhatian',
]) {
  unexport('pages/dashboard/useDashboardData.ts', n);
}

console.log('5) Cabut export tipe yang nggak diimpor siapa pun');
const types = [
  ['api/auditLog.ts', 'PaginatedAuditLog'],
  ['api/masterData/inventory.ts', 'InventoryPosisi'],
  ['api/masterData/inventory.ts', 'PaginatedInventory'],
  ['api/masterData/inventory.ts', 'PaginatedInventoryFoto'],
  ['api/masterData/karyawan.ts', 'KaryawanPayload'],
  ['api/transaksi/inventoryPemakai.ts', 'PaginatedFotoPemakai'],
  ['api/transaksi/inventoryPemakai.ts', 'PaginatedRiwayatInventory'],
  ['api/transaksi/inventoryPenanganan.ts', 'PaginatedInventoryPenanganan'],
  ['hooks/usePushNotifications.ts', 'PushStatus'],
  ['pages/dashboard/useDashboardData.ts', 'InventoryPribadi'],
  ['pages/dashboard/useDashboardData.ts', 'RingkasanAktivitasPribadi'],
  ['pages/dashboard/useDashboardData.ts', 'NotificationsResponse'],
  ['utils/excelReport.ts', 'StyledExcelOptions'],
  ['utils/printStruk.ts', 'StrukRow'],
  ['utils/printStruk.ts', 'StrukData'],
];
for (const [rel, name] of types) unexport(rel, name);

console.log('\nSelesai. Cek `git diff`, lalu jalankan `npm run build`.');
