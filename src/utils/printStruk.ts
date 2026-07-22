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
 * Buka tab/halaman baru berisi struk siap-cetak, dengan tombol "Cetak" dan
 * "Unduh PDF" (unduh PDF = dialog cetak browser, pilih tujuan "Simpan sebagai
 * PDF"). Tidak auto-print lagi — biar user yang milih aksinya. Dipakai buat
 * bukti pinjam/pengembalian/penanganan aset.
 */
export function printStruk(data: StrukData) {
  const printWindow = window.open('', '_blank');
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
          .actions {
            max-width: 340px;
            margin: 16px auto 0;
            display: flex;
            gap: 8px;
          }
          .actions button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            background: #fff;
            color: #1e293b;
            cursor: pointer;
          }
          .actions button:hover { background: #f1f5f9; }
          .actions button.primary {
            background: #0f172a;
            border-color: #0f172a;
            color: #fff;
          }
          .actions button.primary:hover { background: #1e293b; }
          .hint {
            max-width: 340px;
            margin: 8px auto 0;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
          }
          @media print {
            .actions, .hint { display: none; }
            body { padding: 0; }
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
          <p class="footer">Dicetak oleh sistem Marimas One</p>
        </div>
        <div class="actions">
          <button type="button" onclick="window.print()">🖨️ Cetak</button>
          <button type="button" class="primary" onclick="window.print()">⬇️ Unduh PDF</button>
        </div>
        <p class="hint">Untuk unduh PDF, pilih tujuan "Simpan sebagai PDF" di dialog cetak.</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.document.title = `${data.judul} - ${data.noStruk}`;
}
