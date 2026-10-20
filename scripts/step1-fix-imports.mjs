#!/usr/bin/env node
// Langkah 1 refactor: perbaiki import yang rusak setelah pindah folder (frontend).
// Jalankan dari root project:  node scripts/step1-fix-imports.mjs
// Aman dijalankan ulang (idempotent). Tidak menyentuh file di luar resources/js.
import fs from 'node:fs';
import path from 'node:path';

const JS = 'resources/js';
if (!fs.existsSync(JS)) { console.error('Jalankan dari root project (folder resources/js tidak ketemu).'); process.exit(1); }

const TYPE_FILES = {
  "features/inventory/types/inventory.ts": "import type { Kategori } from '../../master-data/kategori/types';\nimport type { Supplier } from '../../master-data/supplier/types';\nimport type { Perusahaan } from '../../master-data/perusahaan/types';\nimport type { InventoryPenanganan } from '../../penanganan/types';\nimport type { InventoryPemakai } from './inventoryPemakai';\n\nexport type InventoryStatus = 'tersedia' | 'dipakai' | 'menunggu_perbaikan' | 'diperbaiki' | 'rusak_berat' | 'dijual';\n// Struktur (induk/menempel) sekarang murni soal parent_id, independen dari\n// kategori -- lihat backend InventoryController::index(). 'induk' =\n// parent_id === null (boleh punya children, boleh juga berdiri sendiri\n// tanpa children). 'menempel' = parent_id !== null.\ntype InventoryPosisi = 'induk' | 'menempel';\n\nexport interface KategoriRef {\n  id: number;\n  nama: string;\n}\n\n// Tipe & fungsi penanganan kerusakan (InventoryPenanganan) ada di\n// ../transaksi/inventoryPenanganan.ts — import dari sana, jangan didefinisikan ulang di sini.\n// Tipe pemakai (InventoryPemakai) ada di ../transaksi/inventoryPemakai.ts —\n// import dari sana, jangan didefinisikan ulang di sini.\n\n// Satu baris `inventory` bisa jadi kategori APA SAJA (bebas, gak lagi cuma 2\n// golongan \"Barang Utama\"/\"Kelengkapan\") -- struktur induk/menempel murni\n// ditentukan `parent_id`, independen dari kategori. `parent`/`children` cuma\n// keisi di endpoint show(), atau lewat query ?parent_id= di index() buat\n// nested/expand view.\nexport interface Inventory {\n  id: number;\n  kode_inventory: string;\n  parent_id: number | null;\n  parent?: Inventory | null;\n  children?: Inventory[];\n  merk: string | null;\n  type: string | null;\n  kategori_id: number | null;\n  kategori?: KategoriRef | null;\n  nama: string | null;\n  warna: string | null;\n  serial_number: string | null;\n  jumlah: number;\n  tanggal_garansi: string | null;\n  perusahaan_id: number | null;\n  perusahaan?: Perusahaan | null;\n  keterangan: string | null;\n  foto: string | null;\n  supplier_id: number | null;\n  supplier?: Supplier | null;\n  tanggal_input: string | null;\n  tanggal_invoice: string | null;\n  no_surat_jalan: string | null;\n  no_good_receive: string | null;\n  status: InventoryStatus;\n  tanggal_rusak: string | null; // ISO datetime, keisi begitu kelengkapan dilaporkan rusak\n  pemakai_saat_ini?: InventoryPemakai | null;\n  pemakai?: InventoryPemakai[]; // riwayat lengkap, cuma keisi di endpoint show()\n  penanganan?: InventoryPenanganan[]; // riwayat lengkap, cuma keisi di endpoint show()\n  penanganan_aktif?: { id: number; jenis_kerusakan: string; keluhan: string; tanggal_lapor: string } | null;\n  // catatan penjualan/writeoff — cuma keisi kalau status 'dijual'\n  writeoff?: {\n    id: number;\n    alasan: string;\n    no_berita_acara: string | null;\n    tanggal_writeoff: string;\n    catatan: string | null;\n    penyetuju?: { id: number; name: string } | null;\n    created_at: string;\n  } | null;\n}\n\nexport interface InventoryFormValues {\n  kategori_id?: number | null;\n  parent_id?: number | null; // cuma valid kalau kategori-nya 'Kelengkapan', dan harus nunjuk ke barang_utama\n  nama?: string;\n  warna?: string;\n  serial_number?: string;\n  merk?: string;\n  type?: string;\n  jumlah?: number;\n  tanggal_garansi?: string;\n  perusahaan_id?: number | null;\n  keterangan?: string;\n  foto?: File | null;\n  supplier_id?: number | null;\n  tanggal_input?: string;\n  tanggal_invoice?: string;\n  no_surat_jalan?: string;\n  no_good_receive?: string;\n  hapus_foto?: boolean;\n}\n\n// [F4-INERTIA] Bentuk props tab Inventory dari server (MasterDataPageController -> InventoryWebController).\n// Satu baris list = Inventory + children_count (withCount('children')).\nexport type InventoryRow = Inventory & { children_count?: number };\n\nexport interface InventoryList {\n  data: InventoryRow[];\n  total: number;\n  current_page: number;\n  last_page: number;\n  per_page: number;\n  ada_induk: boolean;\n  filters: {\n    search: string;\n    status: InventoryStatus | '';\n    kategori: number[];\n  };\n}\n\n// Pilihan dropdown form Tambah/Edit & filter kategori (non-admin menerima daftar kosong).\nexport interface InventoryOpsi {\n  kategori: Kategori[];\n  supplier: Supplier[];\n  perusahaan: Perusahaan[];\n}\n\n// Kandidat induk buat \"Pasang ke Induk\".\nexport interface InventoryIndukOpsi {\n  id: number;\n  kode_inventory: string;\n  nama: string | null;\n}\n",
  "features/inventory/types/inventoryPemakai.ts": "import type { Inventory } from './inventory';\n\nexport type InventoryPemakaiStatus = 'pending' | 'disetujui' | 'ditolak';\n\nexport interface KaryawanUser {\n  id: number;\n  name: string;\n  role?: string;\n  nik?: string | null;\n  departemen?: { id: number; nama: string } | null;\n  status?: 'aktif' | 'nonaktif';\n}\n\nexport interface InventoryPemakai {\n  created_at: string;\n  id: number;\n  inventory_id: number;\n  user_id: number | null;\n  user?: { id: number; name: string; role?: string; nik?: string | null; departemen?: { id: number; nama: string } | null } | null;\n  status: InventoryPemakaiStatus;\n  requested_by_user_id: number | null;\n  nomor_penerimaan: string | null;\n  no_struk_penerimaan: string | null;\n  tanggal_penerimaan: string | null; // nullable — request pending belum ada tanggal penerimaan\n  catatan_penerimaan: string | null;\n  nomor_pengembalian: string | null;\n  no_struk_pengembalian: string | null;\n  tanggal_pengembalian: string | null;\n  catatan_pengembalian: string | null;\n  catatan_penolakan: string | null;\n  inventory?: Inventory; // keisi kalau di-load dari endpoint /inventory-pemakai/riwayat atau /inventory-pemakai\n}\n\nexport interface FotoPemakaiEntry {\n  id: number;\n  inventory_id: number;\n  inventory?: { id: number; kode_inventory: string; nama: string | null; merk?: string | null; type?: string | null } | null;\n  user_id: number | null;\n  user?: { id: number; name: string } | null;\n  tanggal_penerimaan: string | null;\n  tanggal_pengembalian: string | null;\n  diterima_at: string | null;\n  dikembalikan_at: string | null;\n  foto_penerimaan: string[] | null;\n  foto_pengembalian: string[] | null;\n  created_at: string;\n}\n\n// Satu entri riwayat aktivitas inventory — dari peminjaman (pinjam/kembali),\n// penanganan kerusakan, atau penjualan/writeoff (dijual), digabung backend.\nexport interface RiwayatInventoryEvent {\n  type: 'pinjam' | 'kembali' | 'lapor_rusak' | 'mulai_perbaikan' | 'selesai_perbaikan' | 'dijual';\n  waktu: string;\n  nama: string | null;\n  inventory: { id: number; kode_inventory?: string; nama: string | null } | null;\n  tipe_item: 'barang_utama' | 'kelengkapan';\n  keluhan?: string | null; // dipakai lapor_rusak (keluhan) & dijual (alasan)\n  hasil?: string | null;\n}\n",
  "features/penanganan/types.ts": "import type { Inventory } from '../inventory/types/inventory';\n\ninterface PenangananPemakai {\n  id: number;\n  user?: {\n    id: number;\n    name: string;\n  };\n}\n\nexport interface InventoryPenanganan {\n  id: number;\n  inventory_id: number;\n  inventory_pemakai_id: number | null;\n  // Satu daftar gabungan buat item apapun, gak lagi tergantung kategori/\n  // posisi (induk vs menempel): 'hardware' | 'software' | 'tidak_berfungsi'\n  // | 'hancur' | 'terputus_sobek'. Dibiarkan string biasa (bukan union)\n  // biar longgar -- lihat JENIS_KERUSAKAN_OPTIONS di inventoryHelpers.ts.\n  jenis_kerusakan: string;\n  keluhan: string;\n  tanggal_lapor: string;\n  // waktu kejadian akurat (jam-menit-detik lengkap) -- kolom tanggal_lapor\n  // di atas cuma nyimpen tanggal doang, jamnya selalu 00:00:00.\n  lapor_at: string | null;\n  foto: string | null;\n  tanggal_diterima: string | null;\n  // waktu akurat (dengan jam) -- kolom tanggal_* cuma nyimpen tanggal.\n  diterima_at?: string | null;\n  tanggal_selesai: string | null;\n  selesai_at?: string | null;\n  harga_jasa: number | null;\n  biaya_komponen: number | null;\n  hasil: string | null;\n  no_struk: string | null;\n  catatan: string | null;\n  total_biaya?: number;\n  durasi_hari?: number | null;\n  // total durasi lapor -> selesai dalam detik; format tampilan pakai formatDurasi()\n  durasi_detik?: number | null;\n  inventory?: Inventory;\n  pemakai?: PenangananPemakai | null;\n  // siapa yang BENERAN submit laporan (bisa admin lapor saat audit gudang,\n  // jadi pemakai bisa kosong). Sumber kebenaran buat \"Pelapor\".\n  dilaporkan_oleh?: { id: number; name: string } | null;\n}\n\n// [F6-INERTIA] Bentuk props halaman Penanganan dari server (PenangananInventoryPageController -> InventoryPenangananWebController).\nexport type PenangananTab = 'menunggu' | 'diperbaiki' | 'diperbaiki_selesai' | 'rusak_berat';\n\nexport interface PenangananList {\n  data: InventoryPenanganan[];\n  total: number;\n  current_page: number;\n  last_page: number;\n  per_page: number;\n  counts: Record<PenangananTab, number>;\n  filters: {\n    tab: PenangananTab;\n    search: string;\n    jenis: string;\n  };\n}\n",
  "features/karyawan/types.ts": "export interface Departemen {\n  id: number\n  nama: string\n}\n\nexport interface LokasiKantor {\n  id: number\n  nama: string\n}\n\nexport interface Perusahaan {\n  id: number\n  nama: string\n}\n\nexport interface Karyawan {\n  id: number\n  nik: string\n  name: string\n  email: string\n  phone: string\n  departemen: Departemen | null\n  lokasi_kantor: LokasiKantor | null\n  perusahaan: Perusahaan | null\n  tanggal_masuk: string\n  role_id: number\n  role: string\n  status?: 'aktif' | 'nonaktif'\n  created_at?: string\n  updated_at?: string\n}\n\n// [F3-INERTIA] Bentuk props tab Karyawan dari server (MasterDataPageController -> KaryawanWebController).\n// Satu baris = Karyawan lengkap + id relasi (dipakai form Edit).\nexport interface KaryawanRow extends Karyawan {\n  departemen_id: number | null;\n  lokasi_kantor_id: number | null;\n  perusahaan_id: number | null;\n}\n\nexport interface KaryawanList {\n  data: KaryawanRow[];\n  total: number;\n  current_page: number;\n  last_page: number;\n  per_page: number;\n  filters: {\n    search: string;\n    role: 'semua' | 'user' | 'admin';\n  };\n}\n\n// Pilihan dropdown form Tambah/Edit user.\nexport interface KaryawanOpsi {\n  departemen: Departemen[];\n  cabang: LokasiKantor[];\n  perusahaan: Perusahaan[];\n  roles: { id: number; nama: string }[];\n}\n"
};

