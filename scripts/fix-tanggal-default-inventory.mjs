#!/usr/bin/env node
/**
 * fix-tanggal-default-inventory.mjs
 *
 * Kalau tanggal_input dan/atau tanggal_invoice (tanggal pembelian) tidak diisi, otomatis diisi dengan
 * tanggal saat admin membuat data inventory tersebut.
 *
 *  1) app/Models/MasterData/Inventory.php  -> hook `saving` di booted():
 *       - create : kosong => hari ini (zona waktu aplikasi, Asia/Jakarta)
 *       - edit   : kalau dikosongkan => tanggal created_at record itu
 *     Karena dipasang di model, ikut ter-cover: form Tambah/Edit, Import Excel, dan jalur create lainnya.
 *
 *  2) app/Console/Commands/Maintenance/BackfillTanggalInventory.php -> command untuk data LAMA:
 *       php artisan inventory:backfill-tanggal
 *     Mengisi tanggal_input / tanggal_invoice yang masih kosong dengan tanggal created_at.
 *     (Pakai query builder, jadi tidak memicu hook model dan tidak mengubah updated_at.)
 *
 * Pemakaian (dari root project):
 *   node fix-tanggal-default-inventory.mjs            # terapkan
 *   node fix-tanggal-default-inventory.mjs --dry-run  # cek saja
 *   node fix-tanggal-default-inventory.mjs /path/ke/project
 *
 * Idempotent. Kalau struktur model tidak cocok, model TIDAK diubah dan alasannya dicetak.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());

const MODEL = path.join(ROOT, 'app', 'Models', 'MasterData', 'Inventory.php');
const COMMAND = path.join(ROOT, 'app', 'Console', 'Commands', 'Maintenance', 'BackfillTanggalInventory.php');

const ANCHOR = '    // ================= Relasi kategori =================';

const BOOTED = `    /**
     * tanggal_input & tanggal_invoice (tanggal pembelian) yang kosong otomatis diisi tanggal data ini dibuat:
     * saat create = hari ini, saat edit (dikosongkan) = tanggal created_at record. Dashboard "Pertumbuhan
     * inventory" menghitung per bulan dari tanggal_invoice, jadi tanpa ini item tanpa tanggal selalu
     * dianggap "sebelum rentang" dan membuat grafik tidak mulai dari 0.
     */
    protected static function booted(): void
    {
        static::saving(function (self $inventory) {
            $fallback = ($inventory->created_at ?? now())->toDateString();

            if (empty($inventory->tanggal_input)) {
                $inventory->tanggal_input = $fallback;
            }
            if (empty($inventory->tanggal_invoice)) {
                $inventory->tanggal_invoice = $fallback;
            }
        });
    }

`;

const COMMAND_SRC = `<?php

namespace App\\Console\\Commands\\Maintenance;

use Illuminate\\Console\\Command;
use Illuminate\\Support\\Facades\\DB;

class BackfillTanggalInventory extends Command
{
    protected $signature = 'inventory:backfill-tanggal';
    protected $description = 'Isi tanggal_input & tanggal_invoice yang masih kosong dengan tanggal created_at inventory';

    public function handle(): int
    {
        $input = DB::table('inventory')
            ->whereNull('tanggal_input')
            ->whereNotNull('created_at')
            ->update(['tanggal_input' => DB::raw('CAST(created_at AS DATE)')]);

        $invoice = DB::table('inventory')
            ->whereNull('tanggal_invoice')
            ->whereNotNull('created_at')
            ->update(['tanggal_invoice' => DB::raw('CAST(created_at AS DATE)')]);

        $this->info("tanggal_input diisi: {$input} baris. tanggal_invoice diisi: {$invoice} baris.");

        return self::SUCCESS;
    }
}
`;

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function patchModel() {
  if (!(await exists(MODEL))) return 'Inventory.php tidak ditemukan. Jalankan dari root project atau kasih path-nya.';
  const src = await fs.readFile(MODEL, 'utf8');
  if (src.includes('static::saving')) return 'Inventory.php: hook sudah ada, dilewati.';
  if (/function\s+booted\s*\(/.test(src)) return 'Inventory.php: sudah punya booted() sendiri, TIDAK diubah (tambahkan hook manual).';
  if (!src.includes(ANCHOR)) return 'Inventory.php: anchor tidak ketemu, TIDAK diubah.';
  if (!DRY) await fs.writeFile(MODEL, src.replace(ANCHOR, BOOTED + ANCHOR), 'utf8');
  return `Inventory.php: ${DRY ? 'AKAN diubah' : 'diubah'} (hook saving untuk tanggal default).`;
}

async function addCommand() {
  if (await exists(COMMAND)) return 'BackfillTanggalInventory.php: sudah ada, dilewati.';
  if (!DRY) {
    await fs.mkdir(path.dirname(COMMAND), { recursive: true });
    await fs.writeFile(COMMAND, COMMAND_SRC, 'utf8');
  }
  return `BackfillTanggalInventory.php: ${DRY ? 'AKAN dibuat' : 'dibuat'} (php artisan inventory:backfill-tanggal).`;
}

console.log(await patchModel());
console.log(await addCommand());
