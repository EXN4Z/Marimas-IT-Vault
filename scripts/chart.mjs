#!/usr/bin/env node
/**
 * chart.mjs — CHART PEMBELIAN: aktifkan tombol "1 Minggu" & "1 Bulan" di hero dashboard admin.
 *
 * Jalankan dari ROOT project (folder yang ada resources/js):
 *   node scripts/chart.mjs --dry              lihat rencana, tidak menulis apa pun
 *   node scripts/chart.mjs                    jalankan
 *   node scripts/chart.mjs --revert           kembalikan SEMUA yang diubah chart.mjs
 *   node scripts/chart.mjs --revert --force   revert walau file hasil chart.mjs sudah kamu edit
 *
 * Hasil (semua dihitung dari kolom inventory.tanggal_invoice = tanggal pembelian):
 *   1 Minggu  -> minggu ini, 7 titik: Senin, Selasa, ... Minggu
 *   1 Bulan   -> bulan ini, 4 titik: Minggu 1 (tgl 1-7), Minggu 2 (8-14), Minggu 3 (15-21), Minggu 4 (22-akhir bulan)
 *   1 Tahun   -> tidak diubah (tetap tren 12 bulan yang sudah ada)
 *   Satuan = 1 baris inventory = 1 unit (sama dengan chart tahunan). Baris tanpa tanggal_invoice tidak dihitung.
 *
 * File yang diubah (tanpa library baru, chart memakai SVG bawaan PertumbuhanChart):
 *   app/Queries/Dashboard/DashboardQuery.php             + pembelianMingguan(), pembelianBulanan(), dikirim di props `analitik`
 *   resources/js/features/dashboard/types.ts             + PembelianTitik, field opsional di DashboardAdminData
 *   resources/js/features/dashboard/DashboardAdmin.tsx   tombol rentang aktif + PertumbuhanChart menerima titik generik
 *
 * Backup ada di .migrasi-backup/chart/ (struktur folder sama) + manifest.json (sha256), pola sama dengan
 * scripts/dashboard.mjs. Semua perubahan divalidasi dulu: kalau ada satu anchor yang tidak ketemu, TIDAK ADA file yang ditulis.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry');
const REVERT = FLAGS.has('--revert');
const FORCE = FLAGS.has('--force');

const PHASE = 'chart';
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', PHASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const JS = path.join(ROOT, 'resources', 'js');

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

// ─────────────────────────────────────────────────────────────────────────────
// REVERT
// ─────────────────────────────────────────────────────────────────────────────
function revert() {
  if (!fs.existsSync(MANIFEST)) die('Tidak ada manifest chart — belum pernah dijalankan, atau sudah di-revert.');
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  const dirty = [];
  for (const e of m.files) {
    const abs = path.join(ROOT, e.path);
    if (fs.existsSync(abs) && sha(fs.readFileSync(abs, 'utf8')) !== e.sha) dirty.push(e.path);
  }
  if (dirty.length && !FORCE) {
    die(`File hasil chart ini sudah kamu ubah setelahnya:\n  ${dirty.join('\n  ')}\nRevert akan menimpa perubahan itu. Pakai --revert --force kalau memang mau.`);
  }

  log(DRY ? '\n[DRY] Revert chart akan:' : '\nRevert chart:');
  for (const e of m.files) {
    log(`  pulihkan  ${e.path}`);
    if (!DRY) fs.copyFileSync(path.join(BACKUP_DIR, e.path), path.join(ROOT, e.path));
  }
  if (!DRY) {
    fs.rmSync(MANIFEST);
    log('\n✔ Revert selesai. (Salinan backup tetap ada di .migrasi-backup/chart/)\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: tiap langkah harus cocok TEPAT satu kali, kalau tidak -> berhenti sebelum menulis apa pun.
// ─────────────────────────────────────────────────────────────────────────────
function countMatches(text, find) {
  if (find instanceof RegExp) return (text.match(new RegExp(find.source, find.flags.replace('g', '') + 'g')) || []).length;
  return text.split(find).length - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISI PATCH
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. DashboardQuery.php ────────────────────────────────────────────────────
const PHP_METHODS = String.raw`    /**
     * [CHART] Pembelian inventory MINGGU INI (Senin–Minggu), dihitung dari tanggal_invoice (tanggal pembelian).
     * 1 baris inventory = 1 unit (sama dengan tren 12 bulan). Baris tanpa tanggal_invoice tidak dihitung.
     * Bentuk tiap titik: label (sumbu X), judul (tooltip), jumlah.
     */
    public static function pembelianMingguan(): array
    {
        $awal = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $akhir = $awal->copy()->endOfWeek(Carbon::SUNDAY);
        $nama = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        $singkat = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

        $perTanggal = [];
        $hitung = Inventory::query()
            ->whereBetween('tanggal_invoice', [$awal->toDateString(), $akhir->toDateString()])
            ->selectRaw('tanggal_invoice as tgl, COUNT(*) as jumlah')
            ->groupBy('tanggal_invoice')
            ->pluck('jumlah', 'tgl');
        foreach ($hitung as $tgl => $n) {
            $perTanggal[substr((string) $tgl, 0, 10)] = (int) $n;
        }

        $rows = [];
        for ($i = 0; $i < 7; $i++) {
            $d = $awal->copy()->addDays($i);
            $rows[] = [
                'label' => $singkat[$i],
                'judul' => $nama[$i] . ', ' . $d->day . ' ' . self::BULAN_ID[$d->month - 1],
                'jumlah' => $perTanggal[$d->toDateString()] ?? 0,
            ];
        }

        return $rows;
    }

    /**
     * [CHART] Pembelian inventory BULAN INI per minggu, dari tanggal_invoice. Selalu 4 titik:
     * Minggu 1 = tgl 1–7, Minggu 2 = 8–14, Minggu 3 = 15–21, Minggu 4 = tgl 22 s/d akhir bulan (tgl 29–31 ikut Minggu 4).
     */
    public static function pembelianBulanan(): array
    {
        $awal = Carbon::now()->startOfMonth();
        $akhir = $awal->copy()->endOfMonth();
        $bln = self::BULAN_ID[$awal->month - 1];

        $perMinggu = [1 => 0, 2 => 0, 3 => 0, 4 => 0];
        $tanggal = Inventory::query()
            ->whereBetween('tanggal_invoice', [$awal->toDateString(), $akhir->toDateString()])
            ->pluck('tanggal_invoice');
        foreach ($tanggal as $t) {
            $hari = Carbon::parse($t)->day;
            $perMinggu[min(4, (int) ceil($hari / 7))]++;
        }

        $rentang = [1 => '1–7', 2 => '8–14', 3 => '15–21', 4 => '22–' . $awal->daysInMonth];
        $rows = [];
        foreach ($perMinggu as $no => $jumlah) {
            $rows[] = [
                'label' => 'Minggu ' . $no,
                'judul' => 'Minggu ' . $no . ' · ' . $rentang[$no] . ' ' . $bln,
                'jumlah' => $jumlah,
            ];
        }

        return $rows;
    }