// Spesifier lama (tanpa ../ di depan) -> lokasi baru relatif ke resources/js
const MAP = {
  'api/masterData/inventory': 'features/inventory/types/inventory',
  'api/masterData/karyawan': 'features/karyawan/types',
  'api/masterData/kategori': 'features/master-data/kategori/types',
  'api/masterData/departemen': 'features/master-data/departemen/types',
  'api/masterData/cabang': 'features/master-data/cabang/types',
  'api/masterData/perusahaan': 'features/master-data/perusahaan/types',
  'api/masterData/supplier': 'features/master-data/supplier/types',
  'api/transaksi/inventoryPemakai': 'features/inventory/types/inventoryPemakai',
  'api/transaksi/inventoryPenanganan': 'features/penanganan/types',
  'types/karyawan': 'features/karyawan/types',
  'types/supplier': 'features/master-data/supplier/types',
  'types/kategori': 'features/master-data/kategori/types',
  'types/departemen': 'features/master-data/departemen/types',
  'types/cabang': 'features/master-data/cabang/types',
  'types/perusahaan': 'features/master-data/perusahaan/types',
  'types/inventory': 'features/inventory/types/inventory',
  'types/inventoryPemakai': 'features/inventory/types/inventoryPemakai',
  'types/penanganan': 'features/penanganan/types',
  'types/inertia': 'types/inertia',
  'form/FormControls': 'components/form/FormControls',
  'form/SearchInput': 'components/form/SearchInput',
  'modal/Modal': 'components/modal/Modal',
  'modal/ConfirmDeleteModal': 'components/modal/ConfirmDeleteModal',
  'table/Pagination': 'components/table/Pagination',
  'utils/excelReport': 'utils/excelReport',
  'utils/printCsvReport': 'utils/printCsvReport',
  'hooks/useBackdropClose': 'hooks/useBackdropClose',
  'context/AuthContext': 'context/AuthContext',
  'features/laporan/KategoriExportModal': 'features/laporan/KategoriExportModal',
};
// Kasus khusus per file
const FILE_MAP = {
  'features/dashboard/types.ts|./inventoryPemakai': 'features/inventory/types/inventoryPemakai',
  'features/dashboard/types.ts|./notification': 'features/notifications/types',
  'types/laporan.ts|../api/masterData/inventory': 'features/inventory/types/inventory',
};
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '.css'];
const exists = (t) => EXTS.some((e) => fs.existsSync(t + e) && fs.statSync(t + e).isFile());
const log = [];

