// Jalankan dari root project:  node apply-patch.mjs
// (atau: node apply-patch.mjs path/ke/project)
// Aman dijalankan berulang kali: yang sudah ter-patch dilewati.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());

const patches = [
  // ================= Backend: tanggal pembelian & chart =================
  {
    file: 'app/Models/MasterData/Inventory.php',
    edits: [
      [
`     * tanggal_input & tanggal_invoice (tanggal pembelian) yang kosong otomatis diisi tanggal data ini dibuat:
     * saat create = hari ini, saat edit (dikosongkan) = tanggal created_at record. Dashboard "Pertumbuhan
     * inventory" menghitung per bulan dari tanggal_invoice, jadi tanpa ini item tanpa tanggal selalu
     * dianggap "sebelum rentang" dan membuat grafik tidak mulai dari 0.
     */`,
`     * tanggal_input yang kosong otomatis diisi tanggal data ini dibuat:
     * saat create = hari ini, saat edit (dikosongkan) = tanggal created_at record.
     * tanggal_invoice (tanggal pembelian) SENGAJA tidak ikut diisi otomatis: kalau kosong tetap null,
     * dan dashboard tidak menghitungnya di grafik tren pembelian.
     */`,
      ],
      [
`            if (empty($inventory->tanggal_invoice)) {
                $inventory->tanggal_invoice = $fallback;
            }
`,
``,
      ],
    ],
  },
  {
    file: 'app/Queries/Dashboard/DashboardQuery.php',
    edits: [
      [
`                elseif ($tgl->lt($awalRentang)) $sebelumRentang++;
            } else {
                $sebelumRentang++;
            }`,
`                elseif ($tgl->lt($awalRentang)) $sebelumRentang++;
            }
            // tanggal_invoice null = tanggal pembelian tidak diketahui -> tidak dihitung di grafik.`,
      ],
      [
`unit tanpa tanggal invoice / sebelum rentang jadi titik awal)`,
`unit sebelum rentang jadi titik awal; unit tanpa tanggal invoice tidak dihitung)`,
      ],
    ],
  },
  {
    file: 'app/Console/Commands/Maintenance/BackfillTanggalInventory.php',
    edits: [
      [
`Isi tanggal_input & tanggal_invoice yang masih kosong dengan tanggal created_at inventory`,
`Isi tanggal_input yang masih kosong dengan tanggal created_at inventory`,
      ],
      [
`        $invoice = DB::table('inventory')
            ->whereNull('tanggal_invoice')
            ->whereNotNull('created_at')
            ->update(['tanggal_invoice' => DB::raw('CAST(created_at AS DATE)')]);

`,
``,
      ],
      [
`tanggal_input diisi: {$input} baris. tanggal_invoice diisi: {$invoice} baris.`,
`tanggal_input diisi: {$input} baris.`,
      ],
    ],
  },

  // ================= Frontend: sembunyikan "Pasang ke Induk" kalau punya child =================
  {
    file: 'resources/js/features/inventory/list/InventoryRowActions.tsx',
    edits: [
      [
`import type { Inventory } from '../types/inventory';`,
`import type { Inventory, InventoryRow } from '../types/inventory';`,
      ],
      [
`interface InventoryRowActionsProps {
  a: Inventory;`,
`interface InventoryRowActionsProps {
  a: InventoryRow;`,
      ],
      [
`        {!a.parent_id && a.status === 'tersedia' && (
          <button
            onClick={() => setPasangIndukTarget(a)}`,
`        {!a.parent_id && a.status === 'tersedia' && (a.children_count ?? 0) === 0 && (
          <button
            onClick={() => setPasangIndukTarget(a)}`,
      ],
      [
`            ke kategori tertentu lagi. */}`,
`            ke kategori tertentu lagi. Kalau item ini sendiri sudah jadi induk
            (punya children), tombol disembunyikan -- induk tidak boleh
            dipasang ke item lain (aturan server juga menolak). */}`,
      ],
    ],
  },
  {
    file: 'resources/js/features/inventory/detail/InventoryDetailAksi.tsx',
    edits: [
      [
`{!detail.parent_id && detail.status === 'tersedia' && (
            <button
              type="button"
              onClick={() => setPasangIndukTarget(detail)}`,
`{!detail.parent_id && detail.status === 'tersedia' && (detail.children?.length ?? 0) === 0 && (
            <button
              type="button"
              onClick={() => setPasangIndukTarget(detail)}`,
      ],
    ],
  },
  {
    file: 'resources/js/features/inventory/InventoryTab.tsx',
    edits: [
      [
`const renderAksi = (a: Inventory) => (`,
`const renderAksi = (a: InventoryRow) => (`,
      ],
    ],
  },
];

let gagal = 0;

for (const { file, edits } of patches) {
  const path = join(root, file);
  if (!existsSync(path)) {
    console.log(`✗ ${file}: file tidak ditemukan (jalankan dari root project)`);
    gagal++;
    continue;
  }

  const mentah = readFileSync(path, 'utf8');
  const crlf = mentah.includes('\r\n');
  let teks = crlf ? mentah.replace(/\r\n/g, '\n') : mentah;

  let berubah = 0;
  let sudah = 0;
  const hilang = [];

  edits.forEach(([lama, baru], i) => {
    if (teks.includes(lama)) {
      teks = teks.replace(lama, () => baru);
      berubah++;
    } else if (baru !== '' && teks.includes(baru)) {
      sudah++;
    } else if (baru === '' && !teks.includes(lama)) {
      sudah++;
    } else {
      hilang.push(i + 1);
    }
  });

  if (berubah > 0) writeFileSync(path, crlf ? teks.replace(/\n/g, '\r\n') : teks, 'utf8');

  if (hilang.length) {
    gagal++;
    console.log(`✗ ${file}: edit #${hilang.join(', #')} tidak cocok (file sudah beda dari versi zip)`);
  } else if (berubah > 0) {
    console.log(`✓ ${file}: ${berubah} edit diterapkan${sudah ? `, ${sudah} sudah ada` : ''}`);
  } else {
    console.log(`- ${file}: sudah ter-patch`);
  }
}

console.log(gagal ? `\nSelesai dengan ${gagal} file bermasalah.` : '\nSelesai.');
process.exit(gagal ? 1 : 0);
