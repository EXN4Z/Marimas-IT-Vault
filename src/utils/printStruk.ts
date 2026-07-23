function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export interface StrukRow {
  label: string;
  value: string;
}

export interface StrukData {
  judul: string; // cth. "Bukti Peminjaman Aset"
  noStruk: string;
  tanggal: string; // sudah diformat, cth. "20 Juli 2026"
  rows: StrukRow[];
  totalLabel?: string; // cth. "Total Biaya"
  totalValue?: string; // cth. "Rp 250.000"
  catatan?: string | null;
}

/**
 * Buka window kecil berisi struk siap-cetak, lalu langsung trigger print
 * dialog dan nutup window-nya setelah selesai. Dipakai buat bukti
 * pinjam/pengembalian/penanganan aset.
 */
export function printStruk(data: StrukData) {
  const printWindow = window.open('', '_blank', 'width=420,height=600');
  if (!printWindow) return;

  const rowsHtml = data.rows
    .map(
      (r) => `
        <div class="row">
          <span class="label">${escapeHtml(r.label)}</span>
          <span class="value">${escapeHtml(r.value)}</span>
        </div>`
    )
    .join('');

  const totalHtml =
    data.totalLabel && data.totalValue
      ? `
        <div class="total-row">
          <span>${escapeHtml(data.totalLabel)}</span>
          <span>${escapeHtml(data.totalValue)}</span>
        </div>`
      : '';

  const catatanHtml = data.catatan
    ? `<div class="catatan"><span class="label">Catatan</span><p>${escapeHtml(data.catatan)}</p></div>`
    : '';

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(data.judul)} - ${escapeHtml(data.noStruk)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            padding: 24px;
            color: #1e293b;
          }
          .struk {
            max-width: 340px;
            margin: 0 auto;
            border: 1px dashed #94a3b8;
            border-radius: 10px;
            padding: 20px;
          }
          .brand {
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 2px;
          }
          h2 {
            text-align: center;
            font-size: 14px;
            margin: 4px 0 2px;
          }
          .no-struk {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .tanggal {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-bottom: 14px;
          }
          hr {
            border: none;
            border-top: 1px dashed #cbd5e1;
            margin: 10px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 12px;
            padding: 3px 0;
          }
          .row .label { color: #64748b; }
          .row .value { font-weight: 600; text-align: right; }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 700;
            padding-top: 10px;
            margin-top: 6px;
            border-top: 1px solid #1e293b;
          }
          .catatan { margin-top: 10px; font-size: 11px; }
          .catatan .label { color: #64748b; display: block; margin-bottom: 2px; }
          .catatan p { margin: 0; }
          .footer {
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 18px;
          }
        </style>
      </head>
      <body>
        <div class="struk">
          <p class="brand">MARIMAS ONE</p>
          <h2>${escapeHtml(data.judul)}</h2>
          <p class="no-struk">${escapeHtml(data.noStruk)}</p>
          <p class="tanggal">${escapeHtml(data.tanggal)}</p>
          <hr />
          ${rowsHtml}
          ${totalHtml}
          ${catatanHtml}
          <p class="footer">Dicetak otomatis oleh sistem Marimas One</p>
        </div>
        <script>
          window.onload = function () {
            window.print();
            window.onafterprint = function () { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}