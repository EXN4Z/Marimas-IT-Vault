import { useEffect, useRef, useState } from 'react';
import { X, Camera, RotateCcw, CheckCircle2 } from 'lucide-react';
import { loadFaceModels, getFaceDescriptor } from '../../lib/faceApi';
import { daftarWajah, type Karyawan } from '../../api/absensi';

type Props = {
  karyawan: Karyawan;
  onClose: () => void;
  onSuccess: (karyawan: Karyawan) => void;
};

// Canvas hasil capture (dipakai buat extract descriptor) dipaksa selalu rasio 4:3,
// SAMA kayak container <video> yang ditampilkan (aspectRatio: '4/3' + CSS object-cover),
// dan SAMA kayak yang dipakai FaceCapture.tsx saat verifikasi/absen — supaya deskriptor
// yang dibandingkan konsisten dari sisi rasio & crop.
const CAPTURE_W = 320;
const CAPTURE_H = 240;

// PERBAIKAN (fix "wajah gepeng" saat daftar wajah, sama kayak fix di FaceCapture.tsx):
// Sebelumnya `ctx.drawImage(video, 0, 0, 320, 240)` men-STRETCH seluruh frame video
// paksa ke ukuran tujuan tanpa peduli rasio asli video dari kamera. Kamera HP hampir
// selalu BUKAN 4:3 (umumnya 16:9 atau lainnya), jadi wajah "diperas" jadi gepeng, dan
// descriptor yang tersimpan sebagai referensi jadi cacat dari awal — akibatnya proses
// absen (FaceCapture.tsx) nanti dibandingkan ke referensi yang salah bentuk, walau
// capture di sisi absen sendiri sudah benar.
//
// Fungsi ini meniru CSS object-fit:cover: crop bagian TENGAH frame video sesuai rasio
// tujuan, baru digambar penuh ke canvas — wajah tetap proporsional, cuma tepi gambar
// yang kepotong (bukan diperas).
function drawVideoFrameCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  destW: number,
  destH: number
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const videoRatio = vw / vh;
  const destRatio = destW / destH;

  let sx: number, sy: number, sw: number, sh: number;

  if (videoRatio > destRatio) {
    // Video lebih "lebar" dari target -> crop sisi kiri-kanan, tinggi dipakai penuh
    sh = vh;
    sw = vh * destRatio;
    sy = 0;
    sx = (vw - sw) / 2;
  } else {
    // Video lebih "tinggi"/sempit dari target -> crop atas-bawah, lebar dipakai penuh
    sw = vw;
    sh = vw / destRatio;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, destW, destH);
}

export default function DaftarWajahModal({ karyawan, onClose, onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch((err) => {
        console.error('Gagal load model wajah:', err);
        setError('Gagal memuat model deteksi wajah.');
      });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser.'));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const ambilFoto = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsReady) return;
    setError('');
    setProcessing(true);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    drawVideoFrameCover(ctx, videoRef.current, CAPTURE_W, CAPTURE_H);

    try {
      const desc = await getFaceDescriptor(canvasRef.current);
      if (!desc) {
        setError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.');
        setProcessing(false);
        return;
      }
      setDescriptor(Array.from(desc));
      setCaptured(canvasRef.current.toDataURL('image/jpeg', 0.9));
    } catch {
      setError('Gagal memproses deteksi wajah. Coba lagi.');
    } finally {
      setProcessing(false);
    }
  };

  const ulangi = () => {
    setCaptured(null);
    setDescriptor(null);
    setError('');
  };

  const simpan = async () => {
    if (!descriptor) return;
    setSubmitting(true);
    setError('');
    try {
      // UBAH: pakai karyawan.id (bukan qr_code). Kalau requester bukan admin,
      // backend tetap akan pakai identitas akun login sendiri (id ini diabaikan).
      const updated = await daftarWajah(descriptor, karyawan.id);
      onSuccess(updated);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menyimpan data wajah.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Daftar Wajah</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-slate-800">{karyawan.user.name}</p>
          <p className="text-xs text-slate-400">{karyawan.nip}</p>
        </div>

        <div className="relative w-full rounded-lg overflow-hidden bg-slate-900" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${captured ? 'hidden' : ''}`}
          />
          {captured && <img src={captured} alt="Wajah karyawan" className="w-full h-full object-cover" />}
        </div>
        <canvas ref={canvasRef} width={CAPTURE_W} height={CAPTURE_H} className="hidden" />

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            {error}
          </p>
        )}

        {!captured ? (
          <button
            onClick={ambilFoto}
            disabled={!modelsReady || processing}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition w-full justify-center mt-3 disabled:opacity-40"
          >
            <Camera size={16} />
            {processing ? 'Memproses...' : modelsReady ? 'Ambil Foto' : 'Memuat model...'}
          </button>
        ) : (
          <div className="flex flex-col gap-2 mt-3">
            <button
              onClick={simpan}
              disabled={submitting}
              className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition w-full justify-center disabled:opacity-40"
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Menyimpan...' : 'Simpan Wajah'}
            </button>
            <button
              onClick={ulangi}
              disabled={submitting}
              className="flex items-center gap-2 text-slate-600 text-sm px-4 py-2 hover:text-slate-800 transition justify-center disabled:opacity-50"
            >
              <RotateCcw size={14} />
              Ambil ulang
            </button> 
          </div>
        )}
      </div>
    </div>
  );
}