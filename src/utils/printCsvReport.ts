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

function buildPrintableHtml({ title, periodLabel, headers, rows }: PrintReportOptions): string {
  const theadHtml = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  const tbodyHtml = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((_, i) => `<td>${escapeHtml(r[i] ?? '-')}</td>`)
          .join('')}</tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #1e293b;
    margin: 0;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  header h1 { font-size: 16px; margin: 0; }
  header p { font-size: 11px; margin: 2px 0 0; color: #64748b; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9px;
  }
  thead { display: table-header-group; } /* header berulang di tiap halaman cetak */
  tr { page-break-inside: avoid; }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    text-align: left;
    word-wrap: break-word;
    overflow-wrap: break-word;
    /* penting: cegah browser/PDF viewer menafsirkan NIP panjang sebagai angka */
    white-space: normal;
  }
  th {
    background: #0f172a;
    color: #fff;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 8px;
    letter-spacing: 0.02em;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  footer {
    margin-top: 10px;
    font-size: 9px;
    color: #94a3b8;
    text-align: right;
  }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <p>Periode: ${escapeHtml(periodLabel)}</p>
    </div>
    <p>Dicetak: ${escapeHtml(new Date().toLocaleString('id-ID'))}</p>
  </header>
  <table>
    <thead>${theadHtml}</thead>
    <tbody>${tbodyHtml}</tbody>
  </table>
  <footer>Total data: ${rows.length} baris</footer>
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