`;

const PHP_ADMIN_LINE = `    /** Props dashboard ADMIN (lintas-perusahaan). Inventory = SEMUA item, termasuk kelengkapan. */`;
const PHP_RETURN_LINE = `            'trenPembelianInventory' => array_values($bulan),`;

// ── 2. types.ts ──────────────────────────────────────────────────────────────
const TS_TITIK = String.raw`
// [CHART] Satu titik chart pembelian (hero dashboard admin) untuk rentang 1 Minggu / 1 Bulan, dari tanggal_invoice.
//  - 1 Minggu: 7 titik, label "Sen".."Min", judul "Senin, 3 Nov"
//  - 1 Bulan : 4 titik, label "Minggu 1".."Minggu 4", judul "Minggu 1 · 1–7 Nov"
export interface PembelianTitik {
  label: string; // sumbu X
  judul: string; // judul tooltip
  jumlah: number; // unit dibeli pada titik itu
}
`;

const TS_FIELDS = String.raw`  trenPembelianInventory: TrenPembelianInventory[];
  pembelianMingguan?: PembelianTitik[]; // [CHART] opsional: payload lama tetap aman
  pembelianBulanan?: PembelianTitik[]; // [CHART] opsional: payload lama tetap aman
`;

// ── 3. DashboardAdmin.tsx ────────────────────────────────────────────────────
const TSX_CONSTS = String.raw`// [CHART] Pilihan rentang chart hero. 1 Minggu = Senin–Minggu (minggu ini), 1 Bulan = Minggu 1–4 (bulan ini),
// keduanya dari tanggal_invoice (DashboardQuery::pembelianMingguan/pembelianBulanan).
// 1 Tahun tetap memakai tren 12 bulan yang sudah ada (trenPembelianInventory).
type Rentang = 'minggu' | 'bulan' | 'tahun';
const RENTANG: { id: Rentang; teks: string; judul: string }[] = [
  { id: 'minggu', teks: '1 Minggu', judul: 'Pembelian inventory minggu ini (Senin sampai Minggu)' },
  { id: 'bulan', teks: '1 Bulan', judul: 'Pembelian inventory bulan ini (Minggu 1 sampai 4)' },
  { id: 'tahun', teks: '1 Tahun', judul: 'Pertumbuhan inventory per bulan' },
];

