import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { RotateCcw, ScanFace } from 'lucide-react';
import { loadFaceModels, getFaceDescriptor, euclideanDistance, FACE_MATCH_THRESHOLD } from '../lib/faceApi';

type Props = {
  referenceDescriptor: number[] | null; // descriptor wajah terdaftar milik karyawan ini
  onCapture: (photo: Blob, lat: number, lng: number, faceVerified: boolean, matchDistance: number) => void;
  onReset?: () => void;
};

type Direction = 'kiri' | 'kanan' | 'atas' | 'bawah';
// Urutan alur sekarang: loading -> positioning -> verifying (cocokkan identitas wajah
// dengan referenceDescriptor) -> challenge (liveness, disuruh nengok) -> returning
// (balik hadap depan) -> captured (ambil foto final, TANPA re-match wajah lagi karena
// identitas udah dipastikan di tahap 'verifying').
type Stage = 'loading' | 'positioning' | 'verifying' | 'challenge' | 'returning' | 'failed' | 'captured';

const DIRECTIONS: Direction[] = ['kiri', 'kanan', 'atas', 'bawah'];
const DIRECTION_LABEL: Record<Direction, string> = {
  kiri: 'KIRI',
  kanan: 'KANAN',
  atas: 'ATAS',
  bawah: 'BAWAH',
};

// "Kiri/kanan/atas/bawah" di sini merujuk ke arah FISIK badan user (kayak lagi diajak
// ngomong langsung: "noleh kiri" = noleh ke kiri badan sendiri), BUKAN sisi layar.
// Video-nya sendiri ditampilkan apa adanya tanpa mirror, jadi secara koordinat gambar
// arahnya kebalik dari arah fisik — itu udah dikompensasi di logic pengecekan dx di bawah.

// Toleransi pergeseran hidung relatif terhadap ukuran wajah, dipakai buat nentuin
// user sudah "cukup nengok" ke arah yang diminta. Kalau kerasa kegampangan atau
// kesulitan pas dites di device asli, tinggal naik/turunkan angka ini.
const YAW_THRESHOLD = 0.07; // sensitivitas gerak kiri-kanan — diturunin dari 0.09, kerasa kaku
const PITCH_THRESHOLD_UP = 0.055; // sensitivitas gerak atas — diturunin dari 0.07
const PITCH_THRESHOLD_DOWN = 0.045; // sensitivitas gerak bawah — dibuat lebih ringan karena
// nunduk dalam gampang bikin dagu nutupin wajah sampai TinyFaceDetector kehilangan deteksi
const POSITION_STABLE_FRAMES = 3; // deteksi berturut-turut sebelum dianggap "wajah stabil di tengah"
const CHALLENGE_MATCH_FRAMES = 2; // "skor" progres nengok/balik-tengah yang harus dicapai
const RETURN_CENTER_TOLERANCE = 0.06; // toleransi "udah balik ke tengah" — LEBIH LONGGAR
// daripada threshold gerak (di atas), karena ini cuma butuh "kira-kira lurus lagi",
// bukan "persis di pixel yang sama kayak baseline". Sebelumnya ini kebalik: malah lebih
// ketat dari threshold geraknya sendiri (0.0225), padahal noise deteksi landmark aja udah
// bisa segitu meski wajah diam sempurna — makanya kerasa "gak bisa-bisa" walau udah lurus.
const MISS_TOLERANCE_FRAMES = 6; // toleransi berapa frame BERTURUT-TURUT boleh gagal detect
// sebelum dianggap "wajah hilang" dan reset ke positioning. Tanpa ini, 1 frame gagal
// (wajar terjadi pas kepala lagi bergerak/menunduk) langsung nge-reset semua progress.
const DETECT_INTERVAL_MS = 220; // jeda antar frame yang dianalisis (bukan realtime tiap frame, biar hemat CPU)

// PENTING: kode di bawah pakai faceapi.detectSingleFace(...).withFaceLandmarks() langsung
// dari video stream (live, tanpa jepret foto) untuk menghitung arah hadap. Ini butuh model
// TinyFaceDetector + FaceLandmark68Net sudah dimuat. Pastikan loadFaceModels() di
// ../lib/faceApi memuat keduanya (biasanya sudah, karena getFaceDescriptor juga butuh
// landmark buat face alignment sebelum extract descriptor). Kalau ternyata lib itu cuma
// load SsdMobilenetv1, ganti TinyFaceDetectorOptions() di bawah sesuai model yang dimuat.

