import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { X, ScanLine, AlertCircle, Upload, Camera } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ScanQrModalProps {
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  description?: string;
  isProcessing?: boolean; // true pas parent lagi memproses hasil scan
}

const CAMERA_ELEMENT_ID = 'qr-scanner-camera';
const UPLOAD_ELEMENT_ID = 'qr-scanner-upload';

export default function ScanQrModal({
  onClose,
  onScanSuccess,
  title = 'Scan QR',
  description = 'Arahkan kamera ke QR code.',
  isProcessing = false,
}: ScanQrModalProps) {
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [processing, setProcessing] = useState(false); // loading lokal: decode file
  const hasHandledScanRef = useState({ current: false })[0];
  const isRunningRef = useState({ current: false })[0];

  useEffect(() => {
    if (mode !== 'camera') return;

    hasHandledScanRef.current = false;
    isRunningRef.current = false;
    let cancelled = false;

    const html5QrCode = new Html5Qrcode(CAMERA_ELEMENT_ID);

    const stopSafely = () => {
      if (!isRunningRef.current) return;
      isRunningRef.current = false;
      try {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
      } catch (e) {}
    };

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (hasHandledScanRef.current) return;
          hasHandledScanRef.current = true;
          onScanSuccess(decodedText);
        },
        () => {}
      )
      .then(() => {
        isRunningRef.current = true;
        if (cancelled) stopSafely();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError('Tidak bisa mengakses kamera. Pastikan izin kamera diizinkan.');
      });

    return () => {
      cancelled = true;
      stopSafely();
    };
  }, [mode]);

  const decodePdf = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const scanner = new Html5Qrcode(UPLOAD_ELEMENT_ID, false);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;

      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      const pageFile = new File([blob], `page-${pageNum}.png`, { type: 'image/png' });

      try {
        return await scanner.scanFile(pageFile, false);
      } catch {
        // lanjut halaman berikutnya
      }
    }
    throw new Error('QR code tidak ditemukan di file PDF ini.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setProcessing(true);

    try {
      let decoded: string;
      if (file.type === 'application/pdf') {
        decoded = await decodePdf(file);
      } else if (file.type.startsWith('image/')) {
        const scanner = new Html5Qrcode(UPLOAD_ELEMENT_ID, false);
        decoded = await scanner.scanFile(file, false);
      } else {
        throw new Error('Format tidak didukung. Pakai PNG, JPG, atau PDF.');
      }

      if (hasHandledScanRef.current) return;
      hasHandledScanRef.current = true;
      onScanSuccess(decoded);
    } catch (err: any) {
      setError(err?.message || 'QR code tidak ditemukan di file ini.');
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  const busy = processing || isProcessing; // gabungan: lagi decode file ATAU lagi diproses parent

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ScanLine size={18} />
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('camera')}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition disabled:opacity-50 ${
              mode === 'camera' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Camera size={14} /> Kamera
          </button>
          <button
            onClick={() => setMode('upload')}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition disabled:opacity-50 ${
              mode === 'upload' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Upload size={14} /> Upload File
          </button>
        </div>

        {/* KAMERA — selalu di DOM, disembunyikan pas mode upload */}
        <div
          id={CAMERA_ELEMENT_ID}
          className={`w-full rounded-lg overflow-hidden bg-slate-900 min-h-[250px] ${
            mode === 'camera' ? '' : 'hidden'
          }`}
        />

        {/* UPLOAD */}
        {mode === 'upload' && (
          <>
            <label className="flex flex-col items-center justify-center gap-2 w-full min-h-[250px] rounded-lg bg-slate-50 border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-100 transition">
              <Upload size={28} className="text-slate-400" />
              <span className="text-sm text-slate-500 text-center px-4">
                {processing ? 'Memproses file...' : 'Klik untuk pilih PNG, JPG, atau PDF'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleFileChange}
                disabled={busy}
                className="hidden"
              />
            </label>
            <div id={UPLOAD_ELEMENT_ID} className="hidden" />
          </>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-400 text-center mt-3">{description}</p>

        {/* OVERLAY LOADING — muncul pas decode file jalan ATAU parent lagi memproses hasil scan */}
        {busy && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-8 h-8 border-[3px] border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-600">
              {processing ? 'Membaca QR dari file...' : 'Memproses...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}