// 1) Tulis ulang file tipe (versi lengkap: definisi asli dari backup f10 + tipe props server)
for (const [rel, content] of Object.entries(TYPE_FILES)) {
  const p = path.join(JS, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== content) { fs.writeFileSync(p, content); log.push('tipe  ' + rel); }
}

// 2) Perbaiki import relatif yang tidak ter-resolve
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []);
const re = /((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;
for (const file of walk(JS)) {
  const rel = path.relative(JS, file).split(path.sep).join('/');
  const dir = path.dirname(file);
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(re, (m, pre, q, spec) => {
    if (exists(path.normalize(path.join(dir, spec)))) return m;
    const tgt = FILE_MAP[rel + '|' + spec] ?? MAP[spec.replace(/^(\.{1,2}\/)+/, '')];
    if (!tgt) return m;
    let r = path.relative(dir, path.join(JS, tgt)).split(path.sep).join('/');
    if (!r.startsWith('.')) r = './' + r;
    return pre + q + r + q;
  });
  if (out !== src) { fs.writeFileSync(file, out); log.push('import ' + rel); }
}

// 3) Nama komponen yang salah di JSX
const rename = (rel, fn) => {
  const p = path.join(JS, rel);
  if (!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, 'utf8'), o = fn(s);
  if (o !== s) { fs.writeFileSync(p, o); log.push('nama   ' + rel); }
};
rename('inertia/pages/MasterData/Index.tsx', (s) =>
  s.replace(/<Tab(Kategori|Karyawan|Cabang|Perusahaan|Departemen|Supplier) \/>/g, '<$1Tab />'));
rename('features/penanganan/PenangananPage.tsx', (s) =>
  s.replace(/InventoryPenangananExportModal/g, 'PenangananExportModal'));

// 4) Hapus duplikat lama di types/ (identik dengan versi di features/, tidak dipakai siapa pun)
for (const rel of ['types/dashboard.ts', 'types/notification.ts']) {
  const p = path.join(JS, rel);
  if (fs.existsSync(p)) { fs.unlinkSync(p); log.push('hapus  ' + rel); }
}

console.log(log.join('\n') || 'Tidak ada yang perlu diubah.');
console.log(`\nSelesai: ${log.length} perubahan. Lanjut: npx tsc --noEmit && npm run build`);
