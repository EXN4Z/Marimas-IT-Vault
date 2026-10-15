import type { ReactNode } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import RouteModal from '../../shared/RouteModal';
import type { KaryawanRow } from '../../../types/karyawan';

interface Props {
  user: KaryawanRow;
  onClose: () => void;
}

const roleLabels: Record<string, string> = {
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

function formatTanggal(value: string | null | undefined): string {
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

// [F3-INERTIA] Detail User sebagai modal overlay di tab Karyawan (dulu halaman /karyawan/{id}, Show.tsx).
// Murni tampilan: datanya baris dari props list, tidak ada request.
export default function KaryawanDetailModal({ user, onClose }: Props) {
  const isAktif = user.status !== 'nonaktif';

  return (
    <RouteModal
      title="Detail Karyawan"
      description="Informasi profil dan penempatan kerja karyawan."
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-6">
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
                {roleLabels[user.role] ?? user.role}
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

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-xs transition cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </RouteModal>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 text-sm">
      <span className="w-52 text-slate-500 dark:text-zinc-400 text-xs sm:text-sm font-medium shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-zinc-100 font-semibold break-words mt-0.5 sm:mt-0 flex-1">
        {value || '-'}
      </span>
    </div>
  );
}
