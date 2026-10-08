import { printStruk } from '../../../../utils/printStruk';
import { namaPemakai, formatJenisKerusakan, formatDurasi } from '../../../../utils/inventoryHelpers';
import type { Inventory } from '../../../../api/masterData/inventory';
import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';
import type { InventoryPenanganan } from '../../../../api/transaksi/inventoryPenanganan';
import { formatTanggalId, formatRupiah } from './helpers';

export const handlePrintPenanganan = (inventory: Inventory, p: InventoryPenanganan) => {
  if (!p.no_struk) return;
  const rusakBerat = p.hasil === 'rusak_berat';

  if (rusakBerat) {
    printStruk({
      judul: 'Bukti Penanganan Inventory',
      noStruk: p.no_struk,
      tanggal: formatTanggalId(p.tanggal_selesai),
      rows: [
        { label: 'Hasil', value: 'Rusak Berat (tidak bisa diperbaiki)' },
        { label: 'Durasi', value: formatDurasi(p.durasi_detik) },
      ],
      catatan: p.catatan,
    });
    return;
  }

  const totalBiaya = (Number(p.harga_jasa) || 0) + (Number(p.biaya_komponen) || 0);
  printStruk({
    judul: 'Bukti Penanganan Inventory',
    noStruk: p.no_struk,
    tanggal: formatTanggalId(p.tanggal_selesai),
    rows: [
      { label: 'Inventory', value: `${inventory.kode_inventory} — ${inventory.nama || '-'}` },
      { label: 'Jenis Kerusakan', value: formatJenisKerusakan(p.jenis_kerusakan) },
      { label: 'Keluhan', value: p.keluhan },
      { label: 'Hasil', value: p.hasil || '-' },
      { label: 'Tanggal Lapor', value: formatTanggalId(p.tanggal_lapor) },
      { label: 'Durasi', value: formatDurasi(p.durasi_detik) },
      { label: 'Biaya Komponen', value: formatRupiah(p.biaya_komponen) },
      { label: 'Biaya Jasa', value: formatRupiah(p.harga_jasa) },
    ],
    totalLabel: 'Total Biaya',
    totalValue: formatRupiah(totalBiaya),
    catatan: p.catatan,
  });
};

// BARU: sekarang bisa serah-terima lebih dari 1 inventory dalam sekali proses
// (inventory utama + kelengkapan yang ikut dipinjamkan) -- tetap 1 struk gabungan,
// pakai no_struk_penerimaan dari inventory PERTAMA (inventory utama yang diklik) sebagai
// nomor struknya, item lain cuma numpang jadi baris "Inventory 2", "Inventory 3", dst.
export const handlePrintSerahTerima = (results: { inventory: Inventory; pemakai: InventoryPemakai }[]) => {
  if (!results.length) return;
  const utama = results[0];
  if (!utama.pemakai.no_struk_penerimaan) return;
  const inventoryRows = results.map((r, i) => ({
    label: results.length > 1 ? `Inventory ${i + 1}` : 'Inventory',
    value: `${r.inventory.kode_inventory} — ${r.inventory.nama || '-'}`,
  }));
  printStruk({
    judul: 'Bukti Serah Terima Inventory',
    noStruk: utama.pemakai.no_struk_penerimaan,
    tanggal: formatTanggalId(utama.pemakai.tanggal_penerimaan),
    rows: [
      ...inventoryRows,
      { label: 'Diserahkan Kepada', value: namaPemakai(utama.pemakai) },
      { label: 'Nomor Penerimaan', value: utama.pemakai.nomor_penerimaan || '-' },
    ],
    catatan: utama.pemakai.catatan_penerimaan,
  });
};

export const handlePrintPengembalian = (inventory: Inventory, pemakai: InventoryPemakai) => {
  if (!pemakai.no_struk_pengembalian) return;
  printStruk({
    judul: 'Bukti Pengembalian Inventory',
    noStruk: pemakai.no_struk_pengembalian,
    tanggal: formatTanggalId(pemakai.tanggal_pengembalian),
    rows: [
      { label: 'Inventory', value: `${inventory.kode_inventory} — ${inventory.nama || '-'}` },
      { label: 'Dikembalikan Oleh', value: namaPemakai(pemakai) },
      { label: 'Struk Penerimaan Asli', value: pemakai.no_struk_penerimaan || '-' },
    ],
    catatan: pemakai.catatan_pengembalian,
  });
};
