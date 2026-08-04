import ExcelJS from 'exceljs';

// Palet warna diambil dari logo Marimas (public/logo.png): biru navy utama
// + aksen emas di bingkai logo. Dipakai konsisten di semua file Excel yang
// digenerate dari app ini (laporan absensi/izin, export data aset, dst)
// supaya semuanya "berasa" satu produk, bukan sheet mentah tanpa identitas.
const BRAND_NAVY = 'FF0B2A6B';
const BRAND_NAVY_DARK = 'FF081F4F';
const BRAND_GOLD = 'FFC9A227';
const ROW_STRIPE = 'FFF1F5F9'; // slate-50, dipakai selang-seling biar baris gampang dibaca
const BORDER_COLOR = 'FFD6DEE8';
const TEXT_MUTED = 'FF64748B';

// Warna badge per status aset. Kalau kolom "status" ada di data yang
// diexport, sel-nya diwarnai sesuai kondisi asetnya -- niru badge warna
// yang sudah dipakai di tabel aset pada UI (TabAset.tsx), supaya laporan
// Excel-nya langsung "kebaca" tanpa perlu buka aplikasi lagi.
const STATUS_COLORS: Record<string, { fill: string; font: string }> = {
  Tersedia: { fill: 'FFDCFCE7', font: 'FF15803D' },
  Dipakai: { fill: 'FFDBEAFE', font: 'FF1D4ED8' },
  'Menunggu Perbaikan': { fill: 'FFFEF3C7', font: 'FFB45309' },
  'Sedang Diperbaiki': { fill: 'FFFEF3C7', font: 'FFB45309' },
  'Rusak Berat': { fill: 'FFFEE2E2', font: 'FFB91C1C' },
  Dijual: { fill: 'FFF1F5F9', font: 'FF475569' },
  tersedia: { fill: 'FFDCFCE7', font: 'FF15803D' },
  telat: { fill: 'FFFEE2E2', font: 'FFB91C1C' },
  Terlambat: { fill: 'FFFEE2E2', font: 'FFB91C1C' },
  'Tepat Waktu': { fill: 'FFDCFCE7', font: 'FF15803D' },
  disetujui: { fill: 'FFDCFCE7', font: 'FF15803D' },
  Disetujui: { fill: 'FFDCFCE7', font: 'FF15803D' },
  ditolak: { fill: 'FFFEE2E2', font: 'FFB91C1C' },
  Ditolak: { fill: 'FFFEE2E2', font: 'FFB91C1C' },
  pending: { fill: 'FFFEF3C7', font: 'FFB45309' },
  Pending: { fill: 'FFFEF3C7', font: 'FFB45309' },
};

export interface StyledExcelOptions {
  /** Judul laporan, ditulis besar di banner atas (mis. "Data Aset") */
  title: string;
  /** Baris kedua di banner, mis. "Periode: Januari 2026" atau ringkasan filter */
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  /** Nama sheet (otomatis dipotong ke 31 karakter, batas Excel) */
  sheetName: string;
  /** Kolom (berbasis index headers) yang isinya status/badge, buat pewarnaan otomatis */
  statusColumnIndexes?: number[];
}

// Lebar kolom otomatis: ambil string terpanjang antara header & isi kolom,
// dengan batas atas & bawah biar gak ada kolom yang kegepengan atau
// kelebaran cuma gara-gara satu baris "Keterangan" yang panjang banget.
function computeColumnWidth(header: string, values: string[]): number {
  const longest = values.reduce((max, v) => Math.max(max, v.length), header.length);
  return Math.min(Math.max(longest + 3, 10), 42);
}

async function loadLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Bangun workbook Excel yang sudah didesain: banner merek (navy + logo),
 * judul & subjudul laporan, header tabel bold dengan fill navy, baris
 * selang-seling, border tipis konsisten, kolom status berwarna, autofilter,
 * freeze header, dan footer total data + waktu generate.
 */