`;

const TSX_HERO_SIG_NEW = `function HeroInventory({
  total,
  tren = [],
  perMerek = [],
  mingguan = [],
  bulanan = [],
}: {
  total: number;
  tren?: TrenPembelianInventory[];
  perMerek?: InventoryPerMerek[];
  mingguan?: PembelianTitik[];
  bulanan?: PembelianTitik[];
}) {`;

const TSX_HERO_STATE = String.raw`  const merek = Array.isArray(perMerek) ? perMerek : [];
  // [CHART] rentang aktif -> titik chart (semua dibentuk jadi PembelianTitik supaya satu komponen chart untuk ketiganya)
  const [rentang, setRentang] = useState<Rentang>('tahun');
  const titik: PembelianTitik[] =
    rentang === 'minggu'
      ? Array.isArray(mingguan) ? mingguan : []
      : rentang === 'bulan'
        ? Array.isArray(bulanan) ? bulanan : []
        : rows.map((r) => ({ label: r.bulan, judul: r.bulan + (r.tahun ? ' ' + r.tahun : ''), jumlah: r.jumlah }));
  const judulChart = RENTANG.find((r) => r.id === rentang)?.judul ?? '';`;

const TSX_RANGE_BLOCK = String.raw`<div className="dd-rng" role="group" aria-label="Rentang waktu">
          {RENTANG.map((r) => (
            <button key={r.id} type="button" className={rentang === r.id ? 'is-on' : ''} aria-pressed={rentang === r.id} onClick={() => setRentang(r.id)}>
              {r.teks}
            </button>
          ))}
        </div>
        {titik.length === 0 ? <EmptyNote>Belum ada data inventory.</EmptyNote> : <PertumbuhanChart key={rentang} rows={titik} judulChart={judulChart} />}`;

const PLAN = [
  {
    file: 'app/Queries/Dashboard/DashboardQuery.php',
    steps: [
      { what: 'tambah pembelianMingguan() + pembelianBulanan()', find: PHP_ADMIN_LINE, replace: PHP_METHODS + PHP_ADMIN_LINE },
      {
        what: 'kirim di props analitik',
        find: PHP_RETURN_LINE,
        replace: PHP_RETURN_LINE + `\n            'pembelianMingguan' => self::pembelianMingguan(),\n            'pembelianBulanan' => self::pembelianBulanan(),`,
      },
    ],
  },
  {
    file: 'resources/js/features/dashboard/types.ts',
    steps: [
      {
        what: 'tambah interface PembelianTitik',
        find: /export interface TrenPembelianInventory \{[\s\S]*?\n\}\n/,
        replace: null, // diisi di bawah (butuh isi match)
      },
      { what: 'tambah field di DashboardAdminData', find: '  trenPembelianInventory: TrenPembelianInventory[];\n', replace: TS_FIELDS },
    ],
  },
  {
    file: 'resources/js/features/dashboard/DashboardAdmin.tsx',
    steps: [
      { what: 'import PembelianTitik', find: 'DashboardAdminData } from \'./types\';', replace: "DashboardAdminData, PembelianTitik } from './types';" },
      {
        what: 'ambil data dari analitik',
        find: 'const { ringkasanInventory, trenPembelianInventory, inventoryPerhatian, inventoryPerMerek, aktivitasKalender, terbanyakDipegang } = analitik;',
        replace:
          'const { ringkasanInventory, trenPembelianInventory, pembelianMingguan, pembelianBulanan, inventoryPerhatian, inventoryPerMerek, aktivitasKalender, terbanyakDipegang } = analitik;',
      },
      {
        what: 'kirim ke HeroInventory',
        find: '<HeroInventory total={ringkasanInventory?.total ?? 0} tren={trenPembelianInventory} perMerek={inventoryPerMerek} />',
        replace:
          '<HeroInventory total={ringkasanInventory?.total ?? 0} tren={trenPembelianInventory} perMerek={inventoryPerMerek} mingguan={pembelianMingguan} bulanan={pembelianBulanan} />',
      },
      {
        what: 'skala: izinkan step 1 dan 2 (jumlah per hari/minggu kecil)',
        find: 'const pilihan = [5, 10, 20, 25, 50, 100, 200, 500, 1000];',
        replace: 'const pilihan = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]; // [CHART] 1 & 2 ditambah untuk chart mingguan/bulanan',
      },
      {
        what: 'PertumbuhanChart: props generik',
        find: 'function PertumbuhanChart({ rows }: { rows: TrenPembelianInventory[] }) {',
        replace: 'function PertumbuhanChart({ rows, judulChart }: { rows: PembelianTitik[]; judulChart: string }) {',
      },
      { what: 'PertumbuhanChart: judul tooltip', find: /const namaBulan = .*;\n/, replace: 'const namaBulan = rows[active].judul;\n' },
      {
        what: 'PertumbuhanChart: aria-label',
        find: /aria-label=\{`Pertumbuhan inventory per bulan\.[^\n]*\}\n/,
        replace: "aria-label={judulChart + '. ' + namaBulan + ': ' + vals[active] + ' unit.'}\n",
      },
      { what: 'PertumbuhanChart: key label sumbu X', find: 'key={r.bulan + i}', replace: 'key={r.label + i}' },
      { what: 'PertumbuhanChart: teks label sumbu X', find: /\{r\.bulan\}(\s*<\/text>)/, replace: null, keepGroup: (m, g1) => '{r.label}' + g1 },
      {
        what: 'konstanta RENTANG',
        find: '// [DASHBOARD-V4] Kartu utama dashboard admin: total + perubahan bulan ini di kiri',
        replace: TSX_CONSTS + '// [DASHBOARD-V4] Kartu utama dashboard admin: total + perubahan bulan ini di kiri',
      },
      {
        what: 'HeroInventory: signature',
        find: 'function HeroInventory({ total, tren = [], perMerek = [] }: { total: number; tren?: TrenPembelianInventory[]; perMerek?: InventoryPerMerek[] }) {',
        replace: TSX_HERO_SIG_NEW,
      },
      { what: 'HeroInventory: state rentang', find: '  const merek = Array.isArray(perMerek) ? perMerek : [];', replace: TSX_HERO_STATE },
      {
        what: 'HeroInventory: tombol rentang + chart',
        find: /\{\/\* Data harian\/mingguan belum[\s\S]*?<PertumbuhanChart rows=\{rows\} \/>\}/,
        replace: TSX_RANGE_BLOCK,
      },
    ],
  },
];

