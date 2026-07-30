import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import type { Karyawan } from '../../api/absensi';

interface KaryawanQrModalProps {
  karyawan: Karyawan;
  onClose: () => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default function KaryawanQrModal({ karyawan, onClose }: KaryawanQrModalProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const svgElement = qrContainerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgMarkup = new XMLSerializer().serializeToString(svgElement);
    const printWindow = window.open('', '_blank', 'width=420,height=520');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Kartu Absen ${escapeHtml(karyawan.user.name)}</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              text-align: center;
              padding: 24px;
            }
            .label {
              display: inline-block;
              border: 1px dashed #999;
              border-radius: 10px;
              padding: 20px 24px;
            }
            h2 {
              margin: 14px 0 2px;
              font-size: 15px;
              font-weight: 600;
            }
            p {
              margin: 0;
              font-size: 12px;
              color: #666;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${svgMarkup}
            <h2>${escapeHtml(karyawan.user.name)}</h2>
            <p>${escapeHtml(karyawan.nip)}</p>
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
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">QR Absen Karyawan</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div
          ref={qrContainerRef}
          className="flex flex-col items-center gap-3 border border-slate-200 rounded-lg py-6 mb-4"
        >
          <QRCodeSVG value={karyawan.qr_code} size={180} level="M" />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">{karyawan.user.name}</p>
            <p className="text-xs text-slate-400 tracking-wide">{karyawan.nip}</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition"
        >
          <Printer size={16} />
          Cetak Kartu QR
        </button>

        <p className="text-[11px] text-slate-400 text-center mt-3">
          Kartu ini dipegang karyawan — nanti di-scan tiap absen lewat menu "Scan QR".
        </p>
      </div>
    </div>
  );
}