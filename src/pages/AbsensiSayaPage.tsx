import { useEffect, useState, useCallback } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, AlertCircle, Fingerprint, QrCode } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import FaceCapture from '../components/FaceCapture';
import ScanQrModal from '../components/ScanQrModal';
import DaftarWajahModal from '../components/DaftarWajahModal';
import { getAbsensiSaya, scanAbsenQr, scanAbsenFace, type Karyawan, type Absensi } from '../api/absensi';

// Harus sinkron sama ABSENSI_QR_CUTOFF di backend .env
const QR_CUTOFF = '08:00';

function formatJam(time: string | null | undefined): string {
  if (!time) return '-';
  return time.slice(0, 5);
}

function isBeforeCutoff(): boolean {
  const now = new Date();
  const jam = now.toTimeString().slice(0, 5); // "HH:MM"
  return jam < QR_CUTOFF;
}

export default function AbsensiSayaPage() {
  const [pekerja, setPekerja] = useState<Karyawan | null>(null);
  const [absensi, setAbsensi] = useState<Absensi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mode, setMode] = useState<'qr' | 'face'>(isBeforeCutoff() ? 'qr' : 'face');
  const [now, setNow] = useState(new Date());

  const [showQr, setShowQr] = useState(false);
  const [qrProcessing, setQrProcessing] = useState(false);

  const [showFace, setShowFace] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [faceResult, setFaceResult] = useState<{ verified: boolean; distance: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [wajahModal, setWajahModal] = useState(false);

  const muatData = async () => {
    setLoading(true);
    setError('');
    try {
      const { pekerja, absensi_hari_ini } = await getAbsensiSaya();
      setPekerja(pekerja);
      setAbsensi(absensi_hari_ini);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data absensi kamu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatData();
  }, []);

  // Jam berjalan tiap detik, dan sekaligus jadi acuan buat cek cutoff QR/Wajah
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setMode(isBeforeCutoff() ? 'qr' : 'face');
    }, 1_000);
    return () => clearInterval(interval);
  }, []);

  const sudahMasuk = !!absensi?.jam_masuk;
  const sudahPulang = !!absensi?.jam_pulang;
  const tipe: 'masuk' | 'pulang' | 'sudah_lengkap' = !sudahMasuk ? 'masuk' : !sudahPulang ? 'pulang' : 'sudah_lengkap';

  const jamSekarang = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tanggalSekarang = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const bukaAbsen = () => {
    if (mode === 'qr') {
      setShowQr(true);
      return;
    }
    setCapturedPhoto(null);
    setGps(null);
    setFaceResult(null);
    setSubmitError('');
    setShowFace(true);
  };

  const tutupAbsen = () => {
    setShowFace(false);
    setCapturedPhoto(null);
    setGps(null);
    setFaceResult(null);
    setSubmitError('');
  };

  const konfirmasiFace = async () => {
    if (!capturedPhoto || !gps || !faceResult?.verified) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await scanAbsenFace(capturedPhoto, gps.lat, gps.lng, faceResult.verified, faceResult.distance);
      setAbsensi(result.absensi);
      tutupAbsen();
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Gagal memproses absen. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrScan = useCallback(async (decodedText: string) => {
    setQrProcessing(true);
    try {
      const result = await scanAbsenQr(decodedText);
      setAbsensi(result.absensi);
      setShowQr(false);
    } catch (err: any) {
      // ScanQrModal nggak punya prop buat nampilin server error secara eksplisit,
      // jadi biar user tau, kita alert dulu; modal tetap kebuka biar bisa coba scan ulang
      alert(err.response?.data?.message || 'QR tidak valid atau gagal diproses.');
    } finally {
      setQrProcessing(false);
    }
  }, []);

  if (loading) {
    return (
      <AppLayout title="Absensi">
        <p className="text-sm text-slate-400 text-center py-12">Memuat data kamu...</p>
      </AppLayout>
    );
  }

  if (error || !pekerja) {
    return (
      <AppLayout title="Absensi">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error || 'Data karyawan tidak ditemukan.'}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Absensi">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center">
          <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-wide">{jamSekarang}</p>
          <p className="text-xs text-slate-400 mb-6 capitalize">{tanggalSekarang}</p>

          <h2 className="text-lg font-semibold text-slate-900">{pekerja.user.name}</h2>
          <p className="text-sm text-slate-400 mb-1">{pekerja.nip}</p>
          <p className="text-xs text-slate-400 mb-6 flex items-center justify-center gap-1">
            {mode === 'qr' ? <QrCode size={12} /> : <Fingerprint size={12} />}
            Mode absen saat ini: {mode === 'qr' ? 'QR Code' : 'Wajah + Lokasi'}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Masuk</p>
              <p className="text-lg font-semibold text-slate-800">{formatJam(absensi?.jam_masuk)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Pulang</p>
              <p className="text-lg font-semibold text-slate-800">{formatJam(absensi?.jam_pulang)}</p>
            </div>
          </div>

          {tipe === 'sudah_lengkap' ? (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 justify-center">
              <CheckCircle2 size={16} className="text-slate-400" />
              <span>Kamu sudah absen masuk & pulang hari ini.</span>
            </div>
          ) : mode === 'qr' ? (
            <button
              onClick={bukaAbsen}
              className={`w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-lg transition ${
                tipe === 'masuk' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <QrCode size={18} />
              {tipe === 'masuk' ? 'Scan QR Masuk' : 'Scan QR Pulang'}
            </button>
          ) : !pekerja.face_descriptor ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-left">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>Wajah kamu belum terdaftar. Daftarkan dulu sebelum bisa absen.</span>
              </div>
              <button
                onClick={() => setWajahModal(true)}
                className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition w-full justify-center"
              >
                <Fingerprint size={16} />
                Daftarkan Wajah
              </button>
            </div>
          ) : (
            <button
              onClick={bukaAbsen}
              className={`w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-lg transition ${
                tipe === 'masuk' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {tipe === 'masuk' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
              {tipe === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'}
            </button>
          )}
        </div>
      </div>

      {/* MODAL QR — reuse komponen yang sudah ada */}
      {showQr && (
        <ScanQrModal
          onClose={() => setShowQr(false)}
          onScanSuccess={handleQrScan}
          title={tipe === 'masuk' ? 'Scan QR Masuk' : 'Scan QR Pulang'}
          description="Arahkan kamera ke QR code kartu absen kamu."
          isProcessing={qrProcessing}
        />
      )}

      {/* MODAL FACE */}
      {showFace && mode === 'face' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              {tipe === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'}
            </h3>

            <FaceCapture
              referenceDescriptor={pekerja.face_descriptor}
              onCapture={(photo, lat, lng, verified, distance) => {
                setCapturedPhoto(photo);
                setGps({ lat, lng });
                setFaceResult({ verified, distance });
              }}
              onReset={() => {
                setCapturedPhoto(null);
                setGps(null);
                setFaceResult(null);
              }}
            />

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                {submitError}
              </p>
            )}

            <div className="flex flex-col gap-2 mt-3">
              <button
                onClick={konfirmasiFace}
                disabled={submitting || !capturedPhoto || !gps || !faceResult?.verified}
                className={`w-full text-white text-sm font-semibold py-3 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  tipe === 'masuk' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? 'Memproses...' : `Konfirmasi ${tipe === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'}`}
              </button>
              <button
                onClick={tutupAbsen}
                disabled={submitting}
                className="text-sm text-slate-500 hover:text-slate-700 py-2"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {wajahModal && (
        <DaftarWajahModal
          karyawan={pekerja}
          onClose={() => setWajahModal(false)}
          onSuccess={(updated) => {
            setPekerja(updated);
            setWajahModal(false);
          }}
        />
      )}
    </AppLayout>
  );
}