// Parser CSV sederhana tapi tahan terhadap field yang dibungkus tanda kutip
// (termasuk yang berisi koma atau newline di dalamnya).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Normalisasi newline + buang BOM kalau ada
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Field/baris terakhir (kalau file tidak diakhiri newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface PrintReportOptions {
  title: string;
  periodLabel: string;
  headers: string[];
  rows: string[][];
}

// Palet sama persis dengan excelReport.ts (BRAND_NAVY/BRAND_GOLD) supaya
// laporan PDF & Excel yang digenerate dari app ini konsisten satu identitas.
const BRAND_NAVY = '#0b2a6b';
const BRAND_NAVY_DARK = '#081f4f';
const BRAND_GOLD = '#c9a227';

// Badge status: dicocokkan case-insensitive ke isi sel. Kolom yang namanya
// mengandung "status" otomatis dirender sebagai pill berwarna, bukan teks
// polos -- biar laporan yang dicetak langsung kebaca kondisinya sekilas.
const STATUS_BADGES: Record<string, { bg: string; fg: string }> = {
  tersedia: { bg: '#dcfce7', fg: '#15803d' },
  dipakai: { bg: '#dbeafe', fg: '#1d4ed8' },
  'menunggu perbaikan': { bg: '#fef3c7', fg: '#b45309' },
  'sedang diperbaiki': { bg: '#fef3c7', fg: '#b45309' },
  'rusak berat': { bg: '#fee2e2', fg: '#b91c1c' },
  dijual: { bg: '#f1f5f9', fg: '#475569' },
  telat: { bg: '#fee2e2', fg: '#b91c1c' },
  terlambat: { bg: '#fee2e2', fg: '#b91c1c' },
  'tepat waktu': { bg: '#dcfce7', fg: '#15803d' },
  disetujui: { bg: '#dcfce7', fg: '#15803d' },
  ditolak: { bg: '#fee2e2', fg: '#b91c1c' },
  pending: { bg: '#fef3c7', fg: '#b45309' },
};

function renderCell(value: string, isStatusColumn: boolean): string {
  const safe = escapeHtml(value ?? '-');
  if (!isStatusColumn) return safe;
  const badge = STATUS_BADGES[(value ?? '').trim().toLowerCase()];
  if (!badge) return safe;
  return `<span class="badge" style="background:${badge.bg};color:${badge.fg};">${safe}</span>`;
}

function buildPrintableHtml({ title, periodLabel, headers, rows }: PrintReportOptions): string {
  const statusColIdx = headers.findIndex((h) => h.toLowerCase().includes('status'));

  const theadHtml = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  const tbodyHtml = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((_, i) => `<td>${renderCell(r[i] ?? '-', i === statusColIdx)}</td>`)
          .join('')}</tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 16mm 10mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #1e293b;
    margin: 0;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, ${BRAND_NAVY}, ${BRAND_NAVY_DARK});
    color: #fff;
    padding: 12px 16px;
    border-radius: 10px 10px 0 0;
  }
  .banner img { height: 32px; width: auto; display: block; }
  .banner .titles { flex: 1; }
  .banner h1 { font-size: 16px; margin: 0; font-weight: 700; letter-spacing: 0.01em; }
  .banner p { font-size: 10px; margin: 2px 0 0; color: #cbd5e1; }
  .banner .printed { font-size: 9px; color: #cbd5e1; text-align: right; white-space: nowrap; }
  .accent-bar { height: 4px; background: ${BRAND_GOLD}; border-radius: 0 0 3px 3px; margin-bottom: 14px; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9px;
  }
  thead { display: table-header-group; } /* header berulang di tiap halaman cetak */
  tr { page-break-inside: avoid; }
  th, td {
    border: 1px solid #d6dee8;
    padding: 6px 7px;
    text-align: left;
    word-wrap: break-word;
    overflow-wrap: break-word;
    /* penting: cegah browser/PDF viewer menafsirkan NIP panjang sebagai angka */
    white-space: normal;
  }
  th {
    background: ${BRAND_NAVY_DARK};
    color: #fff;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 8px;
    letter-spacing: 0.03em;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
    white-space: nowrap;
  }
  footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #94a3b8;
  }
</style>
</head>
<body>
  <div class="banner">
    <img src="/logo.png" alt="Marimas One" onerror="this.style.display='none'" />
    <div class="titles">
      <h1>${escapeHtml(title)}</h1>
      <p>Periode: ${escapeHtml(periodLabel)}</p>
    </div>
    <p class="printed">Dicetak<br/>${escapeHtml(new Date().toLocaleString('id-ID'))}</p>
  </div>
  <div class="accent-bar"></div>
  <table>
    <thead>${theadHtml}</thead>
    <tbody>${tbodyHtml}</tbody>
  </table>
  <footer>
    <span>Dokumen digenerate otomatis oleh Marimas One — tidak memerlukan tanda tangan basah.</span>
    <span>Total data: ${rows.length} baris</span>
  </footer>
</body>
</html>`;
}

/**
 * Isi jendela browser yang SUDAH dibuka (lihat catatan di bawah) dengan tabel
 * yang sudah dirapikan dari CSV mentah, lalu trigger dialog print (user tinggal
 * pilih "Save as PDF").
 *
 * PENTING: `targetWindow` harus dibuka lewat window.open() SECARA SINKRON di
 * dalam event handler klik (sebelum ada `await` apa pun). Kalau window.open()
 * dipanggil setelah await (misal setelah fetch data selesai), browser sudah
 * tidak menganggapnya sebagai hasil klik langsung user dan akan memblokirnya
 * sebagai popup, walaupun popup blocker sudah diizinkan.
 */
export function printCsvAsReport(
  csvText: string,
  opts: { title: string; periodLabel: string },
  targetWindow: Window
): void {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    targetWindow.close();
    throw new Error('Data laporan kosong.');
  }

  const [headers, ...dataRows] = rows;
  const html = buildPrintableHtml({
    title: opts.title,
    periodLabel: opts.periodLabel,
    headers,
    rows: dataRows,
  });

  targetWindow.document.open();
  targetWindow.document.write(html);
  targetWindow.document.close();

  targetWindow.onload = () => {
    targetWindow.focus();
    targetWindow.print();
  };
}

/**
 * Sama seperti printCsvAsReport, tapi buat data yang sudah kebentuk
 * headers + rows di memori (bukan hasil fetch CSV dari backend) — dipakai
 * misalnya sama export Aset yang datanya sudah ada di state React, jadi
 * gak perlu bolak-balik ke CSV cuma buat di-parse ulang.
 *
 * PENTING: sama seperti printCsvAsReport, `targetWindow` harus dibuka lewat
 * window.open() SECARA SINKRON di dalam event handler klik.
 */
export function printRowsAsReport(
  headers: string[],
  rows: string[][],
  opts: { title: string; periodLabel: string },
  targetWindow: Window
): void {
  if (rows.length === 0) {
    targetWindow.close();
    throw new Error('Data yang dipilih kosong.');
  }

  const html = buildPrintableHtml({
    title: opts.title,
    periodLabel: opts.periodLabel,
    headers,
    rows,
  });

  targetWindow.document.open();
  targetWindow.document.write(html);
  targetWindow.document.close();

  targetWindow.onload = () => {
    targetWindow.focus();
    targetWindow.print();
  };
}