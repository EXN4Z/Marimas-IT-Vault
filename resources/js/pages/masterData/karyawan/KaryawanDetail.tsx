import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '../../../lib/router';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import api from '../../../api/axios';
import RouteModal from '../../../components/shared/RouteModal';
import { Skeleton } from '../../../components/shared/skeleton';

type Role = 'admin' | 'user';

interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  nik: string | null;
  departemen: { id: number; nama: string } | null;
  lokasi_kantor: { id: number; nama: string } | null;
  perusahaan: { id: number; nama: string } | null;
  tanggal_masuk: string | null;
  status?: 'aktif' | 'nonaktif';
  created_at?: string | null;
}

const roleLabels: Record<Role, string> = {
  admin: 'Administrator Sistem',
  user: 'Pengguna / Karyawan',
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTanggal(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function KaryawanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setErrorMsg('');
    api
      .get<User>(`/karyawan/${id}`)
      .then((res) => setUser(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          setErrorMsg('Anda tidak punya akses untuk melihat data ini.');
        } else if (err.response?.status === 404) {
          setErrorMsg('User tidak ditemukan.');
        } else {
          setErrorMsg('Gagal memuat data user.');
          toast.error('Gagal memuat data user.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  function closeModal() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/karyawan', { replace: true });
    }
  }

  if (loading) {
    return (
      <RouteModal
        title="Detail Karyawan"
        description="Informasi profil dan penempatan kerja karyawan."
        maxWidthClassName="max-w-2xl"
        fallbackPath="/karyawan"
        onClose={closeModal}
      >
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-4 w-28 rounded-full" />
            </div>
          </div>
          <div className="space-y-3 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-zinc-800">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-4 w-44 rounded" />
              </div>
            ))}
          </div>
        </div>
      </RouteModal>
    );
  }

  if (errorMsg || !user) {
    return (
      <RouteModal
        title="Detail Karyawan"
        maxWidthClassName="max-w-2xl"
        fallbackPath="/karyawan"
        onClose={closeModal}
      >
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center mb-3">
            <UserIcon size={24} />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{errorMsg || 'User tidak ditemukan.'}</p>
          <button
            type="button"
            onClick={closeModal}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-zinc-800 text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Kembali
          </button>
        </div>
      </RouteModal>
    );
  }

  const isAktif = user.status !== 'nonaktif';

  return (
    <RouteModal
      title="Detail Karyawan"
      description="Informasi profil dan penempatan kerja karyawan."
      maxWidthClassName="max-w-2xl"
      fallbackPath="/karyawan"
      onClose={closeModal}
    >
      <div className="space-y-6">
        {/* Clean Profile Header - Tanpa background biru / tanpa nested card */}
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200 dark:border-zinc-800">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-lg font-bold text-slate-800 dark:text-zinc-200 shrink-0">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 leading-tight truncate">
                {user.name}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  user.role === 'admin'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                    : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <ShieldCheck size={12} />
                {roleLabels[user.role]}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isAktif
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <CheckCircle2 size={12} />
                {isAktif ? 'Akun Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">
              {user.departemen?.nama || 'Tanpa Departemen'}
              {user.lokasi_kantor?.nama ? ` · ${user.lokasi_kantor.nama}` : ''}
            </p>
          </div>
        </div>

        {/* Section 1: Identitas & Kontak */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
            Identitas & Kontak
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            <DetailRow label="NIK Karyawan" value={user.nik} />
            <DetailRow label="Nama Lengkap" value={user.name} />
            <DetailRow label="Alamat Email" value={user.email} />
            <DetailRow label="Nomor Telepon / WhatsApp" value={user.phone} />
            <DetailRow label="Tanggal Masuk" value={formatTanggal(user.tanggal_masuk)} />
          </div>
        </div>

        {/* Section 2: Penempatan & Organisasi */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
            Penempatan Kerja
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            <DetailRow label="Departemen" value={user.departemen?.nama} />
            <DetailRow label="Perusahaan" value={user.perusahaan?.nama} />
            <DetailRow label="Cabang / Lokasi Kantor" value={user.lokasi_kantor?.nama} />
          </div>
        </div>

        {/* Footer: Tombol Tutup saja (tanpa tombol edit di sebelahnya) */}
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={closeModal}
            className="text-xs font-semibold px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-xs transition cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </RouteModal>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 text-sm">
      <span className="w-52 text-slate-500 dark:text-zinc-400 text-xs sm:text-sm font-medium shrink-0">
        {label}
      </span>
      <span className="text-slate-900 dark:text-zinc-100 font-semibold break-words mt-0.5 sm:mt-0 flex-1">
        {value || '-'}
      </span>
    </div>
  );
}