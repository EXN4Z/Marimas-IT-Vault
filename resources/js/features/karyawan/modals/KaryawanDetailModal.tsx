import type { ReactNode } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import Modal from '../../../components/modal/Modal';
import type { KaryawanRow } from '../types';

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
    <Modal
      title="Detail Karyawan"
      description="Informasi profil dan penempatan kerja karyawan."
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-5 border-b border-line-200">
          <div className="w-14 h-14 rounded-full bg-surface-100 border border-line-200 flex items-center justify-center text-lg font-bold text-ink-800 shrink-0 dark:border dark:border-[#38383e]">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-ink-900 leading-tight truncate">
                {user.name}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  user.role === 'admin'
                    ? 'bg-tint-rose-50 text-tone-rose-700 border border-edge-rose-200'
                    : 'bg-surface-100 text-ink-700 border border-line-200 dark:border dark:border-[#38383e]'
                }`}
              >
                <ShieldCheck size={12} />
                {roleLabels[user.role] ?? user.role}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isAktif
                    ? 'bg-tint-emerald-50 text-tone-emerald-700 border border-edge-emerald-200'
                    : 'bg-surface-100 text-ink-500 border border-line-200 dark:border dark:border-[#38383e]'
                }`}
              >
                <CheckCircle2 size={12} />
                {isAktif ? 'Akun Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-1 font-medium">
              {user.departemen?.nama || 'Tanpa Departemen'}
              {user.cabang?.nama ? ` · ${user.cabang.nama}` : ''}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">
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
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">
            Penempatan Kerja
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            <DetailRow label="Departemen" value={user.departemen?.nama} />
            <DetailRow label="Perusahaan" value={user.perusahaan?.nama} />
            <DetailRow label="Cabang / Lokasi Kantor" value={user.cabang?.nama} />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-line-100">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-5 py-2.5 rounded-xl border border-line-200 bg-surface text-ink-700 hover:bg-hover-50 shadow-xs transition cursor-pointer active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 text-sm">
      <span className="w-52 text-ink-500 text-xs sm:text-sm font-medium shrink-0">{label}</span>
      <span className="text-ink-900 font-semibold break-words mt-0.5 sm:mt-0 flex-1">
        {value || '-'}
      </span>
    </div>
  );
}