// Langkah yang butuh isi match / grup regex
function resolveStep(text, step) {
  if (step.what === 'tambah interface PembelianTitik') {
    const m = text.match(step.find);
    return { ...step, replace: m[0] + TS_TITIK };
  }
  return step;
}

function applyAll(text, entry) {
  for (const raw of entry.steps) {
    const step = resolveStep(text, raw);
    const n = countMatches(text, step.find);
    if (n !== 1) die(`[${entry.file}] "${step.what}": anchor ditemukan ${n}× (harus tepat 1×). Kode di file ini sudah berbeda dari yang diperkirakan skrip.`);
    if (step.keepGroup) text = text.replace(step.find, (...m) => step.keepGroup(...m));
    else text = text.replace(step.find, () => step.replace);
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY
// ─────────────────────────────────────────────────────────────────────────────
function apply() {
  if (fs.existsSync(MANIFEST)) die('chart sudah pernah dijalankan (manifest ada). Pakai --revert dulu kalau mau mengulang.');

  const outputs = [];
  for (const entry of PLAN) {
    const abs = path.join(ROOT, entry.file);
    if (!fs.existsSync(abs)) die(`File tidak ditemukan: ${entry.file}. Jalankan dari ROOT project.`);
    const original = fs.readFileSync(abs, 'utf8');
    if (original.includes('[CHART]')) die(`${entry.file} sudah memuat penanda [CHART] — sepertinya perubahan ini sudah ada.`);
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const patched = applyAll(original.replace(/\r\n/g, '\n'), entry);
    outputs.push({ entry, abs, original, text: eol === '\r\n' ? patched.replace(/\n/g, '\r\n') : patched });
  }

  log(DRY ? '\n[DRY] Rencana chart:' : '\nchart:');
  for (const o of outputs) {
    const a = o.original.split('\n').length;
    const b = o.text.split('\n').length;
    log(`  ubah      ${o.entry.file}  (${a} → ${b} baris, ${o.entry.steps.length} langkah)`);
    for (const s of o.entry.steps) log(`              · ${s.what}`);
  }

  if (DRY) {
    log('\n[DRY] Tidak ada yang ditulis.\n');
    return;
  }

  const manifest = { phase: PHASE, at: new Date().toISOString(), files: [] };
  for (const o of outputs) {
    const dest = path.join(BACKUP_DIR, o.entry.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(o.abs, dest);
    manifest.files.push({ path: o.entry.file, action: 'modified', sha: sha(o.text) });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  for (const o of outputs) fs.writeFileSync(o.abs, o.text);

  log(`\n✔ chart selesai. Backup: ${rel(BACKUP_DIR)}/`);
  log('  Cek: npm run build   (atau npx tsc --noEmit)');
  log('  Batal: node scripts/chart.mjs --revert\n');
}

// ─────────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(JS)) die('resources/js tidak ditemukan. Jalankan dari ROOT project (node scripts/chart.mjs).');
REVERT ? revert() : apply();
