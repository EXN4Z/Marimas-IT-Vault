#!/usr/bin/env node
/**
 * script.mjs — aktifkan tombol "1 Minggu" & "1 Bulan" di chart hero dashboard admin, dihitung dari
 * tanggal_invoice (= tanggal pembelian), BUKAN created_at.
 *
 * Jalankan dari ROOT project (folder yang ada resources/js):
 *   node scripts/script.mjs --dry        lihat rencana, tidak menulis apa pun
 *   node scripts/script.mjs              jalankan
 *   node scripts/script.mjs --revert     kembalikan 3 file dari backup
 *   node scripts/script.mjs --only=php   hanya backend (DashboardQuery.php)
 *   node scripts/script.mjs --only=front hanya frontend (types.ts + DashboardAdmin.tsx)
 *   (--only juga bisa dipakai bersama --revert untuk mengembalikan sebagian)
 *
 * Yang diubah:
 *   app/Queries/Dashboard/DashboardQuery.php                  tambah trenMinggu (7 hari) & trenBulan (Mg 1..Mg 4);
 *                                                             semua tren (termasuk 12 bulan) dihitung dari tanggal_invoice
 *   resources/js/features/dashboard/types.ts                  tambah field nama?, trenMinggu?, trenBulan?
 *   resources/js/features/dashboard/DashboardAdmin.tsx        tombol rentang aktif + chart ikut rentang
 *
 * Aman: semua perubahan dihitung dulu; kalau ada satu bagian yang tidak ketemu, TIDAK ada file yang ditulis.
 * Aman dijalankan ulang, juga di project yang sudah pernah kena versi lama skrip ini (created_at): bagian yang
 * masih created_at otomatis dialihkan ke tanggal_invoice. Unit tanpa tanggal_invoice tidak dihitung di chart. Backup asli di .migrasi-backup/tren-rentang/.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry');
const REVERT = FLAGS.has('--revert');
const BACKUP = path.join(ROOT, '.migrasi-backup', 'tren-rentang');
const ONLY = ([...FLAGS].find((f) => f.startsWith('--only=')) ?? '').slice(7);
if (ONLY && !['php', 'front'].includes(ONLY)) {
  console.error('--only harus php atau front');
  process.exit(1);
}
const DIPAKAI = (key) => !ONLY || (ONLY === 'php' ? key === 'php' : key !== 'php');

const FILES = {
  php: 'app/Queries/Dashboard/DashboardQuery.php',
  types: 'resources/js/features/dashboard/types.ts',
  tsx: 'resources/js/features/dashboard/DashboardAdmin.tsx',
};

// ───────────────────────── helper ─────────────────────────

function find(t, needle, label) {
  if (typeof needle === 'string') {
    const i = t.indexOf(needle);
    if (i < 0) throw new Error(`[${label}] tidak ketemu`);
    if (t.indexOf(needle, i + 1) >= 0) throw new Error(`[${label}] ketemu lebih dari satu`);
    return { index: i, end: i + needle.length, m: null };
  }
  const flags = needle.flags.includes('g') ? needle.flags : needle.flags + 'g';
  const ms = [...t.matchAll(new RegExp(needle.source, flags))];
  if (ms.length === 0) throw new Error(`[${label}] tidak ketemu`);
  if (ms.length > 1) throw new Error(`[${label}] ketemu lebih dari satu`);
  return { index: ms[0].index, end: ms[0].index + ms[0][0].length, m: ms[0] };
}
const splice = (t, from, to, s) => t.slice(0, from) + s + t.slice(to);

// ───────────────────────── PHP ─────────────────────────

const PHP_HARI = `
    private const HARI_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
`;

const PHP_BLOK = `        // 1 Minggu = 7 hari terakhir (harian); 1 Bulan = 4 minggu terakhir (tiap titik 7 hari). Dari tanggal_invoice (tanggal pembelian).
        $hariIni = Carbon::today();
        $minggu = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = $hariIni->copy()->subDays($i);
            $nama = $d->day . ' ' . self::BULAN_ID[$d->month - 1];
            $minggu[$d->format('Y-m-d')] = ['bulan' => self::HARI_ID[$d->dayOfWeek], 'tahun' => $d->year, 'nama' => self::HARI_ID[$d->dayOfWeek] . ', ' . $nama, 'jumlah' => 0];
        }

        $bulan4 = [];
        $petaMinggu = []; // 'Y-m-d' => indeks minggu (0..3)
        for ($w = 0; $w < 4; $w++) {
            $akhir = $hariIni->copy()->subDays((3 - $w) * 7);
            $awal = $akhir->copy()->subDays(6);
            $rentang = $awal->month === $akhir->month
                ? $awal->day . '–' . $akhir->day . ' ' . self::BULAN_ID[$akhir->month - 1]
                : $awal->day . ' ' . self::BULAN_ID[$awal->month - 1] . '–' . $akhir->day . ' ' . self::BULAN_ID[$akhir->month - 1];
            $bulan4[$w] = ['bulan' => 'Mg ' . ($w + 1), 'tahun' => $akhir->year, 'nama' => 'Mg ' . ($w + 1) . ' · ' . $rentang, 'jumlah' => 0];
            for ($j = 0; $j < 7; $j++) {
                $petaMinggu[$awal->copy()->addDays($j)->format('Y-m-d')] = $w;
            }
        }

`;

function patchPhp(t) {
  const awal = t;

  if (!t.includes('trenMinggu')) {
    // 1. konstanta HARI_ID di bawah BULAN_ID
    {
      const f = find(t, /private const BULAN_ID = \[[^\]]*\];\n/, 'php: BULAN_ID');
      t = splice(t, f.end, f.end, PHP_HARI);
    }

    // 2. blok bucket minggu/bulan sebelum foreach pertama di admin() (setelah blok 12 bulan)
    {
      const anchor = t.indexOf('// 12 bulan terakhir');
      if (anchor < 0) throw new Error('[php: komentar "12 bulan terakhir"] tidak ketemu');
      const m = /^[ \t]*foreach \(\$list as \$a\) \{\n/m.exec(t.slice(anchor));
      if (!m) throw new Error('[php: foreach ($list as $a)] tidak ketemu di admin()');
      const at = anchor + m.index;
      t = splice(t, at, at, PHP_BLOK);
    }

    // 3. hitung per hari/minggu di dalam loop (di bawah elseif sebelumRentang)
    {
      const f = find(t, /^([ \t]*)elseif \(\$tgl->lt\(\$awalRentang\)\) \$sebelumRentang\+\+;\n/m, 'php: elseif sebelumRentang');
      const ind = f.m[1];
      const add =
        `\n` +
        `${ind}$hk = $tgl->format('Y-m-d');\n` +
        `${ind}if (isset($minggu[$hk])) $minggu[$hk]['jumlah']++;\n` +
        `${ind}if (isset($petaMinggu[$hk])) $bulan4[$petaMinggu[$hk]]['jumlah']++;\n`;
      t = splice(t, f.end, f.end, add);
    }

    // 4. kirim ke frontend
    {
      const f = find(t, /^([ \t]*)'trenPembelianInventory' => array_values\(\$bulan\),\n/m, 'php: return trenPembelianInventory');
      const ind = f.m[1];
      t = splice(t, f.end, f.end, `${ind}'trenMinggu' => array_values($minggu),\n${ind}'trenBulan' => array_values($bulan4),\n`);
    }
  }

  // 5. semua tren dihitung dari tanggal_invoice (tanggal pembelian), bukan created_at
  for (const [a, b] of [
    ["'kategori_id', 'created_at', 'tanggal_garansi'", "'kategori_id', 'tanggal_invoice', 'tanggal_garansi'"],
    ['if ($a->created_at) {', 'if ($a->tanggal_invoice) {'],
    ['Carbon::parse($a->created_at)', 'Carbon::parse($a->tanggal_invoice)'],
    ['unit yang created_at-nya', 'unit yang tanggal_invoice-nya'],
    ['Dari created_at.', 'Dari tanggal_invoice (tanggal pembelian).'],
  ]) {
    t = t.split(a).join(b);
  }
  if (!t.includes('Carbon::parse($a->tanggal_invoice)') || !t.includes("'tanggal_invoice', 'tanggal_garansi'")) {
    throw new Error('[php: kolom tanggal] get([...]) / Carbon::parse($a->...) tidak seperti yang diharapkan; hentikan');
  }

  return t === awal ? null : t;
}

// ───────────────────────── types.ts ─────────────────────────

function patchTypes(t) {
  const awal = t;

  if (!t.includes('trenMinggu')) {
    const f1 = find(t, 'export interface TrenPembelianInventory {\n', 'types: interface TrenPembelianInventory');
    t = splice(t, f1.end, f1.end, '  nama?: string; // label tooltip data harian/mingguan, mis. "Mg 4 · 31 Okt–6 Nov"\n');

    const f2 = find(t, /^([ \t]*)trenPembelianInventory: TrenPembelianInventory\[\];\n/m, 'types: DashboardAdminData.trenPembelianInventory');
    const ind = f2.m[1];
    t = splice(
      t,
      f2.end,
      f2.end,
      `${ind}trenMinggu?: TrenPembelianInventory[]; // 1 Minggu: 7 hari terakhir (tanggal pembelian)\n${ind}trenBulan?: TrenPembelianInventory[]; // 1 Bulan: Mg 1..Mg 4 (tanggal pembelian)\n`,
    );
  }

  // project yang sudah kena versi lama skrip (created_at): samakan komentarnya
  t = t.split('7 hari terakhir (created_at)').join('7 hari terakhir (tanggal pembelian)').split('Mg 1..Mg 4 (created_at)').join('Mg 1..Mg 4 (tanggal pembelian)');

  return t === awal ? null : t;
}

// ───────────────────────── DashboardAdmin.tsx ─────────────────────────

const HERO_BARU = `function HeroInventory({
  total,
  tren = [],
  trenMinggu = [],
  trenBulan = [],
  perMerek = [],
}: {
  total: number;
  tren?: TrenPembelianInventory[];
  trenMinggu?: TrenPembelianInventory[];
  trenBulan?: TrenPembelianInventory[];
  perMerek?: InventoryPerMerek[];
}) {
  const [rentang, setRentang] = useState<'minggu' | 'bulan' | 'tahun'>('tahun');
  const rows = Array.isArray(tren) ? tren : [];
  const rowsAktif = (rentang === 'minggu' ? trenMinggu : rentang === 'bulan' ? trenBulan : rows) ?? [];
  const merek = Array.isArray(perMerek) ? perMerek : [];
  const bulanIni = rows[rows.length - 1];
  const bulanLalu = rows.length > 1 ? rows[rows.length - 2] : undefined;
  const net = bulanIni ? bulanIni.jumlah - (bulanLalu?.jumlah ?? 0) : 0;
  const terbanyak = merek[0];

  return (
    <section aria-label="Ringkasan inventory" className="dd-card dd-hv">
      <div className="dd-hv-l">
        <div className="dd-hv-k">
          <Package size={13} aria-hidden="true" />
          Marimas IT Vault
        </div>
        <b className="dv-g dd-hv-big">{total}</b>
        <b className={\`dd-hv-chg \${net > 0 ? '' : net < 0 ? 'is-down' : 'is-flat'}\`}>{net > 0 ? \`▲ \${net}\` : net < 0 ? \`▼ \${Math.abs(net)}\` : '0'}</b>
        <span className="dd-hv-cap">Unit (Bulan Ini)</span>
        <div className="dd-hv-two">
          <div>
            <small>Unit Paling Banyak</small>
            <b title={terbanyak?.nama}>{terbanyak ? \`\${terbanyak.nama} : \${terbanyak.jumlah} Unit\` : '-'}</b>
          </div>
        </div>
      </div>

      <div className="dd-hv-r">
        <div className="dd-rng" role="group" aria-label="Rentang waktu">
          {([['minggu', '1 Minggu'], ['bulan', '1 Bulan'], ['tahun', '1 Tahun']] as const).map(([k, label]) => (
            <button key={k} type="button" className={rentang === k ? 'is-on' : ''} aria-pressed={rentang === k} onClick={() => setRentang(k)}>
              {label}
            </button>
          ))}
        </div>
        {rowsAktif.length === 0 ? <EmptyNote>Belum ada data inventory.</EmptyNote> : <PertumbuhanChart key={rentang} rows={rowsAktif} />}
      </div>
    </section>
  );
}`;

function patchTsx(t) {
  if (t.includes('trenMinggu')) return null;

  const swap = (from, to, label) => {
    const f = find(t, from, label);
    t = splice(t, f.index, f.end, to);
  };

  swap('trenPembelianInventory, inventoryPerhatian', 'trenPembelianInventory, trenMinggu, trenBulan, inventoryPerhatian', 'tsx: destructuring analitik');
  swap('tren={trenPembelianInventory} perMerek={inventoryPerMerek}', 'tren={trenPembelianInventory} trenMinggu={trenMinggu} trenBulan={trenBulan} perMerek={inventoryPerMerek}', 'tsx: <HeroInventory ...>');
  swap('const pilihan = [5, 10, 20, 25, 50, 100, 200, 500, 1000];', 'const pilihan = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];', 'tsx: skala pilihan');
  swap(
    "const namaBulan = `${rows[active].bulan}${rows[active].tahun ? ` ${rows[active].tahun}` : ''}`;",
    "const namaBulan = rows[active].nama ?? `${rows[active].bulan}${rows[active].tahun ? ` ${rows[active].tahun}` : ''}`;",
    'tsx: namaBulan',
  );

  // ganti seluruh fungsi HeroInventory
  {
    const start = find(t, 'function HeroInventory(', 'tsx: function HeroInventory').index;
    const banner = t.indexOf('// ═', start);
    if (banner < 0) throw new Error('[tsx: banner setelah HeroInventory] tidak ketemu');
    const endFn = t.lastIndexOf('}', banner) + 1;
    const lama = t.slice(start, endFn);
    if (!lama.includes('dd-rng') || !lama.includes('Belum tersedia')) {
      throw new Error('[tsx: HeroInventory] isinya tidak seperti yang diharapkan (mungkin sudah kamu ubah manual); hentikan');
    }
    t = splice(t, start, endFn, HERO_BARU);
  }

  return t;
}

// ───────────────────────── runner ─────────────────────────

const PATCHERS = { php: patchPhp, types: patchTypes, tsx: patchTsx };

function readFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`File tidak ada: ${rel} (jalankan dari ROOT project)`);
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { abs, raw, eol, text: eol === '\r\n' ? raw.replace(/\r\n/g, '\n') : raw };
}

function revert() {
  let n = 0;
  for (const [key, rel] of Object.entries(FILES)) {
    if (!DIPAKAI(key)) continue;
    const bak = path.join(BACKUP, rel);
    if (!fs.existsSync(bak)) {
      console.log(`  - ${rel}: tidak ada backup, dilewati`);
      continue;
    }
    if (!DRY) fs.copyFileSync(bak, path.join(ROOT, rel));
    console.log(`  ✓ ${rel} dikembalikan dari backup`);
    n++;
  }
  console.log(n ? (DRY ? '\n(dry-run: tidak ada yang ditulis)' : '\nSelesai revert.') : '\nTidak ada yang di-revert.');
}

function main() {
  if (REVERT) return revert();

  const plan = [];
  try {
    for (const [key, rel] of Object.entries(FILES)) {
      if (!DIPAKAI(key)) continue;
      const f = readFile(rel);
      const baru = PATCHERS[key](f.text);
      if (baru === null) {
        console.log(`  = ${rel}: sudah ter-patch, dilewati`);
        continue;
      }
      plan.push({ rel, f, out: f.eol === '\r\n' ? baru.replace(/\n/g, '\r\n') : baru, baris: baru.split('\n').length - f.text.split('\n').length });
    }
  } catch (e) {
    console.error(`\n✗ Gagal: ${e.message}\n  Tidak ada file yang diubah.`);
    process.exit(1);
  }

  if (plan.length === 0) {
    console.log('\nTidak ada yang perlu diubah.');
    return;
  }

  for (const p of plan) {
    console.log(`  ${DRY ? '~' : '✓'} ${p.rel}  (${p.baris >= 0 ? '+' : ''}${p.baris} baris)`);
  }
  if (DRY) {
    console.log('\n(dry-run: tidak ada yang ditulis)');
    return;
  }

  for (const p of plan) {
    const bak = path.join(BACKUP, p.rel);
    if (!fs.existsSync(bak)) {
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.writeFileSync(bak, p.f.raw);
    }
    fs.writeFileSync(p.f.abs, p.out);
  }

  console.log('\nSelesai. Backup: .migrasi-backup/tren-rentang/  (kembalikan dengan --revert)');
  console.log('Cek: php -l app/Queries/Dashboard/DashboardQuery.php && npx tsc --noEmit');
}

main();
