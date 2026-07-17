import { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  X,
  Fingerprint,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import FaceCapture from '../components/FaceCapture';
import DaftarWajahModal from '../components/DaftarWajahModal';
import {
  scanAbsenFace,
  type Karyawan,
  type Absensi,
  type Role,
} from '../api/absensi';
import { useQueryClient } from '@tanstack/react-query';
import { useKaryawanAktif, useAbsensiHariIni, useRiwayatAbsensi } from '../hooks/useAbsensi';

// CATATAN: Halaman ini KHUSUS ADMIN. Ini satu-satunya tempat yang boleh
// menandai absen ATAS NAMA orang lain (override lewat karyawan_id).
// Role lain (hr/manajer/karyawan) diarahkan ke AbsensiSayaPage (self-service saja).

type TabKey = 'semua' | 'sudah_absen' | 'belum_absen';

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  hr: 'HR',
  manajer: 'Manajer',
  karyawan: 'Karyawan',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatJam(time: string | null): string {
  if (!time) return '-';
  return time.slice(0, 5);
}

function formatWaktu(tanggal: string): string {
  const date = new Date(tanggal);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function AbsensiPage() {
  const queryClient = useQueryClient();

  const { data: karyawanList = [], isLoading: loadingKaryawan, isError: errorKaryawan } = useKaryawanAktif();
  const { data: absensiHariIni = [], isLoading: loadingAbsensi } = useAbsensiHariIni();
  const { data: riwayat = [] } = useRiwayatAbsensi(10);
  const loading = loadingKaryawan || loadingAbsensi;
  const error = errorKaryawan ? 'Gagal memuat data absensi. Coba refresh halaman.' : '';

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('semua');

  const [modalKaryawan, setModalKaryawan] = useState<Karyawan | null>(null);
  const [modalAbsensi, setModalAbsensi] = useState<Absensi | null>(null);
  const [modalTipe, setModalTipe] = useState<'masuk' | 'pulang' | 'sudah_lengkap' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [faceResult, setFaceResult] = useState<{ verified: boolean; distance: number } | null>(null);

  const [wajahKaryawan, setWajahKaryawan] = useState<Karyawan | null>(null);

  const findAbsensi = (pekerjaId: number) =>
    absensiHariIni.find((a) => a.karyawan_id === pekerjaId) || null;

  const filteredKaryawan = karyawanList
    .filter(
      (k) =>
        k.user.name.toLowerCase().includes(search.toLowerCase()) ||
        k.nip.toLowerCase().includes(search.toLowerCase())
    )
    .filter((k) => {
      const rec = findAbsensi(k.id);
      const sudahAbsen = !!rec?.jam_masuk;
      if (activeTab === 'sudah_absen') return sudahAbsen;
      if (activeTab === 'belum_absen') return !sudahAbsen;
      return true;
    });

  const totalKaryawan = karyawanList.length;
  const sudahAbsenCount = karyawanList.filter((k) => !!findAbsensi(k.id)?.jam_masuk).length;
  const belumAbsenCount = totalKaryawan - sudahAbsenCount;

  const openModal = (item: Karyawan) => {
    const rec = findAbsensi(item.id);
    let tipe: 'masuk' | 'pulang' | 'sudah_lengkap';
    if (!rec || !rec.jam_masuk) tipe = 'masuk';
    else if (!rec.jam_pulang) tipe = 'pulang';
    else tipe = 'sudah_lengkap';

    setModalKaryawan(item);
    setModalAbsensi(rec);
    setModalTipe(tipe);
    setModalError('');
    setCapturedPhoto(null);
    setGps(null);
    setFaceResult(null);
  };

  const closeModal = () => {
    setModalKaryawan(null);
    setModalAbsensi(null);
    setModalTipe(null);
    setModalError('');
    setCapturedPhoto(null);
    setGps(null);
    setFaceResult(null);
  };

  const handleConfirmAbsen = async () => {
    if (!modalKaryawan || modalTipe === 'sudah_lengkap' || !capturedPhoto || !gps || !faceResult?.verified) return;

    setSubmitting(true);
    setModalError('');
    try {
      // BARU: override eksplisit lewat karyawan_id (khusus admin, sesuai kebijakan backend)
      const result = await scanAbsenFace(
        capturedPhoto,
        gps.lat,
        gps.lng,
        faceResult.verified,
        faceResult.distance,
        modalKaryawan.id
      );

      queryClient.setQueryData<Absensi[]>(['absensi-hari-ini'], (prev = []) => {
        const exists = prev.some((a) => a.id === result.absensi.id);
        return exists
          ? prev.map((a) => (a.id === result.absensi.id ? result.absensi : a))
          : [...prev, result.absensi];
      });

      queryClient.setQueryData<Absensi[]>(['riwayat-absensi', 10], (prev = []) =>
        [{ ...result.absensi, pekerja: result.pekerja }, ...prev].slice(0, 10)
      );

      closeModal();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Gagal memproses absen. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="Absensi (Admin)">
      <div className="mb-2">
        <p className="text-sm text-slate-500">
          Kelola & pantau absen seluruh karyawan. Sebagai Admin, kamu bisa menandai absen atas nama karyawan lain.
        </p>
      </div>

      <nav className="mb-6">
        <ul className="flex items-center gap-6 border-b border-slate-200">
          <li>
            <button
              onClick={() => setActiveTab('semua')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'semua'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users size={16} />
              Semua Karyawan
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {totalKaryawan}
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('sudah_absen')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'sudah_absen'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserCheck size={16} />
              Sudah Absen
              <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">
                {sudahAbsenCount}
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('belum_absen')}
              className={`flex items-center gap-2 pb-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'belum_absen'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserX size={16} />
              Belum Absen
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">
                {belumAbsenCount}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Daftar Karyawan</h3>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIP..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-col gap-2">
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-8">Memuat data karyawan...</p>
            ) : (
              <>
                {filteredKaryawan.map((item) => {
                  const rec = findAbsensi(item.id);
                  const sudahMasuk = !!rec?.jam_masuk;
                  const sudahPulang = !!rec?.jam_pulang;
                  const belumDaftarWajah = !item.face_descriptor;

                  return (
                    <div key={item.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-700 flex-shrink-0">
                          {initials(item.user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.user.name}</p>
                            {rec?.status === 'telat' && (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                                Terlambat
                              </span>
                            )}
                            {rec?.status_pulang === 'pulang_cepat' && (
                              <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex-shrink-0">
                                Pulang Cepat
                              </span>
                            )}
                            {belumDaftarWajah && (
                              <span
                                title="Wajah belum didaftarkan"
                                className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0"
                              >
                                Wajah Belum Terdaftar
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {item.nip} · {roleLabels[item.user.role]} · {item.departemen?.nama || '-'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-slate-400">
                            Masuk <span className="font-semibold text-slate-700">{formatJam(rec?.jam_masuk ?? null)}</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            Pulang <span className="font-semibold text-slate-700">{formatJam(rec?.jam_pulang ?? null)}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setWajahKaryawan(item)}
                            title={belumDaftarWajah ? 'Daftarkan Wajah' : 'Perbarui Wajah'}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                              belumDaftarWajah
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <Fingerprint size={16} />
                          </button>
                          {!sudahMasuk && (
                            <button
                              onClick={() => openModal(item)}
                              title="Tandai Masuk"
                              className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition"
                            >
                              <ArrowDownCircle size={16} />
                            </button>
                          )}
                          {sudahMasuk && !sudahPulang && (
                            <button
                              onClick={() => openModal(item)}
                              title="Tandai Pulang"
                              className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition"
                            >
                              <ArrowUpCircle size={16} />
                            </button>
                          )}
                          {sudahMasuk && sudahPulang && (
                            <span
                              title="Absen lengkap hari ini"
                              className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center"
                            >
                              <CheckCircle2 size={16} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredKaryawan.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">Karyawan tidak ditemukan.</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Riwayat Absensi</h3>
          <ul className="flex flex-col gap-4">
            {riwayat.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    r.jam_pulang ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {r.jam_pulang ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{r.pekerja?.user.name ?? '-'}</span>{' '}
                    {r.jam_pulang ? 'absen pulang' : 'absen masuk'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatJam(r.jam_pulang ?? r.jam_masuk)} · {formatWaktu(r.tanggal)}
                  </p>
                </div>
              </li>
            ))}

            {riwayat.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Belum ada riwayat absensi.</p>
            )}
          </ul>
        </div>
      </div>

      {/* MODAL KONFIRMASI ABSEN (override admin) */}
      {modalKaryawan && modalTipe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {modalTipe === 'masuk' && 'Absen Masuk'}
                {modalTipe === 'pulang' && 'Absen Pulang'}
                {modalTipe === 'sudah_lengkap' && 'Absen Lengkap'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-5">
              <p className="text-sm font-medium text-slate-800">{modalKaryawan.user.name}</p>
              <p className="text-xs text-slate-400">
                {modalKaryawan.nip} · {roleLabels[modalKaryawan.user.role]}
              </p>
              {modalAbsensi && (
                <p className="text-xs text-slate-400 mt-1">
                  Masuk {formatJam(modalAbsensi.jam_masuk)} · Pulang {formatJam(modalAbsensi.jam_pulang)}
                </p>
              )}
            </div>

            {modalTipe === 'sudah_lengkap' ? (
              <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-slate-400" />
                <span>Karyawan ini sudah absen masuk dan pulang hari ini.</span>
              </div>
            ) : (
              <>
                <FaceCapture
                  referenceDescriptor={modalKaryawan.face_descriptor}
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

                {modalError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                    {modalError}
                  </p>
                )}
                <button
                  onClick={handleConfirmAbsen}
                  disabled={submitting || !capturedPhoto || !gps || !faceResult?.verified}
                  className={`w-full mt-3 text-white text-sm font-semibold py-3 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    modalTipe === 'masuk' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting
                    ? 'Memproses...'
                    : `Konfirmasi ${modalTipe === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {wajahKaryawan && (
        <DaftarWajahModal
          karyawan={wajahKaryawan}
          onClose={() => setWajahKaryawan(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['karyawan-aktif'] });
            setWajahKaryawan(null);
          }}
        />
      )}
    </AppLayout>
  );
}