export async function buildStyledWorkbook(opts: StyledExcelOptions): Promise<ExcelJS.Workbook> {
  const { title, subtitle, headers, rows, sheetName, statusColumnIndexes = [] } = opts;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Marimas One';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const colCount = headers.length;
  const lastColLetter = sheet.getColumn(colCount).letter;

  // --- Banner merek (baris 1-2) -----------------------------------------
  // PENTING: isi background dengan fill per-sel (BUKAN satu merge besar),
  // supaya area judul di bawah bisa di-merge terpisah tanpa bentrok "cannot
  // merge already merged cells" (ExcelJS/Excel gak izinkan merge yang
  // tumpang tindih dengan merge lain).
  for (let col = 1; col <= colCount; col++) {
    for (let row = 1; row <= 2; row++) {
      sheet.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
    }
  }
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 22;

  const logoBuffer = await loadLogoBuffer();
  if (logoBuffer) {
    const imageId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    // Logo kecil nempel di kiri banner, gak menutupi judul
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.1 },
      ext: { width: 70, height: 42 },
    });
  }

  // Judul ditulis di kolom terpisah dari logo supaya gak tumpang tindih
  const titleAnchorCol = logoBuffer ? Math.min(3, colCount) : 1;
  sheet.mergeCells(1, titleAnchorCol, 2, colCount);
  const titleTextCell = sheet.getCell(1, titleAnchorCol);
  titleTextCell.value = `MARIMAS ONE — ${title}`;
  titleTextCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleTextCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // --- Garis aksen emas tipis (baris 3) ----------------------------------
  sheet.mergeCells(`A3:${lastColLetter}3`);
  sheet.getRow(3).height = 4;
  sheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GOLD } };

  // --- Subjudul / meta info (baris 4) ------------------------------------
  const now = new Date();
  const generatedLabel = now.toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  sheet.mergeCells(`A4:${lastColLetter}4`);
  const metaCell = sheet.getCell('A4');
  metaCell.value = `${subtitle ? subtitle + '   •   ' : ''}Total data: ${rows.length}   •   Digenerate: ${generatedLabel}`;
  metaCell.font = { italic: true, size: 9, color: { argb: TEXT_MUTED } };
  metaCell.alignment = { vertical: 'middle' };
  sheet.getRow(4).height = 18;

  // baris 5 dibiarkan kosong sebagai spacer tipis
  sheet.getRow(5).height = 4;

  // --- Header tabel (baris 6) --------------------------------------------
  const headerRowIndex = 6;
  const headerRow = sheet.getRow(headerRowIndex);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND_NAVY_DARK } },
      bottom: { style: 'thin', color: { argb: BRAND_NAVY_DARK } },
      left: { style: 'thin', color: { argb: BRAND_NAVY_DARK } },
      right: { style: 'thin', color: { argb: BRAND_NAVY_DARK } },
    };
  });
  headerRow.height = 22;

  // --- Data rows -----------------------------------------------------------
  rows.forEach((r, rIdx) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rIdx);
    const isStripe = rIdx % 2 === 1;
    headers.forEach((_, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      const raw = r[cIdx];
      cell.value = raw === null || raw === undefined ? '-' : raw;
      cell.font = { size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };

      const statusStyle = statusColumnIndexes.includes(cIdx) ? STATUS_COLORS[String(raw)] : undefined;
      if (statusStyle) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusStyle.fill } };
        cell.font = { size: 10, bold: true, color: { argb: statusStyle.font } };
      } else if (isStripe) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_STRIPE } };
      }
    });
    excelRow.height = 18;
  });

  // --- Lebar kolom, autofilter, footer -------------------------------------
  headers.forEach((h, i) => {
    const values = rows.map((r) => String(r[i] ?? '-'));
    sheet.getColumn(i + 1).width = computeColumnWidth(h, values);
  });

  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: colCount },
  };

  const footerRowIndex = headerRowIndex + rows.length + 2;
  sheet.mergeCells(footerRowIndex, 1, footerRowIndex, colCount);
  const footerCell = sheet.getCell(footerRowIndex, 1);
  footerCell.value = 'Dokumen digenerate otomatis oleh Marimas One — tidak memerlukan tanda tangan basah.';
  footerCell.font = { italic: true, size: 8, color: { argb: TEXT_MUTED } };

  return workbook;
}

/** Trigger download file .xlsx dari workbook exceljs lewat browser. */
export async function downloadStyledExcel(opts: StyledExcelOptions, filename: string): Promise<void> {
  const workbook = await buildStyledWorkbook(opts);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}