export default function FaceCapture({ referenceDescriptor, onCapture, onReset }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimerRef = useRef<number | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const [stage, setStage] = useState<Stage>('loading');
  const [direction, setDirection] = useState<Direction | null>(null);
  const [debugInfo, setDebugInfo] = useState(''); // DEBUG ONLY — bisa dihapus kalau sudah stabil

  // Baseline posisi hidung saat wajah pertama kali terdeteksi lurus ke depan —
  // dipakai sebagai acuan buat ngukur seberapa jauh user udah nengok.
  const baselineRef = useRef<{ x: number; y: number; boxSize: number } | null>(null);
  const stableCountRef = useRef(0);
  const matchCountRef = useRef(0);
  const missCountRef = useRef(0); // hitung frame gagal detect berturut-turut
  const warmedUpRef = useRef(false); // sudah pernah warm-up recognition net apa belum
  const matchDistanceRef = useRef(0); // distance hasil verifikasi identitas awal, dibawa
  // sampai ke ambilFotoFinal() buat dikirim ke onCapture (gak perlu re-match lagi di akhir)
  const tickErrorLoggedRef = useRef(false); // biar console.error di catch block tick loop
  // cuma nge-log SEKALI per rentetan kegagalan, bukan tiap 220ms selama errornya persisten

  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setError('Gagal memuat model deteksi wajah.'));

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser.'));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current);
    };
  }, []);

  // Begitu model & data referensi siap, mulai tahap "posisikan wajah"
  useEffect(() => {
    if (modelsReady && referenceDescriptor && stage === 'loading') {
      setStage('positioning');
    }
  }, [modelsReady, referenceDescriptor, stage]);

  const pickRandomDirection = (): Direction => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];

  // Dipanggil sekali begitu wajah dianggap stabil di tengah (POSITION_STABLE_FRAMES
  // tercapai). Jepret frame saat ini dari video, extract descriptor, lalu cocokkan
  // dengan referenceDescriptor milik karyawan. Kalau cocok -> lanjut ke liveness
  // challenge (nengok arah). Kalau tidak cocok / wajah gak kedetect -> balik ke
  // positioning, user harus stabilkan wajah lagi sebelum dicoba ulang.
  const verifikasiIdentitas = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !referenceDescriptor) return;
    setError('');
    setStage('verifying');

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);

    try {
      const descriptor = await getFaceDescriptor(canvasRef.current);
      if (!descriptor) {
        setError('Wajah tidak terdeteksi saat verifikasi. Coba ulangi.');
        setStage('failed');
        return;
      }

      const distance = euclideanDistance(descriptor, referenceDescriptor);
      const verified = distance <= FACE_MATCH_THRESHOLD;

      if (!verified) {
        setError('Wajah tidak cocok dengan data terdaftar. Coba lagi dengan pencahayaan lebih baik.');
        setStage('failed');
        return;
      }

      // Identitas cocok — simpan distance buat dikirim nanti pas foto final diambil,
      // lalu lanjut ke liveness challenge (disuruh nengok ke arah random).
      matchDistanceRef.current = distance;
      matchCountRef.current = 0;
      setDirection(pickRandomDirection());
      setStage('challenge');
    } catch {
      setError('Gagal memproses deteksi wajah. Coba lagi.');
      setStage('failed');
    }
  }, [referenceDescriptor]);

  // Dipanggil setelah user berhasil menyelesaikan challenge arah DAN balik hadap
  // depan lagi (stage 'returning' selesai). Identitas sudah dipastikan cocok di
  // verifikasiIdentitas() sebelumnya, jadi di sini tinggal jepret foto final + ambil
  // lokasi GPS, tanpa perlu jalankan face matching lagi.
  const ambilFotoFinal = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setError('');

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);

    setCaptured(canvasRef.current.toDataURL('image/jpeg', 0.9));
    setStage('captured');
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        canvasRef.current!.toBlob(
          (blob) => {
            if (blob) {
              onCapture(blob, pos.coords.latitude, pos.coords.longitude, true, matchDistanceRef.current);
            } else {
              setError('Gagal memproses foto. Coba lagi.');
              setCaptured(null);
              setStage('positioning');
            }
            setLocating(false);
          },
          'image/jpeg',
          0.9
        );
      },
      () => {
        setError('Gagal mengambil lokasi GPS. Aktifkan izin lokasi di browser.');
        setLocating(false);
        setCaptured(null);
        setStage('positioning');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onCapture]);

  // Loop deteksi wajah + landmark, jalan terus selama tahap 'positioning', 'challenge',
  // atau 'returning'. Ini TIDAK menjepret foto — cuma baca posisi wajah dari video
  // secara live tiap DETECT_INTERVAL_MS, buat: (1) mastiin wajah stabil di depan
  // kamera, lalu (2) ngecek apakah user udah nengok/balik-tengah sesuai yang diminta.
  useEffect(() => {
    if (stage !== 'positioning' && stage !== 'challenge' && stage !== 'returning') return;
    if (!modelsReady) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || !videoRef.current) return;

      const video = videoRef.current;

      // Video butuh minimal HAVE_CURRENT_DATA (readyState >= 2) supaya ada frame nyata buat
      // dianalisis. Kalau belum siap, skip dulu tick ini (JANGAN dianggap "wajah tidak
      // terdeteksi" — itu kondisi beda), coba lagi di tick berikutnya.
      if (video.readyState < 2 || video.videoWidth === 0) {
        setDebugInfo('Menunggu video siap...');
        if (!cancelled) detectTimerRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
        return;
      }

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        setDebugInfo(
          detection
            ? `Wajah terdeteksi (skor ${detection.detection.score.toFixed(2)}) — progres: ${matchCountRef.current}/${CHALLENGE_MATCH_FRAMES}`
            : 'Wajah tidak terdeteksi di frame ini'
        );

        if (!detection) {
          missCountRef.current += 1;
          setDebugInfo(`Wajah tidak terdeteksi (${missCountRef.current}/${MISS_TOLERANCE_FRAMES})`);

          if (missCountRef.current >= MISS_TOLERANCE_FRAMES) {
            // Baru dianggap beneran "hilang" setelah gagal berturut-turut, bukan 1 frame doang
            stableCountRef.current = 0;
            matchCountRef.current = 0;
            setDirection(null);
            if (stage !== 'positioning') setStage('positioning');
          }
          // kalau belum sampai batas toleransi, biarin stage & progress apa adanya —
          // tunggu frame berikutnya, jangan reset dulu
        } else {
          missCountRef.current = 0;
          tickErrorLoggedRef.current = false; // deteksi jalan normal lagi, reset flag log error
          const nosePoints = detection.landmarks.getNose(); // 9 titik (indeks landmark 27-35)
          const noseTip = nosePoints[3] ?? nosePoints[Math.floor(nosePoints.length / 2)]; // ~titik 30, ujung hidung
          const box = detection.detection.box;
          const boxSize = (box.width + box.height) / 2;

          if (stage === 'positioning') {
            stableCountRef.current += 1;

            // Fire-and-forget: kompilasi model FaceRecognitionNet (dipakai getFaceDescriptor
            // pas verifikasi identitas nanti) lebih awal, mumpung ada wajah nyata di kamera.
            // Tanpa ini, panggilan getFaceDescriptor() PERTAMA (baru kejadian pas verifikasi
            // identitas) yang nanggung beban compile shader WebGL-nya, jadi kerasa lambat
            // sekali doang. Hasilnya dibuang, cuma butuh efek sampingnya (model jadi "anget").
            if (!warmedUpRef.current && stableCountRef.current === 1) {
              warmedUpRef.current = true;
              getFaceDescriptor(video).catch(() => {});
            }

            if (stableCountRef.current >= POSITION_STABLE_FRAMES) {
              // Simpan posisi hidung saat ini sebagai acuan "lurus ke depan", lalu
              // langsung verifikasi identitas SEBELUM masuk challenge arah.
              baselineRef.current = { x: noseTip.x, y: noseTip.y, boxSize };
              await verifikasiIdentitas();
              return; // stage sudah dialihkan (verifying -> challenge/positioning) di dalamnya
            }
          } else if (stage === 'challenge' && baselineRef.current && direction) {
            const dx = (noseTip.x - baselineRef.current.x) / baselineRef.current.boxSize;
            const dy = (noseTip.y - baselineRef.current.y) / baselineRef.current.boxSize;

            let matched = false;
            // Video TIDAK di-mirror (bukan kayak cermin), jadi noleh ke kanan FISIK badan
            // user bikin hidungnya geser ke arah KIRI layar (dx mengecil/negatif) di frame
            // kamera — kebalik dari intuisi. Makanya di sini kondisinya sengaja "ditukar"
            // biar instruksi "kiri/kanan" cocok sama arah fisik badan user, bukan sisi layar.
            if (direction === 'kiri' && dx > YAW_THRESHOLD) matched = true;
            if (direction === 'kanan' && dx < -YAW_THRESHOLD) matched = true;
            if (direction === 'atas' && dy < -PITCH_THRESHOLD_UP) matched = true;
            if (direction === 'bawah' && dy > PITCH_THRESHOLD_DOWN) matched = true;

            if (matched) {
              matchCountRef.current += 1;
              if (matchCountRef.current >= CHALLENGE_MATCH_FRAMES) {
                // Jangan langsung foto di sini — sudut wajah masih menoleh/nunduk,
                // beda jauh dari foto pendaftaran yang frontal. Minta user balik
                // hadap depan dulu (stage 'returning'), foto diambil setelah itu.
                matchCountRef.current = 0;
                setStage('returning');
              }
            } else {
              // DECAY, bukan reset total ke 0 — wajah manusia wajar goyang dikit (jitter),
              // jadi 1 frame yang meleset dikit dari threshold jangan langsung hapus semua
              // progress yang udah kekumpul.
              matchCountRef.current = Math.max(0, matchCountRef.current - 1);
            }
          } else if (stage === 'returning' && baselineRef.current) {
            const dx = (noseTip.x - baselineRef.current.x) / baselineRef.current.boxSize;
            const dy = (noseTip.y - baselineRef.current.y) / baselineRef.current.boxSize;
            const sudahDitengah = Math.abs(dx) < RETURN_CENTER_TOLERANCE && Math.abs(dy) < RETURN_CENTER_TOLERANCE;

            setDebugInfo(
              `dx=${dx.toFixed(3)} dy=${dy.toFixed(3)} (batas ±${RETURN_CENTER_TOLERANCE}) — progres: ${matchCountRef.current}/${CHALLENGE_MATCH_FRAMES}`
            );

            if (sudahDitengah) {
              matchCountRef.current += 1;
              if (matchCountRef.current >= CHALLENGE_MATCH_FRAMES) {
                await ambilFotoFinal();
                return; // stage sudah dialihkan ke 'captured' di dalam fungsi di atas
              }
            } else {
              matchCountRef.current = Math.max(0, matchCountRef.current - 1);
            }
          }
        }
      } catch (err) {
        // DULU: silent-catch (biarin aja). Ini yang bikin masalah kemarin ketutup —
        // sekarang di-log biar kelihatan kalau memang selalu gagal terus-menerus.
        // TAPI cuma sekali per rentetan gagal (bukan tiap tick 220ms), biar console
        // gak kebanjiran log yang sama pas errornya nyangkut terus.
        if (!tickErrorLoggedRef.current) {
          tickErrorLoggedRef.current = true;
          console.error('Gagal deteksi frame:', err);
        }
        setDebugInfo(`Error deteksi: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (!cancelled) {
        detectTimerRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, modelsReady, direction]);

  const ulangi = () => {
    setCaptured(null);
    setError('');
    stableCountRef.current = 0;
    matchCountRef.current = 0;
    missCountRef.current = 0;
    baselineRef.current = null;
    matchDistanceRef.current = 0;
    tickErrorLoggedRef.current = false;
    setDirection(null);
    setStage('positioning');
    onReset?.();
  };

  if (!referenceDescriptor) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-center">
        Karyawan ini belum mendaftarkan wajah. Daftarkan wajah dulu sebelum bisa absen.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative w-full rounded-lg overflow-hidden bg-slate-900" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${captured ? 'hidden' : ''}`}
        />
        {captured && <img src={captured} alt="Foto absen" className="w-full h-full object-cover" />}

        {!captured && stage === 'challenge' && direction && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm text-white text-center py-3 px-4">
            <p className="text-xs text-slate-300 mb-0.5">Hadapkan wajah ke</p>
            <p className="text-lg font-bold tracking-wide flex items-center justify-center gap-2">
              <ScanFace size={18} />
              {DIRECTION_LABEL[direction]}
            </p>
          </div>
        )}

        {!captured && stage === 'returning' && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm text-white text-center py-3 px-4">
            <p className="text-sm font-semibold">Bagus! Sekarang hadap depan lagi ke kamera</p>
          </div>
        )}

        {!captured && stage === 'positioning' && modelsReady && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm text-white text-center py-3 px-4">
            <p className="text-sm">Posisikan wajah di tengah kamera...</p>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      {!modelsReady && <p className="text-xs text-slate-400 text-center">Memuat model deteksi wajah...</p>}

      {/* DEBUG ONLY — hapus blok ini kalau deteksi sudah jalan stabil */}
      {debugInfo && (stage === 'positioning' || stage === 'challenge' || stage === 'returning') && (
        <p className="text-[11px] text-slate-400 font-mono text-center">{debugInfo}</p>
      )}

      {stage === 'verifying' && <p className="text-xs text-slate-500 text-center">Memverifikasi wajah...</p>}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 w-full text-center">
          {error}
        </p>
      )}

      {(captured || stage === 'failed') && (
        <button
          onClick={ulangi}
          type="button"
          disabled={locating}
          className="flex items-center gap-2 text-slate-600 text-sm px-4 py-2 hover:text-slate-800 transition disabled:opacity-50"
        >
          <RotateCcw size={14} />
          {locating ? 'Memproses lokasi...' : 'Ambil ulang'}
        </button>
      )}
    </div>
  );
}