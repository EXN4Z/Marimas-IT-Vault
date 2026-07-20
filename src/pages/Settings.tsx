import { useState } from 'react';
import { User as UserIcon, Mail, Phone, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  hr: 'HR',
  manajer: 'Manajer',
  manager: 'Manajer',
  karyawan: 'Karyawan',
};

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Settings() {
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDirty =
    name !== (user?.name ?? '') ||
    email !== (user?.email ?? '') ||
    phone !== (user?.phone ?? '');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Nama tidak boleh kosong.');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setUser({ ...user, ...updated });
      setSuccess('Profil berhasil diperbarui.');
    } catch (err: any) {
      const message =
        err.response?.data?.errors?.email?.[0] ||
        err.response?.data?.errors?.phone?.[0] ||
        err.response?.data?.message ||
        'Gagal memperbarui profil. Coba lagi.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Settings">
      <p className="text-sm text-slate-500 mb-6">Kelola informasi akun kamu di sini.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KARTU IDENTITAS */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center h-fit">
          <div className="w-20 h-20 rounded-full bg-slate-900 text-white text-2xl font-bold flex items-center justify-center mb-4">
            {initials(user?.name)}
          </div>
          <p className="text-base font-semibold text-slate-900 break-words">{user?.name}</p>
          <p className="text-sm text-slate-400 mb-3 break-all">{user?.email}</p>
          {user?.role && (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {roleLabels[user.role] ?? user.role}
            </span>
          )}
        </div>

        {/* FORM PROFIL SAYA */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Profil Saya</h3>
          <p className="text-sm text-slate-400 mb-5">Perbarui nama, email, dan nomor HP kamu.</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nama</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={255}
                  placeholder="Nama lengkap"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">No. HP</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving || !isDirty}
              className="self-start flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}